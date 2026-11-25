import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFileSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const guardrails = JSON.parse(readFileSync(new URL('./guardrails.json', import.meta.url)));
const digest = value => createHash('sha256').update(value).digest('hex');
const validGroup = value => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9 -]{0,100}$/.test(value);

// Draw an unbiased index. Recording the seed makes the draw reproducible from the eligibility list.
export function selectAudit(eligibleIds, seed) {
  assert.ok(Array.isArray(eligibleIds) && eligibleIds.every(validGroup));
  const ids = [...new Set(eligibleIds)].sort();
  if (!ids.length) return null;
  assert.equal(guardrails.minAuditGroups, 1, 'Unsupported audit minimum; all groups must run fresh');
  assert.match(seed, /^[0-9a-f]{32,128}$/);
  const range = 2 ** 32;
  const maximum = range - range % ids.length;
  for (let i = 0; ; i++) {
    const draw = createHash('sha256').update(seed + '/' + i).digest().readUInt32BE();
    if (draw < maximum) return ids[draw % ids.length];
  }
}

// Each disagreement has its own immutable record. Concurrent writers cannot lose an earlier decision.
export function disableGroup(directory, groupId, reason) {
  assert.ok(validGroup(groupId));
  assert.ok(typeof reason === 'string' && reason.trim());
  const record = { schema: 1, groupId, reusable: false, reason, observedAt: new Date().toISOString() };
  const raw = JSON.stringify(record) + '\n';
  const folder = join(directory, 'reuse-disabled');
  mkdirSync(folder, { recursive: true, mode: 0o700 });
  assert.ok(lstatSync(folder).isDirectory());
  const name = digest(raw) + '.json';
  try { writeFileSync(join(folder, name), raw, { flag: 'wx', mode: 0o600 }); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const file = join(folder, name);
    assert.ok(lstatSync(file).isFile());
    assert.equal(readFileSync(file, 'utf8'), raw);
  }
  const decisions = join(directory, '..', 'uld-delivery', 'owner-decisions');
  mkdirSync(decisions, { recursive: true, mode: 0o700 });
  appendFileSync(join(decisions, 'reuse.md'), '- ' + record.observedAt + ' — ' + groupId +
    ' reuse disabled. ' + reason.replace(/[\r\n]+/g, ' ') + ' Evidence: reuse-disabled/' + name + '\n', { mode: 0o600 });
  return record;
}

export function disabledGroups(directory) {
  const folder = join(directory, 'reuse-disabled');
  let stat;
  try { stat = lstatSync(folder); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  assert.ok(stat.isDirectory(), 'Invalid disagreement directory');
  const groups = new Set();
  for (const file of readdirSync(folder, { withFileTypes: true })) {
    assert.ok(file.isFile() && /^[a-f0-9]{64}\.json$/.test(file.name), 'Invalid disagreement file');
    const raw = readFileSync(join(folder, file.name));
    assert.equal(file.name, digest(raw) + '.json', 'Damaged disagreement evidence');
    const record = JSON.parse(raw);
    assert.ok(record?.schema === 1 && record.reusable === false && validGroup(record.groupId) &&
      typeof record.reason === 'string' && record.reason.trim() && Number.isFinite(Date.parse(record.observedAt)));
    groups.add(record.groupId);
  }
  return [...groups].sort();
}

export function assertAuditResult(directory, groupId, observedResult, { attempt, fingerprint, sourceAttempt }) {
  if (observedResult === 'passed') return;
  const reason = 'Audit ' + attempt + ' observed ' + observedResult + ' for fingerprint ' + fingerprint +
    ', previously passed in ' + sourceAttempt + '.';
  disableGroup(directory, groupId, reason);
  throw Error(reason);
}
