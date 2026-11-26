import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { baselineRows, publishedTokenProperties } from '../cli.mjs';
import { inspectSource, checkBaseline, validateTokens } from '../policy.mjs';

const options = { scopes: ['uld-'], variables: ['--uld-text', '--uld-space-md'] };
function scan(path, code) {
  return inspectSource(path, code, options);
}
// Native-only token declarations, read from the token sources.
import { nativeTokens } from '../tokens.mjs';

test('rejects a literal appended to the real workflow or Elevate admin component', () => {
  for (const path of ['packages/web/src/application-shell/binding.tsx', 'src/components/admin.tsx']) {
    const hits = scan(
      path,
      'export function Admin() { return <section style={{ color: "#123456" }} />; }',
    );
    assert.deepEqual(
      hits.map((hit) => hit.rule),
      ['style/token'],
    );
    assert.match(hits[0].message, /semantic token/);
  }
});

test('checks each selector branch and prevents selectors escaping to siblings', () => {
  for (const selector of [
    'body',
    '.uld-panel, button',
    '.uld-panel + input',
    ':not(.uld-panel) button',
    ':is(.uld-panel, body)',
  ]) {
    assert.ok(
      scan('a.css', selector + ' { color: var(--uld-text) }').some(
        (hit) => hit.rule === 'style/scope',
      ),
      selector,
    );
  }
  assert.deepEqual(
    scan(
      'a.css',
      '.uld-panel button, .uld-list > li { color: var(--uld-text); gap: var(--uld-space-md); }',
    ),
    [],
  );
});

test('reviewed component scope exceptions retain their enclosing scope and exact declarations', () => {
  const path = 'packages/web/src/demo/styles.css';
  const selector = ':focus-visible { outline: none }';
  const wrapped = '@scope (.uld-dialog) to (dialog) {' + selector + '}';
  const hit = source => scan(path, source).find(finding => finding.rule === 'style/scope');
  const current = hit(wrapped);
  assert.ok(current);
  assert.equal(hit(wrapped.replace('outline: none', 'outline:none')).id, current.id);
  assert.notEqual(hit(selector).id, current.id);
  assert.notEqual(hit(wrapped.replace('to (dialog)', 'to (.unrelated)')).id, current.id);
  const root = ':root:has(.uld-dialog-root:modal) {overflow:hidden}';
  assert.notEqual(hit(root).id, hit(root.replace('overflow:hidden', 'overflow:hidden;display:none')).id);
});

test('checks colors, typography, spacing, radius, focus, elevation and motion', () => {
  for (const rule of [
    'color:red',
    'font-size:14px',
    'gap:4px',
    'border-radius:8px',
    'box-shadow:0 2px 5px #444',
    'outline:2px solid red',
    'animation:fade 1s',
    'color:var(--uld-missing)',
    'color:var(--uld-text,#fff)',
  ]) {
    assert.ok(
      scan('a.css', '.uld-box{' + rule + '}').some((hit) => hit.rule === 'style/token'),
      rule,
    );
  }
  assert.deepEqual(
    scan(
      'a.css',
      '.uld-frame{padding-bottom:env(safe-area-inset-bottom);width:100%;color:currentColor}',
    ),
    [],
  );
  // A reference is a token only when its name and every nested fallback are declared tokens.
  for (const rule of [
    'font-size:var(--uld-text,12px)',
    'font-size:var(--uld-undeclared)',
    'font-size:var(--uld-undeclared,var(--uld-text))',
    'font-size:var(--uld-text,var(--uld-undeclared))',
    'font-size:var(--uld-text,var(--uld-space-md,12px))',
    'font-family:monospace',
    'font-family:var(--uld-text,monospace)',
  ]) {
    assert.equal(scan('a.css', '.uld-box{' + rule + '}').filter((hit) => hit.rule === 'style/token').length, 1, rule);
  }
  assert.deepEqual(
    scan(
      'a.css',
      '.uld-type{font-size:var(--uld-text, var(--uld-space-md));font-family:var(--uld-text,var(--uld-space-md,var(--uld-text)))}',
    ),
    [],
  );
});

test('distinguishes tokens from raw and computed inline RN/JSX styles and SVG paints', () => {
  assert.deepEqual(
    scan(
      'x.tsx',
      "import {tokens} from '@ui-lazy-dev/tokens';const x=<View style={{padding:tokens.size.gap}}/>",
    ),
    [],
  );
  for (const code of [
    'const paint={borderRadius:9};const x=<View style={paint}/>',
    "import {StyleSheet as S} from 'react-native'; const styles=S.create({row:{paddingHorizontal:12}})",
    "const x=<svg><path fill='#ddd'/></svg>",
    'const x=<div style={{height:measuredHeight}}/>',
    "const x=<div style={{color:ok ? '#fff' : '#111'}}/>",
  ])
    assert.ok(scan('x.tsx', code).length, code);
  assert.ok(scan('x.svg', '<svg><path fill="#123"/></svg>').length);
  assert.deepEqual(scan('x.svg', '<svg><path fill="currentColor" d="M0 0L1 1"/></svg>'), []);
});

test('exact scoped exceptions expire and duplicate violations consume independent allowances', () => {
  const source = 'const x=<Box style={{height: measuredHeight}}/>';
  const [finding] = scan('workflow.tsx', source);
  const entry = {
    id: finding.id,
    path: finding.path,
    rule: finding.rule,
    count: 1,
    owner: 'UI platform',
    reason: 'Virtual row height from browser measurement',
    expires: '2027-01-01',
  };
  assert.deepEqual(checkBaseline([finding], [entry], '2026-11-20'), []);
  assert.ok(checkBaseline([finding, finding], [entry], '2026-11-20').length);
  assert.ok(checkBaseline([finding], [entry], '2027-01-01').length);
  assert.deepEqual(checkBaseline([finding], [{ ...entry, expires: '2027-02-18' }], '2026-11-20'), []);
  assert.ok(checkBaseline([finding], [{ ...entry, expires: '2027-02-19' }], '2026-11-20').length);
  assert.ok(checkBaseline(scan('other.tsx', source), [entry], '2026-11-20').length);
  assert.ok(
    checkBaseline(
      scan('workflow.tsx', source.replace('measuredHeight', 'width')),
      [entry],
      '2026-11-20',
    ).length,
  );
});

test('only the exact retired source selects its previously reviewed style exceptions', () => {
  const path = 'packages/native/src/dialog.tsx';
  const prior = 'export const Dialog = () => <View style={{ padding: 17 }} />;';
  const current = 'export const Dialog = () => <View style={{ padding: inset }} />;';
  const sha = source => createHash('sha256').update(source).digest('hex');
  const fields = { owner: 'UI platform', reason: 'Dialog inset follows the native host.', expires: '2027-02-18' };
  function allowance(source) {
    const [finding] = scan(path, source);
    return { ...fields, entries: [[finding.id, finding.rule, 1]] };
  }
  const canonical = [{ path, ...allowance(current) }];
  const transition = { path, previousSha256: sha(prior), currentSha256: sha(current), previousGroups: [allowance(prior)] };
  function check(source, date = '2026-11-24') {
    const rows = baselineRows(canonical, [transition], requested => {
      assert.equal(requested, path);
      return source;
    });
    return checkBaseline(scan(path, source), rows, date);
  }
  assert.deepEqual(check(prior), []);
  assert.deepEqual(check(current), []);
  assert.deepEqual(check(current + '\n// product-only comment'), []);
  assert.ok(check(prior + '\n// no longer the reviewed retired source').length);
  assert.ok(check(current.replace('inset', '27')).some(problem => problem.includes('style/token')));
  assert.ok(check(current.replace('padding: inset', '')).some(problem => problem.includes('obsolete')));
  assert.ok(check(current + current).length);
  assert.ok(check(prior, fields.expires).some(problem => problem.includes('Expired')));
  assert.ok(check(current, fields.expires).some(problem => problem.includes('Expired')));
  assert.throws(() => baselineRows(canonical, [transition, transition], () => current), /duplicate|Invalid/);
});

test('rejects bad types, missing aliases, cycles and incomplete themes', () => {
  const value = { $type: 'dimension', $value: { unit: 'px', value: 4 } };
  const valid = {
    light: { space: value },
    dark: { space: { $type: 'dimension', $value: '{light.space}' } },
  };
  assert.deepEqual(validateTokens(valid), []);
  for (const variant of [
    { light: valid.light, dark: {} },
    { light: valid.light, dark: { space: { $type: 'color', $value: '{light.space}' } } },
    { light: valid.light, dark: { space: { $type: 'dimension', $value: '{dark.space}' } } },
    { light: valid.light, dark: { space: { $type: 'dimension', $value: '{missing.value}' } } },
    {
      light: valid.light,
      dark: { space: { $type: 'dimension', $value: { unit: 'wat', value: 4 } } },
    },
  ])
    assert.ok(validateTokens(variant).length);
  // Native-only tokens never enter the web manifest and must be complete, unshared native leaves.
  const marker = { $extensions: { 'ui-lazy-dev.platforms': ['native'] } };
  const native = { ...value, ...marker };
  assert.ok(validateTokens({ ...valid, borderWidth: { thin: native } }).some(error => /web token manifest/.test(error)));
  const web = { ...valid, size: { gap: value } };
  const check = source => nativeTokens([source], web).errors;
  assert.deepEqual(check({ borderWidth: { thin: native }, fontFamily: { mono: { $type: 'fontFamily', $value: 'Menlo', ...marker } },
    size: { gap: value }, lineHeight: { body: { $type: 'dimension', $value: '{size.gap}', ...marker } } }), []);
  assert.deepEqual(nativeTokens([{ borderWidth: { thin: native } }], web).paths, ['borderWidth.thin']);
  assert.deepEqual([...nativeTokens([{ borderWidth: { thin: native } }], web).variables].sort(), ['--uld-border-width-thin', '--uld-thin']);
  for (const source of [
    { borderWidth: { thin: { ...native, $extensions: { 'ui-lazy-dev.platforms': ['web'] } } } },
    { borderWidth: { thin: { ...native, $extensions: { 'ui-lazy-dev.platforms': ['native', 'web'] } } } },
    { borderWidth: { thin: { ...native, $extensions: { 'ui-lazy-dev.platforms': 'native' } } } },
    { light: { space: native } },
    { size: { gap: native } },
    { borderWidth: { gap: native } },
    { borderWidth: { thin: { ...native, $value: { unit: 'wat', value: 1 } } } },
    { fontFamily: { mono: { $type: 'fontFamily', $value: ' ', ...marker } } },
    { lineHeight: { body: { $type: 'color', $value: '{size.gap}', ...marker } } },
  ])
    assert.ok(check(source).length, JSON.stringify(source));
  assert.ok(nativeTokens([{ borderWidth: { thin: native } }], { ...web, size: { gap: { $type: 'dimension', $value: '{borderWidth.thin}' } } })
    .errors.some(error => /cannot alias/.test(error)));
  // A scaled native token multiplies a web dimension alias by a web number.
  const scaled = (base, scale, type = 'dimension') => ({ lineHeight: { body: { $type: type, $value: base,
    $extensions: { 'ui-lazy-dev.platforms': ['native'], 'ui-lazy-dev.scale': scale } } } });
  const typed = { ...web, type: { bodySize: value, bodyLeading: { $type: 'number', $value: 1.5 } } };
  assert.deepEqual(nativeTokens([scaled('{type.bodySize}', '{type.bodyLeading}')], typed).errors, []);
  for (const source of [scaled('{type.bodySize}', '{type.bodySize}'), scaled('{type.bodyLeading}', '{type.bodyLeading}', 'number'),
    scaled({ unit: 'px', value: 24 }, '{type.bodyLeading}'), scaled('{type.bodySize}', 1.5),
    { ...scaled('{borderWidth.thin}', '{type.bodyLeading}'), borderWidth: { thin: native } }])
    assert.ok(nativeTokens([source], typed).errors.length, JSON.stringify(source));
});

test('unknown JS token references and unknown CSS aliases fail despite a valid import shape', () => {
  const finding = inspectSource(
    'view.tsx',
    "import {tokens as t} from '@ui-lazy-dev/tokens';const x=<View style={{padding:t.size.unknown}}/>",
    { ...options, tokenPaths: ['size.gap'] },
  );
  assert.equal(finding[0]?.rule, 'style/token');
  assert.equal(scan('a.css', '.uld-row{padding:var(--made-up)}')[0]?.rule, 'style/token');
  // Published token names come from the default scope and top-level registrations of a fresh
  // build of the exported sheets. Private brand variables and unexported sheets declare nothing.
  const dir = mkdtempSync(join(tmpdir(), 'ui-style-published-'));
  try {
    const tokens = join(dir, 'tokens');
    mkdirSync(join(tokens, 'dist'), { recursive: true });
    writeFileSync(join(tokens, 'dist/styles.css'), ':root, [data-uld-theme="light"] { --uld-stale: 1px; }');
    writeFileSync(join(tokens, 'package.json'), JSON.stringify({
      type: 'module',
      exports: { './styles.css': './dist/styles.css', './brand.css': './dist/brand.css', '.': './dist/index.js' },
    }));
    const sheets = {
      'styles.css': [
        '@layer uld.tokens { :root, [data-uld-theme="light"] { --uld-base: 1px; --other-name: 1px; }',
        '  [data-uld-theme="dark"] { --uld-dark-only: 1px; }',
        '  @property --uld-layered { syntax: "*"; inherits: true; } }',
        '@property --uld-override { syntax: "*"; inherits: true; }',
        '@media print { @property --uld-conditional { syntax: "*"; inherits: true; } }',
      ].join('\n'),
      'brand.css': '@scope ([data-uld-brand]) { :scope { --uld-if-private: 1px; } }',
      'hidden.css': ':root, [data-uld-theme="light"] { --uld-unexported: 1px; }',
    };
    writeFileSync(join(tokens, 'build.mjs'), ["import { mkdirSync, writeFileSync } from 'node:fs';", "mkdirSync('dist', { recursive: true });",
      ...Object.entries(sheets).map(([file, css]) => 'writeFileSync(' + JSON.stringify('dist/' + file) + ', ' + JSON.stringify(css) + ');')].join('\n'));
    assert.deepEqual([...publishedTokenProperties(tokens)].sort(), ['--uld-base', '--uld-layered', '--uld-override']);
    assert.deepEqual(readdirSync(join(tokens, 'dist')), ['styles.css'], 'The caller build output is unchanged');
    assert.deepEqual([...publishedTokenProperties(join(dir, 'missing'))], []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  const library = [...publishedTokenProperties(fileURLToPath(new URL('../../tokens', import.meta.url)))];
  assert.ok(library.includes('--uld-text'));
  assert.ok(library.every((name) => /^--uld-[a-z0-9-]+$/.test(name) && !/^--uld-(?:if|forced)-/.test(name)), library.join());
});

test('a forged baseline with an impossible date or a line-count ceiling is rejected', () => {
  const [finding] = scan('view.tsx', 'const x=<Box style={{gap:7}}/>');
  const exception = {
    ...finding,
    owner: 'UI platform',
    reason: 'Old literal',
    expires: '2026-02-31',
    count: 2,
  };
  assert.ok(checkBaseline([finding], [exception], '2026-01-01').length);
});

test('CSS-in-JSX, animations and RN style aliases share literal enforcement', () => {
  for (const source of [
    'const styles={row:{padding:7}};const x=<View style={styles.row}/>',
    'const x=<style>{".uld-view{background:red}"}</style>',
    'target.animate([{opacity:0.7}],{duration:300})',
    'const x=<svg><stop stopColor="#fff"/></svg>',
  ])
    assert.ok(
      scan('view.tsx', source).some((v) => v.rule === 'style/token'),
      source,
    );
});

test('requires native shadow and elevation values to use semantic tokens', () => {
  for (const source of [
    'const x=<View style={{elevation:6}}/>',
    'const x=<View style={{shadowColor:"#aaa"}}/>',
    'const x=<View style={{shadowRadius:5}}/>',
  ])
    assert.ok(scan('view.tsx', source).length, source);
  // Native-only tokens are semantic only through the native entry, only in native sources.
  const native = nativeTokens([{ borderWidth: { thin: { $type: 'dimension', $value: { value: 1, unit: 'px' },
    $extensions: { 'ui-lazy-dev.platforms': ['native'] } } } }], { size: { gap: { $type: 'dimension', $value: { value: 8, unit: 'px' } } } });
  const rules = (path, code) => inspectSource(path, code, { ...options, tokenPaths: ['size.gap'],
    nativeTokenPaths: native.paths, nativeVariables: native.variables }).map(hit => hit.rule);
  const imports = "import {View} from 'react-native';import {tokens} from '@ui-lazy-dev/tokens';" +
    "import {nativeTokens} from '@ui-lazy-dev/tokens/native';";
  const view = style => imports + 'export function Probe(){return <View style={' + style + '}/>}';
  const nativeFile = 'packages/native/src/probe/binding.tsx';
  assert.deepEqual(rules(nativeFile, view('{borderWidth: nativeTokens.borderWidth.thin, gap: tokens.size.gap}')), []);
  assert.deepEqual(rules(nativeFile, view('{borderWidth: 1}')), ['style/token']);
  assert.deepEqual(rules(nativeFile, view('{borderWidth: tokens.borderWidth.thin}')), ['style/token']);
  assert.deepEqual(rules(nativeFile, view('{borderWidth: nativeTokens.borderWidth.hair}')), ['style/runtime']);
  assert.deepEqual(rules(nativeFile, view('{borderWidth: nativeTokens.size.gap}')), ['style/runtime']);
  assert.deepEqual(rules(nativeFile, imports + 'mutate(nativeTokens);' +
    'export function Probe(){return <View style={{borderWidth: nativeTokens.borderWidth.thin}}/>}'), ['style/runtime']);
  for (const path of ['packages/web/src/probe/binding.tsx', 'catalog/native/Probe.tsx'])
    assert.notDeepEqual(rules(path, view('{borderWidth: nativeTokens.borderWidth.thin}')), [], path);
  for (const sheet of ['.uld-row{border-width:var(--uld-thin)}', '.uld-row{border-width:var(--uld-border-width-thin)}',
    '.uld-row{--uld-thin:var(--uld-space-md)}', '.uld-row{--uld-border-width-thin:0}'])
    assert.deepEqual(rules('packages/web/src/probe/styles.css', sheet), ['style/token'], sheet);
  assert.deepEqual(rules('packages/web/src/probe/styles.css', '.uld-row{--uld-gap-wide:var(--uld-space-md)}'), []);
  // A resolved native theme reads the mode's tokens and the native-only tokens derived from it.
  const themed = body => "import {View, type StyleProp, type ViewStyle} from 'react-native';" +
    "import type {NativeResolvedTokens} from '@ui-lazy-dev/tokens/native';" +
    'export interface Props { theme?: NativeResolvedTokens; style?: StyleProp<ViewStyle> }' +
    'export function Probe({theme}: Props){' + body + '}';
  assert.deepEqual(rules(nativeFile, themed('return <View style={{borderWidth: theme?.borderWidth.thin, gap: theme?.size.gap}}/>')), []);
  assert.notDeepEqual(rules(nativeFile, themed('return <View style={{borderWidth: theme?.borderWidth.hair}}/>')), []);
  assert.notDeepEqual(rules(nativeFile, themed('mutate(theme);return <View style={{borderWidth: theme?.borderWidth.thin}}/>')), []);
  assert.notDeepEqual(rules(nativeFile, themed('return <View style={{borderWidth: theme?.borderWidth.thin}}/>')
    .replace("from '@ui-lazy-dev/tokens/native'", "from '@example/other'")), []);
});

test('accepts the keyboard height and safe-area geometry, rejecting arbitrary environment names and nonzero fallbacks', () => {
  assert.deepEqual(
    scan(
      'a.css',
      '.uld-sheet{bottom:env(keyboard-inset-height,0px);padding-left:env(safe-area-inset-left,0px)}',
    ),
    [],
  );
  for (const value of [
    'env(unreviewed-height,0px)',
    'env(keyboard-inset-height,16px)',
    'env(keyboard-inset-width,0px)',
  ]) {
    assert.equal(scan('a.css', '.uld-sheet{bottom:' + value + '}')[0]?.rule, 'style/token');
  }
});

test('component color reads use semantic tokens across imports, destructuring and CSS', () => {
  const code = `import raw from '@ui-lazy-dev/tokens/tokens.json';
    import * as semantic from '@ui-lazy-dev/tokens';
    import {palette as values} from '@ui-lazy-dev/tokens/tokens.json';
    const alias = raw;
    const accent = alias['palette'].ink;
    const {palette: privateValues} = raw;
    const other = semantic.tokens.palette;
    const permitted = semantic.tokens.light.accent;
    const consumer = {palette: 'metadata'};
    console.log(consumer.palette);`;
  assert.equal(scan('packages/native/src/demo.tsx', code).filter(x => x.rule === 'style/palette').length, 4);
  const style = '.uld-demo { --uld-palette-ink: inherit; color: var(--uld-palette-ink); }';
  assert.equal(scan('packages/web/src/demo/styles.css', style).filter(x => x.rule === 'style/palette').length, 1);
  assert.deepEqual(scan('packages/web/src/demo/styles.css', '.uld-demo { color: var(--uld-text); }'), []);
});
