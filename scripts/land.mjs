import { requireOriginalReceipt, verifyLandingReuse } from './gates/reuse/runner.mjs';
import { projectStoredPasses } from './gates/reuse/store.mjs';
import { reusePolicyIssues } from './gates/reuse/strength.mjs';
import { withRevisionSnapshot } from '../packages/policy/quality/staged-tree.mjs';
import { installSnapshotDependencies } from '../packages/policy/quality/snapshot-dependencies.mjs';
import { relatedHistory, requireReviewedFailures, treeHistory } from './gates/receipt-history.mjs';
import { reviewPolicy } from './gates/review/qualification-policy.mjs';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { requireGateIsolation, recordMergeResult, requireResolvedMerge } from './gates/landing-policy.mjs';
import { stagedDiff } from './selection/staged-tree.mjs';
import { withLock } from './workers/lock.mjs';

const number = process.argv[2];
if (import.meta.main) assert.match(number ?? '', /^[1-9]\d*$/, 'Usage: npm run land <PR number>');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const root = git('rev-parse', '--show-toplevel');
const common = git('rev-parse', '--path-format=absolute', '--git-common-dir');
const repo = 'thetechgeeek/ThestralUI', integration = 'feat/enterprise-ui';
const slug = 'repos/' + repo + '/pulls/' + number;
const api = (endpoint, method = 'GET', body) => JSON.parse(execFileSync('gh', ['api', '--method', method,
  endpoint, ...(body ? ['--input', '-'] : [])], { input: body && JSON.stringify(body), encoding: 'utf8' }));
const oid = /^[0-9a-f]{40}$/;
export const required = ['No weakening', 'Fast', 'Typed and unit rosters', 'Browser and visual rosters', 'Catalog build',
  'Packed component specifications', 'Packed consumers min', 'Packed consumers max', 'Packed bundle limits',
  'Portable web scenarios', 'Mac browser behavior', 'Mac visual comparisons', 'Scoped styles', 'Mac browser performance',
  'Native package consumer', 'Linux browser behavior', 'iPhone Simulator', 'Android standard and low-end'];
function proposal() {
  const reported = api(slug);
  // The PR can retain the SHA at opening. Get the current target from GitHub
  // and verify it against the fetched branch and the actual merge parents.
  const target = api('repos/' + repo + '/git/ref/heads/' + integration);
  assert.equal(target.ref, 'refs/heads/' + integration);
  assert.match(reported.base.sha, oid);
  const pr = { ...reported, base: { ...reported.base, sha: target.object.sha } };
  assert.equal(pr.state, 'open');
  assert.equal(pr.base.repo.full_name, repo);
  assert.equal(pr.head.repo.full_name, repo);
  assert.equal(pr.base.ref, integration);
  assert.match(pr.head.ref, /^(family|gates|docs)\/[a-z0-9][a-z0-9-]*$/);
  assert.ok(!pr.draft && !pr.merged);
  for (const sha of [pr.base.sha, pr.head.sha]) assert.match(sha, oid);
  const remote = git('remote', 'get-url', 'origin');
  assert.ok(['https://github.com/' + repo + '.git', 'https://github.com/' + repo, 'git@github.com:' + repo + '.git'].includes(remote));
  git('fetch', '--no-tags', 'origin', '+refs/pull/' + number + '/merge:refs/uld-proposals/' + number + '/merge',
    '+refs/heads/' + integration + ':refs/remotes/origin/' + integration);
  git('merge-base', '--is-ancestor', reported.base.sha, pr.base.sha);
  const merge = git('rev-parse', 'refs/uld-proposals/' + number + '/merge');
  assert.deepEqual(git('show', '-s', '--format=%P', merge).split(' '), [pr.base.sha, pr.head.sha]);
  assert.equal(git('rev-parse', 'refs/remotes/origin/' + integration), pr.base.sha);
  const tree = git('rev-parse', merge + '^{tree}');
  const paths = stagedDiff(root, { parent: pr.base.sha, tree }).changes.map(change => change.path);
  requireGateIsolation(pr.head.ref, paths);
  assert.deepEqual(reviewPolicy(root, pr.base.sha, tree), []);
  assert.deepEqual(reusePolicyIssues(root, pr.base.sha, tree), []);
  return { pr, merge, tree };
}
function ownerDecisions(base) {
  const ledger = git('show', base + ':docs/ui-lazy-dev-state.md');
  return /^## Owner decisions\s*$([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(ledger)?.[1] ?? '';
}

function requireProposalHistory(tree, base, directory, proposal) {
  const path = join(directory, tree + '.json');
  const first = existsSync(path) ? JSON.parse(readFileSync(path)) : undefined;
  const target = proposal.commit ? { tree, base, commit: proposal.commit } : first?.commit ? first : undefined;
  const history = relatedHistory(directory, tree, first, proposal.root ?? root, target);
  requireReviewedFailures(directory, tree, history, () => ownerDecisions(base));
}
export function passing(tree, base, directory = join(common, 'uld-receipts'), proposal = {}) {
  assert.match(tree, oid);
  assert.match(base, oid);
  requireProposalHistory(tree, base, directory, proposal);
  const path = join(directory, tree + '.json');
  if (!existsSync(path)) return;
  const first = JSON.parse(readFileSync(path));
  const history = treeHistory(directory, tree, first);
  requireReviewedFailures(directory, tree, history, () => ownerDecisions(base));
  const available = history.filter(item => item.base === base && item.status === 'passed');
  const raw = available.sort((a, b) => (b.finished ?? '').localeCompare(a.finished ?? '')).at(0) ?? first;
  if (raw.status === 'passed' && raw.base === base) requireOriginalReceipt(proposal.root ?? root,raw,base);
  const r = projectStoredPasses(directory, raw);
  if (r.status === 'passed' && r.base === base && raw.suites.some(row => row.result === 'reused' || row.auditRerun)) {
    const checkout = proposal.root ?? root;
    withRevisionSnapshot(checkout, tree, (snapshot, actual, env) => {
      assert.equal(actual, tree);
      installSnapshotDependencies(snapshot, join(directory, '..', 'uld-dependencies'), env);
      verifyLandingReuse({ directory, root: checkout, snapshot }, raw);
    });
  }
  assert.equal(r.tree, tree);
  assert.ok(r.mode === 'qualification' || r.mode === 'release');
  if (r.status !== 'passed') return;
  assert.deepEqual(r.suites.map(row => row.name), required);
  assert.ok(r.vm?.browsers && r.vm?.sourceImageSha256 && r.devices.android.length === 2);
  assert.deepEqual(r.devices.android.map(device => device.id).sort(), ['low-end', 'standard']);
  assert.ok(r.scope.iphone ? r.devices.iphone?.passed : !r.devices.iphone);
  assert.ok(r.suites.every(row => Number.isFinite(row.durationMs) && (row.result === 'passed' ||
    row.name === 'iPhone Simulator' && !r.scope.iphone && row.result === 'web-only')));
  if (r.base !== base) return;
  return raw;
}
if (import.meta.main) await withLock(root, 'landing', 'PR ' + number, async () => {
  const directory = join(common, 'uld-receipts');
  requireResolvedMerge(directory, (commit, actualTree) => {
    assert.equal(git('rev-parse', commit + '^{tree}'), actualTree);
    return passing(actualTree, commit, directory, { commit });
  });
  const { pr, merge, tree } = proposal();
  let receipt = passing(tree, pr.base.sha, directory, { commit: merge });
  if (!receipt) {
    // The first run belongs to qualify. Only a verified movement of a previously
    // qualified base permits this command to start another expensive run.
    const headTree = git('rev-parse', pr.head.sha + '^{tree}');
    const candidates = [];
    const receipts = join(common, 'uld-receipts');
    if (existsSync(receipts)) {
      const { readdirSync } = await import('node:fs');
      for (const path of readdirSync(receipts).filter(path => /^[a-f0-9]{40}\.json$/.test(path))) {
        const item = JSON.parse(readFileSync(join(receipts, path)));
        if (item.status !== 'passed' || !oid.test(item.commit) || item.base === pr.base.sha) continue;
        const parents = git('show', '-s', '--format=%P', item.commit).split(' ');
        if (parents.includes(pr.head.sha) || item.tree === headTree || item.tree === tree) candidates.push(item);
      }
    }
    const previous = candidates.find(item => oid.test(item.base) && passing(item.tree, item.base, directory, { commit: item.commit }));
    assert.ok(previous, 'Run npm run qualify on the current merge result first');
    execFileSync(process.execPath, ['scripts/qualify.mjs', merge], { stdio: 'inherit' });
    receipt = passing(tree, pr.base.sha, directory, { commit: merge });
    assert.ok(receipt, 'Requalification did not produce a passing receipt');
  }
  const latest = proposal();
  assert.equal(latest.pr.base.sha, receipt.base, 'Integration moved while qualifying');
  assert.equal(latest.tree, tree, 'The merge result changed while qualifying');
  assert.equal(latest.pr.head.sha, pr.head.sha, 'The proposed head changed');
  const archive = 'refs/uld-archive/landed/' + number + '/' + pr.head.sha;
  if (!git('for-each-ref', '--format=%(refname)', archive)) git('update-ref', archive, pr.head.sha, '0'.repeat(40));
  assert.equal(git('rev-parse', archive), pr.head.sha);
  const summary = ['Local qualification passed for tree ' + tree + '.', '',
    ...receipt.suites.map(row => '- ' + row.name + ' — ' + row.result + ' (' + (row.durationMs / 1000).toFixed(1) + ' s)')].join('\n');
  api('repos/' + repo + '/issues/' + number + '/comments', 'POST', { body: summary });
  const status = spawnSync('gh', ['api', '--method', 'POST', 'repos/' + repo + '/statuses/' + pr.head.sha,
    '--input', '-'], { input: JSON.stringify({ state: 'success', context: 'local/qualification',
    description: 'Qualified merge tree ' + tree }), encoding: 'utf8' });
  if (status.status !== 0) {
    if (!/HTTP 403|Resource not accessible|insufficient.*permission/i.test(status.stderr ?? '')) throw Error('Unable to post commit status: ' + status.stderr);
    mkdirSync(join(common, 'uld-receipts'), { recursive: true });
    appendFileSync(join(common, 'uld-receipts', 'status-denials.log'), new Date().toISOString() + ' PR ' + number + '\n');
  }
  const last = proposal();
  assert.equal(last.pr.base.sha, receipt.base, 'Integration moved before landing');
  assert.equal(last.tree, tree);
  assert.equal(last.pr.head.sha, pr.head.sha);
  assert.ok(passing(tree, last.pr.base.sha), 'Qualification history changed before landing');
  requireProposalHistory(tree, last.pr.base.sha, directory, { commit: last.merge });
  const merged = api(slug + '/merge', 'PUT', { sha: pr.head.sha, merge_method: 'squash' });
  assert.equal(merged.merged, true);
  assert.match(merged.sha, oid);
  const confirmed = api('repos/' + repo + '/git/commits/' + merged.sha);
  recordMergeResult(directory, merged.sha, confirmed.tree.sha, tree);
  assert.equal(confirmed.tree.sha, tree, 'GitHub merged a different tree');
  git('fetch', '--no-tags', 'origin', '+refs/heads/' + integration + ':refs/remotes/origin/' + integration);
  git('merge-base', '--is-ancestor', merged.sha, 'refs/remotes/origin/' + integration);
  const ref = 'refs/heads/' + pr.head.ref;
  const remote = git('ls-remote', '--refs', 'origin', ref);
  if (remote) {
    assert.equal(remote.split(/\s/)[0], git('rev-parse', archive));
    git('-c', 'push.followTags=false', 'push', '--force-with-lease=' + ref + ':' + pr.head.sha, 'origin', ':' + ref);
  }
  console.log('Landed PR', number, 'at', merged.sha, 'with tree', tree);
});
