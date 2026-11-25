import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, linkSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { withRevisionSnapshot } from '../packages/policy/quality/staged-tree.mjs';
import { installSnapshotDependencies } from '../packages/policy/quality/snapshot-dependencies.mjs';
import { requireResolvedMerge } from './gates/landing-policy.mjs';
import { confirmedZeroUpdateRejection, createTrain, inspectTrain, landTrain, pushAtomicTrain, readTrain, requireAtomicTrainTransport, trainGit } from './gates/merge-train.mjs';
import { treeHistory } from './gates/receipt-history.mjs';
import { withLock } from './workers/lock.mjs';

const repository = 'roopism/ThestralUI';
const integration = 'feat/enterprise-ui';
const oid = /^[0-9a-f]{40}$/;
const api = route => JSON.parse(execFileSync('gh', ['api', 'repos/' + repository + (route ? '/' + route : '')], { encoding: 'utf8' }));

export function requireTrainBranch(branch, rules, repo) {
  assert.equal(repo?.default_branch, integration, 'Indirect train merges require integration to be the default branch');
  assert.equal(branch.name, integration);
  assert.equal(typeof branch.protected, 'boolean', 'Missing branch protection information');
  assert.ok(Array.isArray(rules), 'Missing applicable branch rules');
  if (branch.protected || rules.length) throw Error('Protected integration requires a server transaction that enforces its PR and branch rules');
}

function github(root) {
  const git = (...args) => trainGit(root, ...args);
  const remote = git('remote', 'get-url', 'origin');
  assert.ok(['https://github.com/' + repository, 'https://github.com/' + repository + '.git',
    'git@github.com:' + repository + '.git'].includes(remote), 'Unexpected train repository');
  const pushUrls = git('remote', 'get-url', '--push', '--all', 'origin').split('\n');
  assert.deepEqual(pushUrls, [remote], 'The train requires one identical fetch and push URL');
  const target = 'heads/' + integration;
  const publicationTransaction = null;
  function requireGreen(number, head) {
    const review = JSON.parse(execFileSync('gh', ['pr', 'view', String(number), '--repo', repository,
      '--json', 'headRefOid,reviewDecision'], { encoding: 'utf8' }));
    assert.equal(review.headRefOid, head);
    assert.ok(Object.hasOwn(review, 'reviewDecision') && [null, '', 'APPROVED'].includes(review.reviewDecision), 'GitHub reviews are not green');
    const statuses = api('commits/' + head + '/status');
    assert.equal(statuses.sha, head);
    assert.ok(Number.isSafeInteger(statuses.total_count) && statuses.total_count >= 0);
    assert.ok(statuses.total_count === 0 || statuses.state === 'success', 'A commit status is red or pending');
    const pages = JSON.parse(execFileSync('gh', ['api', '--paginate', '--slurp',
      'repos/' + repository + '/commits/' + head + '/check-runs?filter=latest&per_page=100'], { encoding: 'utf8' }));
    assert.ok(pages.length && pages.every(page => Array.isArray(page.check_runs)), 'Missing GitHub check results');
    const checks = pages.flatMap(page => page.check_runs);
    assert.equal(new Set(checks.map(check => check.id)).size, pages[0].total_count, 'Incomplete GitHub check enumeration');
    for (const check of checks)
      assert.ok(check.head_sha === head && check.status === 'completed' && ['success', 'neutral', 'skipped'].includes(check.conclusion),
        'A GitHub check is red, pending or unknown');
  }
  function confirm(train) {
    const result = api('git/ref/' + target);
    assert.equal(result.ref, 'refs/' + target);
    assert.equal(result.object.sha, train.finalCommit, 'GitHub integration does not point at the qualified commit');
    const commit = api('git/commits/' + result.object.sha);
    assert.equal(commit.tree.sha, train.finalTree, 'GitHub landed a different tree');
    for (const m of train.members) {
      const pr = api('pulls/' + m.number);
      assert.deepEqual([pr.number, pr.base.repo.full_name, pr.base.ref, pr.head.repo.full_name, pr.head.ref, pr.head.sha, pr.merged],
        [m.number, repository, integration, repository, m.branch, m.head, true], 'GitHub has not confirmed the exact merged PR');
      requireGreen(m.number, m.head);
    }
    return commit.tree.sha;
  }
  return {
    base() {
      const ref = api('git/ref/' + target);
      assert.equal(ref.ref, 'refs/' + target);
      assert.match(ref.object.sha, oid);
      git('fetch', '--no-tags', 'origin', '+refs/' + target + ':refs/remotes/origin/' + integration);
      assert.equal(git('rev-parse', 'refs/remotes/origin/' + integration), ref.object.sha, 'Integration moved');
      return ref.object.sha;
    },
    member(number, base) {
      const pr = api('pulls/' + number);
      assert.equal(pr.number, number);
      assert.deepEqual([pr.state, pr.draft, pr.merged, pr.mergeable, pr.mergeable_state],
        ['open', false, false, true, 'clean'], 'PR must be open, ready, mergeable and green');
      assert.deepEqual([pr.base.repo.full_name, pr.base.ref, pr.head.repo.full_name], [repository, integration, repository]);
      requireGreen(number, pr.head.sha);
      assert.match(pr.base.sha, oid);
      assert.match(pr.head.sha, oid);
      assert.match(pr.merge_commit_sha, oid);
      git('fetch', '--no-tags', 'origin', 'refs/pull/' + number + '/merge');
      git('merge-base', '--is-ancestor', pr.base.sha, base);
      assert.equal(git('ls-remote', '--refs', 'origin', 'refs/pull/' + number + '/merge').split('\t')[0], pr.merge_commit_sha,
        'PR merge result changed');
      return { number, branch: pr.head.ref, head: pr.head.sha, soloCommit: pr.merge_commit_sha };
    },
    confirm,
    // GitHub exposes no verified transaction for a write conditional on unchanged PR heads.
    publicationTransaction,
    publish: (train, recheckHistory, transactionId) => pushAtomicTrain(root, remote, train, recheckHistory, publicationTransaction, transactionId),
    requireTransport() {
      const branch = encodeURIComponent(integration);
      requireTrainBranch(api('branches/' + branch), api('rules/branches/' + branch), api(''));
    },
  };
}

export function exactTrainQualification(root, directory, train, passing) {
  const file = join(directory, train.finalTree + '.json');
  const first = existsSync(file) ? JSON.parse(readFileSync(file)) : undefined;
  const history = treeHistory(directory, train.finalTree, first).filter(Boolean);
  if (!history.length) return;
  const exact = history.filter(r => r.base === train.base && r.commit === train.finalCommit && r.tree === train.finalTree);
  assert.ok(exact.length, 'This tree already has a different qualification identity; no duplicate full run');
  const incomplete = exact.find(r => r.status !== 'passed');
  if (incomplete) {
    assert.equal(incomplete.status, 'failed', 'An unfinished qualification already exists for this tree');
    return incomplete;
  }
  const receipt = passing(train.finalTree, train.base, directory, { root, commit: train.finalCommit });
  assert.ok(receipt && exact.some(r => r.id === receipt.id), 'Canonical landing checks did not verify this exact attempt');
  const attempt = JSON.parse(readFileSync(join(directory, 'attempts', receipt.id + '.json')));
  assert.deepEqual(receipt, attempt, 'The passing receipt differs from the original attempt');
  return receipt;
}

const quarantineFile = directory => join(directory, 'train-landing-blocked.json');

export async function reconcileTrainLanding(directory, root) {
  const file = quarantineFile(directory);
  if (!existsSync(file)) return;
  const blocked = JSON.parse(readFileSync(file));
  const train = readTrain(directory, blocked.id);
  assert.deepEqual([blocked.base, blocked.commit, blocked.tree], [train.base, train.finalCommit, train.finalTree]);
  const client = github(root);
  if (client.base() === train.base) {
    // A crash can leave the intent on disk before a push was sent.
    for (const member of train.members) {
      const current = client.member(member.number, train.base);
      assert.deepEqual([current.head, current.branch, current.soloCommit], [member.head, member.branch, member.soloCommit]);
    }
    unlinkSync(file);
    return;
  }
  assert.equal(client.confirm(train), train.finalTree, 'Unconfirmed earlier train landing');
  unlinkSync(file);
  return train;
}

function quarantine(directory, train) {
  const file = quarantineFile(directory);
  const tmp = file + '.' + train.id;
  const transactionId = randomUUID();
  writeFileSync(tmp, JSON.stringify({ id: train.id, base: train.base, commit: train.finalCommit, tree: train.finalTree, transactionId }) + '\n',
    { flag: 'wx', mode: 0o600 });
  try { linkSync(tmp, file); } finally { unlinkSync(tmp); }
  return transactionId;
}

export async function clearRejectedTrainIntent(root, directory, train, error, readBase) {
  const transactionId = await confirmedZeroUpdateRejection(train, error);
  if (!transactionId) return;
  const file = quarantineFile(directory);
  const expected = { id: train.id, base: train.base, commit: train.finalCommit, tree: train.finalTree, transactionId };
  assert.deepEqual(JSON.parse(readFileSync(file)), expected, 'Pending train intent changed');
  assert.equal(trainGit(root, 'rev-parse', train.finalCommit + '^{tree}'), train.finalTree);
  const tip = await readBase();
  assert.match(tip, oid);
  const line = trainGit(root, 'rev-list', '--first-parent', tip).split('\n');
  assert.ok(line.includes(train.base), 'Ambiguous integration history after transaction rejection');
  assert.notEqual(trainGit(root, 'merge-base', tip, train.finalCommit), train.finalCommit, 'The train is already reachable');
  assert.equal(await readBase(), tip, 'Integration moved during rejected transaction recovery');
  assert.deepEqual(JSON.parse(readFileSync(file)), expected, 'Pending train intent changed');
  unlinkSync(file);
}

async function withTrainContext(operation, inspectOnly = false) {
  const root = trainGit(process.cwd(), 'rev-parse', '--show-toplevel');
  const common = trainGit(root, 'rev-parse', '--path-format=absolute', '--git-common-dir');
  const directory = join(common, 'uld-receipts');
  const client = github(root);
  // Refuse unsupported publication before fetching, installing, locking or allocating a receipt.
  if (!inspectOnly) requireAtomicTrainTransport(client.publicationTransaction);
  client.requireTransport();
  const base = client.base();
  return withRevisionSnapshot(root, base, async (trusted, _tree, env) => {
    installSnapshotDependencies(trusted, join(common, 'uld-dependencies'), env);
    const run = (script, args, cwd = trusted, extra = {}) => execFileSync(process.execPath, [join(trusted, script), ...args],
      { cwd, env: { ...env, ...extra, GIT_NO_REPLACE_OBJECTS: '1' }, stdio: 'inherit' });
    const { passing, requireProposalHistory } = await import(join(trusted, 'scripts/land.mjs'));
    const { requireGateIsolation } = await import(join(trusted, 'scripts/gates/landing-policy.mjs'));
    const context = { ...client, passing, root, directory, liveBase: client.base,
      base() { assert.equal(client.base(), base, 'Integration moved'); return base; },
      history: (tree, parent, commit) => requireProposalHistory(tree, parent, directory, { root, commit }),
      judge(member) {
        // The base supplies executable policy. The predecessor supplies the change being judged.
        const comparisons = [[base, member.soloCommit, member.soloTree]];
        if (member.parent !== base) comparisons.push([member.parent, member.commit, member.tree]);
        for (const [parent, commit, tree] of comparisons) {
          run('scripts/gates/no-weakening.mjs', [parent, tree, root]);
          run('scripts/gates/review/qualification-policy.mjs', [root, parent, tree]);
          const reuseJudge = 'scripts/gates/reuse/strength.mjs';
          if (existsSync(join(trusted, reuseJudge))) run(reuseJudge, [root, parent, tree]);
          run('.github/gate-review.mjs', [parent, commit], root, { HEAD_BRANCH: member.branch,
            HEAD_REPOSITORY: repository, GITHUB_REPOSITORY: repository });
          const paths = execFileSync('git', ['--no-replace-objects', 'diff', '--no-renames', '--name-only', '-z', parent, commit],
            { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
          requireGateIsolation(member.branch, paths);
        }
      },
      async checkMember(request) {
        const { checkMember } = await import(join(trusted, 'scripts/gates/train-checks.mjs'));
        return checkMember(request);
      },
      previous: train => exactTrainQualification(root, directory, train, passing),
      qualify: train => run('scripts/qualify.mjs', [train.finalCommit], root),
      async onFailure(train, qualification) {
        const { diagnoseTrainFailure } = await import(join(trusted, 'scripts/gates/train-bisect.mjs'));
        return diagnoseTrainFailure(train, qualification);
      },
    };
    return operation(context);
  });
}

export async function landTrainCommand(args) {
  assert.equal(args.length, 1, 'Usage: npm run land -- --train <receipt>');
  return withTrainContext(context => withLock(context.root, 'landing', 'merge train', async () => {
    requireResolvedMerge(context.directory, (commit, tree) => {
      assert.equal(trainGit(context.root, 'rev-parse', commit + '^{tree}'), tree);
      return context.passing(tree, commit, context.directory, { root: context.root, commit });
    });
    const recovered = await reconcileTrainLanding(context.directory, context.root);
    if (recovered && recovered.id === readTrain(context.directory, args[0]).id) return recovered;
    return landTrain({ ...context,
      async publish(train, recheckHistory) {
        // An interruption or unverifiable outcome blocks every landing until GitHub confirms the result.
        const transactionId = quarantine(context.directory, train);
        try { await context.publish(train, recheckHistory, transactionId); }
        catch (error) {
          await clearRejectedTrainIntent(context.root, context.directory, train, error, context.liveBase);
          throw error;
        }
      },
      async confirm(train) {
        const tree = await context.confirm(train);
        assert.equal(tree, train.finalTree);
        unlinkSync(quarantineFile(context.directory));
        return tree;
      },
    }, args[0]);
  }));
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const inspectOnly = args[0] === '--inspect';
  if (inspectOnly) args.shift();
  assert.ok(args.length > 0 && args.length <= 5 && args.every(a => /^[1-9]\d*$/.test(a)), 'Usage: node scripts/train.mjs <PR> [<PR> ...]');
  if (inspectOnly) {
    const stack = await withTrainContext(context => inspectTrain(context, args.map(Number)), true);
    console.log('Inspected train on', stack.base, 'with final tree', stack.finalTree);
  } else {
    const receipt = await withTrainContext(context => withLock(context.root, 'landing', 'prepare merge train',
      () => createTrain(context, args.map(Number))));
    console.log('Train receipt', receipt.id, 'qualified tree', receipt.finalTree);
  }
}
