import { approvedTimingSuites } from './proposal-timing.mjs';
import { scopedSkip } from './device-verdict.mjs';
import assert from 'node:assert/strict';
import { reuseRows } from './reuse/preflight.mjs';
import { projectStoredPasses } from './reuse/store.mjs';
import { isDeepStrictEqual } from 'node:util';
import { resolveFailure } from './landing-evidence.mjs';
import { execFileSync } from 'node:child_process';
import { existsSync, linkSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const oid = /^[a-f0-9]{40}$/;
const attemptFile = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\.json$/i;
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));

// Use the recorded merge and base, even after a proposal ref has moved or been removed.
export function qualificationIdentity(root, base, commit, tree) {
  for (const id of [base, commit, tree]) assert.match(id, oid, 'Expected a full qualification Git object ID');
  const options = { cwd: root, encoding: 'utf8', env: { ...process.env, GIT_NO_REPLACE_OBJECTS: '1' } };
  const git = (...args) => execFileSync('git', args, options).trim();
  const [actualTree, ...parents] = git('show', '-s', '--format=%T %P', commit).split(' ');
  assert.equal(actualTree, tree, 'The qualification commit does not contain its recorded tree');
  git('merge-base', '--is-ancestor', base, commit);
  const head = parents.length === 2 && parents[0] === base ? parents[1] : commit;
  // Stream the binary-inclusive diff. Git's stable patch ID ignores hunk offsets and whitespace.
  const command = 'git diff --no-ext-diff --no-textconv --no-renames --no-color --binary --full-index ' +
    '--diff-algorithm=myers --no-indent-heuristic --unified=3 --src-prefix=a/ --dst-prefix=b/ "$1" "$2" -- | git patch-id --stable';
  const result = execFileSync('/bin/bash', ['-o', 'pipefail', '-c', command, 'qualification-patch', base, tree], options).trim();
  const patchId = result ? result.split(' ')[0] : null;
  if (patchId !== null) assert.match(patchId, oid, 'Unexpected Git patch identity');
  return { head, patchId };
}

// Publish the first completed attempt atomically. All later attempts keep their own files.
export function publishFirstReceipt(directory, tree, id) {
  const source = join(directory, 'attempts', id + '.json');
  const target = join(directory, tree + '.json');
  try {
    linkSync(source, target);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
}

export function incomplete(attempt, directory) {
  if (Array.isArray(attempt.suites) && reuseRows(attempt).some(row => row?.result === 'reused')) {
    try { attempt = projectStoredPasses(directory, attempt); }
    catch { return true; }
  }
  const skips = approvedTimingSuites(directory, attempt);
  return skips === null || attempt.status !== 'passed' || !Array.isArray(attempt.suites) || !attempt.suites.length ||
    reuseRows(attempt).some(row => row?.result !== 'passed' &&
      !scopedSkip(attempt, row) && !(row?.result === 'skipped' && skips.includes(row.name)) &&
      !(!attempt.devicePlan && row?.name === 'iPhone Simulator' && row.result === 'web-only' && attempt.scope?.iphone === false));
}

export function relatedHistory(directory, tree, first, root, target) {
  const records = first ? [first] : [];
  const identities = new Map();
  function identify(attempt) {
    const key = [attempt.base, attempt.commit, attempt.tree].join('/');
    if (!identities.has(key)) identities.set(key, qualificationIdentity(root, attempt.base, attempt.commit, attempt.tree));
    const identity = identities.get(key);
    for (const field of ['head', 'patchId']) {
      if (Object.hasOwn(attempt, field)) assert.equal(attempt[field], identity[field], 'Inconsistent receipt ' + field);
    }
    return identity;
  }
  const proposed = target && identify(target);
  function include(attempt) {
    if (attempt.tree === tree) {
      if (proposed && !incomplete(attempt, directory)) identify(attempt);
      records.push(attempt);
    } else if (proposed && incomplete(attempt, directory)) {
      const earlier = identify(attempt);
      if (earlier.head === proposed.head || (earlier.patchId !== null && earlier.patchId === proposed.patchId)) records.push(attempt);
    }
  }
  if (first) {
    assert.equal(first.tree, tree, 'Inconsistent published qualification tree');
    if (proposed && !incomplete(first, directory)) identify(first);
  }
  if (!existsSync(directory)) return records;
  for (const name of readdirSync(directory).filter(name => /^[a-f0-9]{40}\.json$/.test(name) && name !== tree + '.json')) {
    const record = read(join(directory, name));
    assert.equal(record.tree + '.json', name, 'Inconsistent published qualification ' + name);
    include(record);
  }
  const folder = join(directory, 'attempts');
  if (existsSync(folder)) {
    for (const name of readdirSync(folder).filter(name => attemptFile.test(name)).sort()) {
      const attempt = read(join(folder, name));
      assert.equal(attempt.id + '.json', name, 'Inconsistent qualification attempt ' + name);
      include(attempt);
    }
  }
  return records;
}

export function treeHistory(directory, tree, first) {
  const folder = join(directory, 'attempts');
  if (!existsSync(folder)) return [first];
  const records = [first];
  for (const name of readdirSync(folder)
    .filter((file) => attemptFile.test(file))
    .sort()) {
    const attempt = read(join(folder, name));
    if (attempt.tree !== tree) continue;
    if (attempt.id + '.json' !== name) throw Error('Inconsistent qualification attempt ' + name);
    records.push(attempt);
  }
  return records;
}

// A tie cannot establish that a pass superseded a failure.
export function latestAttempt(history) {
  const time = row => Date.parse(row.finished ?? row.started) || 0;
  return history.toSorted((a, b) => time(b) - time(a) ||
    Number(a.status === 'passed') - Number(b.status === 'passed'))[0];
}

export function reviewedEvidence(directory, tree, history, context) {
  const reviewed = new Map();
  for (const row of history) {
    if (row.status !== 'failed' || row.tree !== tree || row.base !== context.base ||
        !attemptFile.test(row.id + '.json') || reviewed.has(row.id) ||
        !existsSync(join(directory, 'attempts', row.id + '-evidence', 'landing', 'manifest.json'))) continue;
    assert.ok(history.every(copy => copy.id !== row.id || isDeepStrictEqual(copy, row)), 'Inconsistent failed receipt');
    const { diagnostic } = resolveFailure(context.root, directory, row, history, tree, context.base, context.roster);
    reviewed.set(row.id, { failed: row.id, ...(diagnostic && { diagnostic }) });
  }
  return [...reviewed.values()];
}
