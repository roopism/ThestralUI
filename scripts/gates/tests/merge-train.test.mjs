import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import test from 'node:test';
import { requireProposalHistory } from '../../land.mjs';
import { noWeakening } from '../no-weakening.mjs';
import { archiveTrainObject, trainScope } from '../train-plan.mjs';
import { landOrdered } from '../ordered-landing.mjs';
import { requireTrainBranch } from '../../train.mjs';
import { startAttempt, failUnfinishedAttempt } from '../qualification-attempt.mjs';
import { createTrain, landTrain, pushAtomicTrain, readTrain } from '../merge-train.mjs';
import { memberRepository, offlineTrainEnv } from './fixtures/member-preflight-cli.mjs';
import { fixtureGit, fixtureGitEnv, isolateFixtureProcess } from './fixtures/hermetic-git.mjs';

isolateFixtureProcess();

const git = (cwd, ...args) => fixtureGit(cwd, args);
const integration = 'refs/heads/feat/enterprise-ui';

function fixture(t, count = 2, weaker = false, setup) {
  const dir = mkdtempSync(join(tmpdir(), 'train-unit-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const root = join(dir, 'work'), server = join(dir, 'server');
  git(dir, 'init', '--quiet', '--bare', '--template=', server);
  git(dir, 'init', '--quiet', '--template=', root);
  const file = (name, contents) => {
    writeFileSync(join(root, name), contents);
    git(root, 'add', '--', name);
    return git(root, 'write-tree');
  };
  const commit = (tree, ...parents) => git(root, 'commit-tree', tree, ...parents.flatMap(p => ['-p', p]), '-m', 'Fixture');
  mkdirSync(join(root, '.github'));
  file('.github/CODEOWNERS', '/.github/ @fixture\n');
  file('sample-budget.json', '{"limit":2}\n');
  setup?.(root);
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
        cwd: server, env: fixtureGitEnv(server), input: commands.join('\n') + '\n', encoding: 'utf8',
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

test('an earlier failed solo qualification stays recorded while the train qualifies', async t => {
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
  assert.equal((await createTrain(f.context, f.numbers)).status, 'passed');
  assert.equal(f.calls().full, 1);
  assert.equal(JSON.parse(readFileSync(join(f.context.directory, 'attempts', initial.id + '.json'))).status, 'failed');
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
  const first = attempt;
  assert.throws(() => f.context.qualify({ base: first.base, finalCommit: first.commit, finalTree: first.tree }), /Fixture suite failed/);
  assert.notEqual(attempt.id, first.id);
  assert.equal(run, 2);
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

test('batch preflight CLI seals the first member under the launcher activity', t => {
  const f = fixture(t, 1, false, memberRepository);
  const root = f.context.root, batch = randomUUID();
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../../train.mjs', import.meta.url)),
    '--preflight', batch, '1'], { cwd: root, env: offlineTrainEnv(f), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const prefix = 'refs/uld-archive/member-preflights/' + batch + '/1/' + f.base + '/' + f.base + '/' + f.members[0].soloCommit;
  const blob = git(root, 'for-each-ref', '--format=%(objectname)', prefix + '/finished');
  const receipt = JSON.parse(git(root, 'cat-file', 'blob', blob));
  assert.deepEqual([receipt.kind, receipt.status, receipt.key.head], ['member-preflight', 'passed', f.members[0].head]);
  assert.match(receipt.fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(receipt.outputs.length, 4);
  assert.equal(git(root, 'rev-parse', 'refs/uld-archive/member-preflight-receipts/' + receipt.id), blob);
  assert.equal(existsSync(join(root, '.git/uld-receipts/attempts')), false);
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

async function orderedFixture(t) {
  const f = fixture(t, 3);
  const ctx = f.context;
  const results = new Map(), postings = [];
  const qualify = ctx.qualify;
  Object.assign(ctx, {
    preparePlan: (plan, id) => archiveTrainObject(ctx.root, 'train-plans/' + id, plan),
    seal: train => archiveTrainObject(ctx.root, 'train-receipts/' + train.id, train),
    qualify(train) {
      qualify(train);
      ctx.previous().trainPlan = train.plan;
    },
    liveBase: f.tip,
    proposal(member, parent) {
      const current = ctx.member(member.number);
      const tree = git(ctx.root, 'merge-tree', '--write-tree', parent, current.head);
      const merge = git(ctx.root, 'commit-tree', tree, '-p', parent, '-p', current.head, '-m', 'Live proposal');
      return { pr: { number: current.number, head: { ref: current.branch, sha: current.head }, base: { sha: f.tip() } }, merge, tree };
    },
    evidence: (member, _, receipt, train) => postings.push([member.number, receipt.id, train.finalTree, member.tree]),
    merge(member) {
      const parent = f.tip();
      const head = git(f.server, 'rev-parse', 'refs/heads/' + member.branch);
      assert.equal(head, member.head);
      const tree = git(ctx.root, 'merge-tree', '--write-tree', parent, head);
      const sha = git(ctx.root, 'commit-tree', tree, '-p', parent, '-m', 'Squash PR ' + member.number);
      git(f.server, 'fetch', '--quiet', ctx.root, sha);
      git(f.server, 'update-ref', integration, sha, parent);
      results.set(member.number, sha);
      return { merged: true, sha };
    },
    merged(member) {
      const sha = results.get(member.number);
      if (!sha) return;
      git(f.server, 'merge-base', '--is-ancestor', sha, f.tip());
      return { sha, parents: git(f.server, 'show', '-s', '--format=%P', sha).split(' '),
        tree: git(f.server, 'rev-parse', sha + '^{tree}') };
    },
    cleanup() {},
  });
  const train = await createTrain(ctx, f.numbers);
  return { ...f, ctx, train, postings, run: () => landOrdered(ctx, train.id),
    journal: () => JSON.parse(readFileSync(join(ctx.directory, 'trains', train.id + '.landing.json'))) };
}

test('ordered trains publish and confirm each squash, resume a lost response and reject replay', async t => {
  const { ctx, train, postings, run, journal, calls, tip } = await orderedFixture(t);
  const merge = ctx.merge;
  ctx.merge = m => {
    const reply = merge(m);
    if (m.number === 2) throw Error('Missing merge response');
    return reply;
  };
  await assert.rejects(run(), /Missing merge response/);
  assert.deepEqual(journal().landed.map(m => m.number), [1]);
  assert.equal(journal().intent.number, 2);
  assert.equal(journal().events[0].outcome, 'unconfirmed');
  ctx.merge = merge;
  ctx.cleanup = () => { throw Error('Branch cleanup interrupted'); };
  await assert.rejects(run(), /Branch cleanup interrupted/);
  assert.deepEqual(journal().landed.map(m => m.number), [1, 2]);
  assert.equal(journal().cleanup, 2);
  ctx.cleanup = () => {};
  const result = await run();
  assert.equal(result.landedCommit, tip());
  assert.notEqual(result.landedCommit, train.finalCommit);
  assert.deepEqual(journal().landed.map(m => m.tree), train.members.map(m => m.tree));
  assert.deepEqual(postings, train.members.map(m => [m.number, train.qualificationId, train.finalTree, m.tree]));
  assert.deepEqual(calls(), { checks: 3, full: 1 });
  await assert.rejects(run(), /already landed/);
});

test('a changed head ejects only its PR and unexpected integration movement stops the train', async t => {
  for (const movement of ['head', 'base', 'red']) {
    const { ctx, train, server, run, journal, tip, postings } = await orderedFixture(t);
    const second = train.members[1];
    const evidence = ctx.evidence;
    ctx.evidence = (member, ...args) => {
      evidence(member, ...args);
      if (member.number !== second.number) return;
      if (movement === 'base') {
        const parent = tip();
        const next = git(ctx.root, 'commit-tree', member.tree, '-p', parent, '-m', 'Concurrent integration');
        git(server, 'fetch', '--quiet', ctx.root, next);
        git(server, 'update-ref', integration, next, parent);
      } else if (movement === 'head') git(server, 'update-ref', 'refs/heads/' + member.branch, train.base, member.head);
      else ctx.proposal = () => assert.fail('PR check failed');
    };
    await assert.rejects(run());
    const state = journal();
    assert.deepEqual(state.landed.map(m => m.number), [1]);
    assert.equal(state.events.at(-1).number, second.number);
    assert.equal(state.terminal, movement === 'base' ? 'stopped' : 'ejected');
    assert.deepEqual(postings.map(row => row[0]), [1, 2]);
    assert.equal(existsSync(join(ctx.directory, 'train-landing-blocked.json')), false);
    if (movement !== 'base') assert.equal(tip(), state.landed[0].sha);
  }
});

test('ordered landing quarantines a merged tree or parent mismatch and rejects a substituted receipt', async t => {
  for (const mismatch of ['tree', 'parent', 'receipt']) {
    const { ctx, train, run, journal, postings } = await orderedFixture(t);
    const merged = ctx.merged;
    ctx.merged = member => {
      const actual = merged(member);
      if (!actual) return;
      return mismatch === 'tree' ? { ...actual, tree: train.finalTree } : { ...actual, parents: [train.finalCommit] };
    };
    if (mismatch === 'receipt') ctx.previous().id = randomUUID();
    await assert.rejects(run());
    if (mismatch === 'receipt') assert.equal(postings.length, 0);
    else {
      assert.equal(journal().terminal, 'ejected');
      assert.equal(journal().events[0].number, 1);
      assert.equal(existsSync(join(ctx.directory, 'landing-blocked.json')), true);
      assert.deepEqual(postings.map(m => m[0]), [1]);
    }
  }
});

test('batch device scope includes solo and prefix inputs hidden by the final diff', () => {
  const full = { iphone: true, families: null }, web = { iphone: false, families: [] };
  const plan = { base: 'base', finalTree: 'web', members: [{ parent: 'prefix', soloTree: 'web', tree: 'web' }] };
  assert.deepEqual(trainScope(plan, () => web), web);
  assert.deepEqual(trainScope(plan, (p, _, all) => all || p === 'prefix' ? full : web), full);
  assert.deepEqual(trainScope(plan, (p, _, all) => all ? full :
    { iphone: true, families: p === 'prefix' ? ['button'] : ['dialog'] }), full);
});

test('ordered cleanup preserves a newer remote head, including an advance during lease removal', async () => {
  const { cleanupArchivedBranch } = await import('../ordered-landing.mjs');
  const head = '1'.repeat(40), newer = '2'.repeat(40);
  let live = newer, removals = 0;
  const read = () => live;
  const remove = expected => { removals++; assert.equal(expected, head); live = newer; throw Error('lease rejected'); };
  assert.deepEqual(await cleanupArchivedBranch(head, read, remove), { outcome: 'preserved', head: newer });
  assert.equal(removals, 0);
  live = head;
  assert.deepEqual(await cleanupArchivedBranch(head, read, remove), { outcome: 'preserved', head: newer });
  assert.equal(removals, 1);
  live = head;
  await assert.rejects(() => cleanupArchivedBranch(head, read, () => { throw Error('unavailable'); }), /unavailable/);
  assert.deepEqual(await cleanupArchivedBranch(head, read, () => { live = undefined; }), { outcome: 'removed' });
  assert.deepEqual(await cleanupArchivedBranch(head, read, remove), { outcome: 'absent' });
});

test('ordered publication admits the healthy tail afresh only after a definite ejection', async t => {
  const { publishOrderedMembers } = await import('../ordered-landing.mjs');
  const f = await orderedFixture(t);
  const second = f.train.members[1];
  const original = f.ctx.proposal;
  f.ctx.proposal = (m, p) => { if (m.number === second.number) assert.fail('PR check failed'); return original(m, p); };
  const requests = [];
  await publishOrderedMembers(f.numbers, async (numbers, expected) => {
    requests.push({ numbers, expected });
    if (requests.length === 1) return f.run();
    assert.equal(f.tip(), f.journal().landed[0].sha);
    assert.deepEqual(expected, f.journal().remaining);
    assert.deepEqual(expected, [{ number: 3, head: f.train.members[2].head, branch: f.train.members[2].branch }]);
    const parent = f.tip(), target = expected[0];
    const tree = git(f.ctx.root, 'merge-tree', '--write-tree', parent, target.head);
    const soloCommit = git(f.ctx.root, 'commit-tree', tree, '-p', parent, '-p', target.head, '-m', 'New live prefix');
    const previous = f.ctx.previous, lookup = f.ctx.member;
    f.ctx.member = number => {
      const current = lookup(number);
      assert.deepEqual([current.number, current.branch, current.head], [target.number, target.branch, target.head]);
      return { ...current, soloCommit };
    };
    f.ctx.previous = train => {
      const receipt = previous();
      return !train || receipt.tree === train.finalTree ? receipt : undefined;
    };
    const tail = await createTrain(f.ctx, numbers);
    assert.equal(tail.base, parent);
    assert.notEqual(tail.finalTree, f.train.finalTree);
    assert.deepEqual(tail.cheapChecks.map(row => row.number), [3]);
    assert.equal((await landOrdered(f.ctx, tail.id)).landedCommit, f.tip());
    assert.equal(git(f.server, 'rev-parse', integration + '^{tree}'), tree);
  });
  assert.deepEqual(f.calls(), { checks: 4, full: 2 });
  assert.deepEqual(requests.map(r => r.numbers), [[1, 2, 3], [3]]);
  assert.equal(f.journal().terminal, 'ejected');
  const uncertain = await orderedFixture(t);
  let writes = 0;
  uncertain.ctx.merge = () => { writes++; throw Error('Unknown network outcome'); };
  let calls = 0;
  await assert.rejects(() => publishOrderedMembers(uncertain.numbers, () => { calls++; return uncertain.run(); }), /Unknown network/);
  assert.equal(calls, 1);
  assert.ok(uncertain.journal().intent);
  await assert.rejects(uncertain.run(), /Awaiting confirmation/);
  assert.equal(writes, 1);
});

test('train device admission checks every solo and prefix with the scoped selector', async () => {
  const { trainDeviceCoverage } = await import('../train-plan.mjs');
  const plan = { base: 'base', finalTree: 'final', members: [
    { number: 1, parent: 'base', soloTree: 'solo-1', tree: 'first' },
    { number: 2, parent: 'first', soloTree: 'solo-2', tree: 'final' },
  ] };
  const inspect = (trigger, full = false) => {
    const seen = [];
    const result = trainDeviceCoverage('.', plan, full, (_root, p, t, force) => {
      seen.push([p, t, force]);
      return { full: Boolean(force), run: Boolean(force || trigger === p + '/' + t), reason: 'fixture', paths: [] };
    });
    assert.deepEqual(result.checks.map(row => [row.base, row.tree]), [
      ['base','final'], ['base','solo-1'], ['base','first'], ['base','solo-2'], ['base','final'], ['first','final'],
    ]);
    assert.ok(seen.some(([parent, tree]) => parent === 'first' && tree === 'final'));
    return result;
  };
  assert.deepEqual(inspect(undefined).scope, { iphone: false, families: [] });
  for (const trigger of ['base/solo-1','base/solo-2','base/first','first/final','base/final'])
    assert.deepEqual(inspect(trigger).scope, { iphone: true, families: null });
  assert.equal(inspect(undefined, true).devicePlan.full, true);
  const held = trainDeviceCoverage('.', plan, undefined, (_root, _base, _tree, force) => ({ full: force, run: force }));
  assert.deepEqual(held.scope, { iphone: true, families: null });
  assert.equal(held.devicePlan.full, true);
});
