import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { budgetCheckpoints } from '../../manifests/reviewed-bundle-budgets.mjs';
import { noWeakening } from '../no-weakening.mjs';
import { compareWithBase } from './fixtures/protected-inputs.mjs';

const web = '@ui-lazy-dev/ui-web/';
const baseline = 'tests/packaging/bundle-baseline.json';
const original = { primitives: 1135, 'primitives.css': 862, document: 223, 'document#Heading': 143, other: 100 };
const limits = values => Object.fromEntries(Object.entries(values).map(([name, value]) => [web + name, value]));
const sizes = values => Object.entries(limits(values)).map(([entry, gzip]) => ({ entry, gzip }));
const content = path => 'reviewed fixture for ' + path + '\n';

function state(active) {
  const files = {}, exports = {}, values = { ...original };
  for (const { id, slug, sources, limits: step } of budgetCheckpoints) {
    const row = { id, entries: [], files: { source: [], style: [] } };
    if (active.includes(slug)) {
      for (const path of Object.keys(sources)) {
        files[path] = content(path);
        row.files[path.endsWith('.css') ? 'style' : 'source'].push(path);
      }
      for (const [path, target] of [
        ['./' + slug, { types: './dist/' + slug + '/index.d.ts', default: './dist/' + slug + '/index.js' }],
        ['./' + slug + '.css', './dist/' + slug + '.css'],
      ]) {
        exports[path] = target;
        row.entries.push({ pkg: 'web', path, target });
      }
      if (slug === 'icon-button') {
        const shared = 'packages/web/src/_shared/icon-state.ts', native = 'packages/native/src/icon-button/binding.tsx';
        row.files.source.push(shared);
        row.files.nativeSource = [native];
        files[shared] = content(shared);
        files[native] = content(native);
      }
      Object.assign(values, step);
    }
    files['manifests/families/' + slug + '.json'] = JSON.stringify(row);
  }
  files['packages/web/package.json'] = JSON.stringify({ name: '@ui-lazy-dev/ui-web', exports });
  return { files, values };
}

const pinnedSources = budgetCheckpoints.map(step => step.sources);
test.before(() => {
  // Give the trusted test schedule pins for actual fixture blobs. The candidate only supplies Git objects.
  for (const step of budgetCheckpoints) {
    const originalPins = step.sources;
    step.sources = Object.fromEntries(Object.keys(originalPins).map(path =>
      [path, createHash('sha256').update(content(path)).digest('hex')]));
  }
});
test.after(() => {
  for (const [index, step] of budgetCheckpoints.entries()) step.sources = pinnedSources[index];
});

function compare(t, before, after, options = {}) {
  const parent = state(before), next = state(after);
  const check = compareWithBase(t, baseline, JSON.stringify(limits(parent.values)), parent.files, undefined,
    (root, base, tree, source) => noWeakening(root, base, tree, source, options));
  const changed = Object.fromEntries(Object.entries(next.files).filter(([path, body]) => parent.files[path] !== body));
  return (values = {}, files = {}) => check(JSON.stringify(limits({ ...next.values, ...values })), { ...changed, ...files });
}

const icon = ['icon-button'], separator = [...icon, 'separator'], group = [...separator, 'button-group'];
const iconSizes = { primitives: 1513, 'primitives.css': 962 };

test('Icon Button admits its two reviewed incumbent sizes together on its original parent', t => {
  const evidence = { measurements: sizes(iconSizes) };
  const check = compare(t, [], icon, evidence);
  assert.deepEqual(check(), []);
  assert.ok(check({ primitives: 1514 }).length);
  evidence.measurements = sizes({ ...iconSizes, primitives: 1514 });
  assert.ok(check({ primitives: 1514 }).some(issue => issue.includes('Wrong budget for the new checkpoint: primitives')));
  evidence.measurements = sizes(iconSizes);
  assert.ok(check({ 'primitives.css': 862 }).length);
  assert.ok(check({ other: 101 }).length);
  assert.ok(check({}, { 'manifests/families/other.json': '{"id":"Other"}' }).length);
});

test('Separator requires the Icon Button checkpoint and Button Group requires Separator', t => {
  const measured = { measurements: sizes({ document: 382 }) };
  assert.deepEqual(compare(t, icon, separator, measured)(), []);
  assert.ok(compare(t, [], ['separator'], measured)().length);
  const buttonGroup = { measurements: sizes({ primitives: 1805, 'primitives.css': 1153 }) };
  assert.deepEqual(compare(t, separator, group, buttonGroup)(), []);
  assert.ok(compare(t, icon, [...icon, 'button-group'], buttonGroup)().length);
});

test('two reviewed families cannot advance in the same change even at the exact measured sizes', t => {
  assert.ok(compare(t, [], separator, { measurements: sizes({ ...iconSizes, document: 382 }) })().length);
});

test('a change to any pinned Git source rejects the reviewed raise', t => {
  const check = compare(t, [], icon, { measurements: sizes(iconSizes) });
  const path = 'packages/web/src/icon-button/styles.css';
  assert.ok(check({}, { [path]: content(path) + ' ' }).length);
});

test('a reviewed raise requires one exact packed measurement for every raised entry', t => {
  const evidence = { measurements: sizes(iconSizes) };
  const check = compare(t, [], icon, evidence);
  for (const bytes of [1512, 1514]) {
    evidence.measurements = sizes({ ...iconSizes, primitives: bytes });
    assert.ok(check().length);
  }
  evidence.measurements = sizes({ primitives: 1513 });
  assert.ok(check().length);
  evidence.measurements = [...sizes(iconSizes), ...sizes({ primitives: 1513 })];
  assert.ok(check().length);
  delete evidence.measurements;
  assert.ok(check().length);
  evidence.deferMeasurement = true;
  evidence.pending = [];
  evidence.measurements = [];
  assert.ok(check().length);
  assert.deepEqual(evidence.pending, []);
});

test('Heading rejects its 1526 and 1329 byte measurements against 750 and 552 even with matching sources', t => {
  const measured = { measurements: sizes({ document: 1526, 'document#Heading': 1329 }) };
  const check = compare(t, group, [...group, 'heading'], measured);
  assert.ok(check().some(issue => issue.includes('Unreviewed packed size at first adoption: document')));
  measured.measurements = sizes({ document: 750, 'document#Heading': 1329 });
  assert.ok(check().some(issue => issue.includes('Unreviewed packed size at first adoption: document#Heading')));
  measured.measurements = sizes({ document: 750, 'document#Heading': 552 });
  assert.deepEqual(check(), []);
});

test('a preliminary reviewed step hands every incumbent to the measured judge before acceptance', t => {
  const options = { deferMeasurement: true, pending: [] };
  const check = compare(t, [], icon, options);
  assert.deepEqual(check(), []);
  assert.deepEqual(options.pending, Object.keys(limits(iconSizes)));
  assert.ok(compare(t, [], icon, { deferMeasurement: true })().length);
  const measured = { measurements: sizes(iconSizes) };
  const final = compare(t, [], icon, measured);
  assert.deepEqual(final(), []);
  for (const entry of options.pending) {
    measured.measurements = sizes(iconSizes).filter(row => row.entry !== entry);
    assert.ok(final().length, entry);
  }
});

test('a reviewed step keeps its dedicated script and CSS inside one family band', t => {
  const path = 'manifests/families/icon-button.json';
  const parent = state([]), next = state(icon);
  delete parent.files[path];
  const manifest = JSON.parse(next.files[path]);
  manifest.band = 'primitives';
  const options = {};
  const judge = compareWithBase(t, baseline, JSON.stringify(limits(parent.values)), parent.files, undefined,
    (root, base, tree, source) => noWeakening(root, base, tree, source, options));
  function check(css) {
    const dedicated = { 'icon-button': 700, 'icon-button.css': css };
    manifest.budgets = Object.entries(limits(dedicated)).map(([name, bytes]) => ({ name, bytes }));
    options.measurements = sizes({ ...iconSizes, ...dedicated });
    return judge(JSON.stringify(limits({ ...next.values, ...dedicated })), { ...next.files, [path]: JSON.stringify(manifest) });
  }
  assert.deepEqual(check(324), []);
  assert.ok(check(500).some(issue => issue.includes('combined')));
});

test('a reviewed raise rejects a source-only change to a different family', t => {
  const check = compare(t, icon, separator, { measurements: sizes({ document: 382 }) });
  assert.deepEqual(check(), []);
  for (const path of ['packages/web/src/icon-button/binding.tsx', 'packages/web/src/icon-button/styles.css',
    'packages/native/src/icon-button/binding.tsx', 'packages/web/src/_shared/icon-state.ts',
    'packages/web/src/icon-button/new-view.tsx']) {
    assert.ok(check({}, { [path]: content(path) + '// unrelated edit\n' }).some(issue => issue.includes(path)), path);
  }
});
