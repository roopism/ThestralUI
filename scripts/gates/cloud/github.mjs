import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, createReadStream, mkdtempSync, openSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { requireCloudRun, verifyCloudResults } from './results.mjs';
import { planAt } from './plan.mjs';
import { iphonePartition, requireIphoneEvidence } from './iphone.mjs';
import { readCandidateScenarios } from '../../scenarios/fixture-metadata.mjs';
import { browserCoverage } from './coverage.mjs';
import { verifyCandidatePassed } from '../../../packages/policy/quality/api-depth/evidence.mjs';
import { withRevisionSnapshot } from '../../../packages/policy/quality/staged-tree.mjs';

const repo = 'repos/roopism/ThestralUI';
const id = value => {
  assert.ok(Number.isSafeInteger(value) && value > 0, 'Invalid GitHub ID');
  return String(value);
};
const api = path => JSON.parse(execFileSync('gh', ['api', '--hostname', 'github.com', repo + path], { encoding: 'utf8' }));
const all = (path, key) => {
  const items = [];
  for (let page = 1; ; page++) {
    const group = api(path + '?per_page=100&page=' + page);
    assert.ok(Array.isArray(group[key]) && Number.isSafeInteger(group.total_count));
    items.push(...group[key]);
    if (items.length === group.total_count) return items;
    assert.ok(group[key].length === 100 && items.length < group.total_count, 'Incomplete GitHub listing');
  }
};

async function readArtifact(artifact, directory) {
  const file = join(directory, id(artifact.id) + '.zip');
  const fd = openSync(file, 'wx', 0o600);
  try {
    execFileSync('gh', ['api', '--hostname', 'github.com', repo + '/actions/artifacts/' + id(artifact.id) + '/zip'], { stdio: ['ignore', fd, 'pipe'] });
  } finally { closeSync(fd); }
  assert.equal(statSync(file).size, artifact.size_in_bytes);
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  const archiveSha256 = hash.digest('hex');
  assert.equal(artifact.digest, 'sha256:' + archiveSha256);
  // Read fixed members without extracting paths supplied by the archive.
  const inspect = [
    'import hashlib,json,sys,zipfile',
    'with zipfile.ZipFile(sys.argv[1]) as archive:',
    "    assert sorted(archive.namelist()) == ['evidence.log','result.json']",
    "    assert archive.getinfo('result.json').file_size <= 65536",
    "    result = json.loads(archive.read('result.json'))",
    "    h = hashlib.sha256()",
    "    with archive.open('evidence.log') as log:",
    "        for block in iter(lambda: log.read(1048576), b''): h.update(block)",
    "    print(json.dumps({'result':result,'evidenceSha256':h.hexdigest()}))",
  ].join('\n');
  const report = JSON.parse(execFileSync('python3', ['-I', '-c', inspect, file], { encoding: 'utf8' }));
  return { archiveSha256, ...report };
}

export async function readHostedVerdict(root, runId, expected) {
  const shards = planAt(root, expected.base, expected.merge);
  const path = '/actions/runs/' + id(runId);
  const run = api(path);
  const workflow = api('/actions/workflows/qualify.yml');
  assert.equal(workflow.path, '.github/workflows/qualify.yml');
  assert.equal(workflow.state, 'active');
  const identity = { ...expected, workflowId: workflow.id };
  requireCloudRun(run, identity);
  const jobs = all(path + '/attempts/1/jobs', 'jobs');
  const artifacts = all(path + '/artifacts', 'artifacts');
  const directory = mkdtempSync(join(tmpdir(), 'thestral-hosted-results-'));
  try {
    const reports = new Map();
    const expectedIds = shards.filter(shard => shard.lane !== 'local').map(shard => shard.id).sort();
    assert.deepEqual(artifacts.map(artifact => artifact.name).sort(), expectedIds);
    for (const artifact of artifacts) reports.set(artifact.name, await readArtifact(artifact, directory));
    const verified = verifyCloudResults({ run, expected: identity, shards, jobs, artifacts, reports });
    const readScenarios = createRequire(import.meta.url)('../../scenarios/read.cjs').readScenarios;
    withRevisionSnapshot(root, expected.merge, (snapshot, tree) => {
      assert.equal(tree, expected.tree);
      const scenarios = readCandidateScenarios(snapshot);
      const covered = [];
      for (const shard of shards.filter(row => row.suite === 'iPhone Simulator')) {
        const { coverage } = reports.get(shard.id).result;
        const scope = iphonePartition(scenarios, shard.shard, shard.shards);
        assert.deepEqual(coverage.families, scope.families);
        requireIphoneEvidence(coverage, scope);
        covered.push(...coverage.scenarioIds);
      }
      assert.deepEqual(covered.sort(), scenarios.map(row => row.id).sort(), 'Incomplete iPhone roster');
      const roster = JSON.parse(readFileSync(join(snapshot, 'tests/acceptance/browser-matrix.json')));
      for (const suite of ['Mac browser behavior', 'Linux browser behavior']) {
        const engineReports = shards.filter(shard => shard.suite === suite).map(shard => reports.get(shard.id).result);
        const ids = suite === 'Linux browser behavior' ? readScenarios(snapshot).map(scenario => scenario.id) : [];
        const passed = browserCoverage(suite, engineReports, roster, ids);
        verifyCandidatePassed('browser', passed, roster.projects, snapshot);
      }
    });
    return verified;
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
