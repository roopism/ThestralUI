import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { cloudProposal, startHostedRun } from './proposal.mjs';
import { readHostedVerdict } from './github.mjs';
import { planAt } from './plan.mjs';
import { collectPhysicalEvidence } from './local-snapshots.mjs';
import { sha256 } from './results.mjs';

export function combineEvidence(expected, shards, hosted, local) {
  assert.deepEqual(hosted.map(row => row.id).sort(), shards.filter(row => row.lane !== 'local').map(row => row.id).sort());
  assert.deepEqual([local.base, local.commit, local.tree, local.mode, local.status],
    [expected.base, expected.merge, expected.tree, 'qualification', 'passed']);
  const rows = [];
  for (const shard of shards.filter(row => row.lane === 'local')) {
    const matched = local.suites.filter(row => row.name === shard.suite);
    assert.equal(matched.length, 1, 'Missing or duplicate local suite ' + shard.suite);
    const [row] = matched;
    assert.equal(row.result, 'passed', 'Local lanes require a fresh pass for ' + shard.suite);
    assert.ok(Number.isFinite(row.durationMs) && row.durationMs > 0);
    rows.push({ id: shard.id, durationMs: row.durationMs });
  }
  return { base: expected.base, merge: expected.merge, tree: expected.tree, hosted, local: rows, localAttempt: local.id };
}
const repo = 'repos/roopism/ThestralUI';
const api = path => JSON.parse(execFileSync('gh', ['api', '--hostname', 'github.com', repo + path]));
export async function hostedEvidence(root, common, number, attempt) {
  assert.match(number, /^[1-9]\d*$/);
  if (attempt !== undefined) assert.match(attempt, /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
  const pr = api('/pulls/' + number);
  const base = api('/git/ref/heads/feat/enterprise-ui').object.sha;
  const expected = cloudProposal(root, base, pr.merge_commit_sha, pr);
  const shards = planAt(root, base, expected.merge);
  const required = shards.filter(row => row.lane !== 'local').map(({ id }) => ({ id }));
  let prior;
  if (attempt) {
    prior = readFileSync(join(common, 'uld-receipts/attempts', attempt + '.json'));
    const local = JSON.parse(prior);
    assert.equal(local.id, attempt);
    combineEvidence(expected, shards, required, local);
  }
  const runId = await startHostedRun(root, common, expected);
  async function waitForHosted() {
    for (;;) {
      const run = api('/actions/runs/' + runId);
      assert.equal(run.run_attempt, 1);
      if (run.status === 'completed') return readHostedVerdict(root, runId, expected);
      await delay(15000);
    }
  }
  const outcomes = await Promise.allSettled([waitForHosted(), prior ?? collectPhysicalEvidence(root, common, expected)]);
  const failures = outcomes.filter(item => item.status === 'rejected');
  if (failures.length) throw new AggregateError(failures.map(item => item.reason), 'Qualification lanes failed');
  const [hosted, bytes] = outcomes.map(item => item.value);
  const report = { ...combineEvidence(expected, shards, hosted, JSON.parse(bytes)),
    runId, localEvidenceSha256: sha256(bytes) };
  const directory = join(common, 'uld-delivery/cloud-evidence');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const path = join(directory, expected.merge + '-' + runId + '.json');
  const content = JSON.stringify(report, null, 2) + '\n';
  try { writeFileSync(path, content, { flag: 'wx', mode: 0o600 }); }
  catch (error) { if (error.code !== 'EEXIST' || readFileSync(path, 'utf8') !== content) throw error; }
  return path;
}
