// Only these two fresh subprocesses may supply preflight results to qualification.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { readArtifact } from '../../build-cache/artifact-cache.mjs';
import { preflightChecks, preflightRunner } from '../preflight-receipt.mjs';
import { captureOutputs } from './outputs.mjs';
import { requireOriginalReceipt, rowIdentity } from './runner.mjs';
import { readBytes, sha256 } from './store.mjs';

export const typedGroup = 'Typed and unit rosters';
export const gateGroup = 'Trusted gate tests';
export const preflightGroup = name => name === gateGroup || name === typedGroup;
export const reuseRows = receipt => receipt.gateTests ? [...receipt.suites, receipt.gateTests] : receipt.suites;

const git = (cwd, ...args) => execFileSync('git', ['--no-replace-objects', ...args], { cwd, encoding: 'utf8' }).trim();
const clean = (cwd, tree) => git(cwd, 'rev-parse', 'HEAD^{tree}') === tree &&
  git(cwd, 'status', '--porcelain', '--untracked-files=all') === '';

export function cleanPreflightInputs(ctx) {
  return clean(ctx.snapshot, ctx.tree) && (!ctx.trusted || clean(ctx.trusted, git(ctx.root, 'rev-parse', ctx.base + '^{tree}')));
}

// Capture the identity on both sides of the actual check. A missing fact or output
// only removes this optimization. The original check still runs and can fail.
export async function observePreflightStage(ctx, name, run) {
  const identity = () => {
    if (!ctx.reuseStages) return null;
    try {
      if (!cleanPreflightInputs(ctx)) return null;
      const row = rowIdentity(ctx, name);
      return !row.pipelineChanged && !row.config.exclude.length ? row.fingerprint : null;
    } catch { return null; }
  };
  const before = identity();
  const start = performance.now();
  let result;
  try {
    result = await run();
  } catch (error) {
    if (before && before === identity()) ctx.reuseStages.push({ name, result: 'failed', fingerprint: before });
    throw error;
  }
  const durationMs = Math.round(performance.now() - start);
  if (before && before === identity()) {
    try {
      const outputs = captureOutputs(ctx.directory, ctx.snapshot, name);
      ctx.reuseStages.push({ name, result: 'passed', fingerprint: before, durationMs, outputs });
    } catch (error) { console.error('Preflight output capture unavailable for ' + name + ': ' + error.message); }
  }
  return result;
}

// Older failed preflights have phase verdicts but no fingerprint for the failing stage.
function failedStageAttempts(directory, source, groupId, fingerprint, cutoff) {
  const folder = 'preflight/attempts/';
  const [checkName, phaseName] = groupId === typedGroup
    ? ['Fast and Typed', 'Typed'] : ['Commit hook on the exact tree', 'canaries and gate tests'];
  let failures = 0;
  for (const file of readdirSync(join(directory, folder))) {
    if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\.json$/.test(file)) continue;
    const attempt = JSON.parse(readBytes(directory, folder + file));
    assert.equal(file, attempt.id + '.json');
    if (attempt.status === 'passed' || attempt.base !== source.base || attempt.commit !== source.commit || attempt.tree !== source.tree) continue;
    assert.equal(attempt.status, 'failed');
    const finished = Date.parse(attempt.finished);
    assert.ok(Number.isFinite(finished));
    if (finished > cutoff) continue;
    const observed = attempt.reuseStages?.filter(row => row.name === groupId && row.result === 'failed');
    if (observed?.length === 1 && /^[a-f0-9]{64}$/.test(observed[0].fingerprint)) {
      if (observed[0].fingerprint === fingerprint) failures++;
      continue;
    }
    const check = attempt.checks.find(check => check.name === checkName);
    assert.ok(check, 'Missing preflight check in ' + file);
    if (check.result !== 'failed') continue;
    const failed = check.phases?.filter(phase => phase.result === 'failed');
    // A combined phase without a recorded stage may have reached the gate tests.
    if (!failed?.length || failed.some(phase => phase.name === phaseName &&
        (groupId !== gateGroup || phase.stage !== 'canaries'))) failures++;
  }
  return failures;
}

// Use the source attempt by ID so a later passing preflight cannot replace evidence at landing.
export function preflightSource(directory, context, id, groupId, fingerprint, includeLaterFailures = false) {
  assert.ok(preflightGroup(groupId));
  assert.match(id, /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
  assert.match(fingerprint, /^[a-f0-9]{64}$/);
  const bytes = readBytes(directory, 'preflight/attempts/' + id + '.json');
  const source = JSON.parse(bytes);
  const root = dirname(directory);
  assert.equal(source.reuseSchema, 1);
  requireOriginalReceipt(root, source, context.base);
  assert.equal(bytes.toString(), JSON.stringify(source, null, 2) + '\n');
  assert.deepEqual([source.schema, source.kind, source.id, source.status, source.base, source.commit, source.tree],
    [1, 'preflight', id, 'passed', context.base, context.commit, context.tree]);
  assert.equal(git(root, 'rev-parse', context.commit + '^{tree}'), context.tree);
  const runner = preflightRunner(root, context.base, context.commit);
  assert.equal(runner.source, 'integration');
  assert.deepEqual([source.runner.source, source.runner.blob], [runner.source, runner.blob]);
  assert.deepEqual(source.checks.map(check => [check.name, check.result]), preflightChecks.map(name => [name, 'passed']));
  const rows = source.reuseStages.filter(row => row.name === groupId);
  assert.equal(rows.length, 1);
  const [row] = rows;
  assert.equal(row.result, 'passed');
  assert.equal(row.fingerprint, fingerprint);
  assert.ok(Number.isFinite(row.durationMs) && row.durationMs >= 0);
  for (const output of row.outputs) assert.ok(readArtifact(root, output.sha), 'Missing or corrupt preflight output');
  const finished = Date.parse(source.finished);
  assert.ok(Number.isFinite(finished));
  const retries = failedStageAttempts(directory, source, groupId, fingerprint, includeLaterFailures ? Infinity : finished);
  const record = { sourceKind: 'preflight', sourceAttempt: id, sourceReceiptSha256: sha256(bytes), tree: source.tree,
    groupId, fingerprint, createdAt: source.finished, retries, result: 'passed' };
  return { source, row, evidence: row, record };
}
