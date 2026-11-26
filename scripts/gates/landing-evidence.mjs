import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, linkSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { admission, observationIssues } from './android-host-activity.mjs';
import { hasEarlierAndroidDiagnostic } from './diagnostic-slot.mjs';
import { deviceSuites, scopedSkip, verifiedDevicePlan } from './device-verdict.mjs';
import { budgetFailures } from '../../tests/browser/quality-perf-policy.mjs';
import { requireCompletedProfiles } from '../../tests/android/qualification.mjs';
import { enforceBudget, summarizeTrials } from '../../tests/android/frame-budget.mjs';

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const oid = /^[a-f0-9]{40}$/;
const digest = data => createHash('sha256').update(data).digest('hex');
const android = 'Android standard and low-end';
const timing = 'android/frame-budget';
const mac = 'Mac browser performance';
const macTiming = 'browser/timing-budget';
const timingChecks = new Map([[android, timing], [mac, macTiming]]);
const namespace = 'uld-landing-evidence-v1';

function bytes(file) {
  assert.equal(realpathSync(file), file, 'Evidence must be in its recorded directory');
  assert.ok(lstatSync(file).isFile(), 'Expected a regular evidence file');
  return readFileSync(file);
}

function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', env: { ...process.env, GIT_NO_REPLACE_OBJECTS: '1' } }).trim();
}

function attempt(directory, id) {
  assert.match(id, uuid);
  const body = bytes(join(directory, 'attempts', id + '.json'));
  const row = JSON.parse(body);
  assert.equal(row.id, id);
  return { row, ref: { id, sha256: digest(body) } };
}

function sourceTree(root, receipt) {
  for (const id of [receipt.tree, receipt.base, receipt.commit]) assert.match(id, oid);
  assert.equal(git(root, 'rev-parse', receipt.commit + '^{tree}'), receipt.tree);
  assert.equal(git(root, 'rev-parse', 'refs/uld-archive/qualification-attempts/' + receipt.id), receipt.commit);
  git(root, 'merge-base', '--is-ancestor', receipt.base, receipt.commit);
  return git(root, 'rev-parse', receipt.base + '^{tree}');
}

const folder = (directory, id) => join(directory, 'attempts', id + '-evidence', 'landing');
const claimFolder = (directory, tree) => join(directory, 'timing-diagnostics', tree);
const artifacts = {
  base: ['failed-errors.json', 'base-errors.json'],
  contention: ['failed-errors.json', 'primary.json', 'diagnostic.json'],
};

// The supervisor runs this before starting the diagnostic. A crash consumes the slot.
export function reserveDiagnostic(root, directory, id) {
  const { row, ref } = attempt(directory, id);
  const runnerTree = sourceTree(root, row);
  assert.equal(row.status, 'failed');
  const failures = row.suites.filter(s => s.result === 'failed');
  assert.ok(failures.length === 1 && timingChecks.has(failures[0].name));
  assert.ok(!hasEarlierAndroidDiagnostic(directory, row.tree), 'An Android diagnostic already consumed the tree slot');
  const parent = join(directory, 'timing-diagnostics');
  mkdirSync(parent, { recursive: true });
  const dir = claimFolder(directory, row.tree);
  mkdirSync(dir, { mode: 0o700 });
  const claim = { id: randomUUID(), tree: row.tree, base: row.base, runnerTree, failed: ref, at: Date.now() };
  writeFileSync(join(dir, 'claim.json'), JSON.stringify(claim) + '\n', { flag: 'wx', mode: 0o600 });
  return claim;
}

// Publish one diagnostic result, including a failed or interrupted result, to its original reservation.
export function finishDiagnostic(directory, tree, id, data) {
  assert.match(tree, oid);
  assert.match(id, uuid);
  const dir = claimFolder(directory, tree);
  assert.equal(JSON.parse(bytes(join(dir, 'claim.json'))).id, id);
  const path = join(dir, 'diagnostic.json'), temporary = join(dir, randomUUID() + '.tmp');
  writeFileSync(temporary, data, { flag: 'wx', mode: 0o600 });
  try {
    linkSync(temporary, path);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    if (bytes(path).equals(Buffer.from(data))) return;
    writeFileSync(join(dir, 'duplicate-result'), id + '\n', { mode: 0o600 });
    throw Error('Conflicting second diagnostic result');
  } finally { unlinkSync(temporary); }
}

function artifactFile(directory, row, name) {
  if (name === 'final-budget-failure.json') return join(directory, 'attempts', row.id + '-evidence', 'android', name);
  return name === 'diagnostic.json' ? join(claimFolder(directory, row.tree), name) : join(folder(directory, row.id), name);
}

// Bind supervisor-observed artifacts for signing. The signer independently checks their provenance.
export function evidenceManifest(root, directory, kind, id, ...ids) {
  assert.ok(Object.hasOwn(artifacts, kind));
  const { row, ref } = attempt(directory, id);
  const runnerTree = sourceTree(root, row);
  assert.ok(kind === 'base' ? ids.length === 2 : ids.length <= 1);
  const [witness, pass] = kind === 'base' ? ids : [undefined, ...ids];
  const names = [...artifacts[kind]];
  if (kind === 'contention' && row.suites.some(s => s.name === android && s.result === 'failed')) names.push('final-budget-failure.json');
  const files = Object.fromEntries(names.map(name => [name, digest(bytes(artifactFile(directory, row, name)))]));
  const manifest = { schema: 1, kind, tree: row.tree, base: row.base, runnerTree, failed: ref, files };
  if (kind === 'base') {
    manifest.reference = attempt(directory, witness).ref;
    manifest.pass = attempt(directory, pass).ref;
  } else {
    manifest.claim = digest(bytes(join(claimFolder(directory, row.tree), 'claim.json')));
    if (pass) manifest.pass = attempt(directory, pass).ref;
  }
  return manifest;
}

function signedManifest(root, base, dir) {
  const body = bytes(join(dir, 'manifest.json'));
  const signature = join(dir, 'manifest.json.sig');
  bytes(signature);
  assert.match(base, oid);
  // Only integration can enroll a runner. Both the candidate checkout and caller Git config are untrusted.
  const path = 'scripts/gates/landing-evidence.allowed-signers';
  assert.match(git(root, 'ls-tree', base, '--', path), /^100644 blob /, 'Integration has no enrolled evidence signer');
  const scratch = mkdtempSync(join(tmpdir(), 'uld-evidence-verify-'));
  try {
    const signers = join(scratch, 'allowed-signers');
    writeFileSync(signers, git(root, 'show', base + ':' + path) + '\n', { flag: 'wx', mode: 0o600 });
    execFileSync('/usr/bin/ssh-keygen', ['-Y', 'verify', '-f', signers, '-I', 'uld-qualification',
      '-n', namespace, '-s', signature], { input: body, stdio: ['pipe', 'pipe', 'pipe'] });
  } finally { rmSync(scratch, { recursive: true, force: true }); }
  return JSON.parse(body);
}

function windowOf(row) {
  const start = Date.parse(row.started), end = Date.parse(row.finished);
  assert.ok(Number.isSafeInteger(start) && Number.isSafeInteger(end) && start <= end, 'Incomplete receipt interval');
  return { start, end };
}

const passedSuite = (row, suite) => suite.result === 'passed' ||
  suite.name === 'iPhone Simulator' && row.scope?.iphone === false && suite.result === 'web-only' ||
  row.status === 'failed' && scopedSkip(row, suite);

function completed(row, roster, expectedStatus, fullRoster = true) {
  assert.ok(['qualification', 'release'].includes(row.mode) && !Object.hasOwn(row, 'error'));
  assert.equal(row.status, expectedStatus);
  windowOf(row);
  const names = row.suites.map(s => s.name);
  assert.deepEqual(names, fullRoster ? roster : roster.filter(name => names.includes(name)));
  assert.ok(row.suites.every(s => Number.isFinite(s.durationMs) && s.durationMs >= 0));
  const failures = row.suites.filter(s => s.result === 'failed');
  if (expectedStatus === 'failed') assert.ok(failures.length > 0);
  else assert.equal(failures.length, 0);
  return failures;
}

function completePlatforms(row) {
  assert.equal(typeof row.scope?.iphone, 'boolean');
  assert.ok(row.vm?.browsers && row.vm?.sourceImageSha256);
  assert.deepEqual(row.devices.android.map(s => s.id).sort(), ['low-end', 'standard']);
  assert.ok(row.scope.iphone ? row.devices.iphone?.passed === true : !row.devices.iphone);
}

function wrapperError(error) {
  return /^(Command failed:|Process exited|exit code \d+$)/i.test(error) || / exited (?:\d+|SIG[A-Z]+)$/.test(error);
}

// Partial failed receipts may stop before device stages. Replay omissions before comparing errors.
function verifyFailedDeviceScope(root, row) {
  const claimsSkip = row.devicePlan?.run === false || row.suites.some(suite => suite.result === 'web-only');
  if (!claimsSkip || verifiedDevicePlan(root, row.base, row.tree, row) !== 'scoped') return;
  assert.deepEqual(row.devices, {});
  assert.equal(row.androidTiming, undefined);
  for (const suite of row.suites.filter(s => deviceSuites.includes(s.name))) {
    const blocked = suite.result === 'blocked' && ['Prerequisite failed', 'Preflight failed'].includes(suite.reason);
    assert.ok(scopedSkip(row, suite) || blocked, suite.name + ' differs from the verified device scope');
  }
}

function detailedErrors(row, roster, errors) {
  const failures = completed(row, roster, 'failed', false);
  assert.deepEqual(errors.map(e => e.suite), failures.map(s => s.name));
  assert.ok(errors.every(e => typeof e.check === 'string' && e.check.trim() &&
    typeof e.error === 'string' && e.error.trim() && !wrapperError(e.error)),
  'Expected the originating check and concrete error for each failed suite');
  for (const [index, failure] of failures.entries()) {
    assert.ok(typeof failure.reason === 'string' && failure.reason.trim());
    if (!wrapperError(failure.reason)) assert.equal(errors[index].error, failure.reason);
  }
  for (const suite of row.suites) {
    assert.ok(passedSuite(row, suite) || suite.result === 'failed' ||
      suite.result === 'blocked' && ['Prerequisite failed', 'Preflight failed'].includes(suite.reason));
  }
}

function contentionObserved(report) {
  const { begin, end, samples } = report;
  assert.ok(Number.isSafeInteger(begin) && Number.isSafeInteger(end) && begin < end);
  assert.ok(Array.isArray(samples) && samples.length >= 2);
  const first = samples[0].atMs, last = samples.at(-1).atMs;
  assert.ok(first <= begin && last >= end && begin - first <= 15000 && last - end <= 15000);
  let busy = false;
  for (const [i, s] of samples.entries()) {
    assert.ok(Number.isSafeInteger(s.atMs) && typeof s.hidIdleNs === 'string' && /^\d+$/.test(s.hidIdleNs));
    assert.ok(Number.isSafeInteger(s.cpus) && s.cpus > 0 && s.cpus === samples[0].cpus &&
      Number.isFinite(s.load1) && s.load1 >= 0 && s.loadPerCpu === s.load1 / s.cpus);
    if (i) assert.ok(s.atMs > samples[i - 1].atMs && s.atMs - samples[i - 1].atMs <= 15000);
    const idleNs = BigInt(s.hidIdleNs);
    const active = idleNs < 60000000000n || s.loadPerCpu >= 1 ||
      idleNs <= BigInt(s.atMs - first) * 1000000n;
    if (active && (s.atMs >= begin && s.atMs <= end || report.kind === 'diagnostic')) busy = true;
  }
  return busy;
}

function budgetErrors(report, limits) {
  assert.deepEqual(report.limits, limits);
  const errors = [];
  for (const journey of ['press', 'scroll']) {
    const result = report.frames[journey];
    assert.deepEqual(result, summarizeTrials(result.trials));
    for (const [i, trial] of [...result.trials, result].entries()) {
      assert.ok(Number.isSafeInteger(trial.frames) && trial.frames >= 15 &&
        Number.isSafeInteger(trial.inputs) && trial.inputs >= 5);
      for (const metric of ['p95FrameMs', 'p95InputToCommitMs', 'deadlineMissFraction'])
        assert.ok(Number.isFinite(trial[metric]) && trial[metric] >= 0);
      try { enforceBudget(trial, limits[journey], journey + (i === 3 ? ' median' : ' trial ' + (i + 1))); }
      catch (error) {
        if (error.code !== timing) throw error;
        errors.push(error.message);
      }
    }
  }
  return errors;
}

export function resolveFailure(root, directory, failed, history, tree, base, roster) {
  assert.match(failed.id, uuid);
  const dir = folder(directory, failed.id);
  const manifest = signedManifest(root, base, dir);
  const recorded = attempt(directory, failed.id);
  assert.deepEqual(recorded.row, failed);
  assert.deepEqual(manifest.failed, recorded.ref);
  assert.deepEqual([manifest.schema, manifest.tree, manifest.base, failed.tree, failed.base], [1, tree, base, tree, base]);
  assert.ok(!existsSync(join(claimFolder(directory, tree), 'duplicate-result')), 'A second diagnostic result bars landing');
  const runnerTree = sourceTree(root, failed);
  assert.equal(manifest.runnerTree, runnerTree);
  assert.ok(Object.hasOwn(artifacts, manifest.kind));
  function artifact(name) {
    const data = bytes(artifactFile(directory, failed, name));
    assert.equal(digest(data), manifest.files[name], 'Evidence digest differs for ' + name);
    return JSON.parse(data);
  }
  function receipt(ref) {
    const saved = attempt(directory, ref.id);
    assert.deepEqual(saved.ref, ref);
    assert.equal(sourceTree(root, saved.row), runnerTree);
    assert.equal(saved.row.base, base);
    if (saved.row.status === 'failed') verifyFailedDeviceScope(root, saved.row);
    return saved.row;
  }
  const errors = artifact('failed-errors.json');
  verifyFailedDeviceScope(root, failed);
  detailedErrors(failed, roster, errors);
  const timingFailure = errors.some(e => timingChecks.has(e.suite) && e.check === timingChecks.get(e.suite));
  let pass;
  if (manifest.pass) {
    pass = receipt(manifest.pass);
    assert.equal(pass.tree, tree);
    assert.ok(history.some(row => isDeepStrictEqual(row, pass)));
    completed(pass, roster, 'passed');
    assert.ok(pass.suites.every(s => passedSuite(pass, s)));
    completePlatforms(pass);
    assert.ok(windowOf(pass).start > windowOf(failed).end);
  }
  if (manifest.kind === 'base') {
    assert.ok(pass, 'A base failure needs a later full pass');
    const claim = join(claimFolder(directory, tree), 'claim.json');
    if (timingFailure && existsSync(claim)) {
      assert.notEqual(JSON.parse(bytes(claim)).failed.id, failed.id, 'A claimed diagnostic requires its own verdict');
    }
    const reference = receipt(manifest.reference);
    assert.equal(reference.commit, base);
    assert.equal(reference.tree, runnerTree);
    assert.notEqual(reference.id, failed.id);
    assert.ok(windowOf(reference).end < windowOf(pass).start, 'Base evidence must predate the passing rerun');
    const baseErrors = artifact('base-errors.json');
    detailedErrors(reference, roster, baseErrors);
    assert.deepEqual(errors, baseErrors);
    return { pass, timingFailure };
  }

  assert.ok(errors.length === 1 && timingFailure);
  const { suite, check } = errors[0];
  if (!pass) {
    completed(failed, roster, 'failed');
    assert.ok(failed.suites.every(s => s.name === suite || passedSuite(failed, s)));
    completePlatforms(failed);
  }
  const claimBytes = bytes(join(claimFolder(directory, tree), 'claim.json'));
  assert.equal(digest(claimBytes), manifest.claim);
  const claim = JSON.parse(claimBytes);
  assert.match(claim.id, uuid);
  assert.deepEqual([claim.tree, claim.base, claim.runnerTree, claim.failed], [tree, base, runnerTree, recorded.ref]);
  const primary = artifact('primary.json'), diagnostic = artifact('diagnostic.json');
  for (const report of [primary, diagnostic]) {
    assert.deepEqual([report.tree, report.base, report.runnerTree, report.attempt, report.suites],
      [tree, base, runnerTree, failed.id, [check]]);
  }
  assert.deepEqual([primary.kind, diagnostic.kind, diagnostic.id], ['primary', 'diagnostic', claim.id]);
  assert.equal(primary.functionalChecks, 'passed');
  assert.ok(windowOf(failed).start <= primary.begin && primary.end <= windowOf(failed).end);
  assert.ok(Number.isSafeInteger(claim.at) && windowOf(failed).end <= claim.at && claim.at <= diagnostic.begin && diagnostic.end <= Date.now());
  assert.ok(contentionObserved(primary), 'No measured contention');
  assert.equal(contentionObserved(diagnostic), false, 'Diagnostic was not quiet');
  const file = suite === android ? ':tests/android/low-end-budget.json' : ':tests/browser/quality-perf-baseline.json';
  const policy = JSON.parse(git(root, 'show', base + file));
  assert.deepEqual(JSON.parse(git(root, 'show', tree + file)), policy, 'Timing policy changed');
  if (suite === android) {
    for (const report of [primary, diagnostic]) {
      assert.match(report.entryManifestSha256, /^[a-f0-9]{64}$/);
      assert.equal(report.entryManifestSha256, failed.androidTiming.entryManifestSha256);
      assert.deepEqual(report.hardware, failed.devices.android.find(device => device.id === 'low-end').hardware);
      assert.ok(report.hardware?.fingerprint);
    }
    if (git(root, 'ls-tree', base, '--', 'scripts/gates/android-host-activity.mjs')) {
      const source = failed.androidTiming;
      const observed = source.admission;
      const low = join(directory, 'attempts', failed.id + '-evidence', 'android', 'low-end');
      assert.equal(failed.androidHostActivityPolicy, 1);
      assert.equal(source.result, 'timing failed');
      assert.deepEqual(observed, JSON.parse(bytes(join(low, 'timing-admission.json'))));
      assert.deepEqual(primary.frames, JSON.parse(bytes(join(low, 'frame-measurements.json'))));
      assert.deepEqual([observed.kind, observed.verdict, observed.numericVerdict], ['primary', 'failed', 'failed']);
      assert.deepEqual(observed.policy, admission);
      assert.equal(observed.error, errors[0].error);
      assert.equal(observed.frameSha256, digest(JSON.stringify(primary.frames)));
      assert.deepEqual([observed.identity.tree, observed.identity.attempt, observed.identity.entryManifestSha256,
        observed.identity.apkSha256], [tree, failed.id, source.entryManifestSha256, source.apkSha256]);
      assert.deepEqual(observed.start, observed.wait.at(-1));
      assert.deepEqual(primary.samples, [observed.start, ...observed.samples]);
      assert.deepEqual(observationIssues(diagnostic.samples[0], diagnostic.samples.slice(1)), []);
      assert.ok(pass, 'The adopted Android host admission requires a later full passing receipt');
    } else {
      assert.equal(failed.androidTiming.result, 'timing measured');
    }
    assert.deepEqual(primary.frames, failed.androidTiming.frameBudget);
    assert.ok(budgetErrors(primary, policy.limits).includes(errors[0].error), 'Primary error differs from the measured violation');
    assert.deepEqual(budgetErrors(diagnostic, policy.limits), []);
    const functional = artifact('final-budget-failure.json');
    assert.equal(functional.error, errors[0].error);
    const flows = git(root, 'ls-tree', '--name-only', tree + ':tests/simulator').split('\n').filter(f => f.endsWith('.yaml')).sort();
    assert.deepEqual(functional.flows, flows);
    const selected = failed.scope.families === null ? functional.roster :
      functional.roster.filter(id => failed.scope.families.includes(id.split('.')[0]));
    assert.deepEqual(functional.selected, selected);
    const profiles = functional.profiles.map(p => {
      assert.deepEqual(p.hardware, failed.devices.android.find(device => device.id === p.id)?.hardware);
      if (p.id !== 'low-end') return p;
      assert.deepEqual(p.frameBudget, primary.frames);
      return { ...p, frameBudget: diagnostic.frames };
    });
    requireCompletedProfiles(profiles, flows, functional.roster, policy.limits, selected);
  } else {
    for (const path of ['tests/browser/quality-perf.mjs', 'tests/browser/quality-perf-policy.mjs'])
      assert.equal(git(root, 'rev-parse', tree + ':' + path), git(root, 'rev-parse', base + ':' + path), 'Mac timing probe changed');
    for (const report of [primary, diagnostic]) {
      assert.deepEqual(report.limits, policy.budgets);
      assert.deepEqual(report.system, primary.system);
      assert.ok(report.system?.platform === 'darwin' && report.system.processor && report.system.browser);
      for (const key of ['dataset', 'mountCycles', 'scrollSamples', 'throttle']) assert.equal(report.system[key], policy.system[key]);
      assert.deepEqual(Object.keys(report.metrics).sort(), Object.keys(policy.budgets).sort());
      assert.ok(Object.values(report.metrics).every(n => Number.isFinite(n) && n >= 0));
    }
    const violations = budgetFailures(primary.metrics, policy.budgets);
    assert.ok(violations.length && violations.every(e => /^(openP95Ms|typingP95Ms|scrollTwoFramesP95Ms|motionFrameP95Ms) measured /.test(e)));
    assert.equal(violations.join('\n'), errors[0].error);
    assert.deepEqual(budgetFailures(diagnostic.metrics, policy.budgets), []);
  }

  // This view is only used by landing. Never publish it as a qualification or timing reuse source.
  const verdict = pass ?? { ...failed, status: 'passed', suites: failed.suites.map(s => s.name === suite ?
    { ...s, result: 'passed', reason: 'Timing diagnostic ' + claim.id, durationMs: s.durationMs + diagnostic.end - diagnostic.begin } : s) };
  return { pass: verdict, diagnostic: claim.id, timingFailure };
}

if (import.meta.main) {
  const [command, ...args] = process.argv.slice(2);
  const root = git(process.cwd(), 'rev-parse', '--show-toplevel');
  const directory = join(git(root, 'rev-parse', '--path-format=absolute', '--git-common-dir'), 'uld-receipts');
  assert.ok(['reserve', 'finish', 'bind'].includes(command), 'Use reserve ATTEMPT, finish TREE DIAGNOSTIC_ID, or bind KIND ATTEMPT [RECEIPTS]');
  if (command === 'finish') {
    finishDiagnostic(directory, ...args, readFileSync(0));
    process.exit(0);
  }
  const result = command === 'reserve' ? reserveDiagnostic(root, directory, ...args) :
    evidenceManifest(root, directory, ...args);
  console.log(JSON.stringify(result, null, 2));
}
