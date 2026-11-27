import assert from 'node:assert/strict';
import {test} from 'node:test';
import {rmSync,symlinkSync} from 'node:fs';
import {join} from 'node:path';
import {entry, fixture, header, inlineFile, path, primitivesFile, tokens, valid, webSource} from './family-fallback-fixture.mjs';

test('canonical scope, published token role, documented token and CSS length all agree',()=>fixture(({find})=>{
  for(const selector of ['.uld-probe-family','.uld-probe-family-root','[data-uld-probe-family][data-part="action"]',':where(.uld-probe-family:not([hidden]))',':is(.uld-probe-family,[data-uld-probe-family])','.parent .uld-probe-family']){
    assert.deepEqual(find(header+selector+' { gap: var(--uld-gap, 8px); }'),[],selector);
  }
  assert.deepEqual(find(header+'@media (any-pointer: coarse) { '+valid+' }'),[]);
  for(const value of ['7px','9px','0','0px','8rem','8%','8','+8px','8.0px','calc(8px)','var(--local, 8px)']) {
    assert.ok(find(header+valid.replace('8px',value)).length,value);
  }
  for(const name of ['--uld-body-size','--uld-space-sm','--uld-manufactured','--local','--uld-compact-target','--uld-large-target','--uld-coarse-target']){
    assert.ok(find(header+valid.replace('--uld-gap',name)).length,name);
  }
  assert.ok(find(header+valid.replace('gap:','--made-up:')).length);
  assert.ok(find(header+valid.replace('gap:','padding:')).length);
  assert.ok(find(header+valid.replace('--uld-gap, 8px','--uld-control, 44px')).length);
  assert.ok(find(header+valid.replace('8px);','8px) !important;')).length);
  assert.ok(find(header+'.uld-probe-family{--local:var(--uld-gap);gap:var(--local,8px)}').length);
  assert.ok(find(header+valid.replace('var(--uld-gap, 8px)','calc(2px + var(--uld-gap, 8px))')).length);
  assert.ok(find(header+valid,path,{...tokens,another:{gap:{$type:'dimension',$value:{value:8,unit:'px'}}}}).length);
}));

test('ambiguous equal-valued spacings and swapped control variants cannot qualify',()=>fixture(({put,find})=>{
  put('docs/components/probe-family.md','### Tokens\nUse `size.gap`, `space.spaceSm`, `size.control`, `density.compactTarget`, `density.largeTarget`, `density.coarseTarget`.\n');
  assert.ok(find(header+valid).length);
  assert.ok(find(header+valid.replace('--uld-gap','--uld-space-sm')).length);
  const compact=".uld-probe-family[data-size='sm'] { --uld-control: var(--uld-compact-target, 32px); }";
  const large=compact.replace("'sm'","'lg'").replace('compact-target, 32px','large-target, 56px');
  assert.deepEqual(find(header+compact+large),[]);
  assert.ok(find(header+compact.replace('compact-target, 32px','large-target, 56px')).length);
  assert.ok(find(header+large.replace('large-target, 56px','compact-target, 32px')).length);
  assert.ok(find(header+compact.replace('--uld-control:','inline-size:').replace('compact-target, 32px','control, 44px')).length);
  const coarse="@media (any-pointer: coarse) { .uld-probe-family:not([data-size='lg']) { --uld-control: var(--uld-coarse-target, 48px) } }";
  assert.deepEqual(find(header+coarse),[]);
  assert.ok(find(header+coarse.replace('any-pointer: coarse','hover: hover')).length);
  assert.ok(find(header+coarse.replace(":not([data-size='lg'])", '')).length);
  assert.ok(find(header+coarse.replace(":not([data-size='lg'])", "[data-size='lg']")).length);
}));

test('the target element and every selector branch are family-owned within the actual standalone chunk',()=>fixture(({put,find})=>{
  for(const selector of ['.uld-foreign', '.uld-probe-family[data-p\\61rt="missing"]', '[data-uld-probe-family][data-part="missing"]', '[data-uld-probe-family][data-part="foreign"]', '[data-part="action"] [data-uld-probe-family]', '[uld-probe-family]', '.data-uld-probe-family', '.uld-probe-family-like', '.uld-probe-family .uld-foreign', '.uld-probe-family > [data-part="root"]', '.uld-probe-family + .other', ':not(.uld-probe-family)', ':has(.uld-probe-family)', '.uld-probe-family, .uld-foreign', ':is(.uld-probe-family,.other)', '[data-uld-probe-familyish]', '.uld-probe-family::before']) {
    assert.ok(find(header+valid.replace('.uld-probe-family',selector)).length,selector);
  }
  for(const source of [valid,'/* @uld-css-chunk primitives.005 */\n'+valid,header+'/* @uld-css-chunk primitives */\n'+valid,header+header+valid,
    '@media print {\n'+header+valid+'}',header+'@layer uld.reset {'+valid+'}',header+'@keyframes test {from{gap:var(--uld-gap,8px)}}',header+'.x {'+valid+'}'])assert.ok(find(source).length,source);
  assert.ok(find(header+valid,'packages/web/src/foreign/other.css').length);

  const binding = `import { Children, isValidElement } from 'react';
  function hasContent(children) {
    return Children.toArray(children).some(child => {
      if (isValidElement(child)) return !child.props.hidden;
      return typeof child !== 'string' || Boolean(child.trim());
    });
  }
  export function Probe(props) {
    return hasContent(props.children) ? renderGroup(props) : null;
  }`;
  const helper = `function renderGroup({ unstyled, className, ...host }) {
    const classes = [unstyled ? 'bare' : 'uld-probe-family', className].filter(Boolean).join(' ');
    if (unstyled) return <div {...host} />;
    return <div {...host} className={classes} />;
  }`;
  const ownsGap = (source, css = valid) => {
    put(entry, source);
    return find(header + css).length === 0;
  };
  const source = binding + helper;
  assert.ok(ownsGap(source));
  const inline = source.replace('return <div {...host} className={classes}', 'return <Layout {...host} className={classes}');
  const layoutImport = "import { Inline as Layout } from '../inline/binding.js';";
  put(inlineFile, webSource(inlineFile));
  put(primitivesFile, webSource(primitivesFile));
  assert.ok(ownsGap(layoutImport + inline));
  assert.ok(ownsGap(source.replace('hasContent(props.children) ? renderGroup(props) : null', 'renderGroup(props)')));
  assert.ok(!ownsGap(source, valid.replace('8px', '9px')));
  assert.ok(!ownsGap(source, valid.replace('.uld-probe-family', '.uld-foreign')));
  for (const decoy of [
    binding.replace('renderGroup(props)', 'null') + helper,
    binding.replace('hasContent(props.children)', 'false') + helper,
    binding.replace('renderGroup(props)', 'renderGroup({ unstyled: true })') + helper,
    binding.replace('export function Probe', 'export function* Probe') + helper,
    binding.replace('return hasContent', 'const forced = (props.unstyled = true); return hasContent') + helper,
    binding + helper.replace('const classes =', 'const forced = (unstyled = true); const classes ='),
    binding.replace('return hasContent', 'const renderGroup = () => null; return hasContent') + helper,
    source + 'renderGroup = () => null;',
    binding + helper.replace('if (unstyled)', 'if (unstyled) return <div className="uld-probe-family"/>; return null; if (unstyled)'),
    source.replace('className={classes} />','className={classes} {...host} />'),
    source.replace("unstyled ? 'bare' : 'uld-probe-family'", "unstyled ? 'uld-probe-family' : 'bare'"),
    source.replace("'uld-probe-family', className", "'uld-probe-family' + '-foreign', className"),
    source.replace("className={classes}", "className={discard(classes)}"),
    inline.replace('function renderGroup', 'function Layout() { return null; } function renderGroup'),
    layoutImport.replace('../inline/binding.js', './foreign.js') + inline,
    layoutImport + inline.replace('const classes =', 'const Layout = () => null; const classes ='),
    'const Boolean = () => false;' + source,
    binding + "import { renderGroup } from './other.js';",
  ]) assert.ok(!ownsGap(decoy), decoy);
  for (const decoy of [
    source.replace('return Children.toArray', 'return false && Children.toArray'),
    source.replace("from 'react'", "from './unverified.js'"),
    source.replace('hasContent(props.children)', 'hasContent(props.unstyled)'),
    source.replace('export function Probe(props) {', 'export function Probe(props) { const hasContent = () => false;'),
    source + 'hasContent = () => false;',
  ]) assert.ok(!ownsGap(decoy), decoy);
}));

test('manifest, exported target, family-owned source and nonsymlinked provenance are required',()=>fixture(({root,put,find,manifest,pkg})=>{
  const file='manifests/families/probe-family.json';
  for(const row of [{...manifest,id:'Foreign'},{...manifest,files:{...manifest.files,style:['packages/web/src/foreign/styles.css']}},{...manifest,files:{...manifest.files,source:[]}},{...manifest,inventory:{api:['foreign:Probe']}},{...manifest,entries:[manifest.entries[0]]},{...manifest,entries:[...manifest.entries,manifest.entries[1]]}]){
    put(file,row);assert.ok(find(header+valid).length);
  }
  put(file,manifest);put('packages/web/package.json',{...pkg,exports:{...pkg.exports,'./probe-family.css':'./dist/foreign.css'}});
  assert.ok(find(header+valid).length);
  put('packages/web/package.json',pkg);
  for(const source of ['export function Probe() { const decoy = "uld-probe-family"; return null; }', 'export function Probe() { /* data-uld-probe-family */ return null; }', 'export interface Probe {}','export declare function Probe(): null;', 'export declare class Probe {}', 'export const Unrelated = 1;', "export { Probe } from '../foreign/binding.js';"]){
    put(entry,source);assert.ok(find(header+valid).length,source);
  }
  put('packages/tokens/package.json',{name:'@ui-lazy-dev/tokens',exports:{}});put(entry,'export const Probe=()=><div className="uld-probe-family"/>');assert.ok(find(header+valid).length);
  put('packages/tokens/package.json',{name:'@ui-lazy-dev/tokens',exports:{'./tokens.json':'./tokens.json','./styles.css':'./dist/styles.css'}});
  rmSync(join(root,entry));put('foreign.ts','export const Probe=1');symlinkSync(join(root,'foreign.ts'),join(root,entry));
  assert.ok(find(header+valid).length);
}));
