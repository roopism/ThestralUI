import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { passing, required } from '../../land.mjs';
import { evidenceManifest, finishDiagnostic, reserveDiagnostic } from '../landing-evidence.mjs';
import { summarizeTrials } from '../../../tests/android/frame-budget.mjs';

import { admission, claimDiagnostic } from '../android-host-activity.mjs';
import { sealReceipt } from '../reuse/runner.mjs';
import { requireGateIsolation } from '../landing-policy.mjs';
import { deviceSuites } from '../device-verdict.mjs';
import { createObservationTestDirectory, dailyObservationFixture, dailyObservationFixtureFiles } from './fixtures/daily-observation.mjs';
import { observation, registerObservation } from '../../selection/device-observations.mjs';
import { proposalDevices, proposalScope } from '../../selection/proposal-devices.mjs';
import { fixtureGit, isolateFixtureProcess } from './fixtures/hermetic-git.mjs';

isolateFixtureProcess();

const android = 'Android standard and low-end', mac = 'Mac browser performance';
const timing = 'android/frame-budget';
const asJson = data => JSON.stringify(data) + '\n';
const iso = n => new Date(n).toISOString();
const namespace = 'uld-landing-evidence-v1';

function fixture(t, stage = 'Fast', features = [], scoped = false) {
  const temp = createObservationTestDirectory(t, 'uld-evidence-', 'repo');
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const root = join(temp, 'repo'), key = join(temp, 'key');
  mkdirSync(root);
  const git = (...args) => fixtureGit(root, args);
  const ssh = (...args) => execFileSync('/usr/bin/ssh-keygen', args, { stdio: 'pipe' });
  ssh('-q', '-t', 'ed25519', '-N', '', '-f', key);
  const signers = join(root, 'scripts/gates/landing-evidence.allowed-signers');
  mkdirSync(dirname(signers), { recursive: true });
  writeFileSync(signers, 'uld-qualification ' + readFileSync(key + '.pub', 'utf8'));
  git('init', '--quiet', '--template=');
  for (const file of ['tests/android/low-end-budget.json', 'tests/browser/quality-perf-baseline.json',
    'tests/browser/quality-perf.mjs', 'tests/browser/quality-perf-policy.mjs']) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    copyFileSync(new URL('../../../' + file, import.meta.url), join(root, file));
  }
  for (const path of features) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), '// Adopted in this fixture.\n');
  }
  const flows = ['appearance.yaml', 'workspace.yaml'];
  mkdirSync(join(root, 'tests/simulator'));
  for (const file of flows) writeFileSync(join(root, 'tests/simulator', file), 'appId: example.app\n---\n- launchApp\n');
  if (scoped) {
    const suiteInputs = 'tests/acceptance/suite-inputs.json';
    mkdirSync(dirname(join(root, suiteInputs)), { recursive: true });
    copyFileSync(new URL('../../../' + suiteInputs, import.meta.url), join(root, suiteInputs));
    for (const [file, body] of Object.entries({
      ...dailyObservationFixtureFiles(),
      'package.json': '{"workspaces":["packages/*"]}', 'tsconfig.json': '{}',
      'packages/native/package.json': '{"name":"@fixture/native"}',
      'packages/native/src/button.js': 'export const button = 1;',
      'packages/tokens/package.json': '{"name":"@fixture/tokens"}',
      'tests/simulator/host/package.json': '{}',
    })) {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      writeFileSync(join(root, file), body);
    }
  }
  git('add', '.');
  git('commit', '--quiet', '-m', 'base');
  const base = git('rev-parse', 'HEAD'), runnerTree = git('rev-parse', 'HEAD^{tree}');
  const changed = scoped ? 'README.md' : 'product';
  writeFileSync(join(root, changed), 'changed');
  git('add', changed);
  git('commit', '--quiet', '-m', 'proposal');
  const commit = git('rev-parse', 'HEAD'), tree = git('rev-parse', 'HEAD^{tree}');
  const directory = join(root, '.git', 'uld-receipts');
  const attempts = join(directory, 'attempts');
  mkdirSync(attempts, { recursive: true });
  const now = Date.now() - 120000;
  const hardware = { fingerprint: 'observed' };
  const record = () => ({ schema: 1, id: randomUUID(), commit, tree, base, mode: 'qualification', status: 'passed',
    started: iso(now), finished: iso(now + 20000), scope: { iphone: true, families: null },
    devices: { iphone: { passed: true }, android: [{ id: 'standard', hardware }, { id: 'low-end', hardware }] },
    vm: { browsers: 'engines', sourceImageSha256: 'fixture' }, suites: required.map(name => ({ name, result: 'passed', durationMs: 1 })) });
  const fail = record(), pass = { ...record(), started: iso(now + 60000), finished: iso(now + 70000) };
  const failure = fail.suites.find(s => s.name === stage);
  failure.result = 'failed';
  failure.reason = 'Command failed: suite runner';
  fail.status = 'failed';
  const reference = { ...structuredClone(fail), id: randomUUID(), commit: base, tree: runnerTree };
  const artifactDir = join(attempts, fail.id + '-evidence', 'landing');
  mkdirSync(artifactDir, { recursive: true });
  const save = (row, published = false) => {
    git('update-ref', 'refs/uld-archive/qualification-attempts/' + row.id, row.commit);
    writeFileSync(join(attempts, row.id + '.json'), asJson(row));
    if (published) writeFileSync(join(directory, row.tree + '.json'), asJson(row));
  };
  const check = (targetTree = tree, targetBase = base) => passing(targetTree, targetBase, directory, { root, commit });
  const put = (name, data) => writeFileSync(join(artifactDir, name), asJson(data));
  function sign(kind, ids, signingKey = key, changes = {}, id = fail.id) {
    const manifest = { ...evidenceManifest(root, directory, kind, id, ...ids), ...changes };
    const dir = join(attempts, id + '-evidence', 'landing');
    writeFileSync(join(dir, 'manifest.json'), asJson(manifest));
    writeFileSync(join(dir, 'manifest.json.sig'), execFileSync('/usr/bin/ssh-keygen',
      ['-Y', 'sign', '-f', signingKey, '-n', namespace, '-'], { input: asJson(manifest), stdio: ['pipe', 'pipe', 'pipe'] }));
    return manifest;
  }
  const errors = [{ suite: stage, check: 'shapes/required-field', error: 'row.email is missing' }];
  function baseEvidence() {
    save(reference);
    save(pass);
    put('failed-errors.json', errors);
    put('base-errors.json', errors);
    sign('base', [reference.id, pass.id]);
  }
  function contention(edit = () => {}) {
    const trial = { frames: 40, inputs: 10, p95FrameMs: 10, p95InputToCommitMs: 16, deadlineMissFraction: 0 };
    const stats = sample => summarizeTrials([sample, sample, sample]);
    const frames = { press: stats(trial), scroll: stats(trial) };
    const originalFrames = { ...frames, press: stats({ ...trial, p95FrameMs: 50 }) };
    const entryManifestSha256 = 'e'.repeat(64);
    fail.androidTiming = { result: 'timing measured', entryManifestSha256, frameBudget: originalFrames };
    const observedBase = features.includes('scripts/gates/android-host-activity.mjs');
    const low = join(attempts, fail.id + '-evidence', 'android', 'low-end');
    if (observedBase) {
      const { samples } = report('primary', now + 1000, 3);
      const apkSha256 = 'a'.repeat(64);
      const observed = { kind: 'primary', verdict: 'failed', numericVerdict: 'failed', policy: admission,
        identity: { tree, base, commit, attempt: fail.id, apkSha256, entryManifestSha256 },
        wait: [samples[0]], start: samples[0], samples: samples.slice(1),
        error: 'press trial 1 p95FrameMs 50 exceeds ' + JSON.parse(readFileSync(join(root, 'tests/android/low-end-budget.json'))).limits.press.p95FrameMs,
        frameSha256: createHash('sha256').update(JSON.stringify(originalFrames)).digest('hex') };
      fail.androidHostActivityPolicy = 1;
      Object.assign(fail.androidTiming, { result: 'timing failed', admission: observed, apkSha256 });
      mkdirSync(low, { recursive: true });
      writeFileSync(join(low, 'timing-admission.json'), asJson(observed));
      writeFileSync(join(low, 'frame-measurements.json'), asJson(originalFrames));
    }
    save(fail, true);
    const clock = t.mock.method(Date, 'now', () => now + 30000);
    const claim = reserveDiagnostic(root, directory, fail.id);
    clock.mock.restore();
    function report(kind, begin, load1) {
      return { tree, base, runnerTree, attempt: fail.id, suites: [timing], kind, begin, end: begin + 10000,
        entryManifestSha256, hardware, samples: [0, 5000, 10000].map(delta => ({ atMs: begin + delta, cpus: 2,
          hidIdleNs: String((120000 + delta) * 1e6), load1, loadPerCpu: load1 / 2 })) };
    }
    const limits = JSON.parse(readFileSync(join(root, 'tests/android/low-end-budget.json'))).limits;
    const primary = { ...report('primary', now + 1000, 3), limits, frames: originalFrames, functionalChecks: 'passed' };
    const diagnostic = { ...report('diagnostic', claim.at + 1, 1), limits: structuredClone(limits), frames, id: claim.id };
    const errors = [{ suite: stage, check: timing, error: 'press trial 1 p95FrameMs 50 exceeds ' + limits.press.p95FrameMs }];
    const roster = ['button.save-once', 'stack.child-order'];
    const profiles = fail.devices.android.map(info => ({ ...info, frameBudget: originalFrames, interaction: { heldPixels: 20 },
      passed: ['workspace-light', 'appearance-light', 'appearance-dark'], scenarioIds: roster }));
    const functional = { flows, roster, selected: roster, profiles, error: errors[0].error };
    if (stage === mac) {
      const policy = JSON.parse(readFileSync(join(root, 'tests/browser/quality-perf-baseline.json')));
      const metrics = Object.fromEntries(Object.entries(policy.budgets).map(([k, v]) => [k, v.baseline]));
      for (const r of [primary, diagnostic]) Object.assign(r, { suites: ['browser/timing-budget'], system: policy.system,
        limits: policy.budgets, metrics: { ...metrics } });
      primary.metrics.openP95Ms = 150;
      errors[0] = { suite: mac, check: 'browser/timing-budget', error: 'openP95Ms measured 150, baseline 34.7, allowed increase 40.3' };
    }
    edit({ primary, diagnostic, errors, functional, claim });
    const androidDir = join(attempts, fail.id + '-evidence', 'android');
    mkdirSync(androidDir, { recursive: true });
    writeFileSync(join(androidDir, 'final-budget-failure.json'), asJson(functional));
    put('failed-errors.json', errors);
    put('primary.json', primary);
    finishDiagnostic(directory, tree, claim.id, asJson(diagnostic));
    sign('contention', []);
    return { primary, diagnostic, claim };
  }
  save(fail, true);
  return { root, directory, git, tree, base, commit, runnerTree, pass, fail, reference, errors, check, save, sign,
    artifactDir, put, baseEvidence, contention, ssh, key };
}

test('base failure with matching unchanged-base evidence and a later full pass can land', t => {
  const f = fixture(t);
  f.fail.suites = f.fail.suites.slice(0, 2);
  f.reference.suites = f.reference.suites.slice(0, 2);
  f.save(f.fail, true);
  f.baseEvidence();
  assert.equal(f.check().id, f.pass.id);
  f.put('base-errors.json', [{ ...f.errors[0], error: 'a different field is missing' }]);
  f.sign('base', [f.reference.id, f.pass.id]);
  assert.throws(() => f.check());
});

test('base failure without an unchanged-base receipt is refused', t => {
  const f = fixture(t);
  f.baseEvidence();
  rmSync(join(f.directory, 'attempts', f.reference.id + '.json'));
  assert.throws(() => f.check(), /ENOENT/);
});

test('a quiet timing diagnostic preserves the failure and still needs a full pass', t => {
  const f = fixture(t, android);
  const { claim } = f.contention();
  assert.equal(f.check(), undefined);
  f.save(f.pass);
  const r = f.check();
  assert.equal(r.status, 'passed');
  assert.equal(r.landingEvidence[0].diagnostic, claim.id);
  assert.equal(JSON.parse(readFileSync(join(f.directory, f.tree + '.json'))).status, 'failed');
});

test('a diagnostic with a busy intermediate sample is refused', t => {
  const f = fixture(t, android);
  f.contention(({ diagnostic }) => { diagnostic.samples[1].hidIdleNs = '0'; });
  assert.throws(() => f.check(), /not quiet/);
});

test('a second diagnostic reservation or result cannot replace the first', t => {
  const f = fixture(t, android);
  const { claim, diagnostic } = f.contention();
  assert.throws(() => reserveDiagnostic(f.root, f.directory, f.fail.id), /EEXIST/);
  finishDiagnostic(f.directory, f.tree, claim.id, asJson(diagnostic));
  assert.throws(() => finishDiagnostic(f.directory, f.tree, claim.id, asJson({ ...diagnostic, end: diagnostic.end + 1 })), /second diagnostic/);
  f.save(f.pass);
  assert.equal(f.check().id, f.pass.id);
});

test('a non-timing suite claiming contention is refused', t => {
  const f = fixture(t, 'Fast');
  assert.throws(() => reserveDiagnostic(f.root, f.directory, f.fail.id));
  f.baseEvidence();
  f.sign('base', [f.reference.id, f.pass.id], f.key, { kind: 'contention' });
  assert.throws(() => f.check());
});

test('tampered evidence bytes or a replacement signed by another key are refused', t => {
  const f = fixture(t);
  f.baseEvidence();
  f.put('failed-errors.json', [{ ...f.errors[0], error: 'altered' }]);
  assert.throws(() => f.check(), /digest differs/);
  const otherKey = f.key + '-other';
  f.ssh('-q', '-t', 'ed25519', '-N', '', '-f', otherKey);
  f.put('failed-errors.json', f.errors);
  writeFileSync(join(f.root, 'scripts/gates/landing-evidence.allowed-signers'), 'uld-qualification ' + readFileSync(otherKey + '.pub'));
  f.sign('base', [f.reference.id, f.pass.id], otherKey);
  assert.throws(() => f.check(), /ssh-keygen/);
});

test('a changed timing limit in a signed rerun is refused', t => {
  const f = fixture(t, android);
  f.contention(({ diagnostic }) => { diagnostic.limits.scroll.p95FrameMs++; });
  assert.throws(() => f.check());
});

test('a later passing qualification lands and the original failure stays in history', t => {
  const f = fixture(t);
  f.save(f.pass);
  assert.deepEqual(f.check(), f.pass);
  assert.deepEqual(JSON.parse(readFileSync(join(f.directory, 'attempts', f.fail.id + '.json'))), f.fail);
});

test('a later full pass supersedes both recorded timing failures', t => {
  const f = fixture(t, android);
  f.contention();
  const second = { ...f.fail, id: randomUUID() };
  f.save(second);
  f.save(f.pass);
  f.save(f.reference);
  const dir = join(f.directory, 'attempts', second.id + '-evidence', 'landing');
  mkdirSync(dir, { recursive: true });
  for (const name of ['failed-errors.json', 'base-errors.json'])
    copyFileSync(join(f.artifactDir, 'failed-errors.json'), join(dir, name));
  f.sign('base', [f.reference.id, f.pass.id], f.key, {}, second.id);
  assert.equal(f.check().id, f.pass.id);
  assert.deepEqual(JSON.parse(readFileSync(join(dir, '..', '..', second.id + '.json'))), second);
});

test('signed evidence cannot cross trees, bases, runner versions or receipt IDs', t => {
  const f = fixture(t);
  f.baseEvidence();
  for (const change of [{ tree: f.runnerTree }, { base: f.commit }, { runnerTree: f.tree }, { failed: { id: f.pass.id } }]) {
    f.sign('base', [f.reference.id, f.pass.id], f.key, change);
    assert.throws(() => f.check());
  }
});

test('a pass used for base failure recovery must be complete and later', t => {
  const f = fixture(t);
  f.baseEvidence();
  for (const update of [{ suites: f.pass.suites.slice(1) }, { started: f.fail.started }, { devices: {} }]) {
    f.save({ ...f.pass, ...update });
    f.sign('base', [f.reference.id, f.pass.id]);
    assert.throws(() => f.check());
  }
});

test('missing Android functional coverage cannot be repaired by a timing rerun', t => {
  const f = fixture(t, android);
  f.contention(({ functional }) => { functional.profiles[1].scenarioIds = []; });
  assert.throws(() => f.check(), /missed a registered scenario/);
});

test('the Mac timing suite can recover only a numeric timing violation', t => {
  const f = fixture(t, mac);
  f.contention();
  assert.equal(f.check(), undefined);
  f.save(f.pass);
  assert.equal(f.check().status, 'passed');
});

test('a quiet original measurement cannot claim contention', t => {
  const f = fixture(t, android);
  f.contention(({ primary }) => {
    for (const sample of primary.samples) Object.assign(sample, { load1: 1, loadPerCpu: 0.5 });
  });
  assert.throws(() => f.check(), /No measured contention/);
});


test('a signed base finding still requires the original sealed passing verdict', t => {
  const f = fixture(t, 'Fast', ['scripts/gates/reuse/runner.mjs']);
  f.pass.reuseSchema = 1;
  f.baseEvidence();
  assert.throws(() => f.check());
  sealReceipt(f.root, f.pass);
  assert.equal(f.check().id, f.pass.id);
  f.pass.suites[0].durationMs++;
  f.baseEvidence();
  assert.throws(() => f.check(), /changed after its verdict/);
});

test('a wrapper exit needs a separate concrete signed check failure', t => {
  const f = fixture(t);
  for (const row of [f.fail, f.reference]) row.suites.find(s => s.name === 'Fast').reason = 'Fast exited 1';
  f.save(f.fail, true);
  f.baseEvidence();
  assert.equal(f.check().id, f.pass.id);
  f.errors[0].error = 'Fast exited 1';
  f.baseEvidence();
  assert.throws(() => f.check(), /originating check/);
});

test('automatic and manual timing diagnostics share one reservation per tree', t => {
  function busy(f) {
    const sample = { atMs: Date.now(), cpus: 2, load1: 3, loadPerCpu: 1.5, hidIdleNs: '100000000000' };
    return { kind: 'primary', numericVerdict: 'failed', start: sample, samples: [sample],
      identity: { tree: f.tree, attempt: f.fail.id, entryManifestSha256: '3'.repeat(64) } };
  }
  const first = fixture(t, android);
  const record = busy(first);
  assert.equal(claimDiagnostic(dirname(first.directory), record), true);
  assert.throws(() => reserveDiagnostic(first.root, first.directory, first.fail.id), /already consumed/);
  record.identity.entryManifestSha256 = '4'.repeat(64);
  assert.equal(claimDiagnostic(dirname(first.directory), record), false);
  const second = fixture(t, android);
  reserveDiagnostic(second.root, second.directory, second.fail.id);
  assert.equal(claimDiagnostic(dirname(second.directory), busy(second)), false);
  const legacy = fixture(t, android);
  const earlier = join(dirname(legacy.directory), 'uld-delivery', 'android-timing-diagnostics');
  mkdirSync(earlier, { recursive: true });
  writeFileSync(join(earlier, legacy.tree + '-' + '2'.repeat(64) + '.json'), '{}');
  assert.equal(claimDiagnostic(dirname(legacy.directory), busy(legacy)), false);
  assert.throws(() => reserveDiagnostic(legacy.root, legacy.directory, legacy.fail.id), /already consumed/);
});

test('contention recovery checks the retained Android admission and measured frames', t => {
  const f = fixture(t, android, ['scripts/gates/android-host-activity.mjs']);
  f.contention();
  assert.throws(() => f.check(), /adopted Android host admission requires a later full passing receipt/);
  const low = join(f.directory, 'attempts', f.fail.id + '-evidence', 'android', 'low-end');
  writeFileSync(join(low, 'frame-measurements.json'), '{}');
  assert.throws(() => f.check(), { code: 'ERR_ASSERTION', operator: 'deepStrictEqual' });
});

test('ordinary gate and family proposals cannot enroll a landing evidence signer', () => {
  for (const branch of ['gates/proposal', 'family/button'])
    assert.throws(() => requireGateIsolation(branch, ['scripts/gates/landing-evidence.allowed-signers']), /owner-controlled/);
});

test('signed failure review accepts the original verified device scope and requires matching errors', t => {
  const f = fixture(t, 'Fast', ['scripts/selection/proposal-devices.mjs'], true);
  const platforms = Object.fromEntries(['android', 'iphone'].map(platform => [platform, observation(platform,
    ['index.js', 'node_modules/@fixture/native/dist/button.js'], JSON.stringify(['file', 'catalog/native/scenarios/fixtures.cjs']),
    new Map([['@fixture/native', 'packages/native']]), {})]));
  f.git('update-ref', 'refs/remotes/origin/feat/enterprise-ui', f.base);
  const witness = dailyObservationFixture(f.root, f.base, platforms);
  sealReceipt(f.root, witness);
  registerObservation(f.root, witness);
  for (const row of [f.fail, f.reference, f.pass]) {
    row.reuseSchema = 1;
    row.noReuse = row === f.pass;
    row.gateTests = { result: 'passed' };
    row.devicePlan = proposalDevices(f.root, row.base, row.tree, row.noReuse);
    row.scope = proposalScope(f.root, row.base, row.tree, row.devicePlan);
    if (!row.devicePlan.run) {
      row.devices = {};
      for (const suite of row.suites.filter(s => deviceSuites.includes(s.name))) {
        Object.assign(suite, { result: 'web-only', reason: row.devicePlan.reason, durationMs: 0 });
      }
    }
  }
  assert.equal(f.fail.devicePlan.run, false);
  assert.equal(f.pass.devicePlan.run, true);
  assert.equal(f.pass.devicePlan.full, true);
  assert.equal(f.reference.devicePlan.run, true);
  f.save(f.fail, true);
  f.baseEvidence();
  sealReceipt(f.root, f.pass);
  assert.equal(f.check().id, f.pass.id);
  f.put('base-errors.json', [{ ...f.errors[0], error: 'another field is missing' }]);
  f.sign('base', [f.reference.id, f.pass.id]);
  assert.throws(() => f.check());
  f.fail.suites.find(s => s.name === android).reason = 'Different device decision';
  f.save(f.fail, true);
  f.baseEvidence();
  assert.throws(() => f.check(), /verified device scope/);
});

test('a latest failed qualification blocks landing an earlier complete pass', t => {
  const f = fixture(t);
  f.save(f.pass, true);
  f.save({ ...f.fail, started: f.pass.finished, finished: iso(Date.parse(f.pass.finished) + 1) });
  assert.equal(f.check(), undefined);
});
