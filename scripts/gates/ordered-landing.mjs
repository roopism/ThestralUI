import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readTrain, trainGit } from './merge-train.mjs';
import { checkedPlan } from './train-plan.mjs';
import { recordMergeResult } from './landing-policy.mjs';

const oid = /^[a-f0-9]{40}$/;
const read = file => JSON.parse(readFileSync(file));
const progressFile = (directory, id) => join(directory, 'trains', id + '.landing.json');
const markerFile = directory => join(directory, 'train-landing-blocked.json');

function save(file, value) {
  const temp = file + '.' + randomUUID();
  writeFileSync(temp, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  renameSync(temp, file);
}

export function requireOrderedAdmission(directory, id) {
  const file = markerFile(directory);
  if (!existsSync(file)) return;
  const pending = read(file);
  assert.ok(id && pending.ordered && pending.id === id, 'Resolve pending train ' + pending.id + ' before another landing');
}

function release(directory, id) {
  requireOrderedAdmission(directory, id);
  if (existsSync(markerFile(directory))) unlinkSync(markerFile(directory));
}

function sameProposal(actual, member, parent) {
  assert.deepEqual([actual.pr.number, actual.pr.head.ref, actual.pr.head.sha],
    [member.number, member.branch, member.head], 'PR head or branch changed');
  assert.equal(actual.pr.base.sha, parent, 'Integration moved');
  assert.equal(actual.tree, member.tree, 'PR merge differs from tested prefix tree');
}

class DefiniteEjection extends Error {
  constructor(message, trainId, number, remaining) {
    super(message);
    this.trainId = trainId;
    this.number = number;
    this.remaining = remaining;
  }
}

const identity = ({ number, branch, head }) => ({ number, branch, head });

export async function publishOrderedMembers(numbers, submit, selector) {
  let expected;
  const ejected = [];
  do {
    try { return { ...await submit(numbers, expected, selector), ejected }; }
    catch (error) {
      if (!(error instanceof DefiniteEjection)) throw error;
      if (numbers) assert.ok(error.remaining.length < numbers.length &&
        error.remaining.every(member => numbers.includes(member.number)), 'Invalid continuation');
      ejected.push({ id: error.trainId, number: error.number, error: error.message });
      expected = error.remaining;
      numbers = expected.map(member => member.number);
      selector = undefined;
    }
  } while (numbers.length);
  return { status: 'ejected', ejected };
}

// Deletion is conditional on the exact archived head. A newer head belongs to
// the next change and must survive even if it arrived after the first read.
export async function cleanupArchivedBranch(head, read, remove) {
  assert.match(head, oid);
  const inspect = async () => {
    const remote = await read();
    if (!remote) return { outcome: 'absent' };
    assert.match(remote, oid);
    if (remote !== head) return { outcome: 'preserved', head: remote };
  };
  const initial = await inspect();
  if (initial) return initial;
  try { await remove(head); }
  catch (error) {
    const after = await inspect();
    if (after) return after;
    throw error;
  }
  const after = await inspect();
  assert.ok(after, 'The archived branch still exists after conditional removal');
  return after.outcome === 'absent' ? { outcome: 'removed' } : after;
}

// The caller holds the same landing lock as a solo PR throughout publication and recovery.
export async function landOrdered(context, selector) {
  const { root, directory } = context;
  const train = readTrain(directory, selector);
  requireOrderedAdmission(directory, train.id);
  assert.deepEqual(JSON.parse(trainGit(root, 'cat-file', 'blob', 'refs/uld-archive/train-receipts/' + train.id)), train);
  assert.equal(train.status, 'passed');
  assert.equal(trainGit(root, 'rev-parse', 'refs/uld-archive/train-plans/' + train.id), train.plan);
  const plan = await checkedPlan(root, train.plan, train.base, train.finalCommit, train.finalTree);
  assert.deepEqual(plan.members, train.members);
  assert.deepEqual(train.cheapChecks.map(row => [row.number, row.tree, row.result.tree, row.status]),
    train.members.map(m => [m.number, m.tree, m.tree, 'passed']));

  const path = progressFile(directory, train.id);
  assert.ok(existsSync(path) || !existsSync(markerFile(directory)), 'Pending ordered train has no journal');
  const state = existsSync(path) ? read(path) : { id: train.id, qualification: train.qualificationId, landed: [], events: [] };
  assert.deepEqual([state.id, state.qualification], [train.id, train.qualificationId]);

  const receipt = async () => {
    const r = await context.previous(train);
    assert.deepEqual([r?.id, r?.status, r?.base, r?.commit, r?.tree, r?.trainPlan],
      [train.qualificationId, 'passed', train.base, train.finalCommit, train.finalTree, train.plan]);
    return r;
  };
  function stop(member, outcome, error, actual) {
    // An interrupted PUT may still reach the server. Keep the global intent
    // until readback confirms that merge or the server explicitly rejects it.
    if (state.intent && !actual && !state.rejected) {
      state.events.push({ number: member.number, outcome: 'unconfirmed', error: error.message });
      save(path, state);
      throw error;
    }
    state.terminal = outcome;
    if (outcome === 'ejected' && !actual) {
      assert.equal(train.members[state.landed.length].number, member.number);
      state.remaining = train.members.slice(state.landed.length + 1).map(identity);
    }
    state.events.push({ number: member.number, outcome, error: error.message, actual });
    save(path, state);
    release(directory, train.id);
    if (state.remaining) throw new DefiniteEjection(error.message, train.id, member.number, state.remaining);
    throw error;
  }

  async function finishCleanup() {
    if (!state.cleanup) return;
    const member = train.members[state.landed.length - 1];
    assert.equal(member.number, state.cleanup);
    try {
      const result = await context.cleanup(member);
      if (result) state.landed.at(-1).cleanup = result;
    }
    catch (error) {
      state.events.push({ number: member.number, outcome: 'cleanup pending', error: error.message });
      save(path, state);
      throw error;
    }
    delete state.cleanup;
    save(path, state);
  }

  // A mutable progress file alone can never certify a landed prefix.
  let parent = train.base;
  assert.ok(state.landed.length <= train.members.length);
  for (const [index, row] of state.landed.entries()) {
    const member = train.members[index];
    assert.equal(row.number, member.number);
    const actual = await context.merged(member);
    assert.deepEqual(actual, { sha: row.sha, parents: [parent], tree: member.tree });
    parent = row.sha;
  }
  if (state.terminal) {
    const last = state.events.at(-1);
    if (state.terminal === 'landed') {
      assert.equal(state.landed.length, train.members.length);
      assert.ok(!state.intent && !state.returned && !state.cleanup);
    } else {
      assert.ok(['stopped', 'ejected'].includes(state.terminal));
      assert.equal(last.outcome, state.terminal);
      if (last.actual) {
        const member = train.members.find(m => m.number === last.number);
        assert.deepEqual(await context.merged(member), last.actual);
      } else {
        assert.equal(last.number, train.members[state.landed.length].number);
        assert.ok(!state.intent || state.rejected === true);
        if (state.intent) assert.ok(!await context.merged(train.members[state.landed.length]));
      }
      if (state.remaining) {
        assert.equal(state.terminal, 'ejected');
        assert.ok(!last.actual);
        assert.deepEqual(state.remaining, train.members.slice(state.landed.length + 1).map(identity));
        release(directory, train.id);
        throw new DefiniteEjection(last.error, train.id, last.number, state.remaining);
      }
    }
    release(directory, train.id);
    throw Error('Train already ' + state.terminal + ': ' + train.id);
  }
  if (!existsSync(markerFile(directory))) {
    assert.ok(!state.intent && !state.cleanup, 'Pending journal lost its landing marker');
    save(path, state);
    save(markerFile(directory), { ordered: true, id: train.id });
  }
  await finishCleanup();
  for (const member of train.members.slice(state.landed.length)) {
    const intent = { number: member.number, head: member.head, parent, tree: member.tree };
    if (state.intent) assert.deepEqual(state.intent, intent);
    let actual = state.intent && await context.merged(member);
    if (!actual) {
      if (state.intent) throw Error('Awaiting confirmation of the previous merge request for PR #' + member.number);
      const checkBase = async () => {
        if (await context.liveBase() !== parent) stop(member, 'stopped', Error('Integration moved'));
      };
      await checkBase();
      const inspect = async () => {
        try {
          const result = await context.proposal(member, parent);
          sameProposal(result, member, parent);
          try {
            await context.history(member.soloTree, train.base, member.soloCommit);
            await context.history(member.tree, member.parent, member.commit);
            await context.history(member.tree, parent, result.merge);
          } catch (error) { stop(member, 'ejected', error); }
          return result;
        } catch (error) {
          if (state.terminal) throw error;
          await checkBase();
          if (error.code === 'ERR_ASSERTION') stop(member, 'ejected', error);
          state.events.push({ number: member.number, outcome: 'paused', error: error.message });
          save(path, state);
          throw error;
        }
      };
      const proposal = await inspect();
      try { await context.judge(member); }
      catch (error) { stop(member, 'ejected', error); }
      const checkedReceipt = async () => {
        try { return await receipt(); }
        catch (error) { stop(member, 'stopped', error); }
      };
      const verified = await checkedReceipt();
      if (!state.intent) await context.evidence(member, proposal, verified, train);
      await checkedReceipt();
      await context.requireTransport(train);
      await inspect();
      await checkBase();
      state.intent = intent;
      save(path, state);
      try {
        const result = await context.merge(member);
        if (result.merged === false) {
          state.rejected = true;
          stop(member, 'ejected', Error('PR merge rejected'));
        }
        assert.equal(result.merged, true);
        assert.match(result.sha, oid);
        state.returned = result.sha;
        save(path, state);
        actual = await context.merged(member);
        assert.ok(actual, 'PR merge has not yet been confirmed');
      } catch (error) {
        if (!state.returned && /\(HTTP (405|409|422)\)/.test(String(error.stderr)) && !await context.merged(member)) {
          state.rejected = true;
          await checkBase();
          stop(member, 'ejected', error);
        }
        if (!state.terminal) {
          state.events.push({ number: member.number, outcome: 'unconfirmed', error: error.message });
          save(path, state);
        }
        throw error;
      }
    }
    assert.match(actual.sha, oid);
    assert.match(actual.tree, oid);
    const wrongCommit = state.returned && state.returned !== actual.sha;
    const wrongParent = actual.parents.length !== 1 || actual.parents[0] !== parent;
    recordMergeResult(directory, actual.sha, actual.tree, member.tree, wrongParent || wrongCommit);
    if (wrongCommit || wrongParent || actual.tree !== member.tree)
      stop(member, 'ejected', Error('Merged commit, parent or tree differs from tested prefix'), actual);
    state.cleanup = member.number;
    state.landed.push({ number: member.number, sha: actual.sha, parent, tree: actual.tree });
    delete state.returned;
    delete state.intent;
    save(path, state);
    await finishCleanup();
    parent = actual.sha;
    if (await context.liveBase() !== parent) stop(member, 'stopped', Error('Integration advanced after the verified merge'), actual);
  }
  state.terminal = 'landed';
  save(path, state);
  release(directory, train.id);
  return { ...train, landedCommit: parent };
}
