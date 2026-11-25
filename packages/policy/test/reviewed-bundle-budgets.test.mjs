import assert from 'node:assert/strict';
import test from 'node:test';
import {
  budgetCheckpoints,
  bundleStage,
  checkPackedBudgetAdoption,
  effectiveBundleBudgets,
  verifyBudgetAdoption,
} from '../../../scripts/manifests/reviewed-bundle-budgets.mjs';

const web = '@ui-lazy-dev/ui-web/';
const original = Object.fromEntries(
  Object.entries({
    primitives: 1135,
    document: 223,
    'primitives.css': 862,
    'document#Heading': 143,
    navigation: 62722,
  }).map(([name, bytes]) => [web + name, bytes]),
);

function model(stage) {
  const exports = {};
  const families = budgetCheckpoints.map(({ id, slug, sources }, index) => {
    const row = { id, entries: [], files: { source: [], style: [] } };
    if (index >= stage) return row;
    for (const path of Object.keys(sources)) row.files[path.endsWith('.css') ? 'style' : 'source'].push(path);
    for (const [path, target] of [
      ['./' + slug, { types: './dist/' + slug + '/index.d.ts', default: './dist/' + slug + '/index.js' }],
      ['./' + slug + '.css', './dist/' + slug + '.css'],
    ]) {
      row.entries.push({ pkg: 'web', path, target });
      exports[path] = target;
    }
    return row;
  });
  return { families, exports, limits: effectiveBundleBudgets(families, original) };
}

function hashAt(step, path) {
  return step.sources[path];
}

test('reviewed legacy budgets activate only at their ordered, independently published checkpoints', () => {
  assert.deepEqual(model(0).limits, original);
  for (const [index, step] of budgetCheckpoints.entries()) {
    const previous = model(index),
      current = model(index + 1);
    assert.equal(bundleStage(current.families, current.exports), index + 1);
    assert.ok(verifyBudgetAdoption(previous, current, (path) => hashAt(step, path)));
    const unchanged = structuredClone(current);
    assert.equal(
      verifyBudgetAdoption(current, unchanged, () => {
        throw Error('ordinary edits are not pinned');
      }),
      false,
    );
    const key = web + Object.keys(step.limits)[0];
    assert.notEqual(previous.limits[key], current.limits[key]);
    assert.equal(current.limits[key], Object.values(step.limits)[0]);
    const missing = structuredClone(current);
    delete missing.exports['./' + step.slug + '.css'];
    assert.throws(() => bundleStage(missing.families, missing.exports), /Wrong published entry/);
    const reordered = structuredClone(current);
    const path = './' + step.slug,
      target = reordered.exports[path];
    delete reordered.exports[path];
    reordered.exports[path] = target;
    assert.throws(() => bundleStage(reordered.families, reordered.exports), /reordered/);
    const duplicate = structuredClone(current);
    duplicate.families[index].entries.push(duplicate.families[index].entries[0]);
    assert.throws(() => bundleStage(duplicate.families, duplicate.exports), /duplicated/);
  }
  const afterSeparator = model(2);
  assert.equal(afterSeparator.limits[web + 'primitives'], 1513);
  const ceiling =
    afterSeparator.limits[web + 'primitives'] + Math.ceil(afterSeparator.limits[web + 'primitives'] * 0.1);
  assert.ok(1750 > ceiling);
  const skipped = model(3);
  skipped.families[1].entries = [];
  assert.throws(() => bundleStage(skipped.families, skipped.exports), /Earlier budget checkpoint/);
  assert.throws(() => verifyBudgetAdoption(model(0), model(2), () => ''), /One reviewed/);
  assert.throws(() => verifyBudgetAdoption(model(3), model(2), () => ''), /One reviewed/);
});

test('first adoption verifies the real owned source and preserves every other incumbent import', () => {
  for (const [index, step] of budgetCheckpoints.entries()) {
    const previous = model(index),
      getHash = (path) => hashAt(step, path);
    for (const mutate of [
      (next) => {
        next.limits[web + 'navigation']++;
      },
      (next) => {
        delete next.limits[web + 'navigation'];
      },
      (next) => {
        next.limits[web + Object.keys(step.limits)[0]]++;
      },
      (next) => {
        next.families[index].files.source.pop();
      },
      (next) => {
        next.families[index].files.source.push(next.families[index].files.source[0]);
      },
      (next) => {
        next.exports['./' + step.slug + '.css'] = './dist/styles.css';
      },
    ]) {
      const next = model(index + 1);
      mutate(next);
      assert.throws(() => verifyBudgetAdoption(previous, next, getHash));
    }
    assert.throws(
      () => verifyBudgetAdoption(previous, model(index + 1), () => undefined),
      /Unreviewed source/,
    );
    assert.throws(
      () => verifyBudgetAdoption(previous, model(index + 1), () => '0'.repeat(64)),
      /Unreviewed source/,
    );
  }
});

test('each newly adopted legacy allowance requires exactly one corresponding actual packed measurement', () => {
  for (const [index, step] of budgetCheckpoints.entries()) {
    const previous = model(index).families,
      current = model(index + 1).families;
    const rows = Object.entries(step.limits).map(([name, gzip]) => ({ entry: web + name, gzip }));
    checkPackedBudgetAdoption(previous, current, rows);
    assert.throws(() => checkPackedBudgetAdoption(previous, current, rows.slice(1)), /Missing or duplicated/);
    assert.throws(
      () => checkPackedBudgetAdoption(previous, current, rows.concat(rows[0])),
      /Missing or duplicated/,
    );
    assert.throws(
      () =>
        checkPackedBudgetAdoption(previous, current, [
          { ...rows[0], gzip: rows[0].gzip + 1 },
          ...rows.slice(1),
        ]),
      /Unreviewed packed size/,
    );
  }
});
