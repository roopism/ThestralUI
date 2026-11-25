import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
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
  const outcomes = new Map();
  const receiver = {
    transact(request) {
      // Only this fixture owns a receiver. Git refuses the entire transaction if any comparison changed.
      git(server, 'fetch', '--quiet', '--no-tags', '--no-write-fetch-head', root, request.after);
      const commands = ['start', ...request.members.map(([ref, head]) => 'verify ' + ref + ' ' + head),
        'update ' + request.target + ' ' + request.after + ' ' + request.before, 'prepare', 'commit'];
      const result = spawnSync('git', ['update-ref', '--stdin'], {
        cwd: server, input: commands.join('\n') + '\n', encoding: 'utf8',
      });
      if (result.status === 0) return 'committed';
      if (result.stdout.trim() === 'start: ok' && /prepare: cannot lock ref/.test(result.stderr)) {
        outcomes.set(request.id, { request, status: 'rejected', updatedRefs: [] });
        return 'rejected';
      }
      throw Error('Uncertain local transaction outcome: ' + result.stderr);
    },
    readOutcome: id => outcomes.get(id),
  };
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
    publish: (train, recheckHistory, transactionId) => pushAtomicTrain(root, server, train, recheckHistory, receiver, transactionId),
    confirm: train => {
      assert.equal(git(server, 'rev-parse', integration), train.finalCommit);
      for (const member of train.members) {
        assert.equal(git(server, 'rev-parse', 'refs/heads/' + member.branch), member.head);
        git(server, 'merge-base', '--is-ancestor', member.head, train.finalCommit);
      }
      return git(server, 'rev-parse', integration + '^{tree}');
    },
  };
  return { dir, context, server, base, members, receiver, numbers: members.map(m => m.number),
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

test('changing a member after the last read aborts the complete server ref transaction', async t => {
  const f = fixture(t);
  const train = await createTrain(f.context, f.numbers);
  const member = train.members[1];
  const moved = git(f.context.root, 'commit-tree', member.soloTree, '-p', member.head, '-m', 'Concurrent member update');
  const changeAfterReadback = () => git(f.context.root, 'push', '--quiet', 'origin', moved + ':refs/heads/' + member.branch);
  await assert.rejects(f.context.publish(train, changeAfterReadback), /cannot lock ref|expected/);
  assert.equal(f.tip(), f.base);
  assert.equal(git(f.server, 'rev-parse', 'refs/heads/' + member.branch), moved);
});

test('a confirmed zero-update rejection clears only its matching intent after an independent readback', async t => {
  const { clearRejectedTrainIntent } = await import('../../train.mjs');
  const f = fixture(t);
  const train = await createTrain(f.context, f.numbers);
  const transactionId = randomUUID(), laterId = randomUUID();
  const marker = join(f.context.directory, 'train-landing-blocked.json');
  const pending = id => ({ id: train.id, base: train.base, commit: train.finalCommit, tree: train.finalTree, transactionId: id });
  const advanced = git(f.context.root, 'commit-tree', train.members[0].soloTree, '-p', train.base, '-m', 'Concurrent integration');
  let rejection;
  await assert.rejects(f.context.publish(train, () =>
    git(f.context.root, 'push', '--quiet', 'origin', advanced + ':' + integration), transactionId), error => {
    rejection = error;
    return true;
  });
  assert.equal(f.tip(), advanced);
  writeFileSync(marker, JSON.stringify(pending(laterId)));
  const clear = (error, base = f.tip) => clearRejectedTrainIntent(f.context.root, f.context.directory, train, error, base);
  await assert.rejects(clear(rejection), /intent changed/);
  assert.deepEqual(JSON.parse(readFileSync(marker)), pending(laterId));
  writeFileSync(marker, JSON.stringify(pending(transactionId)));
  let reads = 0;
  await clear(Error('Connection closed before the outcome was known'));
  assert.equal(existsSync(marker), true);
  const readOutcome = f.receiver.readOutcome;
  try {
    f.receiver.readOutcome = () => undefined;
    await assert.rejects(clear(rejection), /Unconfirmed zero-update/);
    assert.equal(existsSync(marker), true);
  } finally { f.receiver.readOutcome = readOutcome; }
  await assert.rejects(clear(rejection, () => { throw Error('Live ref is unavailable'); }), /Live ref is unavailable/);
  assert.equal(existsSync(marker), true);
  await clear(rejection, () => { reads++; return f.tip(); });
  assert.equal(reads, 2);
  assert.equal(existsSync(marker), false);
  assert.equal(f.tip(), advanced);
});

test('the GitHub train commands refuse an unavailable atomic publication before network or qualification', t => {
  const dir = mkdtempSync(join(tmpdir(), 'train-admission-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  git(dir, 'init', '--quiet', '--template=');
  git(dir, 'remote', 'add', 'origin', 'https://github.com/roopism/ThestralUI.git');
  const gh = join(dir, 'gh');
  writeFileSync(gh, '#!/bin/sh\nprintf "%s\\n" "$*" >> "$PWD/network-called"\nexit 1\n');
  chmodSync(gh, 0o700);
  for (const [program, ...args] of [['train.mjs', '10', '4'], ['land.mjs', '--train', 'fixture']]) {
    const module = new URL('../../' + program, import.meta.url);
    const result = spawnSync(process.execPath, [fileURLToPath(module), ...args], {
      cwd: dir, encoding: 'utf8', env: { ...process.env, PATH: dir + ':' + process.env.PATH },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /atomic server transaction.*member heads/);
    assert.equal(existsSync(join(dir, 'network-called')), false);
    assert.equal(existsSync(join(dir, '.git', 'uld-receipts')), false);
    assert.equal(existsSync(join(dir, '.git', 'uld-locks')), false);
  }
  const solo = spawnSync(process.execPath, [fileURLToPath(new URL('../../land.mjs', import.meta.url)), '1'], {
    cwd: dir, encoding: 'utf8', env: { ...process.env, PATH: dir + ':' + process.env.PATH },
  });
  assert.notEqual(solo.status, 0);
  assert.match(readFileSync(join(dir, 'network-called'), 'utf8'), /^api --method GET repos\/roopism\/ThestralUI\/pulls\/1\s*$/);
  assert.equal(existsSync(join(dir, '.git', 'uld-receipts', 'train-landing-blocked.json')), false);
});

test('inspection builds and judges the stack without member execution or a train receipt', async t => {
  const { inspectTrain } = await import('../merge-train.mjs');
  const f = fixture(t);
  const judged = [];
  f.context.judge = member => judged.push(member.number);
  const stack = await inspectTrain(f.context, f.numbers);
  assert.deepEqual(judged, f.numbers);
  assert.deepEqual(stack.members.map(m => m.number), f.numbers);
  assert.deepEqual(f.calls(), { checks: 0, full: 0 });
  assert.equal(existsSync(join(f.context.directory, 'trains')), false);
  assert.equal(f.tip(), f.base);
});
