import { gzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { waitForLock } from '../../workers/lock-queue.mjs';
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
  const promoted = compareWithBase(t, sizes, json({ ...incumbent, [measured[1].entry]: measured[1].gzip }),
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
  const compare = compareWithBase(t, sizes, json({ ...incumbent, [measured[1].entry]: measured[1].gzip }), established, undefined, judge({ measurements: measured }));
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

test('a new family must fit script and standalone CSS in a single band', t => {
  const script = '@ui-lazy-dev/ui-web/sample', css = script + '.css';
  const compareSize = (styleBytes, { omitRow, omitEntry, registered } = {}) => {
    const sizes = { [script]: 700, [script + '#Sample']: 690, [css]: styleBytes };
    if (omitRow) delete sizes[css];
    const manifest = family('supported', {
      entries: omitEntry ? family('supported').entries :
        [...family('supported').entries, { pkg: 'web', path: './sample.css', target: './dist/sample.css', order: 2 }],
      budgets: Object.entries(sizes).map(([name, bytes], order) => ({ name, bytes, order })),
    });
    const measurements = Object.entries(sizes).map(([entry, gzip]) => ({ entry, gzip }));
    const parent = registered ? { ...baseFiles, 'manifests/families/sample.json': json({ id: 'Sample' }) } : baseFiles;
    const compare = compareWithBase(t, 'tests/packaging/bundle-baseline.json', json(incumbent), parent, undefined, judge({ measurements }));
    return compare(json({ ...incumbent, ...sizes }), {
      [webPackage]: pkg(['.', './avatar', './sample', './sample.css']), 'manifests/families/sample.json': json(manifest),
    });
  };
  assert.deepEqual(compareSize(324), []);
  assert.ok(flagged(compareSize(500), 'combined'));
  assert.ok(flagged(compareSize(324, { omitRow: true }), 'missing'));
  assert.ok(flagged(compareSize(324, { omitRow: true, omitEntry: true }), 'missing'));
  assert.deepEqual(compareSize(324, { registered: true }), []);
  assert.ok(flagged(compareSize(500, { registered: true }), 'combined'));
});

test('changing a propagated lock error into a retry is a changed rejection', async t => {
  const before = "export function guard(acquire) { try { acquire(); } catch (error) { throw Error('busy'); } }";
  const after = before.replace("Error('busy')", "Error('busy', { cause: error })");
  const dir = mkdtempSync(join(tmpdir(), 'uld-admission-cause-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  async function acquire(source) {
    const { guard } = await import('data:text/javascript,' + encodeURIComponent(source));
    let calls = 0;
    await waitForLock(dir, 'control', () => guard(() => {
      if (++calls === 1) throw Object.assign(Error('exists'), { code: 'EEXIST' });
    }));
    return calls;
  }
  await assert.rejects(acquire(before), { message: 'busy' });
  assert.equal(await acquire(after), 2);
  const compare = compareWithBase(t, 'scripts/gates/guard.mjs', before);
  assert.ok(compare(after).some(issue => issue.includes('removed reject')));
});

test('an already registered family can publish its first measured size rows', t => {
  const registered = { ...candidate, 'manifests/families/sample.json': json(family('supported', { budgets: [] })) };
  const compare = compareWithBase(t, sizes, json(incumbent), registered, undefined, judge({ measurements: measured }));
  assert.deepEqual(compare(json(rows), candidate), []);
  const predeclared = compareWithBase(t, sizes, json(incumbent), candidate, undefined, judge({ measurements: measured }));
  assert.deepEqual(predeclared(json(rows)), []);
  const promoted = { ...candidate, 'manifests/families/sample.json': json(family('supported', { band: 'simple' })) };
  assert.ok(flagged(compare(json(rows), promoted), 'cannot raise an existing family band'));
});

test('even a single prior named size row rules out first admission', t => {
  const existing = { ...incumbent, [measured[1].entry]: measured[1].gzip };
  for (const parent of [candidate, baseFiles]) {
    const compare = compareWithBase(t, sizes, json(existing), parent, undefined, judge({ measurements: measured }));
    assert.ok(compare(json(rows), candidate).some(issue => issue.startsWith(sizes)), 'the named row already exists');
  }
});

const web = '@ui-lazy-dev/ui-web', primitives = web + '/primitives', icon = web + '/icon-button';
const alias = primitives + '#IconButton';

function compareIconButton(t, { aliasBytes = 993, packedAlias = aliasBytes, prior = {}, packageBytes = 1135, omitDedicated = false } = {}) {
  const manifest = 'manifests/families/icon-button.json';
  const shared = { entries: [{ pkg: 'web', path: './primitives' }] };
  const base = {
    [webPackage]: pkg(['./primitives']),
    'manifests/shared.json': json(shared),
    [manifest]: json({ id: 'Icon button', inventory: { api: ['primitives:IconButton', 'primitives:useIconButton'] } }),
  };
  const before = { [primitives]: 1135, ...prior };
  const first = omitDedicated ? { [alias]: aliasBytes } :
    { [icon]: 1000, [icon + '#IconButton']: 994, [icon + '#useIconButton']: 422, [icon + '.css']: 296, [alias]: aliasBytes };
  const entries = omitDedicated ? [] : ['./icon-button', './icon-button.css'].map(path => ({ pkg: 'web', path }));
  const budgets = Object.entries(first).map(([name, bytes]) => ({ name, bytes }));
  const measurements = Object.entries({ ...first, [alias]: packedAlias }).map(([entry, gzip]) => ({ entry, gzip }));
  const compare = compareWithBase(t, sizes, json(before), base, undefined, judge({ measurements }));
  return compare(json({ ...before, ...first, [primitives]: packageBytes }), {
    [webPackage]: pkg(['./primitives', './icon-button', './icon-button.css']),
    [manifest]: json({ id: 'Icon button', band: 'simple', entries, budgets,
      inventory: { api: ['primitives:IconButton', 'primitives:useIconButton', 'icon-button:IconButton', 'icon-button:useIconButton'] } }),
  });
}

test('the first Icon Button rows admit its measured primitives compatibility alias', t => {
  assert.deepEqual(compareIconButton(t), []);
  assert.ok(flagged(compareIconButton(t, { packedAlias: 992 }), 'differs from the packed measurement'));
  assert.ok(flagged(compareIconButton(t, { packageBytes: 1513 }), 'enlarged an existing entry'));
});

test('a family with a prior size row cannot add a compatibility alias', t => {
  assert.ok(flagged(compareIconButton(t, { prior: { [icon + '#IconButton']: 994 } }), alias + ' new baseline row requires'));
  assert.ok(flagged(compareIconButton(t, { prior: { [alias]: 993 } }), icon + ' new baseline row requires'));
  assert.ok(flagged(compareIconButton(t, { prior: { [primitives + '#useIconButton']: 422 } }), alias + ' new baseline row requires'));
});

test('a compatibility alias plus the family CSS must fit the combined band', t => {
  assert.deepEqual(compareIconButton(t, { aliasBytes: 2264 }), []);
  assert.ok(flagged(compareIconButton(t, { aliasBytes: 2265 }), 'combined'));
  assert.ok(flagged(compareIconButton(t, { omitDedicated: true }), 'missing'));
});

test('an alias-only Spinner includes the packed shared stylesheet once in its band', t => {
  const manifest = 'manifests/families/spinner.json', style = 'packages/web/src/spinner/styles.css';
  const sheet = primitives + '.css', label = primitives + '#Spinner';
  const row = { id: 'Spinner', band: 'primitives', inventory: { api: ['primitives:Spinner'] }, files: { style: [style] } };
  const base = { [manifest]: json(row), [webPackage]: pkg(['./primitives', './primitives.css']),
    [style]: '/* @uld-css-chunk primitives.032 */\n.spinner {}\n/* @uld-css-chunk primitives.035 */\n.busy {}\n' };
  const before = { [primitives]: 1135, [sheet]: 862 };
  const first = { ...before, [label]: 200 };
  const candidate = { [manifest]: json({ ...row, budgets: [{ name: label, bytes: 200 }] }) };
  const compare = options => compareWithBase(t, sizes, json(before), base, undefined, judge(options))(json(first), candidate);
  const script = { entry: label, gzip: 200 };
  assert.ok(flagged(compare({ measurements: [script, { entry: sheet, gzip: 825 }] }), 'combined'));
  assert.deepEqual(compare({ measurements: [script, { entry: sheet, gzip: 824 }] }), []);
  for (const evidence of [[], [{ entry: sheet, gzip: 0 }], [{ entry: sheet, gzip: 1 }, { entry: sheet, gzip: 1 }]])
    assert.ok(flagged(compare({ measurements: [script, ...evidence] }), 'measurement'));
  const pending = [];
  assert.deepEqual(compare({ deferMeasurement: true, pending }), []);
  assert.deepEqual(pending.sort(), [label, sheet].sort());
});

test('registered compatibility bindings can differ from their manifest filenames', t => {
  for (const [slug, subpath, symbol] of [
    ['resizable-list-and-detail', 'workflows', 'SplitView'], ['locale-provider', 'navigation', 'I18nProvider'],
  ]) {
    const path = 'manifests/families/' + slug + '.json', binding = subpath + ':' + symbol;
    const label = web + '/' + subpath + '#' + symbol;
    const manifest = { id: slug, band: 'simple', inventory: { api: [binding] } };
    const base = { [path]: json(manifest), [webPackage]: pkg(['./' + subpath]) };
    const first = { [label]: 175 }, options = { measurements: [{ entry: label, gzip: 175 }] };
    const compare = compareWithBase(t, sizes, '{}', base, undefined, judge(options));
    const next = { [path]: json({ ...manifest, budgets: [{ name: label, bytes: 175 }] }) };
    assert.deepEqual(compare(json(first), next), []);
    assert.ok(flagged(compare(json(first), { ...next, 'manifests/families/other.json':
      json({ id: 'Other', inventory: { api: [binding] } }) }), 'not a new public entry'));
    assert.ok(flagged(compare(json(first), { ...next, [webPackage]: pkg([]) }), 'not a new public entry'));
  }
});

function mixedStyles(t, source, scriptBytes, standaloneBytes, otherSources = {}) {
  const script = web + '/sample', sheet = script + '.css', style = 'packages/web/src/sample/styles.css';
  const exports = ['./sample', './sample.css', './primitives.css', './compat.css'];
  const entries = exports.slice(0, 2).map(path => ({ pkg: 'web', path }));
  const first = { [script]: scriptBytes, [sheet]: standaloneBytes };
  const budgets = Object.entries(first).map(([name, bytes]) => ({ name, bytes }));
  const catalog = 'catalog/sample/catalog.css';
  const files = { ...otherSources, [webPackage]: pkg(exports), [style]: source, [catalog]: '.story { display: grid; }',
    'manifests/families/sample.json': json(family('supported', { entries, budgets, files: { style: [style, catalog] } })) };
  return options => compareWithBase(t, sizes, '{}', {}, undefined, judge(options))(json(first), files);
}

const mixedSource = [
  '/* @uld-css-chunk sample */', '.layout{display:block}',
  '/* @uld-css-chunk compat */', "@import './sample.css';",
  '/* @uld-css-chunk primitives.001 */', '.busy{opacity:.5}',
  '/* @uld-css-chunk primitives.002 */', '.loading{cursor:progress}', '',
].join('\n');

test('standalone and distinct shared CSS must fit one band at the exact packed boundary', t => {
  const check = mixedStyles(t, mixedSource, 700, 300);
  const compare = sharedBytes => check({ measurements: [
    { entry: web + '/sample', gzip: 700 }, { entry: web + '/sample.css', gzip: 300 },
    { entry: primitives + '.css', gzip: sharedBytes },
  ] });
  assert.ok(flagged(compare(100), 'combined'), '700 + 300 + 100 exceeds the 1024-byte band');
  assert.deepEqual(compare(24), []);
  assert.ok(flagged(compare(25), 'combined'));
});

test('mixed CSS requests one measurement per required shared sheet and ignores a pure forward', t => {
  const check = mixedStyles(t, mixedSource, 700, 300), pending = [];
  assert.deepEqual(check({ deferMeasurement: true, pending }), []);
  assert.deepEqual(pending.sort(), [web + '/sample', web + '/sample.css', primitives + '.css'].sort());
  const entries = [{ entry: web + '/sample', gzip: 700 }, { entry: web + '/sample.css', gzip: 300 }];
  const shared = { entry: primitives + '.css', gzip: 24 };
  for (const invalid of [[], [{ ...shared, gzip: 0 }], [shared, shared]])
    assert.ok(flagged(check({ measurements: [...entries, ...invalid] }), 'measurement'));
});

test('a shared sheet with both a repeated rule and a distinct rule charges only its distinct payload', t => {
  const layout = '.layout{display:block}', busy = '.busy{opacity:.5}', standalone = layout + '\n';
  const source = ['/* @uld-css-chunk sample */', layout, '/* @uld-css-chunk primitives */', layout, busy, ''].join('\n');
  const size = css => gzipSync(css, { level: 9 }).length;
  const shared = layout + busy + '\n', limit = 1024 - size(standalone) - size(busy + '\n');
  const compare = script => mixedStyles(t, source, script, size(standalone))({ measurements: [
    { entry: web + '/sample', gzip: script }, { entry: web + '/sample.css', gzip: size(standalone), css: standalone },
    { entry: primitives + '.css', gzip: size(shared), css: shared },
  ] });
  assert.ok(flagged(compare(limit + 1), 'combined'));
  assert.deepEqual(compare(limit), []);
});

function compiledScope(t, opening, closing) {
  const rule = '.busy{opacity:.5}', layout = '.layout{display:block}';
  const source = ['/* @uld-css-chunk sample.2 */', rule, '/* @uld-css-chunk primitives.2 */', rule,
    '/* @uld-css-chunk sample.4 */', layout, ''].join('\n');
  const surround = (sheet, start, end) => ['/* @uld-css-chunk ' + sheet + '.1 */', start,
    '/* @uld-css-chunk ' + sheet + '.3 */', end, ''].join('\n');
  const size = css => gzipSync(css, { level: 9 }).length;
  const scoped = opening + rule + closing;
  const standalone = scoped + layout + '\n', script = 1024 - size(standalone);
  const evidence = [{ entry: web + '/sample', gzip: script },
    { entry: web + '/sample.css', gzip: size(standalone), css: standalone }];
  const check = (shared, wrappers, options) => mixedStyles(t, source, script, size(standalone), {
    'packages/web/src/other/scope.css': surround('sample', opening, closing) + wrappers,
  })(options ?? { measurements: [...evidence, { entry: primitives + '.css', css: shared, gzip: size(shared) }] });
  assert.ok(flagged(check(rule + '\n', ''), 'combined'), 'the unscoped shared rule costs additional bytes');
  const pending = [];
  assert.deepEqual(check(rule + '\n', '', { deferMeasurement: true, pending }), []);
  assert.ok(pending.includes(primitives + '.css'), 'request the shared packed bytes');
  assert.deepEqual(check(scoped + '\n', surround('primitives', opening, closing)), []);
}

test('a media query assembled across files counts distinct compiled rules', t => compiledScope(t, '@media print{', '}'));
test('a supports condition assembled across files counts distinct compiled rules', t => compiledScope(t, '@supports (display:grid){', '}'));
test('a selector assembled across files counts distinct compiled rules', t => compiledScope(t, '.panel ', ''));
