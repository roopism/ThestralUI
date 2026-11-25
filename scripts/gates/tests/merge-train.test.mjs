import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { requireProposalHistory } from '../../land.mjs';
import { noWeakening } from '../no-weakening.mjs';
import { requireTrainBranch } from '../../train.mjs';
import { startAttempt, failUnfinishedAttempt } from '../qualification-attempt.mjs';
import { createTrain, landTrain, pushAtomicTrain, readTrain } from '../merge-train.mjs';

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const integration = 'refs/heads/feat/enterprise-ui';

function fixture(t, count = 2, weaker = false) {
  const dir = mkdtempSync(join(tmpdir(), 'train-unit-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const root = join(dir, 'work'), server = join(dir, 'server');
  git(dir, 'init', '--quiet', '--bare', '--template=', server);
  git(dir, 'init', '--quiet', '--template=', root);
  git(root, 'config', 'user.name', 'Train fixture');
  git(root, 'config', 'user.email', 'fixture@example.invalid');
  const file = (name, contents) => {
    writeFileSync(join(root, name), contents);
    git(root, 'add', '--', name);
    return git(root, 'write-tree');
  };
  const commit = (tree, ...parents) => git(root, 'commit-tree', tree, ...parents.flatMap(p => ['-p', p]), '-m', 'Fixture');
  mkdirSync(join(root, '.github'));
  file('.github/CODEOWNERS', '/.github/ @fixture\n');
  file('sample-budget.json', '{"limit":2}\n');
  const base = commit(file('base', 'base'));
  git(root, 'remote', 'add', 'origin', server);
  git(root, 'push', '--quiet', 'origin', base + ':' + integration);
  const members = [];
  for (let number = 1; number <= count; number++) {
    git(root, 'read-tree', base);
    const branch = 'family/item-' + number;
    if (weaker && number === 2) file('sample-budget.json', '{"limit":3}\n');
    const tree = file('item-' + number, 'item ' + number);
    const head = commit(tree, base), soloCommit = commit(tree, base, head);
    git(root, 'push', '--quiet', 'origin', head + ':refs/heads/' + branch);
    members.push({ number, branch, head, soloCommit });
  }
  let verified;
  let checks = 0, full = 0;
  const directory = join(dir, 'receipts');
  mkdirSync(directory);
  const context = { root, directory, base: () => git(server, 'rev-parse', integration),
    member: n => {
      const member = members[n - 1];
      const head = git(server, 'rev-parse', 'refs/heads/' + member.branch);
      return { ...member, head };
    },
    judge: () => {}, checkMember: ({ member }) => { checks++; return { tree: member.tree, status: 'passed' }; }, history: () => {},
    requireTransport: () => {}, previous: () => verified,
    qualify: train => {
      full++;
      verified = { id: 'cdddc6d8-ab1d-4e22-bf69-6b895600d921', status: 'passed',
        commit: train.finalCommit, tree: train.finalTree, base: train.base };
    },
    publish: (train, recheckHistory) => pushAtomicTrain(root, server, train, recheckHistory),
    confirm: train => {
      assert.equal(git(server, 'rev-parse', integration), train.finalCommit);
      for (const member of train.members) {
        assert.equal(git(server, 'rev-parse', 'refs/heads/' + member.branch), member.head);
        git(server, 'merge-base', '--is-ancestor', member.head, train.finalCommit);
      }
      return git(server, 'rev-parse', integration + '^{tree}');
    },
  };
  return { dir, context, server, base, members, numbers: members.map(m => m.number),
    calls: () => ({ checks, full }), tip: () => git(server, 'rev-parse', integration) };
}

test('a red middle member or missing member checks stops a train before qualification', async t => {
  const f = fixture(t, 3, true);
  f.context.judge = m => {
    const issues = noWeakening(f.context.root, m.parent, m.tree);
    if (issues.length) throw Error(issues.join('\n'));
  };
  await assert.rejects(createTrain(f.context, f.numbers), /sample-budget.json.*numeric limit/);
  f.context.judge = () => {};
  f.context.checkMember = ({ member }) => {
    assert.notEqual(member.number, 2, 'Member fast checks failed');
    return { tree: member.tree, status: 'passed' };
  };
  await assert.rejects(createTrain(f.context, f.numbers), /Member fast checks failed/);
  assert.equal(f.calls().full, 0);
  assert.equal(f.tip(), f.base);
  await assert.rejects(createTrain(f.context, [1, 1]), /unique/);
  await assert.rejects(createTrain(f.context, [1, 2, 3, 4, 5, 6]), /five/);
});

test('single and multiple PR trains bind the canonical result and atomically land the qualified tree', async t => {
  for (const n of [1, 2]) {
    const f = fixture(t, n);
    const train = await createTrain(f.context, f.numbers);
    assert.deepEqual(readTrain(f.context.directory, train.id), train);
    assert.equal(train.qualificationId, f.context.previous().id);
    assert.deepEqual(train.cheapChecks.map(v => [v.number, v.result.tree]), train.members.map(m => [m.number, m.tree]));
    assert.deepEqual(f.calls(), { checks: n, full: 1 });
    if (n === 1) assert.equal(train.finalCommit, f.members[0].soloCommit);
    const same = await createTrain(f.context, f.numbers);
    assert.equal(same.finalCommit, train.finalCommit);
    assert.equal(f.calls().full, 1);
    await landTrain(f.context, train.id);
    assert.equal(f.tip(), train.finalCommit);
    assert.equal(git(f.server, 'rev-parse', f.tip() + '^{tree}'), train.finalTree);
  }
});

test('a changed base or member head and a mismatched final tree leave integration untouched', async t => {
  for (const movement of ['base', 'head', 'tree']) {
    const f = fixture(t);
    const train = await createTrain(f.context, f.numbers);
    if (movement === 'base') git(f.server, 'update-ref', integration, f.members[0].head, f.base);
    if (movement === 'head') git(f.server, 'update-ref', 'refs/heads/' + f.members[1].branch, f.base, f.members[1].head);
    if (movement === 'tree') f.context.previous = () => ({ id: train.qualificationId, base: train.base,
      status: 'passed', commit: train.finalCommit, tree: train.members[0].tree });
    const before = f.tip();
    await assert.rejects(landTrain(f.context, train.id));
    assert.equal(f.tip(), before);
  }
});

test('the publication readback rejects a moved head before the atomic integration push', async t => {
  const f = fixture(t);
  const train = await createTrain(f.context, f.numbers);
  const publish = f.context.publish;
  f.context.publish = (record, recheckHistory) => {
    git(f.server, 'update-ref', 'refs/heads/' + f.members[1].branch, f.base, f.members[1].head);
    return publish(record, recheckHistory);
  };
  await assert.rejects(landTrain(f.context, train.id), /Remote ref moved before atomic push/);
  assert.equal(f.tip(), f.base);
  assert.equal(git(f.server, 'rev-parse', 'refs/heads/' + f.members[0].branch), f.members[0].head);
});

test('an earlier failed solo qualification bars a train member before the final run', async t => {
  const f = fixture(t);
  const m = f.members[1];
  const { root } = f.context;
  // The same patch failed on another base. Neither the current head nor the current tree matches.
  git(root, 'read-tree', f.base);
  writeFileSync(join(root, 'previous-base'), 'earlier integration');
  git(root, 'add', 'previous-base');
  const oldBase = git(root, 'commit-tree', git(root, 'write-tree'), '-p', f.base, '-m', 'Earlier base');
  const tree = git(root, 'merge-tree', '--write-tree', oldBase, m.head);
  const oldHead = git(root, 'commit-tree', tree, '-p', oldBase, '-m', 'Earlier proposal');
  const oldMerge = git(root, 'commit-tree', tree, '-p', oldBase, '-p', oldHead, '-m', 'Earlier merge');
  const initial = startAttempt(root, f.context.directory, oldBase, oldMerge, tree, 'qualification');
  failUnfinishedAttempt(f.context.directory, initial, Error('Fixture check failed'));
  f.context.history = (tree, base, commit) => requireProposalHistory(tree, base, f.context.directory, { root: f.context.root, commit });
  await assert.rejects(createTrain(f.context, f.numbers), /earlier failed qualification/);
  assert.equal(f.calls().full, 0);
  assert.equal(f.tip(), f.base);
});

test('a member losing eligibility during final metadata checks stops train publication', async t => {
  for (const comparison of ['solo', 'stacked']) {
    const f = fixture(t, 2);
    const train = await createTrain(f.context, f.numbers);
    const [first, second] = train.members;
    const identities = [
      [first.soloTree, train.base, first.soloCommit],
      [second.soloTree, train.base, second.soloCommit],
      [second.tree, second.parent, second.commit],
    ];
    const failed = comparison === 'solo' ? 1 : 2;
    const finalHistory = [];
    let metadataRead = false;
    f.context.requireTransport = () => { metadataRead = true; };
    f.context.history = (tree, base, commit) => {
      if (!metadataRead) return;
      finalHistory.push([tree, base, commit]);
      if (commit === identities[failed][2]) throw Error('Updated member history rejects publication');
    };
    await assert.rejects(landTrain(f.context, train.id), /Updated member history rejects publication/);
    assert.deepEqual(finalHistory, identities.slice(0, failed + 1));
    assert.equal(f.tip(), f.base);
  }
});

test('protected or unknown server rules refuse a train before qualification or publication', async t => {
  const f = fixture(t);
  const branch = { name: 'feat/enterprise-ui', protected: false };
  const repo = { default_branch: branch.name };
  assert.throws(() => requireTrainBranch(branch, [], { default_branch: 'main' }), /default branch/);
  assert.doesNotThrow(() => requireTrainBranch(branch, [], repo));
  assert.throws(() => requireTrainBranch(branch, undefined, repo), /Missing applicable branch rules/);
  assert.throws(() => requireTrainBranch(branch, [{ type: 'pull_request' }], repo), /Protected integration/);
  f.context.requireTransport = () => requireTrainBranch({ ...branch, protected: true }, [], repo);
  await assert.rejects(createTrain(f.context, f.numbers), /Protected integration/);
  assert.equal(f.calls().full, 0);
  assert.equal(f.tip(), f.base);
});

test('a failed train keeps its immutable receipt before invoking prefix diagnostics', async t => {
  const f = fixture(t);
  let attempt, run = 0, diagnoses = 0;
  f.context.previous = () => attempt;
  f.context.qualify = train => {
    run++;
    const initial = startAttempt(f.context.root, f.context.directory, train.base, train.finalCommit, train.finalTree, 'qualification');
    failUnfinishedAttempt(f.context.directory, initial, Error('Fixture suite failed'));
    attempt = JSON.parse(readFileSync(join(f.context.directory, 'attempts', initial.id + '.json')));
    throw Error('Fixture suite failed');
  };
  f.context.onFailure = (train, result) => {
    diagnoses++;
    assert.deepEqual(readTrain(f.context.directory, train.id), train);
    assert.equal(train.status, 'failed');
    assert.equal(train.qualificationId, result.id);
    assert.deepEqual(result, attempt);
  };
  await assert.rejects(createTrain(f.context, f.numbers), /Train failed/);
  await assert.rejects(createTrain(f.context, f.numbers), /Train failed/);
  assert.equal(run, 1);
  assert.equal(diagnoses, 2);
  assert.equal(f.tip(), f.base);
});
