import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { scan, review } from '../index.mjs';
function fixture(t, files, options = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'ui-ownership-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const [file, source] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), source);
  }
  return scan(dir, {
    include: ['src', 'packages'],
    mode: 'library',
    publicEntries: { '@ui-lazy-dev/ui-web': ['/', '/forms'] },
    owners: [],
    adapters: [],
    ...options,
  });
}
test('allows only the assigned implementation symbol and explains a new workflow button', (t) => {
  const r = fixture(
    t,
    {
      'src/controls.tsx': 'export const Button=()=> <button/>; export const Bad=()=> <button/>;',
      'src/page.tsx':
        "import{Button as Submit}from './controls';export const Page=()=> <><Submit/><button/></>",
    },
    { owners: [{ file: 'src/controls.tsx', symbol: 'Button', family: 'button' }] },
  );
  assert.deepEqual(r.findings.map((x) => x.symbol).sort(), ['Bad', 'Page']);
  assert.match(r.findings[0].fix, /Button/);
  const nested = fixture(t, {
    'src/ui/dist/Toggle.tsx': 'export const Toggle=()=> <span role={"switch"} />;',
    'src/ui/release/Toggle.tsx': 'export const Toggle=()=> <span role={"switch"} />;',
    'src/dist/Ignore.tsx': 'export const Ignore=()=> <button />;',
    'src/release/Ignore.tsx': 'export const Ignore=()=> <button />;',
    'src/Flat.tsx': 'export const Flat=()=> <span role={"switch"} />;',
  });
  assert.deepEqual(nested.findings.map(row => [row.file, row.family]).sort(), [
    ['src/Flat.tsx', 'selection'], ['src/ui/dist/Toggle.tsx', 'selection'], ['src/ui/release/Toggle.tsx', 'selection'],
  ]);
});
test('follows aliases, namespaces, barrel reexports, host strings and local wrappers including RN', (t) => {
  const r = fixture(t, {
    'src/barrel.ts': "export {Pressable as Tap,TextInput as Edit} from 'react-native'",
    'src/actions.tsx':
      "import * as N from './barrel'; export const Bad=()=> <N.Tap/>;export const Field=()=> <N.Edit/>;",
    'src/alias.tsx': "const Tag='button';export const Raw=()=> <Tag/>;export {Raw as Wrapped};",
    'src/page.tsx':
      "import {Wrapped as X} from './alias';import{createElement as el} from 'react';export const Page=()=> <><X/><div onClick={()=>{}}/>{el('input')}</>;",
  });
  const issue = r.findings.map((f) => f.family);
  for (const family of ['button', 'input']) assert.ok(issue.includes(family));
  assert.ok(r.findings.some((f) => f.file === 'src/page.tsx' && f.rule === 'local-substitute'));
  assert.ok(r.findings.some((f) => f.file === 'src/actions.tsx' && f.family === 'input'));
  assert.ok(r.findings.some((f) => f.file === 'src/alias.tsx' && f.family === 'button'));
  assert.ok(r.findings.some((f) => f.file === 'src/page.tsx' && f.family === 'input'));
});
test('reports private imports, reversed layers, catalog dependencies, cross-platform imports and cycles', (t) => {
  const r = fixture(t, {
    'packages/web/src/index.tsx':
      "import './workflows';import 'react-native';import '@ui-lazy-dev/ui-web/dist/secret';import '../../../catalog/a';",
    'packages/web/src/workflows.tsx': "import './index';import 'next/navigation';",
    'packages/native/src/index.tsx': "import 'react-dom';",
  });
  const rules = new Set(r.findings.map((x) => x.rule));
  for (const rule of [
    'cycle',
    'private-import',
    'layer',
    'platform',
    'test-import',
    'product-import',
  ])
    assert.ok(rules.has(rule), rule);
});
test('consumers count eligible uses from public imports, local bridges, and raw inputs by screen', (t) => {
  const r = fixture(
    t,
    {
      'src/controls.tsx': 'export const Button=()=>null;',
      'src/screen.tsx':
        "import {Button as Save} from './controls';import {Input as Search} from '@ui-lazy-dev/ui-web/forms';export function Page(){return <><Save/><Search/><input/></>}",
    },
    {
      mode: 'consumer',
      adapters: [{ file: 'src/controls.tsx', symbol: 'Button', family: 'button' }],
    },
  );
  assert.deepEqual(
    r.usage
      .filter((x) => x.file === 'src/screen.tsx')
      .map((x) => [x.family, x.status])
      .sort(),
    [
      ['button', 'bridged'],
      ['input', 'adopted'],
      ['input', 'raw'],
    ],
  );
  assert.match(r.findings[0].fix, /Input/);
});
test('exact reviewed fingerprints cannot hide changed nodes, duplicates, stale or expired exceptions', (t) => {
  const config = { 'src/page.tsx': "export const Page=()=> <input name='review'/>;" };
  const [entry] = fixture(t, config).findings;
  const exemption = {
    fingerprint: entry.fingerprint,
    owner: '@team',
    reason: 'Migrate the reviewed input after flag promotion.',
    expires: '2027-02-01',
  };
  assert.equal(review([entry], [exemption], '2026-11-20').length, 0);
  for (const overrides of [
    { expires: '2026-11-20' },
    { expires: '2027-02-02' },
    { owner: '' },
    { fingerprint: '*' },
    { reason: '' },
  ])
    assert.ok(review([entry], [{ ...exemption, ...overrides }], '2026-11-20').length);
  assert.ok(review([], [exemption], '2026-11-20').length);
  assert.ok(
    review(
      fixture(t, {
        'src/page.tsx': "export const Page=()=> <><input name='review'/><input name='review'/></>;",
      }).findings,
      [exemption],
      '2026-11-20',
    ).length,
  );
});

test('an existing reviewed input cannot grant permission for the next input in the same component', (t) => {
  const before = {
    'src/components/elevate-screen.tsx': "export const Review=()=> <input name='legacy'/>;",
  };
  const result = fixture(t, before, { mode: 'consumer' });
  const approved = {
    fingerprint: result.findings[0].fingerprint,
    owner: '@product',
    reason: 'Retain the original autofill behavior during migration.',
    expires: '2027-01-01',
  };
  const after = fixture(
    t,
    {
      'src/components/elevate-screen.tsx':
        "export const Review=()=> <><input name='legacy'/><input name='new'/></>;",
    },
    { mode: 'consumer' },
  );
  const errors = review(after.findings, [approved], '2026-11-20');
  assert.equal(errors.length, 1);
  assert.match(errors[0], /elevate-screen.tsx.*primitive-owner.*Input/);
});

test('type-only imports do not create runtime cycles; package aliases cannot invert the layering', (t) => {
  const r = fixture(
    t,
    {
      'packages/tokens/colors.ts':
        "import type {B} from './format';import {DataTable} from '@ui-lazy-dev/ui-web/collections';export type A=B;export const Colors=DataTable;",
      'packages/tokens/format.ts': "import type {A} from './colors';export type B={a:A};",
    },
    { publicEntries: { '@ui-lazy-dev/ui-web': ['/collections'] } },
  );
  assert.deepEqual(
    r.findings.map((f) => f.rule),
    ['layer'],
  );
});

test('finds a local alias of a runtime factory and a direct re-export of a native host', (t) => {
  const r = fixture(t, {
    'src/bad.tsx':
      "import {createElement as make} from 'react';const host=make;export const Local=()=>host('div',{onClick:()=>0});export {Pressable as PublicButton} from 'react-native';",
  });
  assert.ok(r.findings.some((f) => f.family === 'button' && f.rule === 'primitive-owner'));
  assert.ok(r.findings.some((f) => f.rule === 'primitive-reexport'));
});

test('TypeScript path aliases, destructured namespaces, and spread click handlers retain their owners', (t) => {
  const r = fixture(t, {
    'tsconfig.json': JSON.stringify({ compilerOptions: { paths: { '~/*': ['./src/*'] } } }),
    'src/aliases.ts':
      "import * as Native from 'react-native';const {Pressable: Activate}=Native;export {Activate};",
    'src/items.tsx':
      "import {Activate} from '~/aliases';const handlers={onClick:()=>{}};export const Test=()=> <><Activate/><div {...handlers}/></>;",
  });
  assert.equal(
    r.findings.filter(
      (f) => f.file === 'src/items.tsx' && f.family === 'button' && f.rule === 'primitive-owner',
    ).length,
    2,
  );
});

test('an owner cannot lend its name to an unrelated local implementation in the same file', (t) => {
  const r = fixture(
    t,
    {
      'src/controls.tsx':
        'export function Button(){return <button/>;}export function Screen(){function Button(){return <button/>;}return <Button/>;}',
    },
    { owners: [{ file: 'src/controls.tsx', symbol: 'Button', family: 'button' }] },
  );
  assert.equal(r.findings.filter((f) => f.rule === 'primitive-owner').length, 1);
});

test('pure visual native views are allowed; accessible and pressable native views need an interaction owner', (t) => {
  const r = fixture(t, {
    'packages/native/src/layout.tsx':
      "import {View,Text} from 'react-native';export const Screen=()=> <><View/><Text onPress={()=>0}>Act</Text><View accessibilityRole='link'/></>;",
  });
  assert.deepEqual(
    r.findings.map((f) => f.family),
    ['button', 'link'],
  );
});

test('server-safe leaves and mixed re-exports reject a blanket client boundary', t => {
  const root = 'packages/web/src/';
  const result = fixture(t, {
    [root + 'text/binding.tsx']: "'use client'; export function Text({children}:{children:string}) { return <p>{children}</p>; }",
    [root + 'field/binding.tsx']: "import {useId} from 'react'; export function Field(){const id=useId();return <input id={id}/>;}",
    [root + 'action/binding.tsx']: "'use client'; import {useState as signal} from 'react'; export function Action(){const [n]=signal(0);return <span>{n}</span>;}",
    [root + 'mixed.ts']: "'use client'; export { Action } from './action/binding'; export { Field } from './field/binding';",
    [root + 'input.tsx']: "'use client'; export function Input(){return <input onChange={event=>event.target.value}/>;}",
    [root + 'unused.tsx']: "'use client'; import type {CSSProperties} from 'react'; export const Title = (props:{style:CSSProperties})=><h1 {...props}/>;",
  }, { mode: 'library' });
  const paths = result.findings.filter(finding => finding.rule === 'use-client').map(finding => finding.file).sort();
  assert.deepEqual(paths, [root + 'mixed.ts', root + 'text/binding.tsx', root + 'unused.tsx']);
});

test('client ownership follows hook aliases and permits React server memoization', t => {
  const root = 'packages/web/src/';
  const result = fixture(t, {
    [root + 'active.tsx']: "'use client'; import * as React from 'react'; const { useState: open }=React; const read=open; export function Panel(){return <p>{read(false)[0]}</p>;}",
    [root + 'pure.tsx']: "'use client'; import * as React from 'react'; const compute=React.useMemo; export function Total(){return <span>{compute(()=>2,[])}</span>;}",
  });
  assert.deepEqual(result.findings.filter(f => f.rule === 'use-client').map(f => f.file), [root + 'pure.tsx']);
});

test('registered family imports need a matching package target, public binding and owned source', t => {
  const slug = 'review-panel';
  const target = { types: './dist/review-panel/index.d.ts', default: './dist/review-panel/index.js' };
  const css = './dist/review-panel.css';
  const source = 'packages/web/src/review-panel/index.ts';
  const style = 'packages/web/src/review-panel/styles.css';
  const published = { name: '@ui-lazy-dev/ui-web', exports: { './review-panel': target, './review-panel.css': css } };
  const family = {
    id: 'Review panel',
    entries: [{ pkg: 'web', path: './review-panel', target }, { pkg: 'web', path: './review-panel.css', target: css }],
    inventory: { api: ['review-panel:ReviewPanel'] }, files: { source: [source], style: [style] },
  };
  const files = {
    [source]: 'export const ReviewPanel=1;',
    [style]: '/* @uld-css-chunk review-panel */\n.review {}',
    'src/screen.ts': "import '@ui-lazy-dev/ui-web/review-panel'; import '@ui-lazy-dev/ui-web/review-panel.css'; import '@ui-lazy-dev/ui-web/review-panel/private';",
  };
  function issues(manifest, pkg, options = {}, overrides = {}) {
    const fixtureFiles = { ...files, 'packages/web/package.json': JSON.stringify(pkg), ...overrides };
    if (manifest) fixtureFiles['manifests/families/' + slug + '.json'] = JSON.stringify(manifest);
    return fixture(t, fixtureFiles, { registeredFamilyEntries: true, ...options }).findings;
  }
  const privateImports = findings => findings.filter(f => f.rule === 'private-import').map(f => f.detail);
  const deep = '@ui-lazy-dev/ui-web/review-panel/private';
  const entry = '@ui-lazy-dev/ui-web/review-panel';
  const sheet = entry + '.css';
  assert.deepEqual(privateImports(issues(family, published)), [deep]);
  for (const [manifest, pkg, options] of [
    [undefined, published], [family, { ...published, exports: {} }], [{ ...family, id: 'Other' }, published],
    [{ ...family, inventory: { api: ['other:ReviewPanel'] } }, published],
    [{ ...family, files: {} }, published], [family, { ...published, name: '@ui-lazy-dev/other' }],
    [family, published, { mode: 'consumer' }], [family, published, { registeredFamilyEntries: false }],
  ]) assert.deepEqual(privateImports(issues(manifest, pkg, options)), [entry, sheet, deep]);
  const badTarget = { ...target, browser: './private.js' };
  assert.deepEqual(privateImports(issues(family, { ...published, exports: { ...published.exports, './review-panel': badTarget } })), [entry, sheet, deep]);
  const wrong = { types: './dist/private/index.d.ts', default: './dist/private/index.js' };
  assert.deepEqual(privateImports(issues({ ...family, entries: [{ pkg: 'web', path: './review-panel', target: wrong }] },
    { ...published, exports: { './review-panel': wrong } })), [entry, sheet, deep]);
  assert.deepEqual(privateImports(issues(family, published, {}, { [style]: '/* @uld-css-chunk other */' })), [sheet, deep]);
  assert.deepEqual(privateImports(issues(family, published, {}, { [source]: 'export const unrelated=1;' })), [entry, sheet, deep]);
  const wildcard = { ...family, entries: [{ pkg: 'web', path: './*', target }] };
  assert.deepEqual(privateImports(issues(wildcard, published)), [entry, sheet, deep]);
  assert.ok(issues(family, published, {}, { 'packages/web/src/button/helper.ts': "import '@ui-lazy-dev/ui-web/review-panel';" }).some(f => f.rule === 'layer'));
  assert.ok(issues(family, published, {}, { 'packages/native/src/check.ts': "import '@ui-lazy-dev/ui-web/review-panel';" }).some(f => f.rule === 'platform'));
});

test('foundation helpers retain dependency and cycle checks through relative and public family routes', t => {
  const target = { types: './dist/modal-dialog/binding.d.ts', default: './dist/modal-dialog/binding.js' };
  const binding = 'packages/web/src/modal-dialog/binding.tsx';
  const result = fixture(t, {
    'manifests/families/modal-dialog.json': JSON.stringify({
      id: 'Modal dialog', entries: [{ pkg: 'web', path: './modal-dialog', target }],
      files: { source: [binding] }, inventory: { api: ['modal-dialog:Dialog'] },
    }),
    'packages/web/package.json': JSON.stringify({ name: '@ui-lazy-dev/ui-web', exports: { './modal-dialog': target } }),
    [binding]: "import './focus.js'; export const Dialog = 1;",
    'packages/web/src/box/helper.ts': "import '@ui-lazy-dev/ui-web/modal-dialog';",
    'packages/web/src/modal-dialog/focus.ts': "import '../queue/binding.js'; import '../button/handle.js';",
    'packages/web/src/button/handle.ts': "import '../modal-dialog/focus.js';",
    'packages/web/src/queue/binding.ts': 'export const queue=1;',
    'packages/web/src/icon-button/binding.tsx': "import '../button/handle.js';",
    'packages/tokens/color.ts': "import '@ui-lazy-dev/ui-web/review-panel';",
  }, { registeredFamilyEntries: true });
  assert.deepEqual(result.findings.filter(f => f.file === 'packages/web/src/box/helper.ts'), []);
  assert.deepEqual(result.findings.filter(f => f.rule === 'layer').map(f => f.detail).sort(), ['../queue/binding.js', '@ui-lazy-dev/ui-web/review-panel']);
  assert.equal(result.findings.filter(f => f.rule === 'cycle').length, 1);
});

test('moving a private host preserves the old owner and rejects raw or missing replacements', async t => {
  const {createHash} = await import('node:crypto');
  const {applicableExceptions} = await import('../owner-transitions.mjs');
  const trigger = 'packages/native/src/labeled-field/binding.tsx';
  const helper = 'packages/native/src/labeled-field/control.tsx';
  const old = "import {TextInput} from 'react-native'; export function FormField(){return <TextInput/>;}";
  const changed = "import {NativeFieldControl} from './control.js'; export function FormField(){return <NativeFieldControl/>;}";
  const host = "import {TextInput} from 'react-native'; export function NativeFieldControl(){return <TextInput/>;}";
  const id = '1'.repeat(64);
  const before = {file:trigger,symbol:'FormField',family:'input'};
  const after = {file:helper,symbol:'NativeFieldControl',family:'input'};
  const change = {file: trigger, previousSha256: createHash('sha256').update(old).digest('hex'),
    previousOwners:[before], currentOwners:[after], previousExceptions:[id]};
  const run = (files, row = change, mode = 'library') => fixture(t, files, {mode, ownerTransitions:[row]});
  const approved = {fingerprint:id, file:trigger};
  const original = run({[trigger]:old});
  assert.deepEqual(original.findings, []);
  assert.deepEqual(applicableExceptions([approved], original.historicalExceptions), [approved]);
  const adopted = run({[trigger]:changed,[helper]:host});
  assert.deepEqual(adopted.findings, []);
  assert.deepEqual(applicableExceptions([approved], adopted.historicalExceptions), []);
  assert.throws(() => applicableExceptions([{...approved,file:helper}], adopted.historicalExceptions));
  assert.throws(() => applicableExceptions([approved,approved], adopted.historicalExceptions));
  assert.throws(() => applicableExceptions([], adopted.historicalExceptions));
  assert.throws(() => run({[trigger]:changed}));
  assert.throws(() => run({[trigger]:changed,[helper]:host},{...change,currentOwners:[{...after,file:'packages/native/src/other/control.tsx'}]}));
  assert.throws(() => run({[trigger]:changed,[helper]:host},{...change,currentOwners:[{...after,symbol:'*'}]}));
  assert.throws(() => run({[trigger]:old}, change, 'consumer'));
  const rogue = run({[trigger]:changed,[helper]:host+' export function Unreviewed(){return <TextInput/>;}'});
  assert.deepEqual(rogue.findings.map(f => [f.file,f.symbol,f.rule]), [[helper,'Unreviewed','primitive-owner']]);
  const reintroduced = run({[trigger]:old+' ',[helper]:host});
  assert.ok(reintroduced.findings.some(f => f.file === trigger && f.symbol === 'FormField'));
});

test('a future host owner applies only to its published family and exact module-level symbol', (t) => {
  const slug = 'breadcrumb';
  const entry = '@ui-lazy-dev/ui-web/' + slug;
  const index = 'packages/web/src/breadcrumb/index.ts';
  const file = 'packages/web/src/breadcrumb/trail.tsx';
  const manifest = 'manifests/families/breadcrumb.json';
  const pkg = 'packages/web/package.json';
  const target = {types:'./dist/breadcrumb/index.d.ts',default:'./dist/breadcrumb/index.js'};
  const library = {name:'@ui-lazy-dev/ui-web',exports:{'./breadcrumb':target}};
  const family = {id:'Breadcrumb',entries:[{pkg:'web',path:'./breadcrumb',target}],
    inventory:{api:['breadcrumb:Breadcrumbs']},files:{source:[index,file]}};
  const owner = {entry,file,symbol:'BreadcrumbAnchor',family:'link'};
  const options = {registeredFamilyEntries:true,registeredOwners:[owner]};
  const old = {'src/legacy.ts':'export const existing = 1;'};
  const original = old['src/legacy.ts'];
  const source = 'function BreadcrumbAnchor(){return <a href="/library">Library</a>} export function Breadcrumbs(){return <BreadcrumbAnchor/>}';
  const accepted = {...old,[pkg]:JSON.stringify(library),[manifest]:JSON.stringify(family),
    [index]:"export { Breadcrumbs } from './trail.js';",[file]:source};
  const run = (files,extra={}) => fixture(t, files, {...options,...extra});
  assert.deepEqual(run(old).findings, []);
  assert.deepEqual(run(accepted).findings, []);
  for (const omitted of [file,pkg,manifest,index]) {
    const partial = {...accepted}; delete partial[omitted]; assert.throws(()=>run(partial),/registered host owner/);
  }
  assert.throws(()=>run({...old,[manifest]:JSON.stringify(family)}),/registered host owner/);
  assert.throws(()=>run({...old,[pkg]:JSON.stringify(library)}),/registered host owner/);
  assert.throws(()=>run({...accepted,[manifest]:JSON.stringify({...family,files:{source:[index]}})}),/registered host owner/);
  assert.throws(()=>run({...accepted,[pkg]:JSON.stringify({...library,exports:{'./breadcrumb':'./other.js'}})}),/registered host owner/);
  assert.throws(()=>run({...accepted,[file]:source.replaceAll('BreadcrumbAnchor','RogueAnchor')}),/registered host owner/);
  assert.throws(()=>run(accepted,{mode:'consumer'}),/public-family host owner/);
  for (const bad of [{file:'packages/web/src/other/trail.tsx'},{symbol:'*'},{entry:entry+'/private'}])
    assert.throws(()=>run(old,{registeredOwners:[{...owner,...bad}]}),/public-family host owner/);
  assert.throws(()=>run(old,{owners:[owner]}),/outside scanned production files/);
  const linked=mkdtempSync(join(tmpdir(),'ui-linked-metadata-'));
  t.after(()=>rmSync(linked,{recursive:true,force:true}));
  mkdirSync(join(linked,'src')); mkdirSync(join(linked,'packages/web'),{recursive:true});
  writeFileSync(join(linked,'src/example.ts'),original);
  writeFileSync(join(linked,'untrusted.json'),'deliberately non-JSON');
  symlinkSync(join(linked,'untrusted.json'),join(linked,pkg));
  assert.throws(()=>scan(linked,{include:['src','packages'],mode:'library',...options}),/regular repository file/);
  const rogue = run({...accepted,[file]:source+' export function Extra(){return <a href="/other">Other</a>}'});
  assert.deepEqual(rogue.findings.map(f=>[f.symbol,f.rule]),[['Extra','primitive-owner']]);
  const wrong = run({...accepted,[file]:source.replace('<a href="/library">Library</a>','<button>Library</button>')});
  assert.ok(wrong.findings.some(f=>f.family==='button' && f.rule==='primitive-owner'));
  const shadow = run({...accepted,'src/screen.tsx':original+' function BreadcrumbAnchor(){return <a href="/other">Other</a>}'});
  assert.ok(shadow.findings.some(f=>f.file==='src/screen.tsx' && f.rule==='primitive-owner'));
});
