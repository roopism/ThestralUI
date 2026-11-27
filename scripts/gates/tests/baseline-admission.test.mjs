import assert from 'node:assert/strict';
import test from 'node:test';
import { noWeakening } from '../no-weakening.mjs';
import { compareWithBase } from './fixtures/protected-inputs.mjs';

const sizes = 'tests/packaging/bundle-baseline.json';
const webPackage = 'packages/web/package.json';
const json = value => JSON.stringify(value, null, 2) + '\n';
const pkg = exports => json({ name: '@ui-lazy-dev/ui-web', exports: Object.fromEntries(exports.map(path => [path, './dist/x.js'])) });
const incumbent = { '@ui-lazy-dev/ui-web': 800, '@ui-lazy-dev/ui-web/avatar': 472 };
const family = (web, extra = {}) => ({
  id: 'Sample', band: 'primitives', inventory: { web },
  entries: [{ pkg: 'web', path: './sample', target: './dist/sample.js', order: 1 }],
  budgets: [{ name: '@ui-lazy-dev/ui-web/sample', bytes: 300, order: 1 }, { name: '@ui-lazy-dev/ui-web/sample#Sample', bytes: 290, order: 2 }],
  ...extra,
});
const rows = { ...incumbent, '@ui-lazy-dev/ui-web/sample': 300, '@ui-lazy-dev/ui-web/sample#Sample': 290 };
const measured = [{ entry: '@ui-lazy-dev/ui-web/sample', gzip: 300 }, { entry: '@ui-lazy-dev/ui-web/sample#Sample', gzip: 290 }];
const judge = options => (root, base, tree, source) => noWeakening(root, base, tree, source, options);
const baseFiles = { [webPackage]: pkg(['.', './avatar']) };
const candidate = { [webPackage]: pkg(['.', './avatar', './sample']), 'manifests/families/sample.json': json(family('supported')) };
const flagged = (issues, text) => issues.some(issue => issue.startsWith(sizes) && issue.includes(text));

test('a valid new family size row is admitted only at its measured size', t => {
  const compare = compareWithBase(t, sizes, json(incumbent), baseFiles, undefined, judge({ measurements: measured }));
  assert.deepEqual(compare(json(rows), candidate), []);
  const pending = [];
  const deferred = compareWithBase(t, sizes, json(incumbent), baseFiles, undefined, judge({ deferMeasurement: true, pending }));
  assert.deepEqual(deferred(json(rows), candidate), []);
  assert.deepEqual(pending, ['@ui-lazy-dev/ui-web/sample', '@ui-lazy-dev/ui-web/sample#Sample']);
  const unmeasured = compareWithBase(t, sizes, json(incumbent), baseFiles);
  assert.ok(flagged(unmeasured(json(rows), candidate), 'requires the trusted packed measurement'));
  const promoted = compareWithBase(t, sizes, json(incumbent),
    { ...baseFiles, 'manifests/families/sample.json': json({ id: 'Sample', band: 'primitives', inventory: { web: 'exported' } }) },
    undefined, judge({ measurements: measured }));
  assert.ok(flagged(promoted(json(rows), candidate), 'requires a newly added family'));
});

test('an existing size row cannot grow or vanish while a new row is admitted', t => {
  const compare = compareWithBase(t, sizes, json(incumbent), baseFiles, undefined, judge({ measurements: measured }));
  assert.ok(flagged(compare(json({ ...rows, '@ui-lazy-dev/ui-web/avatar': 473 }), candidate), 'enlarged an existing entry'));
  const dropped = { ...rows };
  delete dropped['@ui-lazy-dev/ui-web/avatar'];
  assert.ok(flagged(compare(json(dropped), candidate), 'removed an existing entry'));
  assert.ok(flagged(compare(json(dropped), { ...candidate, [webPackage]: pkg(['.', './sample']) }), 'removed an existing entry'));
  const legacy = compareWithBase(t, sizes, json(incumbent), baseFiles);
  assert.ok(flagged(legacy(json({ ...incumbent, '@ui-lazy-dev/ui-web/avatar': 473 })), 'baseline gained or enlarged an existing entry'));
});

test('a new size row needs a newly added owning family', t => {
  const established = { ...baseFiles, 'manifests/families/sample.json': json(family('supported', { budgets: [] })), [webPackage]: pkg(['.', './avatar', './sample']) };
  const compare = compareWithBase(t, sizes, json(incumbent), established, undefined, judge({ measurements: measured }));
  assert.ok(flagged(compare(json(rows), { 'manifests/families/sample.json': json(family('supported')) }), 'requires a newly added family'));
  const unowned = compareWithBase(t, sizes, json(incumbent), baseFiles, undefined, judge({ measurements: measured }));
  assert.ok(flagged(unowned(json(rows), { [webPackage]: candidate[webPackage] }), 'no single new family budget'));
  const otherEntry = family('supported', { entries: [{ pkg: 'web', path: './other', target: './dist/other.js', order: 1 }] });
  assert.ok(flagged(unowned(json(rows), { ...candidate, 'manifests/families/sample.json': json(otherEntry) }), 'not a new public entry'));
});

test('a new size row must equal the measured packed size', t => {
  const compare = compareWithBase(t, sizes, json(incumbent), baseFiles, undefined,
    judge({ measurements: [{ ...measured[0], gzip: 299 }, measured[1]] }));
  assert.ok(flagged(compare(json(rows), candidate), 'differs from the packed measurement'));
  const lower = family('supported', { budgets: [{ name: '@ui-lazy-dev/ui-web/sample', bytes: 290, order: 1 }, family('supported').budgets[1]] });
  const manifest = compareWithBase(t, sizes, json(incumbent), baseFiles, undefined, judge({ measurements: measured }));
  assert.ok(flagged(manifest(json(rows), { ...candidate, 'manifests/families/sample.json': json(lower) }), 'differs from the family budget'));
});

test('a new size row over its family band is rejected', t => {
  const big = family('supported', { band: 'primitives', budgets: [{ name: '@ui-lazy-dev/ui-web/sample', bytes: 1100, order: 1 }] });
  const large = { ...incumbent, '@ui-lazy-dev/ui-web/sample': 1100 };
  const compare = compareWithBase(t, sizes, json(incumbent), baseFiles, undefined,
    judge({ measurements: [{ entry: '@ui-lazy-dev/ui-web/sample', gzip: 1100 }] }));
  const files = { ...candidate, 'manifests/families/sample.json': json(big) };
  assert.ok(flagged(compare(json(large), files), 'exceeds its family band'));
  assert.ok(flagged(compare(json(large), { ...files, 'manifests/families/sample.json': json({ ...big, band: undefined }) }), 'requires a known size band'));
  assert.deepEqual(compare(json(large), { ...files, 'manifests/families/sample.json': json({ ...big, band: 'simple' }) }), []);
  assert.ok(flagged(compare(json(large), { ...files, 'manifests/families/sample.json': json({ ...big, band: 'unbounded' }) }), 'requires a known size band'));
});

test('other baseline files stay shrink-only for new family rows', t => {
  const other = 'tests/acceptance/style-baseline.json';
  const compare = compareWithBase(t, other, json(incumbent), baseFiles, undefined, judge({ measurements: measured }));
  assert.ok(compare(json(rows), candidate).some(issue => issue.startsWith(other) && issue.includes('baseline gained or enlarged an entry')));
});
