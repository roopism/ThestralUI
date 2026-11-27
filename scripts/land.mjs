import { verifiedDevicePlan, requireGateTimingEvidence, requireScopedEvidence } from './gates/device-verdict.mjs';
import { requirePairedMeasurement, timingForIdenticalApk } from './gates/android-timing-reuse.mjs';
import { requireObservedSource } from './gates/android-host-activity.mjs';
import { requireOriginalReceipt, verifyLandingReuse } from './gates/reuse/runner.mjs';
import { projectStoredPasses } from './gates/reuse/store.mjs';
import { reusePolicyIssues } from './gates/reuse/strength.mjs';
import { withRevisionSnapshot } from '../packages/policy/quality/staged-tree.mjs';
import { installSnapshotDependencies } from '../packages/policy/quality/snapshot-dependencies.mjs';
import { relatedHistory, requireReviewedFailures, treeHistory } from './gates/receipt-history.mjs';
import { reviewPolicy } from './gates/review/qualification-policy.mjs';
import { assertTimingConfigChange, readTimingConfig } from './gates/timing/config-policy.mjs';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { requireGateIsolation, recordMergeResult, requireResolvedMerge } from './gates/landing-policy.mjs';
import { derivedRegistrations } from './gates/registrations.mjs';
import { stagedDiff } from './selection/staged-tree.mjs';
import { withLock } from './workers/lock.mjs';
import { trustedVerdict } from './gates/verdict.mjs';

const number = process.argv[2];
if (import.meta.main && number === '--train') {
  const { resumeTrainCommand: landTrainCommand, reportEjections } = await import('./train.mjs');
  const train = await landTrainCommand(process.argv.slice(3));
  reportEjections(train);
  if (train.status === 'passed') console.log('Landed train', train.id, 'at', train.landedCommit ?? train.finalCommit, 'with tree', train.finalTree);
  process.exit(0);
}
if (import.meta.main) assert.match(number ?? '', /^[1-9]\d*$/, 'Usage: npm run land <PR number>');
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { encoding: 'utf8' }).trim();
const root = git('rev-parse', '--show-toplevel');
const common = git('rev-parse', '--path-format=absolute', '--git-common-dir');
const repo = 'roopism/ThestralUI', integration = 'feat/enterprise-ui';
const pull = number => 'repos/' + repo + '/pulls/' + number;
const api = (endpoint, method = 'GET', body) => JSON.parse(execFileSync('gh', ['api', '--method', method,
  endpoint, ...(body ? ['--input', '-'] : [])], { input: body && JSON.stringify(body), encoding: 'utf8' }));
const oid = /^[0-9a-f]{40}$/;
export const required = ['No weakening', 'Fast', 'Typed and unit rosters', 'Browser and visual rosters', 'Catalog build',
  'Packed component specifications', 'Packed consumers min', 'Packed consumers max', 'Packed bundle limits',
  'Portable web scenarios', 'Mac browser behavior', 'Mac visual comparisons', 'Scoped styles', 'Mac browser performance',
  'Native package consumer', 'Linux browser behavior', 'iPhone Simulator', 'Android standard and low-end'];
export function proposal(number = process.argv[2]) {
  const reported = api(pull(number));
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
  requireGateIsolation(pr.head.ref, paths, undefined, derivedRegistrations(root, pr.base.sha, tree, pr.head.ref));
  assert.deepEqual(reviewPolicy(root, pr.base.sha, tree), []);
  assert.deepEqual(reusePolicyIssues(root, pr.base.sha, tree), []);
  assertTimingConfigChange(root, pr.base.sha, tree);
  return { pr, merge, tree };
}
function ownerDecisions(base) {
  const ledger = git('show', base + ':docs/ui-lazy-dev-state.md');
  return /^## Owner decisions\s*$([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(ledger)?.[1] ?? '';
}

export function requireProposalHistory(tree, base, directory, proposal) {
  const path = join(directory, tree + '.json');
  const first = existsSync(path) ? JSON.parse(readFileSync(path)) : undefined;
  const target = proposal.commit ? { tree, base, commit: proposal.commit } : first?.commit ? first : undefined;
  const history = relatedHistory(directory, tree, first, proposal.root ?? root, target);
  requireReviewedFailures(directory, tree, history, () => ownerDecisions(base),
    { root: proposal.root ?? root, base, roster: required });
}
export function passing(tree, base, directory = join(common, 'uld-receipts'), proposal = {}) {
  assert.match(tree, oid);
  assert.match(base, oid);
  requireProposalHistory(tree, base, directory, proposal);
  const path = join(directory, tree + '.json');
  if (!existsSync(path)) return;
  const first = JSON.parse(readFileSync(path));
  const history = treeHistory(directory, tree, first);
  const available = requireReviewedFailures(directory, tree, history, () => ownerDecisions(base),
    { root: proposal.root ?? root, base, roster: required });
  const candidates = available.filter(item => item.receipt.base === base);
  const selected = candidates.sort((a, b) => (b.receipt.finished ?? '').localeCompare(a.receipt.finished ?? '')).at(0);
  const raw = selected?.receipt ?? first;
  if (raw.status === 'passed' && raw.base === base) requireOriginalReceipt(proposal.root ?? root,raw,base);
  const r = projectStoredPasses(directory, selected?.verdict ?? raw);
  if (r.status === 'passed' && r.base === base && raw.suites.some(row => row.result === 'reused' || row.auditRerun)) {
    const checkout = proposal.root ?? root;
    withRevisionSnapshot(checkout, tree, (snapshot, actual, env) => {
      assert.equal(actual, tree);
      installSnapshotDependencies(snapshot, join(directory, '..', 'uld-dependencies'), env);
      verifyLandingReuse({ directory, root: checkout, snapshot }, raw);
    });
  }
  // When gate tests were the sole eligible operation they must themselves be the
  // fresh audit. There are no reusable outputs or environment claims to restore.
  if (r.status === 'passed' && raw.base === base && raw.gateTests &&
      !raw.suites.some(row => row.result === 'reused' || row.auditRerun)) {
    assert.notEqual(raw.gateTests.result, 'reused', 'Gate-test reuse requires an independent audit');
    if (raw.gateTests.auditRerun) verifyLandingReuse({ directory, root: proposal.root ?? root }, raw);
  }
  assert.equal(r.tree, tree);
  assert.ok(r.mode === 'qualification' || r.mode === 'release');
  if (r.status !== 'passed') return;
  assert.deepEqual(r.suites.map(row => row.name), required);
  // Both evidence protocols use the same history, seal, reuse verification and exact suite roster.
  switch (verifiedDevicePlan(proposal.root ?? root, r.base, tree, r)) {
    case 'gate-only timing':
      requireGateTimingEvidence(proposal.root ?? root, r);
      break;
    case 'scoped':
      requireScopedEvidence(r);
      break;
    case 'measured': {
      assert.ok(r.vm?.browsers && r.vm?.sourceImageSha256 && r.devices.android.length === 2);
      assert.deepEqual(r.devices.android.map(device => device.id).sort(), ['low-end', 'standard']);
      assert.ok(r.scope.iphone ? r.devices.iphone?.passed : !r.devices.iphone);
      assert.ok(r.suites.every(row => Number.isFinite(row.durationMs) && (row.result === 'passed' ||
        row.name === 'iPhone Simulator' && !r.scope.iphone && row.result === 'web-only')));
      const checkout = proposal.root ?? root;
      const config = readTimingConfig(checkout, tree);
      if (config?.active['android-low-end'] === 'paired-ab') {
        assert.equal(r.androidTiming?.result, 'timing measured', 'Paired timing requires measurements for both proposal trees');
        assert.equal(r.androidHostActivityPolicy, 1);
        const gitAt = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { cwd: checkout, encoding: 'utf8' }).trim();
        const budgets = JSON.parse(gitAt('show', tree + ':tests/android/low-end-budget.json'));
        const low = join(directory, 'attempts', r.id + '-evidence', 'android', 'low-end');
        requirePairedMeasurement(r.androidTiming, tree, gitAt('rev-parse', base + '^{tree}'), low, config, budgets);
      }
      if (r.androidHostActivityPolicy===1 || spawnSync('git',['--no-replace-objects','cat-file','-e',base+':scripts/gates/android-host-activity.mjs'],
          {cwd:proposal.root??root,stdio:'ignore'}).status===0) {
        assert.equal(r.androidHostActivityPolicy,1);
        const timing=r.androidTiming;
        if (timing?.result==='timing measured') {
          requireObservedSource(timing,r);
          const low=join(directory,'attempts',r.id+'-evidence','android','low-end');
          assert.deepEqual(JSON.parse(readFileSync(join(low,'timing-admission.json'))),timing.admission);
          assert.deepEqual(JSON.parse(readFileSync(join(low,'frame-measurements.json'))),timing.frameBudget);
        } else {
          assert.equal(timing?.result,'timing reused: identical app');
          const gitAt=(...args)=>execFileSync('git',['--no-replace-objects',...args],{cwd:proposal.root??root,encoding:'utf8'}).trim();
          const baseTree=gitAt('rev-parse',base+'^{tree}');
          assert.equal(timing.baseTree,baseTree);
          assert.equal(timing.sourceReceipt,'uld-receipts/'+baseTree+'.json');
          assert.match(timing.measuredReceipt,/^uld-receipts\/[a-f0-9]{40}\.json$/);
          const source=JSON.parse(readFileSync(join(directory,baseTree+'.json')));
          assert.equal(timing.baseApkSha256,source.androidTiming?.apkSha256);
          assert.deepEqual(timing.admission??null,source.androidTiming?.admission??null);
          if(timing.admission) requireObservedSource(timing,r);
          if(source.androidTiming?.entryManifestSha256) assert.equal(timing.baseEntryManifestSha256,source.androidTiming.entryManifestSha256);
          const limits=JSON.parse(gitAt('show',tree+':tests/android/low-end-budget.json')).limits;
          assert.ok(timing.frameBudget);
          assert.deepEqual(timingForIdenticalApk(source,baseTree,timing.apkSha256,limits,timing.entryManifestSha256,
            timing.baseEntryManifestSha256),timing.frameBudget);
        }
      }
      break;
    }
    default: throw Error('Unrecognized device evidence protocol');
  }
  if (r.base !== base) return;
  return selected?.evidence ? { ...selected.verdict, landingEvidence: selected.evidence } : raw;
}
export function archiveProposal(number, head) {
  const archive = 'refs/uld-archive/landed/' + number + '/' + head;
  if (!git('for-each-ref', '--format=%(refname)', archive)) git('update-ref', archive, head, '0'.repeat(40));
  assert.equal(git('rev-parse', archive), head);
  return archive;
}

export function postQualification(number, pr, tree, receipt, message = 'Local qualification passed for tree ' + tree + '.') {
  const summary = [message, '',
    ...(receipt.landingEvidence ?? []).map(({ failed, diagnostic }) =>
      '- Reviewed failure ' + failed + (diagnostic ? ' with timing diagnostic ' + diagnostic : ' against unchanged base')),
    ...receipt.suites.map(row => '- ' + row.name + ' — ' + row.result + ' (' + (row.durationMs / 1000).toFixed(1) + ' s)')].join('\n');
  api('repos/' + repo + '/issues/' + number + '/comments', 'POST', { body: summary });
  const status = spawnSync('gh', ['api', '--method', 'POST', 'repos/' + repo + '/statuses/' + pr.head.sha,
    '--input', '-'], { input: JSON.stringify({ state: 'success', context: 'local/qualification',
    description: 'Qualified merge tree ' + tree }), encoding: 'utf8' });
  return status;
}

function recordDenial(number) {
  mkdirSync(join(common, 'uld-receipts'), { recursive: true });
  appendFileSync(join(common, 'uld-receipts', 'status-denials.log'), new Date().toISOString() + ' PR ' + number + '\n');
}

export function checkStatus(number, status) {
  if (status.status !== 0) {
    if (!/HTTP 403|Resource not accessible|insufficient.*permission/i.test(status.stderr ?? '')) throw Error('Unable to post commit status: ' + status.stderr);
    recordDenial(number);
  }
}

export function mergeProposal(number, head) {
  return api(pull(number) + '/merge', 'PUT', { sha: head, merge_method: 'squash' });
}

export function confirmedCommit(sha) {
  assert.match(sha, oid);
  return api('repos/' + repo + '/git/commits/' + sha);
}

export function removeArchivedBranch(ref, head) {
  git('-c', 'push.followTags=false', 'push', '--force-with-lease=' + ref + ':' + head, 'origin', ':' + ref);
}

if (import.meta.main) await withLock(root, 'landing', 'PR ' + number, async () => {
  const directory = join(common, 'uld-receipts');
  if (existsSync(join(directory, 'train-landing-blocked.json'))) {
    const { reconcileTrainLanding } = await import('./train.mjs');
    await reconcileTrainLanding(directory, root);
  }
  requireResolvedMerge(directory, (commit, actualTree) => {
    assert.equal(git('rev-parse', commit + '^{tree}'), actualTree);
    const receipt = passing(actualTree, commit, directory, { commit });
    // Clearing a post-merge discrepancy still needs a full qualification of the actual commit.
    if (receipt?.landingEvidence?.some(item => item.failed === receipt.id)) return;
    return receipt;
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
    execFileSync(process.execPath, [trustedVerdict('verify-preflight.mjs'), merge, '--branch', pr.head.ref,
      '--base', pr.base.sha], { stdio: 'inherit' });
    execFileSync(process.execPath, ['scripts/qualify.mjs', merge], { stdio: 'inherit' });
    receipt = passing(tree, pr.base.sha, directory, { commit: merge });
    assert.ok(receipt, 'Requalification did not produce a passing receipt');
  }
  const latest = proposal();
  assert.equal(latest.pr.base.sha, receipt.base, 'Integration moved while qualifying');
  assert.equal(latest.tree, tree, 'The merge result changed while qualifying');
  assert.equal(latest.pr.head.sha, pr.head.sha, 'The proposed head changed');
  const archive = archiveProposal(number, pr.head.sha);
  assert.equal(git('rev-parse', archive), pr.head.sha);
  const status = postQualification(number, pr, tree, receipt);
  if (status.status !== 0) {
    if (!/HTTP 403|Resource not accessible|insufficient.*permission/i.test(status.stderr ?? '')) throw Error('Unable to post commit status: ' + status.stderr);
    recordDenial(number);
  }
  const last = proposal();
  assert.equal(last.pr.base.sha, receipt.base, 'Integration moved before landing');
  assert.equal(last.tree, tree);
  assert.equal(last.pr.head.sha, pr.head.sha);
  assert.ok(passing(tree, last.pr.base.sha), 'Qualification history changed before landing');
  requireProposalHistory(tree, last.pr.base.sha, directory, { commit: last.merge });
  const merged = mergeProposal(number, pr.head.sha);
  assert.equal(merged.merged, true);
  assert.match(merged.sha, oid);
  const confirmed = confirmedCommit(merged.sha);
  recordMergeResult(directory, merged.sha, confirmed.tree.sha, tree);
  assert.equal(confirmed.tree.sha, tree, 'GitHub merged a different tree');
  git('fetch', '--no-tags', 'origin', '+refs/heads/' + integration + ':refs/remotes/origin/' + integration);
  git('merge-base', '--is-ancestor', merged.sha, 'refs/remotes/origin/' + integration);
  const ref = 'refs/heads/' + pr.head.ref;
  const remote = git('ls-remote', '--refs', 'origin', ref);
  if (remote) {
    assert.equal(remote.split(/\s/)[0], git('rev-parse', archive));
    removeArchivedBranch(ref, pr.head.sha);
  }
  console.log('Landed PR', number, 'at', merged.sha, 'with tree', tree);
});
