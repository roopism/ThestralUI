// Only these two fresh subprocesses may supply preflight results to qualification.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname } from 'node:path';
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
  const result = await run();
  const durationMs = Math.round(performance.now() - start);
  if (before && before === identity()) {
    try {
      const outputs = captureOutputs(ctx.directory, ctx.snapshot, name);
      ctx.reuseStages.push({ name, result: 'passed', fingerprint: before, durationMs, outputs });
    } catch (error) { console.error('Preflight output capture unavailable for ' + name + ': ' + error.message); }
  }
  return result;
}

// Use the source attempt by ID so a later passing preflight cannot replace evidence at landing.
export function preflightSource(directory, context, id, groupId, fingerprint) {
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
  const record = { sourceKind: 'preflight', sourceAttempt: id, sourceReceiptSha256: sha256(bytes), tree: source.tree,
    groupId, fingerprint, createdAt: source.finished, retries: 0, result: 'passed' };
  return { source, row, evidence: row, record };
}
