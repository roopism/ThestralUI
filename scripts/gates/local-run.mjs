import { trustedVerdict } from './verdict.mjs';
import { shutdownSimulators, usingSimulator, withTiming } from '../workers/resource-guard.mjs';
import { publishFirstReceipt } from './receipt-history.mjs';
import { readAttempt } from './qualification-attempt.mjs';
import { reviewPolicy } from './review/qualification-policy.mjs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, globSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { qualificationStatus, runWithIntegrationReservation } from './qualification-policy.mjs';
import { randomUUID } from 'node:crypto';
import { releaseLocksOnSignal, withLock } from '../workers/lock.mjs';
import { deviceScope } from '../selection/local-device.mjs';
import { browserMatrix, scenarioMatrix } from '../../packages/policy/quality/browser-matrix.mjs';
import { verifyCandidatePassed } from '../../packages/policy/quality/api-depth/evidence.mjs';
import { packedDepth, checkNewBudgets } from '../../packages/policy/quality/check-staged.mjs';
import { verifyPackedCeiling } from '../../packages/policy/quality/size-ceiling.mjs';
import { fast, typed, browserRosters } from './fast-typed.mjs';
import { linuxBrowsers, stopVm } from './linux-vm.mjs';

releaseLocksOnSignal();
const read = file => JSON.parse(readFileSync(file, 'utf8'));
const run = (bin, ...args) => execFileSync(bin, args, { stdio: 'inherit' });
const node = (...args) => run(process.execPath, ...args);
const root = process.argv[2], base = process.argv[3], commit = process.argv[4], mode = process.argv[5];
const tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim();
const common = process.env.ULD_ARTIFACT_COMMON;
const directory = join(common, 'uld-receipts');
const initial = mode === 'hook' ? { id: randomUUID(), started: new Date().toISOString() }
  : readAttempt(directory, process.argv[6], base, commit, tree, mode);
const id = initial.id;
const scope = deviceScope(root, base, tree, mode === 'release');
writeFileSync('.git/gate-selection.json', JSON.stringify({ budgetComparisonBase: base }));
const receipt = { ...initial, schema: 1, tree, base, commit, id, mode, scope,
  status: 'running', vm: null, devices: {}, suites: [] };
const steps = new Map();
function step(name, operation, dependencies = []) {
  const entry = { name, result: 'pending', durationMs: 0 };
  steps.set(name, { operation, entry, dependencies });
  receipt.suites.push(entry);
}
function save(final = false) {
  if (mode === 'hook') return;
  mkdirSync(join(directory, 'attempts'), { recursive: true });
  const body = JSON.stringify(receipt, null, 2) + '\n';
  const attempt = join(directory, 'attempts', id + '.json');
  const tmp = attempt + '.tmp';
  writeFileSync(tmp, body, { mode: 0o600 });
  renameSync(tmp, attempt);
  if (final) publishFirstReceipt(directory, tree, id);
}
function runDevice(script, reports, platform) {
  try { node(script); } finally {
    const root = join('test-results', reports);
    const versions = globSync(['device.json', '*/device.json'], { cwd: root }).map(file => read(join(root, file)));
    receipt.devices[platform] = platform === 'iphone' ? versions[0] ?? null : versions;
    const patterns = ['device.json', '*/device.json', 'maestro-session-*/ready.json', '*/maestro-session-*/ready.json',
      '{maestro-session-*,*/maestro-session-*}/*/{request.json,reply.json,suite.json,junit.xml,nodes.xml}',
      '*/timing-source.json', '*/frame-trial-*/*.txt', '*/frame-measurements.json', '*/motion-target.json', '*/ripple.json'];
    for (const file of globSync(patterns, { cwd: root })) {
      const target = join(directory, 'attempts', id + '-evidence', platform, file);
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(join(root, file), target);
    }
    const timing = join(root, 'low-end/timing-source.json');
    if (platform === 'android' && existsSync(timing)) receipt.androidTiming = read(timing);
  }
}
async function execute(name) {
  const { operation, entry, dependencies } = steps.get(name);
  if (dependencies.some(key => steps.get(key).entry.result !== 'passed')) {
    entry.result = 'blocked';
    entry.reason = 'Prerequisite failed';
    save();
    return;
  }
  const start = performance.now();
  try {
    if (['No weakening', 'Fast', 'iPhone Simulator', 'Android standard and low-end', 'Mac browser performance'].includes(name)) await operation(entry);
    else await withTiming('activity', name, () => operation(entry));
    if (entry.result === 'pending') entry.result = 'passed';
  }
  catch (error) { entry.result = 'failed'; entry.reason = String(error.message).slice(0, 2000); console.error(name, entry.reason); }
  finally { entry.durationMs = Math.round(performance.now() - start); save(); }
}
const trustedGate = file => fileURLToPath(new URL(file, import.meta.url));
step('No weakening', () => {
  assert.deepEqual(reviewPolicy(root, base, tree), []);
  node(trustedGate('no-weakening.mjs'), base, tree, root);
  node(trustedGate('canaries.mjs'), tree);
  node(trustedGate('device-scope-canaries.mjs'), tree);
  node(trustedGate('maestro-canary.mjs'), '--offline');
  const tests = globSync('*.test.mjs', { cwd: trustedGate('tests/') }).sort();
  assert.ok(tests.includes('hardening.test.mjs'));
  node('--test', ...tests.map(file => trustedGate('tests/' + file)));
});
step('Fast', fast);
step('Typed and unit rosters', typed, ['Fast', 'No weakening']);
if (mode !== 'hook') {
  step('Browser and visual rosters', browserRosters, ['Typed and unit rosters']);
  const preflight = ['Typed and unit rosters', 'Browser and visual rosters'];
  step('Catalog build', () => run('node_modules/.bin/storybook', 'build', '-o', 'dist/catalog', '--disable-telemetry'), preflight);
  step('Packed component specifications', packedDepth, preflight);
  for (const range of ['min', 'max']) step('Packed consumers ' + range, () =>
    node(trustedVerdict('verify-consumers.mjs'), 'release/evidence', range), preflight);
  step('Packed bundle limits', async () => {
    await checkNewBudgets(root, base, read('release/evidence/bundles.json'));
    verifyPackedCeiling(process.cwd());
  }, ['Packed consumers max']);
  step('Portable web scenarios', () => scenarioMatrix(), ['Catalog build']);
  step('Mac browser behavior', () => {
    const path = 'tests/acceptance/browser-matrix.json';
    browserMatrix(path);
    const { cases, projects } = read(path);
    verifyCandidatePassed('browser', cases, projects);
  }, ['Catalog build']);
  step('Mac visual comparisons', () => browserMatrix('tests/acceptance/visual-matrix.json', 'tests/browser/motion.visual.config.ts'), ['Catalog build']);
  step('Scoped styles', () => node('tests/browser/quality-style-scope.mjs'), ['Catalog build']);
  step('Mac browser performance', () => usingSimulator('Mac browser performance', async () => {
    await stopVm();
    shutdownSimulators();
    node('tests/browser/quality-perf.mjs');
  }), ['Catalog build']);
  step('Native package consumer', () => node(trustedVerdict('verify-native-consumer.mjs'), 'release/evidence'), preflight);
  step('Linux browser behavior', async () => { receipt.vm = await linuxBrowsers(root, commit, metadata => { receipt.vm = metadata; save(); }); }, preflight);
  step('iPhone Simulator', async entry => {
    if (!scope.iphone) { entry.result = 'web-only'; entry.reason = 'Every input was verified web-only'; return; }
    await stopVm();
    await withLock(root, 'simulator', 'iPhone ' + tree, () => {
      runDevice(trustedVerdict('verify-ios-simulator.mjs'), 'ios-simulator', 'iphone');
      receipt.devices.iphone = read('release/evidence/ios-simulator.json');
      assert.equal(receipt.devices.iphone.passed, true);
    });
  }, preflight);
  step('Android standard and low-end', async () => {
    await stopVm();
    await withLock(root, 'simulator', 'Android ' + tree, () => {
      runDevice(trustedVerdict('verify-android-emulator.mjs'), 'android-emulator', 'android');
      const android = read('release/evidence/android-emulator.json');
      assert.equal(android.passed, true);
      receipt.devices.android = android.profiles.map(({ id, hardware }) => ({ id, hardware }));
    });
  }, preflight);
}
save();
try {
  await execute('No weakening');
  await execute('Fast');
  if (receipt.suites.slice(0, 2).every(row => row.result === 'passed')) {
    await runWithIntegrationReservation(mode, root, tree, async () => {
      if (mode !== 'hook') await stopVm();
      writeFileSync('.git/local-device-scope.json', JSON.stringify(scope));
      for (const name of [...steps.keys()].slice(2)) await execute(name);
    });
  }
} catch (error) { receipt.error = String(error.message); }
finally {
  for (const row of receipt.suites) if (row.result === 'pending') { row.result = 'blocked'; row.reason = receipt.error ?? 'Preflight failed'; }
  receipt.status = qualificationStatus(receipt.suites, receipt.error);
  receipt.finished = new Date().toISOString();
  save(true);
  console.table(receipt.suites.map(({ name, result, durationMs }) => ({ name, result, durationMs })));
  if (receipt.status !== 'passed') process.exitCode = 1;
}
