import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { preparePackedApk } from '../../../tests/android/host.mjs';
import { verifiedAndroidProbes } from '../../../tests/android/probe-integrity.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const probes = join(root, 'tests/android');
const names = ['FrameActivity.kt', 'FrameFixture.js', 'index.js'];

function candidate(t) {
  const dir = mkdtempSync(join(tmpdir(), 'uld-probe-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, 'tests/android'), { recursive: true });
  for (const file of [...names, 'low-end-budget.json']) {
    copyFileSync(join(probes, file), join(dir, 'tests/android', file));
  }
  assert.equal(resolve(verifiedAndroidProbes(dir)), probes);
  return dir;
}

test('Android refuses a candidate timing probe with rescaled durations before building', async t => {
  const dir = candidate(t);
  const path = join(dir, 'tests/android/FrameActivity.kt');
  const original = readFileSync(path, 'utf8');
  const changed = original.replace('System.nanoTime() - earliestPendingEvent', '(System.nanoTime() - earliestPendingEvent) / 4');
  assert.notEqual(changed, original);
  writeFileSync(path, changed);
  await assert.rejects(preparePackedApk(dir, dir, {}, dir), /probe calibration mismatch for FrameActivity\.kt/);
});

test('Android refuses a shorter scroll fixture before building', async t => {
  const dir = candidate(t);
  const path = join(dir, 'tests/android/FrameFixture.js');
  const original = readFileSync(path, 'utf8');
  const changed = original.replace('length: 120', 'length: 12');
  assert.notEqual(changed, original);
  writeFileSync(path, changed);
  await assert.rejects(preparePackedApk(dir, dir, {}, dir), /probe calibration mismatch for FrameFixture\.js/);
});

test('Android refuses changed probe bytes even if a candidate supplies its own pin', async t => {
  const dir = candidate(t);
  for (const name of names) {
    const path = join(dir, 'tests/android', name);
    const budgetFile = join(dir, 'tests/android/low-end-budget.json');
    const bytes = Buffer.concat([readFileSync(path), Buffer.from('\n')]);
    writeFileSync(path, bytes);
    const error = new RegExp('calibration mismatch for ' + name.replace('.', '\\.'));
    await assert.rejects(preparePackedApk(dir, dir, {}, dir), error);
    const budget = JSON.parse(readFileSync(budgetFile));
    const blob = createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
    if (name === 'FrameActivity.kt') budget.reference.scrollInputSource.probeBlob = blob;
    else budget.reference.scrollInputSource.fixtureBlobs[name] = blob;
    writeFileSync(budgetFile, JSON.stringify(budget));
    await assert.rejects(preparePackedApk(dir, dir, {}, dir), error);
    copyFileSync(join(probes, name), path);
    copyFileSync(join(probes, 'low-end-budget.json'), budgetFile);
  }
});
