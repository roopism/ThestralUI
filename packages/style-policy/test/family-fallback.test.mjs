import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {tmpdir} from 'node:os';
import {registeredFallback} from '../family-fallback.mjs';
import {inspectSource} from '../policy.mjs';

const path='packages/web/src/probe-family/styles.css';
const entry='packages/web/src/probe-family/index.tsx';
const header='/* @uld-css-chunk probe-family */\n';
const valid='.uld-probe-family { gap: var(--uld-gap, 8px); }';
const tokens={
  size:{gap:{$type:'dimension',$value:{value:8,unit:'px'}},control:{$type:'dimension',$value:{value:44,unit:'px'}}},
  type:{bodySize:{$type:'dimension',$value:{value:8,unit:'px'}}},
  density:{compactTarget:{$type:'dimension',$value:{value:32,unit:'px'}},largeTarget:{$type:'dimension',$value:{value:56,unit:'px'}},coarseTarget:{$type:'dimension',$value:{value:48,unit:'px'}}},
  space:{spaceSm:{$type:'dimension',$value:{value:8,unit:'px'}}},
  palette:{manufactured:{$type:'dimension',$value:{value:8,unit:'px'}}}
};
function fixture(run) {
  const root=mkdtempSync(join(tmpdir(),'uld-style-fallback-'));
  const put=(name,value)=>{const out=join(root,name);mkdirSync(dirname(out),{recursive:true});writeFileSync(out,typeof value==='string'?value:JSON.stringify(value));};
  const routes={js:{types:'./dist/probe-family/index.d.ts',default:'./dist/probe-family/index.js'},css:'./dist/probe-family.css'};
  const manifest={id:'Probe family',inventory:{api:['probe-family:Probe']},files:{source:[entry],style:[path]},entries:[{pkg:'web',path:'./probe-family',target:routes.js},{pkg:'web',path:'./probe-family.css',target:routes.css}]};
  const pkg={name:'@ui-lazy-dev/ui-web',exports:{'./probe-family':routes.js,'./probe-family.css':routes.css}};
  put('packages/tokens/package.json',{name:'@ui-lazy-dev/tokens',exports:{'./tokens.json':'./tokens.json','./styles.css':'./dist/styles.css'}});
  put(entry,'export const Probe = () => <div className="uld-probe-family uld-probe-family-root" data-uld-probe-family data-part="action"><span data-part="foreign"/></div>;');put(path,header+valid);
  put('manifests/families/probe-family.json',manifest);put('packages/web/package.json',pkg);
  put('docs/components/probe-family.md','### Tokens\n\nUse `size.gap`, `size.control`, and `type.bodySize`.\n\n### Other\n`space.spaceSm`');
  const find=(source,pathOverride=path,tokenOverride=tokens)=>inspectSource(pathOverride,source,{
    component:true,scopes:['uld-'],variables:['--uld-gap','--uld-control','--uld-body-size','--uld-space-sm','--uld-manufactured','--local','--uld-compact-target','--uld-large-target','--uld-coarse-target'],tokenPaths:[],
    familyFallback:registeredFallback(root,pathOverride,tokenOverride),
  }).filter(f=>f.rule==='style/token');
  try{run({root,put,find,manifest,pkg});}finally{rmSync(root,{recursive:true,force:true});}
}

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

test('the target element and every selector branch are family-owned within the actual standalone chunk',()=>fixture(({find})=>{
  for(const selector of ['.uld-foreign', '.uld-probe-family[data-p\\61rt="missing"]', '[data-uld-probe-family][data-part="missing"]', '[data-uld-probe-family][data-part="foreign"]', '[data-part="action"] [data-uld-probe-family]', '[uld-probe-family]', '.data-uld-probe-family', '.uld-probe-family-like', '.uld-probe-family .uld-foreign', '.uld-probe-family > [data-part="root"]', '.uld-probe-family + .other', ':not(.uld-probe-family)', ':has(.uld-probe-family)', '.uld-probe-family, .uld-foreign', ':is(.uld-probe-family,.other)', '[data-uld-probe-familyish]', '.uld-probe-family::before']) {
    assert.ok(find(header+valid.replace('.uld-probe-family',selector)).length,selector);
  }
  for(const source of [valid,'/* @uld-css-chunk primitives.005 */\n'+valid,header+'/* @uld-css-chunk primitives */\n'+valid,header+header+valid,
    '@media print {\n'+header+valid+'}',header+'@layer uld.reset {'+valid+'}',header+'@keyframes test {from{gap:var(--uld-gap,8px)}}',header+'.x {'+valid+'}'])assert.ok(find(source).length,source);
  assert.ok(find(header+valid,'packages/web/src/foreign/other.css').length);
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
