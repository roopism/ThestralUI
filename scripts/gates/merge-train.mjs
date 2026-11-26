import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { linkSync, lstatSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const oid = /^[0-9a-f]{40}$/;
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
export const trainGit = (root, ...args) => execFileSync('git', ['--no-replace-objects', ...args],
  { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 }).trim();

function numbers(prs) {
  assert.ok(Array.isArray(prs) && prs.length >= 1 && prs.length <= 5, 'A train requires one to five PRs');
  assert.ok(prs.every(n => Number.isSafeInteger(n) && n > 0), 'Positive PR numbers required');
  assert.equal(new Set(prs).size, prs.length, 'Every train member must be unique');
}

function stackCommit(root, tree, parent, head, number) {
  // Deterministic object identity lets a later landing independently reconstruct the entire stack.
  const date = '@' + trainGit(root, 'show', '-s', '--format=%ct', head) + ' +0000';
  const env = { ...process.env, GIT_AUTHOR_NAME: 'ThestralUI Train', GIT_AUTHOR_EMAIL: 'train@users.noreply.github.com',
    GIT_COMMITTER_NAME: 'ThestralUI Train', GIT_COMMITTER_EMAIL: 'train@users.noreply.github.com',
    GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date };
  return execFileSync('git', ['--no-replace-objects', '-c', 'commit.gpgSign=false',
    'commit-tree', tree, '-p', parent, '-p', head, '-m', 'Merge PR #' + number + ' into feat/enterprise-ui'],
  { cwd: root, env, encoding: 'utf8' }).trim();
}

async function checkMemberHistory(context, base, member) {
  await context.history(member.soloTree, base, member.soloCommit);
  if (member.commit !== member.soloCommit) await context.history(member.tree, member.parent, member.commit);
}

async function build(context, prs) {
  numbers(prs);
  const { root } = context;
  const base = await context.base();
  assert.match(base, oid);
  const members = [];
  let parent = base;
  for (const n of prs) {
    const { number, branch, head, soloCommit } = await context.member(n, base);
    assert.equal(number, n);
    assert.match(branch, /^(family|gates|docs)\/[a-z0-9][a-z0-9-]*$/);
    assert.match(head, oid);
    assert.match(soloCommit, oid);
    assert.ok(!members.some(m => m.branch === branch || m.head === head), 'Duplicate branch or head in train');
    const [soloTree, ...parents] = trainGit(root, 'show', '-s', '--format=%T %P', soloCommit).split(' ');
    assert.deepEqual(parents, [base, head], 'The solo merge must bind the integration base and PR head');
    assert.equal(trainGit(root, 'merge-tree', '--write-tree', base, head), soloTree, 'Remote solo merge differs from local merge');
    const tree = parent === base ? soloTree : trainGit(root, 'merge-tree', '--write-tree', parent, head);
    assert.match(tree, oid);
    assert.notEqual(tree, trainGit(root, 'rev-parse', parent + '^{tree}'), 'Train member adds no change to its predecessor');
    const commit = parent === base ? soloCommit : stackCommit(root, tree, parent, head, number);
    const member = { number, branch, head, soloCommit, soloTree, parent, commit, tree };
    await checkMemberHistory(context, base, member);
    await context.judge(member, base);
    members.push({ ...member, judge: 'passed', review: 'passed' });
    parent = commit;
  }
  return { base, members, finalCommit: parent, finalTree: members.at(-1).tree };
}

export { build as inspectTrain };

function persist(directory, train) {
  const folder = join(directory, 'trains');
  mkdirSync(folder, { recursive: true });
  const file = join(folder, train.id + '.json');
  const tmp = file + '.' + randomUUID();
  writeFileSync(tmp, JSON.stringify(train, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  try { linkSync(tmp, file); } finally { unlinkSync(tmp); }
}

export function readTrain(directory, selector) {
  assert.ok(typeof selector === 'string', 'Expected a train receipt ID or path');
  const id = basename(selector).replace(/\.json$/, '');
  assert.match(id, uuid, 'Invalid train receipt ID');
  const file = join(directory, 'trains', id + '.json');
  if (selector !== id && selector !== id + '.json') assert.equal(resolve(selector), resolve(file), 'Unexpected train receipt path');
  assert.ok(lstatSync(file).isFile(), 'Expected a regular train receipt');
  const train = JSON.parse(readFileSync(file));
  assert.equal(train.version, 1);
  assert.equal(train.id, id);
  return train;
}

function verifyQualification(train, receipt) {
  assert.ok(receipt, 'No exact canonical qualification attempt');
  assert.match(receipt.id, uuid);
  assert.ok(['passed', 'failed'].includes(receipt.status), 'A terminal qualification is required');
  assert.deepEqual([receipt.base, receipt.tree, receipt.commit], [train.base, train.finalTree, train.finalCommit],
    'Qualification must bind the exact base, tree and commit');
}

async function refresh(context, stack) {
  assert.equal(await context.base(), stack.base, 'Integration moved');
  for (const member of stack.members) {
    const current = await context.member(member.number, stack.base);
    for (const key of ['number', 'branch', 'head', 'soloCommit'])
      assert.equal(current[key], member[key], 'PR ' + member.number + ' changed');
  }
}

const target = 'refs/heads/feat/enterprise-ui';

const rejectedTransactions = new WeakMap();

export function requireAtomicTrainTransport(transaction) {
  if (typeof transaction?.transact !== 'function' || typeof transaction.readOutcome !== 'function')
    throw Error('Train publication requires an atomic server transaction for integration and all member heads. Inspect with node scripts/train.mjs --inspect <PR> [<PR> ...] or use normal solo landing.');
}

export async function pushAtomicTrain(root, remote, train, recheckHistory, transaction, transactionId = randomUUID()) {
  requireAtomicTrainTransport(transaction);
  assert.equal(trainGit(root, 'rev-parse', train.finalCommit + '^{tree}'), train.finalTree, 'Final commit has a different tree');
  trainGit(root, 'merge-base', '--is-ancestor', train.base, train.finalCommit);
  const expected = [[target, train.base], ...train.members.map(m => ['refs/heads/' + m.branch, m.head])];
  const current = new Map(trainGit(root, 'ls-remote', '--refs', remote, ...expected.map(([ref]) => ref))
    .split('\n').filter(Boolean).map(row => row.split('\t').reverse()));
  for (const [ref, sha] of expected) assert.equal(current.get(ref), sha, 'Remote ref moved before atomic push: ' + ref);
  // The backend must compare all refs in the same transaction that advances integration.
  // A normal Git push elides unchanged member refs, even when leases are supplied.
  await recheckHistory();
  assert.match(transactionId, uuid);
  const request = { id: transactionId, trainId: train.id, target, before: train.base, after: train.finalCommit, members: expected.slice(1) };
  const status = await transaction.transact(structuredClone(request));
  if (status === 'rejected') {
    const error = Error('Server rejected atomic train transaction for the expected refs');
    rejectedTransactions.set(error, { request, transaction });
    throw error;
  }
  assert.equal(status, 'committed', 'Unconfirmed train transaction');
}

// Only a reply from this invocation can start recovery. Query the receiver again
// for its terminal result, the exact submitted comparisons and the full write set.
export async function confirmedZeroUpdateRejection(train, error) {
  const refusal = rejectedTransactions.get(error);
  if (!refusal) return;
  const { request, transaction } = refusal;
  assert.deepEqual([request.trainId, request.target, request.before, request.after, request.members],
    [train.id, target, train.base, train.finalCommit, train.members.map(m => ['refs/heads/' + m.branch, m.head])]);
  const result = await transaction.readOutcome(request.id);
  assert.deepEqual(result, { request, status: 'rejected', updatedRefs: [] }, 'Unconfirmed zero-update train rejection');
  return request.id;
}

export async function createTrain(context, prs) {
  const stack = await build(context, prs);
  await context.requireTransport(stack);
  const cheapChecks = [];
  for (const member of stack.members) {
    const result = await context.checkMember({ root: context.root, base: stack.base, member });
    assert.equal(result?.tree, member.tree, 'Member checks must bind the exact tree');
    assert.ok(!Object.hasOwn(result, 'status') || result.status === 'passed', 'Member checks failed');
    cheapChecks.push({ number: member.number, tree: member.tree, status: 'passed', result });
  }
  await refresh(context, stack);
  const train = { version: 1, id: randomUUID(), ...stack, cheapChecks };
  for (const commit of new Set([train.finalCommit, ...train.members.map(m => m.soloCommit)])) {
    const ref = 'refs/uld-archive/trains/' + train.id + '/' + commit;
    trainGit(context.root, 'update-ref', ref, commit, '0'.repeat(40));
  }
  if (context.preparePlan) train.plan = await context.preparePlan(stack, train.id);
  let receipt = await context.previous(train);
  let failure;
  if (!receipt) {
    try { await context.qualify(train); }
    catch (error) { failure = error; }
    receipt = await context.previous(train);
  }
  if (!receipt && failure) throw failure;
  verifyQualification(train, receipt);
  train.qualificationId = receipt.id;
  train.status = receipt.status === 'passed' && !failure ? 'passed' : 'failed';
  if (context.seal) await context.seal(train);
  persist(context.directory, train);
  if (train.status !== 'passed') {
    if (receipt.status === 'failed') await context.onFailure(train, receipt);
    throw Error('Train failed. Receipt ' + train.id, { cause: failure });
  }
  return train;
}

export async function landTrain(context, selector) {
  const train = readTrain(context.directory, selector);
  assert.equal(train.status, 'passed', 'A passing train receipt is required');
  const prs = train.members.map(m => m.number);
  const rebuilt = await build(context, prs);
  assert.deepEqual([train.base, train.members, train.finalCommit, train.finalTree],
    [rebuilt.base, rebuilt.members, rebuilt.finalCommit, rebuilt.finalTree], 'The qualified PR stack changed');
  assert.deepEqual(train.cheapChecks.map(({ number, tree, status, result }) => [number, tree, status, result?.tree]),
    train.members.map(m => [m.number, m.tree, 'passed', m.tree]), 'Missing exact member checks');
  await refresh(context, train);
  const receipt = await context.previous(train);
  verifyQualification(train, receipt);
  assert.deepEqual([train.qualificationId, train.status], [receipt.id, receipt.status], 'The canonical qualification changed');
  await context.requireTransport(train);
  await context.publish(train, async () => {
    for (const member of rebuilt.members) await checkMemberHistory(context, rebuilt.base, member);
  });
  const actual = await context.confirm(train);
  assert.equal(actual, train.finalTree, 'Server landed a different tree');
  return train;
}
