import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { cloudProposal, startHostedRun } from './proposal.mjs';
import { readHostedVerdict } from './github.mjs';
import { planAt } from './plan.mjs';
import { collectPhysicalEvidence } from './local-snapshots.mjs';
import { requireOriginalReceipt, requirePhysicalSeal } from '../reuse/runner.mjs';
import { sha256 } from './results.mjs';
import { withTimingReservation } from '../../workers/timing-reservation.mjs';

function requireHostedCoverage(shards, hosted) {
  assert.deepEqual(hosted.map(row => row.id).sort(), shards.filter(row => row.lane !== 'local').map(row => row.id).sort());
}

export function combineEvidence(expected, shards, hosted, local, visualRoster) {
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
    const entry = { id: shard.id, durationMs: row.durationMs };
    if (shard.suite === 'Mac visual comparisons') {
      assert.ok(Array.isArray(visualRoster?.cases) && visualRoster.cases.length, 'Missing committed local visual matrix');
      assert.ok(row.coverage, 'Missing case-level visual evidence on this exact tree; the suite summary alone cannot verify it');
      assert.deepEqual(visualRoster.projects, ['chromium', 'firefox', 'webkit']);
      assert.deepEqual(row.coverage, { tree: expected.tree, projects: visualRoster.projects, cases: visualRoster.cases },
        'Local visual evidence must cover every registered case on this exact tree');
      entry.coverage = row.coverage;
    }
    rows.push(entry);
  }
  return { base: expected.base, merge: expected.merge, tree: expected.tree, hosted, local: rows, localAttempt: local.id };
}
const repo = 'repos/roopism/ThestralUI';
const api = (path, ...options) => JSON.parse(execFileSync('gh', ['api', '--hostname', 'github.com', ...options, repo + path]));
// Rerunning an old workflow preserves its creation time. Compare every retained
// run ID and attempt before and after measuring, with no requests during timing.
export function requireHostedIdle() {
  const attempts = new Map();
  let count;
  for (let page = 1; ; page++) {
    const { total_count, workflow_runs } = api('/actions/runs?per_page=100&page=' + page,
      '--jq', '{total_count, workflow_runs: (.workflow_runs | map({id, status, run_attempt}))}');
    assert.ok(Number.isSafeInteger(total_count) && total_count >= 0 && Array.isArray(workflow_runs),
      'Incomplete hosted workflow listing');
    count ??= total_count;
    assert.equal(total_count, count, 'Hosted workflow listing changed during pagination');
    assert.equal(workflow_runs.length, Math.min(100, count - attempts.size), 'Incomplete hosted workflow page');
    for (const run of workflow_runs) {
      assert.ok(Number.isSafeInteger(run.id) && run.id > 0 && !attempts.has(run.id), 'Invalid or duplicate hosted workflow ID');
      assert.equal(run.status, 'completed', 'Local timing requires every hosted workflow to be completed');
      assert.ok(Number.isSafeInteger(run.run_attempt) && run.run_attempt > 0, 'Missing hosted workflow attempt');
      attempts.set(run.id, run.run_attempt);
    }
    if (attempts.size === count) return attempts;
  }
}

export async function whileHostedIdle(measure) {
  const before = requireHostedIdle();
  const result = await measure();
  assert.deepEqual(requireHostedIdle(), before, 'A hosted workflow started or was retried during the local measurement');
  return result;
}

export async function hostedEvidence(root, common, number, attempt) {
  assert.match(number, /^[1-9]\d*$/);
  if (attempt !== undefined) assert.match(attempt, /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
  const pr = api('/pulls/' + number);
  const base = api('/git/ref/heads/feat/enterprise-ui').object.sha;
  const expected = cloudProposal(root, base, pr.merge_commit_sha, pr);
  const shards = planAt(root, base, expected.merge);
  const visualRoster = shards.some(row => row.lane === 'local' && row.suite === 'Mac visual comparisons')
    ? JSON.parse(execFileSync('git', ['--no-replace-objects', 'show', expected.merge + ':tests/acceptance/visual-matrix.json'], { cwd: root }))
    : undefined;
  let prior, priorLocal, visualEvidenceSha256;
  if (attempt) {
    prior = readFileSync(join(common, 'uld-receipts/attempts', attempt + '.json'));
    const local = JSON.parse(prior);
    assert.equal(local.id, attempt);
    assert.equal(local.reuseSchema, 1, 'Combined evidence requires a sealed qualification attempt');
    requireOriginalReceipt(root, local, expected.base);
    const visual = local.suites.find(row => row.name === 'Mac visual comparisons');
    if (visualRoster && visual?.result === 'passed' && !visual.coverage) {
      // Older ordinary receipts contain a suite summary. An immutable, host-written
      // physical report for the exact proposal can supply its actual case-level proof.
      let saved;
      try {
        saved = readFileSync(join(common, 'uld-delivery/cloud-local', expected.base + '-' + expected.merge, 'local.json'));
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        throw Error('Missing case-level visual evidence for this prior attempt; no hosted or device work was started');
      }
      const physical = JSON.parse(saved);
      requirePhysicalSeal(root, physical);
      assert.deepEqual([physical.base, physical.commit, physical.tree, physical.mode],
        [expected.base, expected.merge, expected.tree, 'qualification']);
      assert.ok(['passed', 'failed'].includes(physical.status), 'Visual evidence needs a finalized physical report');
      const visuals = physical.suites.filter(row => row.name === 'Mac visual comparisons');
      assert.equal(visuals.length, 1, 'Missing or duplicate saved visual suite');
      assert.equal(visuals[0].result, 'passed');
      assert.ok(Number.isFinite(visuals[0].durationMs) && visuals[0].durationMs > 0);
      visual.coverage = visuals[0].coverage;
      visualEvidenceSha256 = sha256(saved);
    }
    priorLocal = local;
    // Preflight only the local subset before dispatch. Hosted proof arrives separately.
    combineEvidence(expected, shards.filter(row => row.lane === 'local'), [], local, visualRoster);
  }
  async function waitForHosted() {
    const runId = await startHostedRun(root, common, expected);
    for (;;) {
      const run = api('/actions/runs/' + runId);
      assert.equal(run.id, runId, 'Hosted qualification run ID changed');
      assert.equal(run.head_sha, expected.merge, 'Hosted qualification belongs to another commit');
      assert.equal(run.run_attempt, 1);
      if (run.status === 'completed') {
        assert.equal(run.conclusion, 'success', 'Hosted qualification did not pass');
        const hosted = await readHostedVerdict(root, runId, expected);
        requireHostedCoverage(shards, hosted);
        return { runId, hosted };
      }
      assert.ok(['queued', 'in_progress', 'requested', 'waiting', 'pending'].includes(run.status), 'Unknown hosted workflow status');
      await delay(15000);
    }
  }
  const outcomes = await Promise.allSettled([
    withTimingReservation(root, 'activity', 'Hosted qualification ' + expected.merge, waitForHosted),
  ]);
  if (outcomes[0].status === 'fulfilled') {
    const { runId } = outcomes[0].value;
    const local = async () => {
      if (prior) return prior;
      assert.equal(requireHostedIdle().get(runId), 1, 'The verified hosted attempt is missing from the idle listing');
      return collectPhysicalEvidence(root, common, expected);
    };
    outcomes.push(...await Promise.allSettled([local()]));
  }
  const failures = outcomes.filter(item => item.status === 'rejected');
  if (failures.length) throw new AggregateError(failures.map(item => item.reason), 'Qualification lanes failed');
  const [{ runId, hosted }, bytes] = outcomes.map(item => item.value);
  const physical = priorLocal ?? JSON.parse(bytes);
  if (!priorLocal) requirePhysicalSeal(root, physical);
  const report = { ...combineEvidence(expected, shards, hosted, physical, visualRoster),
    runId, localEvidenceSha256: sha256(bytes), ...(visualEvidenceSha256 && { visualEvidenceSha256 }) };
  const directory = join(common, 'uld-delivery/cloud-evidence');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const path = join(directory, expected.merge + '-' + runId + '.json');
  const content = JSON.stringify(report, null, 2) + '\n';
  try { writeFileSync(path, content, { flag: 'wx', mode: 0o600 }); }
  catch (error) { if (error.code !== 'EEXIST' || readFileSync(path, 'utf8') !== content) throw error; }
  return path;
}
