import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { linkSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { publishFirstReceipt, qualificationIdentity } from './receipt-history.mjs';

export function startAttempt(root, directory, base, commit, tree, mode) {
  assert.ok(['qualification', 'release'].includes(mode));
  const id = randomUUID();
  const receipt = { schema: 1, id, tree, base, commit, mode, ...qualificationIdentity(root, base, commit, tree),
    status: 'running', started: new Date().toISOString(), suites: [] };
  execFileSync('git', ['update-ref', 'refs/uld-archive/qualification-attempts/' + id, commit, '0'.repeat(40)], { cwd: root });
  const folder = join(directory, 'attempts');
  mkdirSync(folder, { recursive: true });
  const path = join(folder, id + '.json');
  const temporary = path + '.start';
  writeFileSync(temporary, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  try { linkSync(temporary, path); } finally { unlinkSync(temporary); }
  return receipt;
}

export function readAttempt(directory, id, base, commit, tree, mode) {
  assert.match(id ?? '', /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
  const receipt = JSON.parse(readFileSync(join(directory, 'attempts', id + '.json')));
  assert.deepEqual([receipt.id, receipt.base, receipt.commit, receipt.tree, receipt.mode, receipt.status],
    [id, base, commit, tree, mode, 'running'], 'The suite runner must continue its exact preflight attempt');
  return receipt;
}

export function failUnfinishedAttempt(directory, initial, error) {
  const path = join(directory, 'attempts', initial.id + '.json');
  const receipt = JSON.parse(readFileSync(path));
  if (receipt.status !== 'running') return;
  receipt.status = 'failed';
  receipt.error = String(error.message);
  receipt.finished = new Date().toISOString();
  const temporary = path + '.failed';
  writeFileSync(temporary, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  renameSync(temporary, path);
  publishFirstReceipt(directory, receipt.tree, receipt.id);
}
