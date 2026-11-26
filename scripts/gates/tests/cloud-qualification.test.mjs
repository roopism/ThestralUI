import assert from 'node:assert/strict';
import test from 'node:test';
import { qualificationShards, preserveLaneCoverage } from '../cloud/lanes.mjs';
import { repositoryId, sha256, verifyCloudResults } from '../cloud/results.mjs';
import { fixtureGit, isolateFixtureProcess } from './fixtures/hermetic-git.mjs';

isolateFixtureProcess();

const roster = { schema: 1, suites: {
  'Mac browser behavior': { lane: 'github-macos', shards: 3, splitBy: 'engine' },
  'Mac browser performance': { lane: 'local', shards: 1 },
  'Typed and unit rosters': { lane: 'github-linux', shards: 1, alsoRunOn: ['github-macos'] },
} };
const names = Object.keys(roster.suites);

test('lane coverage keeps every registered suite, browser engine and required platform', () => {
  const plan = qualificationShards(roster, names);
  assert.deepEqual(plan.filter(item => item.engine).map(item => item.engine), ['chromium', 'firefox', 'webkit']);
  assert.equal(plan.filter(item => item.suite === 'Typed and unit rosters').length, 2);
  assert.throws(() => qualificationShards(roster, [...names, 'Missing suite']), /every qualification suite/);
  const fewer = structuredClone(roster);
  delete fewer.suites['Typed and unit rosters'].alsoRunOn;
  assert.throws(() => preserveLaneCoverage(roster, fewer, names), /Lost required/);
  const remoteTiming = structuredClone(roster);
  remoteTiming.suites['Mac browser performance'].lane = 'github-macos';
  assert.throws(() => qualificationShards(remoteTiming, names));
  preserveLaneCoverage(roster, structuredClone(roster), names);
});

function complete() {
  const expected = { controlDigest: sha256('trusted tooling'), base: 'a'.repeat(40), merge: 'b'.repeat(40), tree: 'c'.repeat(40), baseWorkflow: 'd'.repeat(40),
    mergeWorkflow: 'd'.repeat(40), branch: 'gates/cloud-proof', workflowId: 9 };
  const run = { id: 10, workflow_id: 9, path: '.github/workflows/qualify.yml', repository: { id: repositoryId },
    head_repository: { id: repositoryId }, event: 'workflow_dispatch', head_branch: expected.branch, head_sha: expected.merge,
    run_attempt: 1, status: 'completed', conclusion: 'success' };
  const shards = qualificationShards(roster, names);
  const jobs = [], artifacts = [], reports = new Map();
  for (const shard of shards.filter(item => item.lane !== 'local')) {
    const job = { id: 11 + jobs.length, name: 'Qualify / ' + shard.id, run_id: run.id, run_attempt: 1,
      head_sha: expected.merge, status: 'completed', conclusion: 'success',
      labels: [shard.lane === 'github-linux' ? 'ubuntu-24.04-arm' : 'macos-26'] };
    jobs.push(job);
    const archiveSha256 = sha256('archive ' + shard.id), evidenceSha256 = sha256('evidence ' + shard.id);
    artifacts.push({ id: 21 + artifacts.length, name: shard.id, expired: false, digest: 'sha256:' + archiveSha256,
      workflow_run: { id: run.id, head_sha: expected.merge, repository_id: repositoryId, head_repository_id: repositoryId } });
    reports.set(shard.id, { archiveSha256, evidenceSha256, result: { base: expected.base, merge: expected.merge, tree: expected.tree,
      controlDigest: expected.controlDigest, workflow: expected.baseWorkflow, runId: run.id, result: 'passed', retries: 0, shard, evidenceSha256 } });
  }
  return { expected, run, shards, jobs, artifacts, reports };
}

test('landing requires the trusted workflow, exact merge and every successful shard with intact evidence', () => {
  const good = complete();
  assert.equal(verifyCloudResults(good).length, 5);
  for (const alter of [
    state => { state.expected.mergeWorkflow = 'e'.repeat(40); },
    state => { state.run.head_sha = state.expected.base; },
    state => { state.run.run_attempt = 2; },
    state => { state.run.repository.id++; },
    state => { state.jobs.pop(); },
    state => { state.jobs.push(state.jobs[0]); },
    state => { state.jobs[0].conclusion = 'skipped'; },
    state => { state.jobs[0].run_id++; },
    state => { state.jobs[0].labels = ['self-hosted']; },
    state => { state.artifacts.pop(); },
    state => { state.artifacts[0].workflow_run.id++; },
    state => { state.artifacts[0].digest = 'sha256:' + 'a'.repeat(64); },
    state => { state.reports.values().next().value.evidenceSha256 = 'b'.repeat(64); },
    state => { state.reports.values().next().value.result.retries++; },
    state => { state.reports.values().next().value.result.controlDigest = sha256('other tools'); },
  ]) {
    const candidate = complete();
    alter(candidate);
    assert.throws(() => verifyCloudResults(candidate), Error, String(alter));
  }
});

test('the hosted matrix reads committed rosters and preserves every existing lane', async t => {
  const { mkdtempSync, mkdirSync, rmSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { planAt } = await import('../cloud/plan.mjs');
  const root = mkdtempSync(join(tmpdir(), 'thestral-cloud-plan-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const run = (...args) => fixtureGit(root, args);
  run('init', '--quiet', '--template=');
  const folder = join(root, 'tests', 'acceptance');
  mkdirSync(folder, { recursive: true });
  const gateFolder = join(root, 'scripts/gates/cloud');
  mkdirSync(gateFolder, { recursive: true });
  const write = (name, data) => writeFileSync(join(name === 'lanes.json' ? gateFolder : folder, name), JSON.stringify(data));
  write('lanes.json', roster);
  write('suite-inputs.json', { contractVersion: 1, groups: Object.fromEntries(names.map(name => [name, {}])) });
  run('add', 'tests', 'scripts');
  const base = run('commit-tree', run('write-tree'), '-m', 'source');
  const expected = qualificationShards(roster, [...names].sort());
  assert.deepEqual(planAt(root, base, base), expected);
  const smaller = structuredClone(roster);
  delete smaller.suites['Typed and unit rosters'].alsoRunOn;
  write('lanes.json', smaller);
  assert.deepEqual(planAt(root, base, base), expected);
  run('add', 'tests', 'scripts');
  const tree = run('write-tree');
  const head = run('commit-tree', tree, '-p', base, '-m', 'proposed change');
  const merge = run('commit-tree', tree, '-p', base, '-p', head, '-m', 'merge');
  assert.throws(() => planAt(root, base, head), /exact PR merge/);
  assert.throws(() => planAt(root, base, merge), /Lost required/);
});

test('browser evidence covers the whole roster and every Linux scenario once per engine', async () => {
  const { browserCoverage } = await import('../cloud/coverage.mjs');
  const suite = 'Linux browser behavior';
  const projects = ['chromium', 'firefox', 'webkit'];
  const manifest = { projects, cases: projects.map(engine => engine + ' | fixture.spec.ts | retains focus') };
  const reports = projects.map((engine, i) => ({ shard: { suite, engine }, coverage: {
    cases: [manifest.cases[i]], scenarios: [engine + ' | scenarios.spec.ts | focus'],
  } }));
  assert.deepEqual(browserCoverage(suite, reports, manifest, ['focus']), manifest.cases);
  const missingCase = structuredClone(reports);
  missingCase[0].coverage.cases.pop();
  assert.throws(() => browserCoverage(suite, missingCase, manifest, ['focus']), /every registered case/);
  const missingScenario = structuredClone(reports);
  missingScenario[2].coverage.scenarios.pop();
  assert.throws(() => browserCoverage(suite, missingScenario, manifest, ['focus']), /portable scenario/);
  assert.throws(() => browserCoverage(suite, [reports[0], reports[0], reports[2]], manifest, ['focus']), /browser engine/);
});

test('iPhone family shards cover the full fixture roster and enforce the pinned device tools', async () => {
  const { iphonePartition, requireIphoneEvidence, selectHostedIphone } = await import('../cloud/iphone.mjs');
  const runtime = 'com.apple.CoreSimulator.SimRuntime.iOS-26-2';
  const devices = [];
  const simctl = (operation, kind, deviceType, selected) => {
    if (operation === 'create') {
      assert.equal(deviceType, 'com.apple.CoreSimulator.SimDeviceType.iPhone-17');
      assert.equal(selected, runtime);
      devices.push({ name: kind, isAvailable: true, udid: 'fixture' });
      return 'fixture';
    }
    if (kind === 'runtimes') return JSON.stringify({ runtimes: [{ identifier: runtime, isAvailable: true }] });
    return JSON.stringify({ devices: { [runtime]: devices } });
  };
  assert.equal(selectHostedIphone(simctl), 'fixture');
  assert.throws(() => selectHostedIphone((_, kind) => JSON.stringify(kind === 'devices' ? { devices: {} } : { runtimes: [] })), /missing/);
  const scenarios = ['alert.a', 'alert.b', 'button.a', 'menu.a', 'wizard.a'].map(id => ({ id }));
  const scopes = [1, 2, 3].map(n => iphonePartition(scenarios, n, 3));
  assert.deepEqual(scopes.flatMap(row => row.scenarioIds).sort(), scenarios.map(row => row.id));
  for (const scope of scopes) {
    const report = { xcode: 'Xcode 26.3\nBuild version 17C529', runtime: 'com.apple.CoreSimulator.SimRuntime.iOS-26-2',
      maestro: '2.4.0', testsPassed: 1, passed: true, skipped: 0, failed: 0, scenarioIds: scope.scenarioIds };
    assert.deepEqual(requireIphoneEvidence(report, scope).scenarioIds, scope.scenarioIds);
    assert.throws(() => requireIphoneEvidence({ ...report, scenarioIds: [] }, scope));
    assert.throws(() => requireIphoneEvidence({ ...report, skipped: 1 }, scope));
    assert.throws(() => requireIphoneEvidence({ ...report, xcode: 'other' }, scope));
  }
});

test('cloud evidence joins only successful local measurements for the exact proposal', async () => {
  const { combineEvidence } = await import('../cloud/coordinator.mjs');
  const { expected, shards } = complete();
  const hosted = shards.filter(row => row.lane !== 'local').map(({ id }) => ({ id }));
  const local = { id: 'fixture', base: expected.base, commit: expected.merge, tree: expected.tree, mode: 'qualification',
    status: 'passed', suites: [{ name: 'Mac browser performance', result: 'passed', durationMs: 1 }] };
  assert.equal(combineEvidence(expected, shards, hosted, local).local.length, 1);
  assert.throws(() => combineEvidence(expected, shards, hosted.slice(1), local));
  assert.throws(() => combineEvidence(expected, shards, hosted, { ...local, tree: expected.base }));
  assert.throws(() => combineEvidence(expected, shards, hosted, { ...local, suites: [] }));
  assert.throws(() => combineEvidence(expected, shards, hosted, { ...local, suites: [{ ...local.suites[0], result: 'reused' }] }));
});

test('hosted dispatch pins the toolchain and keeps timing on this Mac', async () => {
  const { readFileSync } = await import('node:fs');
  const { createRequire } = await import('node:module');
  const yaml = createRequire(import.meta.url)('js-yaml');
  const workflow = yaml.safeLoad(readFileSync(new URL('../../../.github/workflows/qualify.yml', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.deepEqual(workflow.permissions, { contents: 'read', 'pull-requests': 'read' });
  assert.equal(workflow.jobs.shard.strategy['max-parallel'], 5);
  assert.equal(workflow.jobs.shard.strategy['fail-fast'], false);
  assert.equal(workflow.jobs.shard.needs, 'plan');
  for (const { steps } of Object.values(workflow.jobs)) {
    for (const step of steps.filter(row => row.uses)) {
      assert.match(step.uses, /@[a-f0-9]{40}$/);
      if (step.uses.startsWith('actions/checkout@')) {
        assert.equal(step.with['persist-credentials'], false);
        assert.equal(step.with.ref, '${{ inputs.base }}');
      }
    }
  }
  const { runShard } = await import('../cloud/shard.mjs');
  assert.equal(typeof runShard, 'function');
  const runner = readFileSync(new URL('../cloud/shard.mjs', import.meta.url), 'utf8');
  assert.ok(!runner.includes("case 'Mac browser performance'") && !runner.includes("case 'Android standard and low-end'"));
});

test('simulator build caches stay bound to an exact proposal and verify their archive before restore', async t => {
  const { execFileSync } = await import('node:child_process');
  const { mkdtempSync, mkdirSync, rmSync, readFileSync, appendFileSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const root = mkdtempSync(join(tmpdir(), 'thestral-host-cache-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const tool = fileURLToPath(new URL('../cloud/host-cache.py', import.meta.url));
  const archive = join(root, 'host.tar'), host = join(root, 'source', 'ios-fixture');
  mkdirSync(host, { recursive: true });
  writeFileSync(join(host, 'ready.json'), '{}');
  writeFileSync(join(host, 'asset'), 'known build');
  const run = (mode, dir, identity) => execFileSync('python3', ['-I', tool, mode, join(root, dir), archive, identity], { stdio: 'pipe' });
  run('save', 'source', 'proposal-one');
  run('restore', 'target', 'proposal-one');
  assert.equal(readFileSync(join(root, 'target', 'ios-fixture', 'asset'), 'utf8'), 'known build');
  assert.throws(() => run('restore', 'other', 'proposal-two'));
  appendFileSync(archive, 'changed byte');
  assert.throws(() => run('restore', 'other', 'proposal-one'));
});
