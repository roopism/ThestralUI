import { requireOriginalReceipt, sealReceipt } from './reuse/runner.mjs';
import { readBytes } from './reuse/store.mjs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const oid = /^[a-f0-9]{40}$/;
export const preflightScript = 'scripts/verify-preflight.mjs';
// The receipt lists every check in this order. Qualification accepts only all of them.
export const preflightChecks = [
  'Gate isolation',
  'No weakening',
  'Qualification policy review',
  'Generated files',
  'Roster completeness',
  'Commit hook on the exact tree',
  'Fast and Typed',
  'Banned words and owners',
];

export const preflightDirectory = common => join(common, 'uld-receipts', 'preflight');

// The integration copy judges a candidate once it has landed. Before that, the
// candidate's committed copy is the only one, so it must be exactly that blob.
export function preflightRunner(root, base, commit) {
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  for (const revision of [base, commit]) {
    const entry = git('ls-tree', revision, '--', preflightScript);
    if (!entry) continue;
    const match = /^100(?:644|755) blob ([a-f0-9]{40})\t/.exec(entry);
    assert.ok(match, 'The preflight entry must be a regular file at ' + revision);
    return { source: revision === base ? 'integration' : 'candidate', blob: match[1] };
  }
}

// Only a sealed integration verdict can admit a failed preflight for evidence collection.
export function judgeOnlyFindings(receipt) {
  if (receipt.status !== 'failed' || receipt.reuseSchema !== 1 || receipt.runner?.source !== 'integration' ||
      !Array.isArray(receipt.checks) || receipt.checks.length !== preflightChecks.length) return;
  const findings = [];
  for (const [index, check] of receipt.checks.entries()) {
    if (check.name !== preflightChecks[index] || !Array.isArray(check.phases) || !check.phases.length) return;
    const failed = check.phases.filter(phase => phase.result !== 'passed');
    if (check.result !== (failed.length ? 'failed' : 'passed')) return;
    for (const phase of failed) {
      const judge = ['No weakening', 'Qualification policy review'].includes(check.name) && phase.name === 'integration base';
      const parent = check.name === 'Commit hook on the exact tree' && phase.name === 'each commit against its parent';
      if (!(judge || parent) || phase.result !== 'failed' || 'reason' in phase ||
          !Array.isArray(phase.findings) || !phase.findings.length ||
          !phase.findings.every(issue => typeof issue === 'string' && issue.length) ||
          JSON.stringify(phase.issues) !== JSON.stringify(phase.findings.slice(0, 200))) return;
      findings.push(...phase.findings);
    }
  }
  return findings.length ? findings : undefined;
}

export function publishPreflightVerdict(root, common, receipt) {
  if (receipt.reuseSchema === 1 && (receipt.status === 'passed' || judgeOnlyFindings(receipt))) sealReceipt(root, receipt);
  // A newer refusal supersedes any earlier diagnostic admission of the same tree.
  return writePreflightReceipt(common, receipt, true);
}

// Every attempt keeps its own file.
export function writePreflightReceipt(common, receipt, publish = receipt.status === 'passed') {
  const directory = preflightDirectory(common);
  mkdirSync(join(directory, 'attempts'), { recursive: true });
  const body = JSON.stringify(receipt, null, 2) + '\n';
  const attempt = join(directory, 'attempts', receipt.id + '.json');
  writeFileSync(attempt + '.tmp', body, { mode: 0o600 });
  renameSync(attempt + '.tmp', attempt);
  if (!publish) return attempt;
  const published = join(directory, receipt.tree + '.json');
  writeFileSync(published + '.' + process.pid, body, { mode: 0o600 });
  renameSync(published + '.' + process.pid, published);
  return published;
}

export function preflightCommand(commit, branch) {
  return 'node scripts/verify-preflight.mjs ' + commit + ' --branch ' + (branch ?? '<proposal branch>');
}

// Qualification starts only from an admissible preflight of this exact commit, tree,
// integration base and judging script. Older integration histories predate it.
export function requirePreflight(root, common, base, commit, tree, attemptId) {
  for (const id of [base, commit, tree]) assert.match(id, oid, 'Expected a full Git object ID');
  const runner = preflightRunner(root, base, commit);
  if (!runner) return;
  if (attemptId !== undefined) assert.match(attemptId, /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
  const file = attemptId === undefined ? tree + '.json' : 'attempts/' + attemptId + '.json';
  const path = join(preflightDirectory(common), file);
  const refuse = reason => {
    throw Error('Qualification refused: ' + reason + '. Run the cheap checks first: ' + preflightCommand(commit) +
      ' (receipt ' + path + ')');
  };
  if (!existsSync(path)) refuse('no passing preflight receipt exists for tree ' + tree);
  const bytes = readBytes(preflightDirectory(common), file);
  const receipt = JSON.parse(bytes);
  if (attemptId !== undefined) assert.equal(receipt.id, attemptId);
  if (receipt.schema !== 1 || receipt.kind !== 'preflight' || receipt.tree !== tree) refuse('the preflight receipt is malformed');
  const diagnostic = judgeOnlyFindings(receipt);
  if (receipt.status !== 'passed' && !diagnostic) refuse('the preflight receipt did not pass');
  if (receipt.base !== base) refuse('integration moved from ' + receipt.base + ' to ' + base + ' after preflight');
  if (receipt.commit !== commit) refuse('preflight checked commit ' + receipt.commit + ', not ' + commit);
  if (receipt.runner?.blob !== runner.blob) refuse('preflight ran ' + receipt.runner?.blob + ' instead of the ' + runner.source + ' script ' + runner.blob);
  const names = (receipt.checks ?? []).map(check => check.name);
  if (JSON.stringify(names) !== JSON.stringify(preflightChecks) || (!diagnostic && !receipt.checks.every(check => check.result === 'passed')))
    refuse('the preflight receipt does not record every passing check');
  const adopted = execFileSync('git', ['--no-replace-objects', 'ls-tree', base, '--', 'scripts/gates/reuse/preflight.mjs'], { cwd: root }).length;
  if (adopted || receipt.reuseSchema !== undefined) {
    try {
      assert.equal(receipt.reuseSchema, 1);
      requireOriginalReceipt(root, receipt, base);
      assert.ok(bytes.equals(Buffer.from(JSON.stringify(receipt, null, 2) + '\n')));
      assert.ok(bytes.equals(readBytes(preflightDirectory(common), 'attempts/' + receipt.id + '.json')));
    } catch { refuse('the preflight receipt differs from its sealed verdict'); }
  }
  return receipt;
}
