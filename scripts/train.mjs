import { withPreflightActivity } from './workers/resource-guard.mjs';
import { requireBatchId } from './gates/train-preflight.mjs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, linkSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { withRevisionSnapshot } from '../packages/policy/quality/staged-tree.mjs';
import { installSnapshotDependencies } from '../packages/policy/quality/snapshot-dependencies.mjs';
import { requireResolvedMerge } from './gates/landing-policy.mjs';
import { confirmedZeroUpdateRejection, createTrain, inspectTrain, landTrain, pushAtomicTrain, readTrain, requireAtomicTrainTransport, trainGit } from './gates/merge-train.mjs';
import { archiveTrainObject } from './gates/train-plan.mjs';
import { cleanupArchivedBranch, landOrdered, publishOrderedMembers, requireOrderedAdmission } from './gates/ordered-landing.mjs';
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

class PendingMerge extends Error {}

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
    member(number, base, tested) {
      const pr = api('pulls/' + number);
      if (tested) {
        assert.equal(pr.head.sha, tested.head, 'PR head changed');
        assert.equal(pr.head.ref, tested.branch, 'PR branch changed');
        if (pr.state === 'open' && (pr.mergeable === null || pr.mergeable_state === 'unknown'))
          throw new PendingMerge('Server is computing PR #' + number + ' mergeability');
      }
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
      if (tested && git('rev-parse', pr.merge_commit_sha + '^1') !== base)
        throw new PendingMerge('Waiting for the PR merge ref on ' + base);
      return { number, branch: pr.head.ref, head: pr.head.sha, soloCommit: pr.merge_commit_sha };
    },
    merged(member) {
      const pr = api('pulls/' + member.number);
      assert.deepEqual([pr.number, pr.base.repo.full_name, pr.base.ref], [member.number, repository, integration]);
      if (!pr.merged) return;
      assert.deepEqual([pr.head.repo.full_name, pr.head.ref, pr.head.sha], [repository, member.branch, member.head]);
      assert.match(pr.merge_commit_sha, oid);
      const commit = api('git/commits/' + pr.merge_commit_sha);
      assert.equal(commit.sha, pr.merge_commit_sha);
      const tip = this.liveBase();
      git('merge-base', '--is-ancestor', commit.sha, tip);
      assert.deepEqual(git('show', '-s', '--format=%T %P', commit.sha).split(' '),
        [commit.tree.sha, ...commit.parents.map(p => p.sha)]);
      requireGreen(member.number, member.head);
      return { sha: commit.sha, parents: commit.parents.map(p => p.sha), tree: commit.tree.sha };
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
  if (blocked.ordered) throw Error('Resume ordered train ' + blocked.id);
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

async function withTrainContext(operation, inspectOnly = false, ordered = false, selector) {
  const root = trainGit(process.cwd(), 'rev-parse', '--show-toplevel');
  const common = trainGit(root, 'rev-parse', '--path-format=absolute', '--git-common-dir');
  const directory = join(common, 'uld-receipts');
  const client = github(root);
  // Refuse unsupported publication before fetching, installing, locking or allocating a receipt.
  if (!inspectOnly && !ordered) requireAtomicTrainTransport(client.publicationTransaction);
  client.requireTransport();
  const saved = selector && readTrain(directory, selector);
  if (saved) {
    assert.deepEqual(JSON.parse(trainGit(root, 'cat-file', 'blob', 'refs/uld-archive/train-receipts/' + saved.id)), saved);
    trainGit(root, 'merge-base', '--is-ancestor', saved.base, client.base());
  }
  const base = saved ? saved.base : client.base();
  return withRevisionSnapshot(root, base, async (trusted, _tree, env) => {
    installSnapshotDependencies(trusted, join(common, 'uld-dependencies'), env);
    const run = (script, args, cwd = trusted, extra = {}) => execFileSync(process.execPath, [join(trusted, script), ...args],
      { cwd, env: { ...env, ...extra, GIT_NO_REPLACE_OBJECTS: '1' }, stdio: 'inherit' });
    const solo = await import(join(trusted, 'scripts/land.mjs'));
    const { passing, requireProposalHistory } = solo;
    const { requireGateIsolation } = await import(join(trusted, 'scripts/gates/landing-policy.mjs'));
    const registrations = join(trusted, 'scripts/gates/registrations.mjs');
    const derived = existsSync(registrations) ? (await import(registrations)).derivedRegistrations : undefined;
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
          requireGateIsolation(member.branch, paths, undefined, derived?.(root, parent, tree, member.branch));
        }
      },
      async checkMember(request) {
        const { checkMember } = await import(join(trusted, 'scripts/gates/train-checks.mjs'));
        return checkMember(request);
      },
      async preflight(member, batch) {
        const { prepareTrainMember } = await import(join(trusted, 'scripts/gates/train-checks.mjs'));
        return prepareTrainMember({ root, base, member, batch });
      },
      previous: train => exactTrainQualification(root, directory, train, passing),
      qualify: train => run('scripts/qualify.mjs', [train.finalCommit], root),
      async onFailure(train, qualification) {
        const { diagnoseTrainFailure } = await import(join(trusted, 'scripts/gates/train-bisect.mjs'));
        return diagnoseTrainFailure(train, qualification);
      },
    };
    if (ordered) {
      const { trainDeviceCoverage, requireTrainPreflight } = await import(join(trusted, 'scripts/gates/train-plan.mjs'));
      const verify = context.previous;
      Object.assign(context, {
        requireTransport(stack) {
          client.requireTransport();
          assert.ok(!stack.members.slice(0, -1).some(member => member.branch.startsWith('gates/')),
            'Start a fresh batch after a gate change so the next member uses the new judge');
        },
        preparePlan: (plan, id) => archiveTrainObject(root, 'train-plans/' + id, plan),
        seal: train => archiveTrainObject(root, 'train-receipts/' + train.id, train),
        qualify(train) {
          run('scripts/verify-preflight.mjs', [train.finalCommit, '--base', base, '--branch', train.members[0].branch,
            '--train-plan', train.plan, '--train-id', train.id], root, { ULD_PREFLIGHT_TRUSTED: trusted });
          run('scripts/qualify.mjs', ['--train-id', train.id, train.finalCommit], root);
        },
        previous(train) {
          const receipt = verify(train);
          if (receipt?.status === 'passed') {
            assert.equal(receipt.trainPlan, train.plan, 'Different qualified batch');
            const admitted = requireTrainPreflight(root, common, train.base, train.finalCommit, train.finalTree, receipt.trainId);
            assert.deepEqual([receipt.trainPreflightId, receipt.trainPlan], [admitted.id, admitted.trainPlan]);
            const selection = trainDeviceCoverage(root, train);
            assert.deepEqual(receipt.trainDeviceChecks, selection.checks);
            assert.deepEqual(receipt.devicePlan, selection.devicePlan);
            assert.deepEqual(receipt.scope, selection.scope);
            assert.equal(receipt.noReuse, selection.devicePlan.full);
            assert.equal(receipt.gateTests.result, 'passed');
            assert.ok(receipt.suites.every(row => row.result === 'passed' ||
              !selection.devicePlan.run && ['iPhone Simulator', 'Android standard and low-end'].includes(row.name) &&
              row.result === 'web-only' && row.reason === selection.devicePlan.reason));
            if (receipt.devices.android?.length)
              assert.equal(receipt.androidTiming?.result, 'timing measured', 'Train requires fresh Android timing');
          }
          return receipt;
        },
        async proposal(member, parent) {
          let current;
          for (let attempt = 0; ; attempt++) {
            try { current = client.member(member.number, parent, member); break; }
            catch (error) {
              if (!(error instanceof PendingMerge) || attempt >= 5) throw error;
              assert.equal(client.base(), parent, 'Integration moved');
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
          assert.equal(current.head, member.head, 'PR head changed');
          assert.equal(current.branch, member.branch);
          const result = solo.proposal(member.number);
          assert.equal(result.merge, current.soloCommit);
          return result;
        },
        evidence(member, { pr }, receipt, train) {
          solo.archiveProposal(member.number, member.head);
          const status = solo.postQualification(member.number, pr, train.finalTree, receipt,
            'Train ' + train.id + ' qualified combined tree ' + train.finalTree + ' (attempt ' +
            receipt.id + '). PR #' + member.number + ' tested prefix tree: ' + member.tree + '.');
          solo.checkStatus(member.number, status);
        },
        merge: member => solo.mergeProposal(member.number, member.head),
        cleanup(member) {
          const ref = 'refs/heads/' + member.branch;
          return cleanupArchivedBranch(soloArchivedHead(root, member), () => {
            const remote = trainGit(root, 'ls-remote', '--refs', 'origin', ref);
            if (!remote) return;
            const [head, name] = remote.split('\t');
            assert.equal(name, ref);
            return head;
          }, head => solo.removeArchivedBranch(ref, head));
        },
      });
    }
    return operation(context);
  });
}

function soloArchivedHead(root, member) {
  const head = trainGit(root, 'rev-parse', 'refs/uld-archive/landed/' + member.number + '/' + member.head);
  assert.equal(head, member.head);
  return head;
}

function orderedCommand(prs, expected, selector, batch) {
  return withTrainContext(context => withLock(context.root, 'landing', 'ordered PR train', async () => {
    requireResolvedMerge(context.directory, (commit, tree) => {
      assert.equal(trainGit(context.root, 'rev-parse', commit + '^{tree}'), tree);
      const receipt = context.passing(tree, commit, context.directory, { root: context.root, commit });
      if (!receipt?.landingEvidence?.some(item => item.failed === receipt.id)) return receipt;
    });
    requireOrderedAdmission(context.directory, selector && readTrain(context.directory, selector).id);
    if (expected) {
      const lookup = context.member;
      const heads = new Map(expected.map(member => [member.number, member]));
      context.member = (number, parent) => lookup(number, parent, heads.get(number));
    }
    const id = selector ?? (await createTrain({ ...context, batch }, prs)).id;
    console.log('Ordered train receipt', id);
    const result = await landOrdered(context, id);
    console.log('Landed train', id, 'at', result.landedCommit, 'with tree', result.finalTree);
    return result;
  }), false, true, selector);
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

export function reportEjections(result) {
  for (const { id, number, error } of result.ejected ?? []) console.log('Ejected PR #' + number + ' from train ' + id + ': ' + error);
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const prepare = args[0] === '--preflight';
  const batch = prepare || args[0] === '--batch' ? requireBatchId(args.splice(0, 2)[1]) : undefined;
  if (args[0] === '--publish') {
    args.shift();
    assert.ok(!prepare, 'Member preparation takes only PR numbers');
    if (args[0] === '--resume') {
      assert.ok(!batch, 'Resume uses the sealed train receipt');
      assert.equal(args.length, 2, 'Expected --resume <train receipt>');
      reportEjections(await publishOrderedMembers(null, orderedCommand, args[1]));
    } else {
      assert.ok(args.length && args.every(arg => /^[1-9]\d*$/.test(arg) && Number.isSafeInteger(Number(arg))));
      assert.equal(new Set(args).size, args.length, 'Duplicate PR');
      const submit = (prs, expected, selector) => orderedCommand(prs, expected, selector, batch);
      const pending = args.map(Number);
      while (pending.length) {
        const batch = [];
        while (pending.length && batch.length < 5) {
          const number = pending.shift();
          batch.push(number);
          // A later PR needs the new integration judge after a gate change.
          if (pending.length && api('pulls/' + number).head.ref.startsWith('gates/')) break;
        }
        reportEjections(await publishOrderedMembers(batch, submit));
      }
    }
    process.exit(0);
  }
  const inspectOnly = args[0] === '--inspect';
  if (inspectOnly) {
    assert.ok(!batch, 'Inspection takes only PR numbers');
    args.shift();
  }
  assert.ok(args.length > 0 && args.length <= 5 && args.every(a => /^[1-9]\d*$/.test(a)), 'Usage: node scripts/train.mjs <PR> [<PR> ...]');
  if (prepare) {
    await withPreflightActivity('Prepare train members', () => withTrainContext(async context => {
      const stack = await inspectTrain(context, args.map(Number));
      for (const member of stack.members) await context.preflight(member, batch);
      console.log('Prepared batch', batch, 'on', stack.base);
    }, true));
  } else if (inspectOnly) {
    const stack = await withTrainContext(context => inspectTrain(context, args.map(Number)), true);
    console.log('Inspected train on', stack.base, 'with final tree', stack.finalTree);
  } else {
    const receipt = await withTrainContext(context => withLock(context.root, 'landing', 'prepare merge train',
      () => createTrain({ ...context, batch }, args.map(Number))));
    console.log('Train receipt', receipt.id, 'qualified tree', receipt.finalTree);
  }
}

export async function resumeTrainCommand(args) {
  if (args.length === 1 && /^[a-f0-9-]{36}(?:\.json)?$/.test(args[0].split('/').at(-1))) {
    const common = trainGit(process.cwd(), 'rev-parse', '--path-format=absolute', '--git-common-dir');
    if (readTrain(join(common, 'uld-receipts'), args[0]).plan) return publishOrderedMembers(null, orderedCommand, args[0]);
  }
  return landTrainCommand(args);
}
