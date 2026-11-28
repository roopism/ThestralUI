import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.module.kotlin.KotlinModule;
import java.awt.image.BufferedImage;
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

    private static Object iosElements(Maestro maestro) throws ReflectiveOperationException {
        // Maestro's own iOS tree drops the XCTest element type. Read the raw snapshot from the
        // same driver so the scenario adapter can verify each target's native role.
        var driver = maestro.getDriver();
        var field = driver.getClass().getDeclaredField("iosDevice");
        field.setAccessible(true);
        var device = field.get(driver);
        var snapshot = Class.forName("device.IOSDevice").getMethod("viewHierarchy", boolean.class).invoke(device, false);
        if (snapshot == null) throw new IllegalStateException("Missing raw iOS hierarchy");
        return snapshot.getClass().getMethod("getAxElement").invoke(snapshot);
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
                            } else if (op.equals("button-pixels")) {
                                Path image = step.resolve("dark-button.png");
                                final Method capture = method(Maestro.class, "takeScreenshot", android ? 3 : 2);
                                if (android) {
                                    BuildersKt.runBlocking(EmptyCoroutineContext.INSTANCE,
                                        (scope, cont) -> invoke(capture, maestro, image.toFile(), false, cont));
                                } else {
                                    invoke(capture, maestro, image.toFile(), false);
                                }
                                var deviceInfo = maestro.getCachedDeviceInfo();
                                var rect = fields.required("rect");
                                var bitmap = javax.imageio.ImageIO.read(image.toFile());
                                var counts = NativeButtonPixels.count(bitmap,
                                    android ? bitmap.getWidth() : deviceInfo.getWidthGrid(),
                                    android ? bitmap.getHeight() : deviceInfo.getHeightGrid(),
                                    rect.required("x").intValue(), rect.required("y").intValue(),
                                    rect.required("right").intValue(), rect.required("bottom").intValue(),
                                    Integer.decode(fields.required("fill").asText()), Integer.decode(fields.required("label").asText()));
                                publish(step.resolve("counts.json"), counts);
                            } else if (op.equals("android-xml") && android) {
                                Files.writeString(step.resolve("nodes.xml"), androidHierarchy(maestro));
                            } else if (op.equals("ios-elements") && !android) {
                                publish(step.resolve("elements.json"), iosElements(maestro));
                            } else if (op.equals("ios-roles") && !android) {
                                publish(step.resolve("roles.json"), iosElements(maestro));
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

// The trusted phone wrapper compiles MaestroSession.java as a single source.
final class NativeButtonPixels {
    static Map<String, Integer> count(BufferedImage image, int gridWidth, int gridHeight,
            int x, int y, int right, int bottom, int fill, int label) {
        if (gridWidth <= 0 || gridHeight <= 0 || x < 0 || y < 0 || right <= x || bottom <= y
                || right > gridWidth || bottom > gridHeight || fill == label)
            throw new IllegalArgumentException("Invalid Button bounds, screen grid or token colors");
        // XCTest and Android provide accessibility bounds in their own coordinate grids.
        int leftPixel = (int) Math.ceil((double) x * image.getWidth() / gridWidth);
        int topPixel = (int) Math.ceil((double) y * image.getHeight() / gridHeight);
        int rightPixel = (int) Math.floor((double) right * image.getWidth() / gridWidth);
        int bottomPixel = (int) Math.floor((double) bottom * image.getHeight() / gridHeight);
        int fillCount = 0, labelCount = 0;
        for (int row = topPixel; row < bottomPixel; row++) {
            for (int col = leftPixel; col < rightPixel; col++) {
                int rgb = image.getRGB(col, row) & 0xffffff;
                if (rgb == fill) fillCount++;
                if (rgb == label) labelCount++;
            }
        }
        return Map.of("pixels", (rightPixel - leftPixel) * (bottomPixel - topPixel),
                "fill", fillCount, "label", labelCount, "gridWidth", gridWidth, "gridHeight", gridHeight);
    }
}
