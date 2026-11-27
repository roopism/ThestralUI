import {mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {tmpdir} from 'node:os';
import {registeredFallback} from '../family-fallback.mjs';
import {inspectSource} from '../policy.mjs';

export const path='packages/web/src/probe-family/styles.css';
export const entry='packages/web/src/probe-family/index.tsx';
export const header='/* @uld-css-chunk probe-family */\n';
export const valid='.uld-probe-family { gap: var(--uld-gap, 8px); }';
export const tokens={
  size:{gap:{$type:'dimension',$value:{value:8,unit:'px'}},control:{$type:'dimension',$value:{value:44,unit:'px'}}},
  type:{bodySize:{$type:'dimension',$value:{value:8,unit:'px'}}},
  density:{compactTarget:{$type:'dimension',$value:{value:32,unit:'px'}},largeTarget:{$type:'dimension',$value:{value:56,unit:'px'}},coarseTarget:{$type:'dimension',$value:{value:48,unit:'px'}}},
  space:{spaceSm:{$type:'dimension',$value:{value:8,unit:'px'}}},
  palette:{manufactured:{$type:'dimension',$value:{value:8,unit:'px'}}}
};
export const inlineFile = 'packages/web/src/inline/binding.tsx';
export const primitivesFile = 'packages/web/src/_shared/primitives/binding.tsx';
export const webSource = file => readFileSync(new URL('../../../' + file, import.meta.url), 'utf8');

export function fixture(run) {
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
