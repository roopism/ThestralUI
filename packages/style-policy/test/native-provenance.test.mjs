import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { enrolledGroups } from '../cli.mjs';
import { inspectSource } from '../policy.mjs';

const tokens = JSON.parse(readFileSync(new URL('../../tokens/tokens.json', import.meta.url)));
const options = { scopes: ['uld-'], variables: [], tokenPaths: Object.entries(tokens)
  .filter(([domain]) => domain !== 'palette')
  .flatMap(([domain, values]) => Object.keys(values).map(name => domain + '.' + name)) };

test('native style passthroughs require the original typed caller or an existing semantic token leaf', () => {
  const imports=`import {type StyleProp as RNStyle, type ViewStyle, type TextStyle, View} from 'react-native'; import {tokens as system} from '@ui-lazy-dev/tokens'; import type {ResolvedTokens} from '@ui-lazy-dev/tokens/modes';`;
  const declaration=`export type Part='body'|'header';export interface Props { style?:RNStyle<ViewStyle>; theme?:ResolvedTokens; partStyles?:Partial<Record<Part,RNStyle<TextStyle>>> }`;
  const style=text=>imports+declaration+'export function Box(props:Props){'+text+'}';
  const samples=[
   ['public-slot',style('return <View style={props.style}/>'),true],
   ['aliased-named-slot',style('const {style: selected}=props;return <View style={selected}/>'),true],
   ['typed-part',style('const {partStyles}=props; return <View style={partStyles?.body}/>'),true],
   ['valid-theme',style("const {theme}=props;const c=theme?.color ?? system.light; return <View style={{color:c.text}}/>"),true],
   ['valid-token',style("return <View style={{padding:system.space.spaceMd}}/>"),true],
   ['wrong-style-origin',style('return <View style={props.style}/>').replace("from 'react-native'","from '@example/unrelated'"),false],
   ['wrong-token-origin',style('return <View style={{padding:system.space.spaceMd}}/>').replace("from '@ui-lazy-dev/tokens'","from '@example/unrelated'"),false],
   ['wrong-theme-origin',style('return <View style={{color:props.theme?.color.text}}/>').replace("from '@ui-lazy-dev/tokens/modes'","from '@example/other-modes'"),false],
   ['shadowed-token',style('function shadow(system:{space:{spaceMd:number}}){ return <View style={{padding:system.space.spaceMd}}/> } return shadow({space:{spaceMd:123}});'),false],
   ['unknown-prop',style('const t=props.theme ?? system;return <View style={{padding:t.space.invented}}/>'),false],
   ['unknown-style-map-key',style('return <View style={props.partStyles?.unknown}/>'),false],
   ['raw',style("return <View style={[props.style,{backgroundColor:'#dc143c'}]}/>"),false],
   ['arith',style('return <View style={{padding:system.space.spaceMd*2}}/>'),false],
   ['mixed-token',style('const c=props.theme?.color ?? {text:"red"};return <View style={{color:c.text}}/>'),false],
   ['local-cast',style("const x={color:'red'} as RNStyle<ViewStyle>;return <View style={x}/>"),false],
   ['direct-write',style("props.style={color:'red'};return <View style={props.style}/>"),false],
   ['alias-write',style("const alias=props;alias.style={color:'red'};return <View style={props.style}/>"),false],
   ['slot-alias-write',style("const alias=props.style as ViewStyle;alias.backgroundColor='red';return <View style={props.style}/>"),false],
   ['shadowed-token-alias',style('const pad=system.space.spaceMd;function inner(pad:number){return <View style={{padding:pad}}/>}return inner(123);'),false],
   ['shadowed-style-alias',style('const input={padding:system.space.spaceMd};function inner(input:unknown){return <View style={input}/>}return inner({color:"red"});'),false],
   ['modified-alias',style('const temp=props;Object.assign(temp,{style:{backgroundColor:"red"}});return <View style={props.style}/>'),false],
   ['opaque-slot-call',style('mutate(props.style);return <View style={props.style}/>'),false],
   ['opaque-object-call',style('mutate(props);return <View style={props.style}/>'),false],
   ['opaque-style-alias-call',style('const local=props.style;mutate(local);return <View style={props.style}/>'),false],
   ['opaque-nested-call',style('mutate({value:props.style});return <View style={props.style}/>'),false],
   ['opaque-global-token-call',style('mutate(system.space);return <View style={{padding:system.space.spaceMd}}/>'),false],
   ['opaque-unrelated-string',style('report(props.label);return <View style={props.style}/>'),true],
   ['caller-shadow',style('function inner(props:{style:unknown}){return <View style={props.style}/>} return inner({style:{}});'),false],
  ];

  for (const [label, source, allowed] of samples) {
    const found = inspectSource('packages/native/src/probe/binding.tsx', source, options);
    assert.equal(found.length === 0, allowed, label + ': ' + JSON.stringify(found));
  }
});

test('a new native style binding can be absent only in its exact unregistered family revision', () => {
  const path = 'packages/native/src/example/binding.tsx';
  const manifest = 'manifests/families/example.json';
  const original = JSON.stringify({ id: 'Example', files: {}, entries: [] });
  const previousManifestSha256 = createHash('sha256').update(original).digest('hex');
  const addition = [{ path, previousManifestSha256 }];
  const groups = [{ path }, { path: 'other.tsx' }];
  const active = JSON.stringify({ files: { nativeSource: [path] }, entries: [{ pkg: 'native', path: './example' }] });
  function inspect(registration, present) {
    return enrolledGroups(groups, addition, key => {
      if (key === manifest) return registration;
      if (key === path && present) return 'export function Example() {}';
      throw Object.assign(new Error('missing ' + key), { code: 'ENOENT' });
    });
  }
  assert.deepEqual(inspect(original, false), [groups[1]]);
  assert.deepEqual(inspect(active, true), groups);
  assert.throws(() => inspect(active, false), /Missing registered/);
  assert.throws(() => inspect(original, true), /Unregistered family/);
  assert.throws(() => inspect(original + ' ', false), /Missing registered/);
  for (const part of ['entries', 'files']) {
    const broken = JSON.parse(active);
    delete broken[part];
    assert.throws(() => inspect(JSON.stringify(broken), true), /Unregistered family/);
  }
  assert.throws(() => enrolledGroups(groups, [...addition, ...addition], () => original), /Unregistered|Invalid/);
});

test('explicit scope selectors require the reviewed component boundary and retain token checks', () => {
  const scopeBoundary = '(.uld-data) to ([data-uld-table])';
  const path = 'packages/web/src/data-table/styles.css';
  const rule = (selector, property = 'display:grid') => selector + '{' + property + '}';
  const scope = (inner, header = scopeBoundary) => '@scope ' + header + '{' + inner + '}';
  const observed = css => inspectSource(path, css, { ...options, scopeBoundary }).map(item => item.rule);
  assert.deepEqual(observed(scope(rule(':scope'))), []);
  assert.deepEqual(observed(scope(rule(':scope :is(th, td)'))), []);
  assert.deepEqual(observed(scope('@container (max-width:38rem){' + rule(':scope tbody') + '}')), []);
  for (const source of [
    rule(':scope tbody'),
    scope(rule(':scope tbody'), '(.uld-data)'),
    scope(rule(':scope tbody'), '(.uld-data) to ([data-wrong])'),
    scope(rule(':scope tbody'), '(body) to ([data-uld-table])'),
    scope(rule(':scope + body')),
    scope(rule(':scope, body')),
    scope(scope(rule(':scope tbody'), '(body)')),
  ]) assert.deepEqual(observed(source), ['style/scope'], source);
  assert.deepEqual(observed(scope(rule(':scope', 'color:#dc143c'))), ['style/token']);
});

test('standalone CSS permits only the exact registered semantic fallback value and unit', () => {
  const path = 'packages/web/src/data-table/styles.css';
  const known = { ...options, variables: ['--uld-control', '--uld-gap'],
    dimensionFallbacks: new Map([['--uld-control', '44px'], ['--uld-gap', '8px']]) };
  const errors = (value, opts = known) => inspectSource(path, '.uld-table { min-height:' + value + '}', opts).map(f => f.rule);
  assert.deepEqual(errors('var(--uld-control, 44px)'), []);
  assert.deepEqual(errors('var(--uld-gap,8px)'), []);
  for (const value of ['44px', 'var(--uld-control, 2.75rem)', 'var(--uld-control, 43px)',
    'var(--uld-gap, 44px)', 'var(--uld-invented, 44px)', 'var(--uld-control, 44px + 1px)']) {
    assert.deepEqual(errors(value), ['style/token'], value);
  }
  assert.deepEqual(errors('var(--uld-control, 44px)', { ...known, dimensionFallbacks: undefined }), ['style/token']);
});

test('new standalone web stylesheet allowances require its exact old manifest or its actual matching public route', () => {
  const path = 'packages/web/src/example/styles.css';
  const target = './dist/example.css';
  const previous = { files: {}, entries: [] };
  const active = { files: { style: [path] }, entries: [{ pkg: 'web', path: './example.css', target }] };
  const previousManifestSha256 = createHash('sha256').update(JSON.stringify(previous)).digest('hex');
  const group = { path };
  function inspect(manifest, published, present, auditedPath = path) {
    return enrolledGroups([group], [{ path: auditedPath, previousManifestSha256 }], file => {
      if (file === 'manifests/families/example.json') return JSON.stringify(manifest);
      if (file === 'packages/web/package.json') return JSON.stringify({ exports: { './example.css': published } });
      assert.equal(file, path);
      if (present) return '.example {}';
      throw Object.assign(Error('Missing CSS'), { code: 'ENOENT' });
    });
  }
  assert.deepEqual(inspect(previous, undefined, false), []);
  assert.deepEqual(inspect(active, target, true), [group]);
  assert.throws(() => inspect({ ...previous, id: 'different' }, undefined, false), /Missing registered/);
  assert.throws(() => inspect(previous, target, false), /Missing registered/);
  assert.throws(() => inspect(active, target, false), /Missing registered/);
  assert.throws(() => inspect(active, './dist/other.css', true), /Unregistered/);
  assert.throws(() => inspect({ ...active, files: {} }, target, true), /Unregistered/);
  assert.throws(() => inspect({ ...active, entries: [] }, target, true), /Unregistered/);
  assert.throws(() => inspect(previous, undefined, false, 'packages/native/src/example/styles.css'), /Invalid/);
});

test('native style slots accept literal absence and reject same-spelled mutable styles and missing design values', () => {
  const path = 'packages/native/src/example/binding.tsx';
  const findings = (body) => inspectSource(path, body, options);
  const fixture = (parameter, value) =>
    `import { View } from 'react-native'; export function Sample(${parameter}) { return <View style={${value}} />; }`;
  for (const value of ['null', 'false', 'undefined', '[false, null, undefined]', 'plain ? undefined : {}']) {
    assert.deepEqual(findings(fixture('plain: boolean', value)), []);
  }
  for (const [parameter, value] of [['undefined: object', '[undefined]'], ['style: object', '[style]'],
    ['readStyle: () => object', '[readStyle()]'], ['plain:boolean', '{color: undefined}'],
    ['plain:boolean', '{color: null}'], ['plain:boolean', '{padding: false}']]) {
    assert.ok(findings(fixture(parameter, value)).length > 0, value);
  }
});

test('a private native style host must render through its real public family binding', () => {
  const path = 'packages/native/src/badge/host.tsx';
  const binding = 'packages/native/src/badge/binding.tsx';
  const prior = JSON.stringify({ id: 'Badge', files: {}, entries: [] });
  const hash = createHash('sha256').update(prior).digest('hex');
  const target = { types: './dist/badge/binding.d.ts', default: './dist/badge/binding.js' };
  const active = {
    inventory: { nativeApi: ['native/badge:Badge'] }, files: { nativeSource: [binding, path] },
    entries: [{ pkg: 'native', path: './badge', target }],
  };
  const call = 'export function Badge() { return draw(); }';
  const use = "import { render as draw } from './host.js'; " + call;
  function inspect({ manifest = active, exported = target, source = use, host = true, audited = path } = {}) {
    const contents = new Map([
      ['manifests/families/badge.json', typeof manifest === 'string' ? manifest : JSON.stringify(manifest)],
      ['packages/native/package.json', JSON.stringify({ exports: exported === null ? {} : { './badge': exported } })],
      [binding, source], ...(host ? [[path, 'export function render() {}']] : []),
    ]);
    return enrolledGroups([{ path: audited }], [{ path: audited, previousManifestSha256: hash }], file => {
      if (contents.has(file)) return contents.get(file);
      throw Object.assign(Error('Missing ' + file), { code: 'ENOENT' });
    });
  }
  assert.deepEqual(inspect(), [{ path }]);
  assert.deepEqual(inspect({ manifest: prior, exported: null, host: false }), []);
  for (const input of [
    { manifest: prior + ' ', exported: null, host: false }, { manifest: prior, host: false }, { host: false },
    { manifest: { ...active, files: { nativeSource: [path] } } },
    { manifest: { ...active, files: { nativeSource: [binding] } } },
    { manifest: { ...active, inventory: { nativeApi: ['native/badge:Other'] } } },
    { manifest: { ...active, entries: [] } }, { exported: { ...target, default: './dist/other.js' } },
    { exported: { ...target, 'react-native': './dist/other.js' } },
    { source: use.replace('./host.js', './foreign.js') }, { source: use.replace('import {', 'import type {') },
    { source: use.replace('render as draw', 'type render as draw') },
    { source: use.replace('return draw()', 'return 0') },
    { source: use.replace('Badge()', 'Badge(draw)') }, { source: use.replace('export function', 'function') },
    { source: use.replace('function Badge', 'function Other') }, { audited: path.replace('/native/', '/web/') },
  ]) {
    assert.throws(() => inspect(input), /Missing registered|Unregistered|Unbound native|Invalid new/, JSON.stringify(input));
  }
});
