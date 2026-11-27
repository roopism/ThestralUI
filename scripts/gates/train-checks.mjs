import { prepareMemberPreflight } from './train-preflight.mjs';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { closeSync, cpSync, existsSync, globSync, lstatSync, mkdirSync, mkdtempSync, openSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withTiming } from '../workers/resource-guard.mjs';
import { withRevisionSnapshot } from '../../packages/policy/quality/staged-tree.mjs';
import { installSnapshotDependencies } from '../../packages/policy/quality/snapshot-dependencies.mjs';

import { deviceSuites } from './device-verdict.mjs';
import { proposalDevices, proposalScope } from '../selection/proposal-devices.mjs';
import { readCandidateScenarios } from '../scenarios/fixture-metadata.mjs';
import { requireCompletedProfiles } from '../../tests/android/qualification.mjs';
import { apkIdentity } from './android-timing-reuse.mjs';
import { requireCleanObservation } from './android-host-activity.mjs';
import { sealPhysical, requirePhysicalSeal } from './reuse/runner.mjs';

const trusted = fileURLToPath(new URL('../../', import.meta.url));
const git = (root, ...args) => execFileSync('git', ['--no-replace-objects', ...args], {
  cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
}).trimEnd();

// Unknown and shared inputs get Mac behavior; documentation and Android-only
// probe files have no web renderer.
export function needsMacBehavior(paths) {
  return !paths.length || paths.some(path => !/^(?:docs\/[^\n]+\.md|[^/]+\.md|tests\/android\/.+)$/.test(path));
}

export function withTrainSnapshot({ root, base, member }, run) {
  for (const id of [base, member.parent, member.commit, member.tree]) assert.match(id, /^[a-f0-9]{40}$/);
  assert.equal(git(trusted, 'rev-parse', 'HEAD^{tree}'), git(root, 'rev-parse', base + '^{tree}'),
    'Train checks must execute from the trusted integration snapshot');
  assert.equal(git(root, 'rev-parse', member.commit + '^{tree}'), member.tree);
  const common = git(root, 'rev-parse', '--path-format=absolute', '--git-common-dir');
  return withRevisionSnapshot(root, member.commit, async (snapshot, tree, env) => {
    assert.equal(tree, member.tree);
    await withTiming('activity', 'Prepare train snapshot', () => installSnapshotDependencies(snapshot, join(common, 'uld-dependencies'), env));
    const node = (args, options = {}) => execFileSync(process.execPath, args, { cwd: snapshot,
      env: { ...env, ULD_ARTIFACT_COMMON: common }, stdio: 'inherit', ...options });
    return run({ snapshot, node, env, common });
  });
}

const offlineCanaries = new Set(['scripts/gates/canaries.mjs', 'scripts/gates/device-scope-canaries.mjs', 'scripts/gates/maestro-canary.mjs']);

export function trainSuiteDeviceScope(root, base, tree, suite, interlocked) {
  const physical = deviceSuites.includes(suite);
  const devicePlan = proposalDevices(root, base, tree, interlocked || physical);
  const scope = proposalScope(root, base, tree, devicePlan);
  if (physical) assert.deepEqual(scope, {iphone:true, families:null}, 'A train diagnostic requires the full physical suite');
  return { devicePlan, scope };
}

export function runMemberChecks(paths, gateTests, operations) {
  operations.preflight();
  const changedCanaries = paths.filter(path => offlineCanaries.has(path));
  for (const file of changedCanaries) operations.canary(file);
  const changedGateTests = paths.filter(path => gateTests.has(path));
  if (changedGateTests.length) operations.tests(changedGateTests);
  const mac = needsMacBehavior(paths);
  if (mac) operations.browser();
  return { fast: 'passed', typedAndUnit: 'passed', changedGateTests, changedCanaries, macBehavior: mac ? 'passed' : 'no-web-inputs' };
}

function memberPreflight(request, { snapshot, node, common }) {
  const { root, member, batch } = request;
  const run = mode => node([join(trusted, 'scripts/gates/local-run.mjs'), root, member.parent, member.commit, mode]);
  if (!batch) { run('hook'); return {}; }
  const ctx = { ...request, snapshot, trusted, tree: member.tree, commit: member.commit,
    directory: join(common, 'uld-receipts') };
  return prepareMemberPreflight(ctx, () => run('hook'), () => run('member-controls'));
}

export function prepareTrainMember(request) {
  return withTrainSnapshot(request, snapshot => memberPreflight(request, snapshot));
}

export function checkCheapMember(request) {
  const { root, member } = request;
  const paths = git(root, 'diff', '--no-renames', '--name-only', '-z', member.parent, member.tree).split('\0').filter(Boolean);
  return withTrainSnapshot(request, ({ snapshot, node, env, common }) => withTiming('activity', 'Train member checks', () => {
    const gateTests = new Set(globSync('scripts/gates/tests/*.test.mjs', { cwd: snapshot }));
    let preflight;
    const checks = runMemberChecks(paths, gateTests, {
      preflight: () => { preflight = memberPreflight(request, { snapshot, node, common }); },
      canary: file => node([file, file.endsWith('maestro-canary.mjs') ? '--offline' : member.tree],
        { env: { ...env, ULD_ARTIFACT_COMMON: join(snapshot, '.git') } }),
      tests: cases => node(['--test', '--test-concurrency=1', ...cases],
        { env: { ...env, ULD_ARTIFACT_COMMON: join(snapshot, '.git') } }),
      browser: () => node([fileURLToPath(new URL('train-suite.mjs', import.meta.url)), root, member.parent, member.commit, 'Mac browser behavior']),
    });
    return { tree: member.tree, ...checks, ...preflight };
  }));
}

function memberTargets(base, member) {
  const solo = { parent:base, commit:member.soloCommit, tree:member.soloTree };
  return solo.tree === member.tree ? [member] : [solo, member];
}

export async function runMemberDevices(base, member, run) {
  const results = [];
  for (const target of memberTargets(base, member))
    for (const suite of deviceSuites) results.push(await run(target, suite));
  return results;
}

export async function checkMember(request) {
  const result = await checkCheapMember(request);
  const { root, base, member } = request;
  const common = git(root, 'rev-parse', '--path-format=absolute', '--git-common-dir');
  const dir = join(common, 'uld-delivery', 'train-member-devices');
  mkdirSync(dir, { recursive:true });
  result.deviceRuns = await runMemberDevices(base, member, (target, suite) =>
    checkPrefixSuite({ root, base, member:target, evidenceDir:mkdtempSync(join(dir, target.tree + '-')) }, suite));
  return result;
}

export function requirePrefixDevice(root, base, target, suite, proof) {
  assert.deepEqual([proof?.kind, proof?.base, proof?.commit, proof?.tree, proof?.suite, proof?.verdict],
    ['full-train-device-v1', base, target.commit, target.tree, suite, 'passed'], 'Missing fresh train device report for ' + suite);
  requirePhysicalSeal(root, proof);
  assert.deepEqual([proof.report.passed,proof.report.failed,proof.report.skipped], [true,0,0]);
  assert.ok(proof.scenarioIds.length, 'Missing full train scenario roster');
  const reports = suite === deviceSuites[0] ? [proof.report] : proof.report.profiles;
  for (const report of reports) assert.deepEqual([...report.scenarioIds].sort(), proof.scenarioIds);
  if (suite === deviceSuites[1]) {
    assert.deepEqual(reports.map(row => row.id).sort(), ['low-end','standard']);
    assert.equal(proof.timing.result, 'timing measured');
  }
  const common = git(root, 'rev-parse', '--path-format=absolute', '--git-common-dir');
  assert.match(proof.directory, /^uld-delivery\/(?:train-member-devices|train-diagnostics)\/[a-zA-Z0-9-]+$/);
  assert.deepEqual(rawDeviceEvidence(join(common, proof.directory), suite), proof.raw, 'Train device files differ from the sealed evidence');
}

export function requireTrainMemberDevices(root, train) {
  const ids = new Set();
  assert.equal(train.cheapChecks.length, train.members.length);
  for (const [index, member] of train.members.entries()) {
    const row = train.cheapChecks[index];
    assert.deepEqual([row.number, row.tree], [member.number, member.tree]);
    const runs = row.result.deviceRuns;
    const targets = memberTargets(train.base, member);
    assert.equal(runs?.length, targets.length * deviceSuites.length, 'Missing full train member device evidence');
    let i = 0;
    for (const target of targets) for (const suite of deviceSuites) {
      const proof = runs[i++];
      requirePrefixDevice(root, train.base, target, suite, proof);
      assert.ok(!ids.has(proof.id), 'Repeated train device report');
      ids.add(proof.id);
    }
  }
}

// Bind the verifier's report and every raw driver output. The built applications
// and bundle directories are artifacts; the Android report binds the installed APK separately.
function rawDeviceEvidence(base, suite) {
  const name = suite === 'iPhone Simulator' ? 'ios-simulator' : 'android-emulator';
  const dir = join(base, 'test-results', name);
  const files = globSync('**/*', { cwd:dir, exclude:['app','apk','bundle'] })
    .filter(file => lstatSync(join(dir,file)).isFile()).map(file => join('test-results',name,file));
  assert.ok(files.length, 'Missing train device driver output');
  files.push('suite.log', join('release/evidence', name + '.json'));
  return Object.fromEntries(files.sort().map(path => [path, createHash('sha256').update(readFileSync(join(base,path))).digest('hex')]));
}

function deviceProof({ root, base, member, evidenceDir }, suite, snapshot) {
  const read = path => JSON.parse(readFileSync(join(snapshot, path)));
  assert.deepEqual(read('.git/local-device-scope.json'), {iphone:true, families:null});
  const ids = readCandidateScenarios(snapshot).map(row => row.id).sort();
  const iphone = suite === 'iPhone Simulator';
  const report = read('release/evidence/' + (iphone ? 'ios-simulator' : 'android-emulator') + '.json');
  assert.deepEqual([report.passed, report.failed, report.skipped], [true, 0, 0]);
  const proof = { kind:'full-train-device-v1', id:randomUUID(), base, commit:member.commit, tree:member.tree,
    suite, verdict:'passed', scenarioIds:ids, report,
    directory:relative(git(root, 'rev-parse', '--path-format=absolute', '--git-common-dir'), evidenceDir),
    raw:rawDeviceEvidence(evidenceDir,suite) };
  if (iphone) {
    assert.ok(report.profiles.length > 0 && report.testsPassed >= report.profiles.length && report.runtime && report.model);
    assert.deepEqual([...report.scenarioIds].sort(), ids);
  } else {
    const flows = readdirSync(join(snapshot, 'tests/simulator')).filter(file => file.endsWith('.yaml'));
    requireCompletedProfiles(report.profiles, flows, ids, read('tests/android/low-end-budget.json').limits);
    const timing = read('test-results/android-emulator/low-end/timing-source.json');
    assert.equal(timing.result, 'timing measured', 'Train Android timing must be fresh');
    assert.deepEqual(timing.frameBudget, report.profiles.find(p => p.id === 'low-end').frameBudget);
    const apk = apkIdentity(join(snapshot,'test-results/android-emulator/apk/app-release.apk'));
    const measured = timing.admission.identity;
    assert.deepEqual([measured.attempt,measured.tree,measured.apkSha256,measured.entryManifestSha256],
      [null,member.tree,apk.apkSha256,apk.entryManifestSha256]);
    assert.deepEqual([timing.apkSha256,timing.entryManifestSha256], [apk.apkSha256,apk.entryManifestSha256]);
    requireCleanObservation(timing.admission, timing.frameBudget);
    proof.timing = timing;
  }
  sealPhysical(root, proof);
  return proof;
}

export function checkPrefixSuite(request, suite) {
  return withTrainSnapshot(request, ({ node, snapshot }) => {
    const target = join(snapshot, '.git');
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, 'gate-selection.json'), JSON.stringify({ budgetComparisonBase: request.base }));
    const log = openSync(join(request.evidenceDir, 'suite.log'), 'wx', 0o600);
    try {
      node([fileURLToPath(new URL('train-suite.mjs', import.meta.url)), request.root, request.base, request.member.commit, suite],
        { stdio: ['ignore', log, log] });
    } finally {
      closeSync(log);
      for (const path of ['release/evidence', 'test-results']) {
        const source = join(snapshot, path);
        if (path.startsWith('release/') && existsSync(join(snapshot, 'release')))
          assert.ok(lstatSync(join(snapshot, 'release')).isDirectory(), 'Unexpected release evidence directory');
        if (existsSync(source)) cpSync(source, join(request.evidenceDir, path), {
          recursive: true, errorOnExist: true, force: false, filter: file => !lstatSync(file).isSymbolicLink(),
        });
      }
    }
    if (deviceSuites.includes(suite)) {
      try { return deviceProof(request, suite, snapshot); }
      catch (cause) { throw Object.assign(new Error('Incomplete physical evidence for ' + suite, {cause}), {code:'train/no-device-evidence'}); }
    }
  });
}
