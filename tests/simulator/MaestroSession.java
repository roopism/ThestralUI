import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.module.kotlin.KotlinModule;
import java.lang.reflect.Method;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Set;
import kotlin.jvm.functions.Function1;
import maestro_android.MaestroAndroid.ViewHierarchyRequest;
import maestro_android.MaestroDriverGrpc;
import kotlin.coroutines.EmptyCoroutineContext;
import kotlinx.coroutines.BuildersKt;
import maestro.Maestro;
import maestro.cli.model.TestExecutionSummary;
import maestro.cli.report.JUnitTestSuiteReporter;
import maestro.cli.runner.TestSuiteInteractor;
import maestro.cli.session.MaestroSessionManager;
import maestro.orchestra.workspace.WorkspaceExecutionPlanner;
import okio.Buffer;

/** Keep the installed CLI's device session alive across flows and live hierarchy reads. */
public final class MaestroSession {
    private static final ObjectMapper JSON = new ObjectMapper()
        .registerModule(new KotlinModule.Builder().build()).setSerializationInclusion(JsonInclude.Include.NON_NULL);

    private static void publish(Path file, Object result) throws Exception {
        Path temporary = file.resolveSibling(file.getFileName() + ".tmp");
        JSON.writeValue(temporary.toFile(), result);
        Files.move(temporary, file, StandardCopyOption.ATOMIC_MOVE);
    }

    private static Method method(Class<?> owner, String name, int count) {
        for (Method candidate : owner.getDeclaredMethods()) {
            if (candidate.getName().equals(name) && candidate.getParameterCount() == count) return candidate;
        }
        throw new IllegalStateException("Unsupported Maestro CLI method " + name);
    }

    private static Object invoke(Method method, Object receiver, Object... args) {
        try { return method.invoke(receiver, args); }
        catch (ReflectiveOperationException failure) { throw new IllegalStateException(method.getName(), failure); }
    }

    private static final int ANDROID_PORT = 6209;

    private static String androidHierarchy(Maestro maestro) throws ReflectiveOperationException {
        // Use the existing CLI connection, including its device-specific transport.
        // The OS node XML retains class, checkable and focusable attributes.
        var driver = maestro.getDriver();
        var connection = invoke(method(driver.getClass(), "access$getConnection$p", 1), null, driver);
        Function1<MaestroDriverGrpc.MaestroDriverBlockingStub, String> read =
            stub -> stub.viewHierarchy(ViewHierarchyRequest.getDefaultInstance()).getHierarchy();
        var response = invoke(method(connection.getClass(), "execute", 2), connection, "viewHierarchy", read);
        var unwrap = Class.forName("maestro.android.AndroidDeviceConnectionModelKt")
            .getMethod("orThrow", Class.forName("maestro.android.DeviceResponse"));
        return (String) unwrap.invoke(null, response);
    }

    public static void main(String[] args) throws Exception {
        Path dir = Path.of(args[0]).toRealPath();
        String device = args[1], platform = args[2];
        boolean android = platform.equals("android");
        int status = MaestroSessionManager.INSTANCE.newSession(null, null, android ? ANDROID_PORT : null,
            device, null, platform, false, false, null, true, null, null, session -> {
                try {
                    Maestro maestro = session.getMaestro();
                    Object reporter = invoke(method(JUnitTestSuiteReporter.Companion.getClass(), "xml", android ? 2 : 1),
                        JUnitTestSuiteReporter.Companion, android ? new Object[]{device, ZoneId.systemDefault()} : new Object[]{device});
                    Object[] ctor = android
                        ? new Object[]{maestro, session.getDevice(), reporter, null, false, false}
                        : new Object[]{maestro, session.getDevice(), reporter, null, false};
                    var constructor = java.util.Arrays.stream(TestSuiteInteractor.class.getConstructors())
                        .filter(c -> c.getParameterCount() == ctor.length).findFirst().orElseThrow();
                    Object tester = constructor.newInstance(ctor);
                    final Method run = method(TestSuiteInteractor.class, "runTestSuite", android ? 6 : 7);
                    final Method hierarchy = method(Maestro.class, android ? "viewHierarchy-8JJjmZI$default"
                        : "viewHierarchy-c1iYVAs$default", android ? 5 : 4);
                    publish(dir.resolve("ready.json"), Map.of("device", device, "pid", ProcessHandle.current().pid()));
                    for (int seq = 1; ; seq++) {
                        Path step = dir.resolve(Integer.toString(seq)), request = step.resolve("request.json");
                        while (!Files.exists(request)) Thread.sleep(20);
                        JsonNode fields = JSON.readTree(request.toFile());
                        String op = fields.required("op").asText();
                        try {
                            if (op.equals("quit")) {
                                publish(step.resolve("reply.json"), Map.of("ok", true));
                                return 0;
                            } else if (op.equals("android-xml") && android) {
                                Files.writeString(step.resolve("nodes.xml"), androidHierarchy(maestro));
                            } else if (op.equals("reconnect-ios") && !android) {
                                // A cold simulator boot terminates its XCTest runner. Keep the CLI
                                // and Maestro session, and reopen the same driver's transport.
                                var transport = maestro.getDriver();
                                invoke(method(transport.getClass(), "open", 0), transport);
                            } else if (op.equals("hierarchy")) {
                                Object tree = android ? BuildersKt.runBlocking(EmptyCoroutineContext.INSTANCE,
                                    (scope, cont) -> invoke(hierarchy, null, maestro, false, cont, 1, null))
                                    : invoke(hierarchy, null, maestro, false, 1, null);
                                if (tree == null) throw new IllegalStateException("Missing live hierarchy");
                                // On suspend completion Kotlin may return its boxed value class.
                                if (tree.getClass().getName().equals("maestro.ViewHierarchy"))
                                    tree = invoke(method(tree.getClass(), "getRoot", 0), tree);
                                publish(step.resolve("hierarchy.json"), tree);
                            } else if (op.equals("test")) {
                                Path flow = Path.of(fields.required("flow").asText());
                                Path artifacts = Path.of(fields.required("artifacts").asText());
                                Files.createDirectories(artifacts);
                                var plan = WorkspaceExecutionPlanner.INSTANCE.plan(Set.of(flow), List.of(), List.of(), null);
                                if (plan.getFlowsToRun().size() != 1) throw new IllegalStateException("Expected one flow");
                                Map<String,String> env = JSON.convertValue(fields.required("env"),
                                    new com.fasterxml.jackson.core.type.TypeReference<Map<String,String>>() {});
                                Buffer xml = new Buffer();
                                TestExecutionSummary summary = BuildersKt.runBlocking(EmptyCoroutineContext.INSTANCE,
                                    (scope, cont) -> android ? invoke(run, tester, plan, xml, env, artifacts, device, cont)
                                        : invoke(run, tester, plan, xml, env, artifacts, artifacts, device, cont));
                                publish(step.resolve("suite.json"), summary);
                                Files.write(step.resolve("junit.xml"), xml.readByteArray());
                                if (!summary.getPassed() || summary.getSuites().size() != 1 ||
                                    summary.getSuites().get(0).getFlows().size() != 1)
                                    throw new IllegalStateException("Maestro flow failed or did not execute exactly once");
                            } else throw new IllegalArgumentException("Unknown operation " + op);
                            publish(step.resolve("reply.json"), Map.of("ok", true));
                        } catch (Exception failure) {
                            failure.printStackTrace();
                            publish(step.resolve("reply.json"), Map.of("ok", false, "error", failure.toString()));
                        }
                    }
                } catch (Exception failure) { failure.printStackTrace(); return 1; }
            });
        System.exit(status);
    }
}
