import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { nativeTokenSources, profileBaseline, proveProject, scanProject } from '../../../packages/style-policy/cli.mjs';
import { literalIssue } from '../../../packages/style-policy/css.mjs';
import { checkBaseline, inspectSource } from '../../../packages/style-policy/policy.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const inputs = ['packages/web/src', 'packages/native/src', 'catalog', 'packages/tokens/tokens.json',
  'packages/web/package.json', 'packages/native/package.json', 'packages/tokens/package.json',
  'manifests/families', 'docs/components'];
const stylesheet = 'packages/web/src/resizable-list-and-detail/styles.css';
const profile = JSON.parse(readFileSync(new URL('../../../packages/style-policy/profiles/library.json', import.meta.url)));
const transition = profile.baselineTransitions?.find(row => row.path === stylesheet);
const legacySheet = createHash('sha256').update(readFileSync(join(root, stylesheet))).digest('hex') === transition?.previousSha256;
// An edit to the exact legacy sheet retires its two allowances. Keep the ownership probes in
// the same family until the product migration, then exercise the migrated sheet directly.
const family = legacySheet ? join(dirname(stylesheet), 'component-token-canary.css') : stylesheet;
const sibling = 'packages/web/src/record-selection/styles.css';

function copyInputs(dir) {
  for (const path of [...inputs, profile.nativeTokenSources]) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    cpSync(join(root, path), join(dir, path), { recursive: true });
  }
}

// Run the real library policy on a disposable copy of the real sources with mutations.
function errorsAfter(mutations) {
  const dir = mkdtempSync(join(tmpdir(), 'ui-style-component-'));
  try {
    copyInputs(dir);
    for (const [path, text] of mutations) appendFileSync(join(dir, path), '\n' + text + '\n');
    return checkBaseline(scanProject(dir, 'library').findings, profileBaseline('library', dir));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const only = (errors, path, property) => {
  assert.equal(errors.length, 1, errors.join('\n'));
  assert.ok(errors[0].startsWith(path + ':') && errors[0].includes('style/token [' + property + ']'), errors[0]);
};

test('the real sources keep exactly their dated findings and a family may alias its own component token', () => {
  assert.deepEqual(errorsAfter([]), []);
  if (legacySheet) {
    const retired = errorsAfter([[stylesheet, '/* changed legacy source */']]);
    assert.equal(retired.length, 2);
    assert.ok(retired.some(issue => issue.startsWith(stylesheet + ':') && issue.includes('style/token [outline]')));
    assert.ok(retired.some(issue => issue.startsWith(stylesheet + ':') && issue.includes('style/token [outline-offset]')));
  }
  assert.deepEqual(errorsAfter([[family,
    '.uld-split { --uld-resizable-list-and-detail-gap: var(--uld-space-md); gap: var(--uld-resizable-list-and-detail-gap); }']]), []);
});

test('a component token used or declared outside its family is rejected', () => {
  only(errorsAfter([[sibling, '.uld-record-list { outline-width: var(--uld-resizable-list-and-detail-ring); }']]),
    sibling, 'outline-width');
  only(errorsAfter([['catalog/catalog.css', '.catalog { --uld-resizable-list-and-detail-ring: var(--uld-indicator-stroke); }']]),
    'catalog/catalog.css', '--uld-resizable-list-and-detail-ring');
  const findings = inspectSource('packages/web/src/record-selection/binding.tsx',
    "export const A = () => <div style={{ '--uld-resizable-list-and-detail-ring': 'var(--uld-indicator-stroke)' }} />;",
    { scopes: ['uld-'], variables: ['--uld-indicator-stroke'], componentTokens: {
      owner: 'record-selection', family: (name) => name.startsWith('--uld-resizable-list-and-detail-') ? 'resizable-list-and-detail' : undefined } });
  assert.deepEqual(findings.map((finding) => finding.rule), ['style/token']);
});

test('a component token with a raw literal, a wrong fallback or no declaration is rejected', () => {
  for (const value of ['12px', '#fff', 'solid', '1.5', 'calc(var(--uld-space-md) * 2)', 'var(--uld-indicator-stroke, 3px)', 'var(--uld-unknown-role)'])
    only(errorsAfter([[family, '.uld-split { --uld-resizable-list-and-detail-edge: ' + value + '; }']]),
      family, '--uld-resizable-list-and-detail-edge');
  only(errorsAfter([[family, '.uld-split { outline-width: var(--uld-resizable-list-and-detail-missing); }']]),
    family, 'outline-width');
});

test('structural circle, full viewport and quarter-turn values pass while design literals stay rejected', () => {
  const options = { variables: [] };
  for (const [property, value] of [['border-radius', '50%'], ['border-start-end-radius', '50%'], ['min-height', '100dvh'],
    ['block-size', '100vh'], ['min-block-size', '100svh'], ['transform', 'rotate(90deg)'], ['transform', 'rotate(-180deg)'],
    ['transform', 'rotate(1turn)'], ['rotate', '270deg']])
    assert.equal(literalIssue(property, value, options), false, property + ': ' + value);
  for (const [property, value] of [['font-size', '100vh'], ['line-height', '100dvh'], ['border-width', '100vw']])
    assert.equal(literalIssue(property, value, options), true, property + ': ' + value);
  for (const [property, value] of [['border-radius', '12px'], ['border-radius', '49%'], ['border-radius', '100vmax'],
    ['color', '#fff'], ['min-height', '90vh'], ['margin-block', '100vh'], ['transform', 'rotate(15deg)'],
    ['transform', 'translateX(12px)'], ['transform', 'rotate(90deg) translateX(2px)'], ['transform', 'skew(90deg)'], ['padding', '50%']])
    assert.equal(literalIssue(property, value, options), true, property + ': ' + value);
});

test('only React Native StyleSheet.absoluteFill is a structural style constant', () => {
  const native = (source) => inspectSource('packages/native/src/probe/binding.tsx', source, { scopes: ['uld-'], variables: [], tokenPaths: [] })
    .map((finding) => finding.rule);
  assert.deepEqual(native("import { StyleSheet, View } from 'react-native';\nexport const A = () => <View style={StyleSheet.absoluteFill} />;"), []);
  assert.deepEqual(native("import { StyleSheet, View } from 'react-native';\nexport const A = () => <View style={StyleSheet.hairlineWidth} />;"), ['style/runtime']);
  assert.deepEqual(native("import { View } from 'react-native';\nconst StyleSheet = { absoluteFill: { top: 12 } };\nexport const A = () => <View style={StyleSheet.absoluteFill} />;"), ['style/token']);
});

test('missing native token sources preserve raw findings and grant no native tokens', t => {
  const dir = mkdtempSync(join(tmpdir(), 'ui-style-registry-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  copyInputs(dir);
  const path = 'packages/native/src/registry-probe.tsx';
  writeFileSync(join(dir, path), "import { View } from 'react-native';\n" +
    "import { nativeTokens } from '@ui-lazy-dev/tokens/native';\n" +
    'export const Probe = () => <View style={{borderWidth: nativeTokens.borderWidth.probe, elevation: 12347}}/>;');
  const tokenDir = join(dir, profile.nativeTokenSources);
  const token = { $type: 'dimension', $value: { value: 1, unit: 'px' }, $extensions: { 'ui-lazy-dev.platforms': ['native'] } };
  writeFileSync(join(tokenDir, 'probe.json'), JSON.stringify({ borderWidth: { probe: token } }));
  const renderer = scan => scan.findings.filter(hit => hit.path === path).map(hit => [hit.rule, hit.property]);
  const complete = scanProject(dir, 'library');
  assert.deepEqual(renderer(complete), [['style/token', 'elevation']]);
  const raw = complete.findings.find(hit => hit.path === path && hit.property === 'elevation');
  writeFileSync(join(tokenDir, 'probe.json'), '{');
  assert.throws(() => nativeTokenSources(dir, profile, {}), SyntaxError);
  assert.throws(() => scanProject(dir, 'library'), SyntaxError);
  rmSync(tokenDir, { recursive: true });
  assert.throws(() => nativeTokenSources(dir, profile, {}), { code: 'ENOENT' });
  const report = scanProject(dir, 'library');
  assert.deepEqual(renderer(report), [['style/runtime', 'borderWidth'], ['style/token', 'elevation']]);
  const missingRaw = report.findings.find(hit => hit.path === path && hit.property === 'elevation');
  assert.deepEqual(missingRaw, raw);
  const [rawError] = checkBaseline([raw], []);
  const errors = checkBaseline(report.findings, profileBaseline('library', dir));
  assert.ok(errors.includes(rawError));
  assert.ok(errors.some(issue => issue.includes('ENOENT') && issue.includes(profile.nativeTokenSources)));
  const registry = report.findings.find(hit => hit.rule === 'style/config');
  assert.equal(registry.path, profile.nativeTokenSources);
  assert.throws(() => checkBaseline([registry], [{ ...registry, id: '1'.repeat(64), owner: 'renderer',
    reason: 'Temporary renderer occurrence', count: 1, expires: '2027-02-18' }]), /Invalid.*style exception/);
});

test('the full style verdict and mutation proof reject a missing native registry', t => {
  const dir = mkdtempSync(join(tmpdir(), 'ui-style-verdict-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  copyInputs(dir);
  const tokenPackage = dirname(profile.tokenFile);
  const sourcePackage = join(root, tokenPackage);
  cpSync(sourcePackage, join(dir, tokenPackage), { recursive: true,
    filter: path => ![join(sourcePackage, 'dist'), join(sourcePackage, 'node_modules')].includes(path) });
  rmSync(join(dir, profile.nativeTokenSources), { recursive: true });
  const cli = join(root, 'packages/style-policy/cli.mjs');
  const verdict = spawnSync(process.execPath, [cli, '--profile', 'library', '--root', dir, '--json'], { encoding: 'utf8' });
  assert.equal(verdict.status, 1);
  const { findings, errors } = JSON.parse(verdict.stdout);
  const config = findings.find(hit => hit.rule === 'style/config' && hit.path === profile.nativeTokenSources);
  assert.ok(config?.message.includes('ENOENT'));
  assert.ok(errors.includes(config.path + ': ' + config.message));
  assert.throws(() => proveProject(dir, 'library'), /domains/);
});
