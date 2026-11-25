import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { baselineRows } from '../cli.mjs';
import { inspectSource, checkBaseline, validateTokens } from '../policy.mjs';

const options = { scopes: ['uld-'], variables: ['--uld-text', '--uld-space-md'] };
function scan(path, code) {
  return inspectSource(path, code, options);
}

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
});

test('unknown JS token references and unknown CSS aliases fail despite a valid import shape', () => {
  const finding = inspectSource(
    'view.tsx',
    "import {tokens as t} from '@ui-lazy-dev/tokens';const x=<View style={{padding:t.size.unknown}}/>",
    { ...options, tokenPaths: ['size.gap'] },
  );
  assert.equal(finding[0]?.rule, 'style/token');
  assert.equal(scan('a.css', '.uld-row{padding:var(--made-up)}')[0]?.rule, 'style/token');
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
