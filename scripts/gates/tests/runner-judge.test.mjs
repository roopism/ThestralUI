import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { verifiedTimingSkip } from '../proposal-timing.mjs';
import { phases, runPreflight } from '../../verify-preflight.mjs';
import { preflightRunner, publishPreflightVerdict } from '../preflight-receipt.mjs';
import { EventEmitter } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import { passing, required } from '../../land.mjs';
import { startAttempt } from '../qualification-attempt.mjs';
import { fixtureGit, isolateFixtureProcess } from './fixtures/hermetic-git.mjs';

isolateFixtureProcess();

async function qualification(t, failures, driver) {
  const root = mkdtempSync(join(tmpdir(), 'qualification-judge-'));
  const git = (...args) => fixtureGit(root, args);
  git('init', '--quiet', '--template=');
  if (driver) {
    const write = (path, body) => {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), body);
    };
    for (const name of ['verify-preflight', 'gates/local-run', 'gates/qualification-attempt', 'gates/reuse/preflight', 'gates/reuse/strength'])
      write('scripts/' + name + '.mjs', '');
    const helper = new URL('../preflight-judges.mjs', import.meta.url);
    write('scripts/gates/preflight-judges.mjs', readFileSync(helper));
    for (const name of ['qualification-attempt', 'preflight-receipt'])
      write('scripts/gates/' + name + '.mjs', 'export * from ' + JSON.stringify(new URL('../' + name + '.mjs', import.meta.url).href));
    write('scripts/gates/no-weakening.mjs', 'export function noWeakening() { if (!process.env.FIXTURE_TRUSTED_JUDGE) throw Error("Missing snapshot environment"); return ' + JSON.stringify(driver.outer ?? []) + '; }');
    write('scripts/gates/review/qualification-policy.mjs', 'export const reviewPolicy = () => []');
    git('add', 'scripts');
  }
  const roster = { projects: ['fixture'], cases: ['appearance'] };
  mkdirSync(join(root, 'tests/acceptance'), { recursive: true });
  writeFileSync(join(root, 'tests/acceptance/visual-matrix.json'), JSON.stringify(roster));
  if (driver?.gateOnly) git('add', 'tests');
  git('commit', '--quiet', '--allow-empty', '-m', 'base');
  const base = git('rev-parse', 'HEAD');
  if (driver?.gateOnly) {
    const path = 'scripts/gates/no-weakening.mjs';
    writeFileSync(join(root, path), '\n// gate revision\n', { flag: 'a' });
    git('add', path);
  } else git('add', 'tests');
  git('commit', '--quiet', '-m', 'proposal');
  const commit = git('rev-parse', 'HEAD'), tree = git('rev-parse', 'HEAD^{tree}');
  const common = join(root, '.git'), directory = join(common, 'uld-receipts');
  const { id } = driver ? { id: randomUUID() } : startAttempt(root, directory, base, commit, tree, 'qualification');
  let attemptId = driver ? undefined : id;
  const previous = { cwd: process.cwd(), argv: process.argv, env: process.env, exitCode: process.exitCode };
  t.after(() => {
    process.chdir(previous.cwd);
    process.argv = previous.argv;
    process.env = previous.env;
    process.exitCode = previous.exitCode;
    rmSync(root, { recursive: true, force: true });
  });
  process.chdir(root);
  process.argv = [process.execPath, 'local-run.mjs', root, base, commit, 'qualification', id, '--no-reuse'];
  process.env = { ...process.env, ULD_ARTIFACT_COMMON: common };
  process.exitCode = 0;
  const calls = [];
  let functional = false, measurement;
  const boundary = (name) => {
    calls.push(name);
    if (failures.includes(name)) throw Object.assign(Error(name + ' finding'), { status: 1 });
  };
  const url = new URL('../local-run.mjs?' + id, import.meta.url).href;
  // Keep the runner, scheduler, receipt store and landing check real. Substitute the hardware and suite processes.
  const stubs = {
    'node:child_process': {
      execFileSync(tool, args) {
        if (tool === 'git') return git(...args);
        assert.equal(tool, process.execPath);
        boundary(basename(args[0]));
      },
      spawn(tool, args) {
        assert.equal(tool, process.execPath);
        const group = args.includes('--reuse-operation') ? args.at(-1) : [basename(args[0]), args[2]?.startsWith('--') && args[2]].filter(Boolean).join(' ');
        if (group === 'mac-performance.mjs') assert.equal(measurement, 'macPerformance');
        if (group === 'verify-android-emulator.mjs --timing') assert.equal(measurement, 'androidTiming');
        const child = new EventEmitter();
        child.stdout = new PassThrough();
        child.stderr = new PassThrough();
        if (group === 'Mac visual comparisons') writeFileSync(join(common, 'visual-coverage-' + process.argv[6] + '.json'), JSON.stringify({ tree, ...roster }));
        setImmediate(() => {
          calls.push(group);
          child.stdout.end();
          child.stderr.end();
          child.emit('close', failures.includes(group) ? 1 : 0, null);
        });
        return child;
      },
    },
    './typed-tools.mjs': { requireTypedControls: () => boundary('typed controls') },
    './review/qualification-policy.mjs': { reviewPolicy: () => {
      calls.push('qualification policy');
      return failures.includes('qualification policy') ? ['policy finding'] : [];
    } },
    './no-weakening.mjs': { noWeakening: () => {
      calls.push('no-weakening.mjs');
      return failures.includes('no-weakening.mjs') ? ['no-weakening finding'] : [];
    } },
    './reuse/fingerprint.mjs': { gitInputs() { throw Error('Fixture has no reusable inputs'); } },
    './fast-typed.mjs': { fast: () => boundary('Fast') },
    '../selection/proposal-devices.mjs': { proposalDevices: () => ({ run: true }), proposalScope: () => ({ iphone: true, families: null }) },
    './linux-vm.mjs': { stopVm() {}, linuxBrowsers() { boundary('Linux'); return { browsers: ['fixture'] }; } },
    './android-host-activity.mjs': { waitForQuiet: () => ({}), quiet: () => true, sampleHost: () => ({}), observationIssues: () => [] },
    '../workers/lock.mjs': { releaseLocksOnSignal() {}, withLock: (_root, _name, _label, run) => run('fixture lease') },
    '../workers/resource-guard.mjs': {
      withTiming: (_mode, _name, run) => run(), shutdownSimulators() {},
      async withFunctionalDeviceGroup(_root, _name, run) {
        functional = true;
        try { return await run({}); } finally { functional = false; }
      },
    },
    '../workers/timing-reservation.mjs': {
      async withTimingReservation(_root, mode, stage, run) {
        if (mode === 'activity') return run({});
        assert.equal(mode, 'measurement');
        assert.equal(functional, false);
        assert.equal(measurement, undefined);
        measurement = stage;
        calls.push('reserve ' + stage);
        try { return await run({}); } finally { measurement = undefined; }
      },
    },
  };
  if (driver?.gateOnly) {
    delete stubs['../selection/proposal-devices.mjs'];
    stubs['./android-timing-reuse.mjs'] = { apkIdentity: () => ({}) };
    stubs['./android-host-activity.mjs'].observedIdentity = () => ({});
    stubs['./device-verdict.mjs'] = { functionalAndroidDevices: () => [] };
  }
  const command = new URL('../../qualify.mjs?' + id, import.meta.url).href;
  const bindings = { [url]: stubs };
  let preflight;
  if (driver) {
    git('update-ref', 'refs/remotes/origin/feat/enterprise-ui', base);
    const checks = await runPreflight({}, run => run({}), phases.map(phase => ({ ...phase, operation() {
      if (phase.check === driver.crash) throw Error('judge process broke');
      return phase.check === driver.finding || phase.name === driver.other ? [phase.name + ' issue'] : [];
    } })));
    if (driver.historical) {
      const hook = checks.find(row => row.name === 'Commit hook on the exact tree');
      const phase = hook.phases.find(row => row.name === 'each commit against its parent');
      hook.result = 'failed';
      Object.assign(phase, { result: 'failed', issues: [driver.historical], findings: [driver.historical] });
    }
    preflight = { schema: 1, kind: 'preflight', id, reuseSchema: 1, reuseStages: [], base, tree, commit, checks,
      runner: preflightRunner(root, base, commit), status: checks.every(row => row.result === 'passed') ? 'passed' : 'failed' };
    publishPreflightVerdict(root, common, preflight);
    process.argv = [process.execPath, 'qualify.mjs', ...(driver.gateOnly ? [] : ['--no-reuse']), commit];
    bindings[command] = {
      './workers/lock.mjs': { releaseLocksOnSignal() {} },
      '../packages/policy/quality/staged-tree.mjs': { withRevisionSnapshot: (_repo, rev, run) => run(root, git('rev-parse', rev + '^{tree}'), { ...process.env, FIXTURE_TRUSTED_JUDGE: '1' }) },
      '../packages/policy/quality/snapshot-dependencies.mjs': { installSnapshotDependencies() {} },
      './manifests/bundle-parent.mjs': { familyInputs: () => [], familyInputsAt: () => [] },
      './manifests/reviewed-bundle-budgets.mjs': { verifyFirstAdoptionSources() {} },
      'node:child_process': {
        execFileSync(tool, args, options) {
          if (driver.handoff && args[0]?.endsWith('/preflight-judges.mjs'))
            options = driver.handoff({ root, common, preflight, options });
          if (args[0]?.endsWith('/preflight-judges.mjs')) return execFileSync(tool, args, options);
          if (tool === 'git') return args[0] === 'fetch' ? '' : git(...args);
          assert.equal(tool, process.execPath);
          if (args[0].endsWith('no-weakening.mjs') && driver.outer?.length) throw Error('preliminary judge finding');
        },
        spawn(tool, args, options) {
          assert.equal(tool, process.execPath);
          assert.equal(args[0], join(root, 'scripts/gates/local-run.mjs'));
          const child = new EventEmitter();
          attemptId = args[5];
          process.argv = [tool, ...args];
          process.env = options.env;
          setImmediate(async () => {
            try { await import(url); child.emit('exit', process.exitCode, null); }
            catch (error) { child.emit('error', error); }
          });
          return child;
        },
      },
    };
  }
  globalThis[id] = bindings;
  const hooks = registerHooks({ resolve(name, context, next) {
    const modules = bindings[context.parentURL];
    if (!modules || !Object.hasOwn(modules, name)) return next(name, context);
    const source = ['export * from ' + JSON.stringify(next(name, context).url),
      ...Object.keys(modules[name]).map(key => 'export const ' + key + ' = globalThis[' + JSON.stringify(id) + '][' + JSON.stringify(context.parentURL) + '][' + JSON.stringify(name) + '].' + key)];
    return { url: 'data:text/javascript,' + encodeURIComponent(source.join('\n')), shortCircuit: true };
  } });
  mkdirSync('release/evidence', { recursive: true });
  writeFileSync('release/evidence/ios-simulator.json', JSON.stringify({ passed: true }));
  writeFileSync('release/evidence/android-emulator.json', JSON.stringify({ passed: true, profiles: [] }));
  let error;
  try { await import(driver ? command : url); } catch (cause) { if (!driver) throw cause; error = cause; } finally { hooks.deregister(); delete globalThis[id]; }
  const land = () => passing(tree, base, directory, { root, commit });
  if (driver && !existsSync(join(directory, tree + '.json'))) return { preflight, calls, land, error, directory };
  const receipt = JSON.parse(readFileSync(join(directory, tree + '.json')));
  if (attemptId) assert.equal(receipt.id, attemptId);
  assert.deepEqual(receipt, JSON.parse(readFileSync(join(directory, 'attempts', receipt.id + '.json'))));
  return { preflight, receipt, calls, error, exitCode: process.exitCode, land,
    seals: git('for-each-ref', '--format=%(refname)', 'refs/uld-archive/reuse-receipts') };
}

const lanes = ['mac', 'iphone', 'android', 'audit', 'macPerformance', 'androidTiming'];
const judges = ['qualification policy', 'no-weakening.mjs'];
function complete(receipt, calls, failedSuite) {
  assert.deepEqual(receipt.suites.map(row => [row.name, row.result]), required.map(name => [name, name === failedSuite ? 'failed' : 'passed']));
  assert.equal(receipt.gateTests.result, 'passed');
  for (const command of ['verify-ios-simulator.mjs --functional', 'verify-android-emulator.mjs --functional',
    'mac-performance.mjs', 'verify-android-emulator.mjs --timing']) assert.ok(calls.includes(command), command);
  assert.deepEqual(Object.fromEntries(Object.entries(receipt.lanes).map(([name, row]) => [name, row.result])),
    Object.fromEntries(lanes.map(name => [name, 'passed'])));
  assert.deepEqual(calls.filter(call => judges.includes(call) || ['canaries.mjs', 'device-scope-canaries.mjs', 'maestro-canary.mjs',
    'native-role-canaries.mjs', 'Trusted gate tests', 'Fast', 'Linux', 'reserve macPerformance', 'reserve androidTiming'].includes(call)),
    [...judges, 'canaries.mjs', 'device-scope-canaries.mjs', 'maestro-canary.mjs', 'native-role-canaries.mjs', 'Trusted gate tests',
      'Fast', 'Linux', 'reserve macPerformance', 'reserve androidTiming']);
}

test('judge findings retain every lane and exclusive timed verdict and prevent landing', async t => {
  for (const failures of [[judges[0]], [judges[1]], judges]) await t.test(failures.join(' and '), async t => {
    const { receipt, calls, land, seals, exitCode } = await qualification(t, failures);
    assert.equal(receipt.status, 'failed');
    assert.equal(exitCode, 1);
    assert.equal(seals, '');
    assert.deepEqual(receipt.suites[0].findings,
      failures.map(name => name === 'qualification policy' ? 'policy finding' : 'no-weakening finding'));
    assert.throws(land, /failed qualification.*prevents landing/);
    complete(receipt, calls, 'No weakening');
  });
});

test('passing judges preserve the ordered qualification and seal its passing receipt', async t => {
  const { receipt, calls, seals, exitCode } = await qualification(t, []);
  assert.equal(receipt.status, 'passed');
  assert.equal(exitCode, 0);
  assert.equal(seals, 'refs/uld-archive/reuse-receipts/' + receipt.id);
  complete(receipt, calls);
});

test('Fast and non-judge preflight failures still block downstream work', async t => {
  for (const failures of [['Fast'], ['qualification policy', 'Fast'], ['canaries.mjs'], ['Trusted gate tests']]) await t.test(failures.join(' and '), async t => {
    const { receipt, calls, exitCode } = await qualification(t, failures);
    assert.equal(exitCode, 1);
    assert.equal(receipt.status, 'failed');
    assert.equal(receipt.suites.find(row => row.name === (failures.includes('Fast') ? 'Fast' : 'No weakening')).result, 'failed');
    assert.ok(receipt.suites.slice(2).every(row => row.result === 'blocked'));
    assert.equal(receipt.lanes, undefined);
    assert.ok(calls.includes('Fast'));
    assert.ok(!calls.includes('Linux'));
  });
});

test('a functional failure beside a judge finding preserves independent timing evidence', async t => {
  const { receipt, exitCode } = await qualification(t, ['qualification policy', 'Mac browser behavior']);
  assert.equal(exitCode, 1);
  assert.equal(receipt.status, 'failed');
  assert.equal(receipt.suites.find(row => row.name === 'No weakening').result, 'failed');
  assert.equal(receipt.suites.find(row => row.name === 'Mac browser behavior').result, 'failed');
  assert.deepEqual(Object.fromEntries(lanes.map(name => [name, receipt.lanes[name].result])),
    { mac: 'failed', iphone: 'passed', android: 'passed', audit: 'passed', macPerformance: 'passed', androidTiming: 'passed' });
});

test('qualify runs every lane after sealed preflight judge findings and land refuses its failed receipt', async t => {
  const result = await qualification(t, [], { finding: 'Qualification policy review', outer: ['preliminary finding'] });
  assert.equal(result.preflight.status, 'failed');
  assert.ok(result.preflight.checks.every(row => row.result === (row.name === 'Qualification policy review' ? 'failed' : 'passed')));
  assert.equal(result.receipt?.status, 'failed', result.error?.message);
  assert.deepEqual(new Set(result.receipt.suites[0].findings), new Set(['integration base issue', 'preliminary finding']));
  assert.equal(result.exitCode, 1);
  assert.equal(result.seals, '');
  assert.throws(result.land, /failed qualification.*prevents landing/);
  complete(result.receipt, result.calls, 'No weakening');
});

test('qualify records a preliminary judge finding even after a clean preflight', async t => {
  const result = await qualification(t, [], { outer: ['preliminary finding'] });
  assert.equal(result.preflight.status, 'passed');
  assert.deepEqual(result.receipt?.suites[0]?.findings, ['preliminary finding'], result.error?.message);
  assert.equal(result.receipt.status, 'failed');
  assert.equal(result.exitCode, 1);
  assert.throws(result.land, /failed qualification.*prevents landing/);
  complete(result.receipt, result.calls, 'No weakening');
});

test('qualify refuses other preflight failures and judge errors before any landing receipt exists', async t => {
  for (const driver of [{ other: 'Fast', finding: 'No weakening' }, { other: 'branch paths' }, { crash: 'No weakening' }]) await t.test(driver.other ?? driver.crash, async t => {
    const result = await qualification(t, [], driver);
    assert.equal(result.preflight.status, 'failed');
    assert.match(result.error?.message ?? '', /Qualification refused/);
    assert.deepEqual(result.calls, []);
    assert.equal(existsSync(join(result.directory, 'attempts')), false);
    assert.equal(result.land(), undefined);
  });
});

test('ordinary gate-only qualification measures both stages after a judge finding', async t => {
  const { receipt, calls, land } = await qualification(t, [judges[0]], { gateOnly: true });
  assert.deepEqual(verifiedTimingSkip(process.cwd(), receipt)?.files, ['scripts/gates/no-weakening.mjs']);
  assert.deepEqual(calls.filter(call => call.startsWith('reserve ')), ['reserve macPerformance', 'reserve androidTiming']);
  complete(receipt, calls, 'No weakening');
  assert.equal(receipt.status, 'failed');
  assert.throws(land, /failed qualification.*prevents landing/);
});

test('ordinary passing gate-only qualification keeps its verified timing skip', async t => {
  const { receipt, calls } = await qualification(t, [], { gateOnly: true });
  assert.equal(receipt.status, 'passed');
  for (const stage of ['macPerformance', 'androidTiming'])
    assert.deepEqual(receipt.lanes[stage], { result: 'skipped', reason: 'gate-only change', files: ['scripts/gates/no-weakening.mjs'] });
  assert.deepEqual(calls.filter(call => call.startsWith('reserve ')), []);
});

test('the trusted handoff retains the admitted parent finding when the launcher omits it', async t => {
  const historical = 'parent commit judge finding';
  const result = await qualification(t, [], { historical, handoff({ root, common, preflight, options }) {
    const checks = preflight.checks.map(row => ({ ...row, result: 'passed', phases: row.phases.map(phase => ({ name: phase.name, result: 'passed' })) }));
    publishPreflightVerdict(root, common, { ...preflight, id: randomUUID(), status: 'passed', checks });
    return { ...options, stdio: ['pipe', 'inherit', 'inherit'], input: JSON.stringify({ id: preflight.id, findings: [] }) };
  } });
  assert.deepEqual(result.receipt?.suites[0]?.findings, [historical], result.error?.message);
  assert.equal(result.receipt.preflightId, result.preflight.id);
  assert.equal(result.receipt.status, 'failed');
  assert.throws(result.land, /failed qualification.*prevents landing/);
  complete(result.receipt, result.calls, 'No weakening');
});

test('the trusted handoff refuses a preflight attempt changed after admission', async t => {
  const result = await qualification(t, [], { handoff({ common, preflight, options }) {
    const path = join(common, 'uld-receipts/preflight/attempts', preflight.id + '.json');
    writeFileSync(path, JSON.stringify({ ...preflight, branch: 'changed' }, null, 2) + '\n');
    return options;
  } });
  assert.equal(result.receipt?.status, 'failed');
  assert.deepEqual(result.calls, []);
  assert.throws(result.land, /failed qualification.*prevents landing/);
});
