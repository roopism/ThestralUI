import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runBrowserShards } from '../../../packages/policy/quality/browser-matrix.mjs';
import { auditComponentSpecs } from '../../../packages/policy/quality/specs/validate.mjs';
import { renderApiRows, replaceApiTable } from '../../../packages/policy/quality/specs/tables.mjs';
import { randomUUID } from 'node:crypto';
import { readVisualCoverage, requireOriginalReceipt, sealReceipt } from '../reuse/runner.mjs';
import { combineEvidence } from '../cloud/coordinator.mjs';
import { repositoryId } from '../cloud/results.mjs';
import { lockOwner } from '../../workers/lock.mjs';

const project = fileURLToPath(new URL('../../../',import.meta.url));
function scratch(t) {
  const dir = mkdtempSync(join(tmpdir(),'uld-review-seven-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  return dir;
}

// Replace only the selected module's process boundaries. No physical tools or network execute.
async function load(t, path, stubs, methods) {
  const url = new URL(path,import.meta.url).href + '?offline';
  const key = 'r7-' + path;
  globalThis[key] = methods;
  const hooks = registerHooks({resolve(name,ctx,next) {
    if (ctx.parentURL !== url || !Object.hasOwn(stubs,name)) return next(name,ctx);
    const source = stubs[name].map(fn => 'export const ' + fn + ' = (...args) => globalThis[' +
      JSON.stringify(key) + '].' + fn + '(...args)').join('\n');
    return {url:'data:text/javascript,'+encodeURIComponent(source),shortCircuit:true};
  }});
  t.after(()=>{hooks.deregister();delete globalThis[key];});
  return import(url);
}

test('landing Linux identity and guest shutdown use the shared reservations', async t => {
  const root = scratch(t);
  execFileSync('git',['init','--quiet','--template=',root]);
  const common = join(root,'.git'), snapshot = join(root,'snapshot');
  execFileSync('git',['init','--quiet','--template=',snapshot]);
  const {rowIdentity} = await load(t,'../reuse/runner.mjs',{'node:child_process':['execFileSync','spawnSync']},{
    execFileSync(tool,args,options) {
      if(tool==='git') return JSON.stringify({contractVersion:1,groups:{'Linux browser behavior':{
        envFacts:['image'],exclude:[],extraInputs:[],mode:'tree',reusable:true}}});
      assert.equal(tool,process.execPath);
      assert.equal(options.cwd,snapshot);
      assert.equal(options.env?.ULD_ARTIFACT_COMMON, common, 'Identity must contend with the real timing reservation');
      return '{"image":"fixture"}';
    },
  });
  rowIdentity({root,snapshot,directory:join(common,'uld-receipts')},'Linux browser behavior',null,
    {candidate:[],basePipeline:'fixture',pipelineChanged:false});

  const guestHeld = () => existsSync(join(common,'uld-locks/linux-guest/owner.json'));
  assert.throws(()=>lockOwner(common,'linux-guest'),/Unknown shared resource/);
  let state = 'stopped';
  const calls = [];
  const vm = await load(t,'../linux-vm.mjs',{'node:child_process':['execFileSync']},{
    execFileSync(bin,args) {
      assert.ok(guestHeld(), 'Access outside the guest reservation');
      calls.push(args[0]);
      if (args[0]==='status') return state;
      if (args[0]==='start') {state='started';return '';}
      if (args[0]==='stop') {state='stopped';return '';}
      if (args[0]==='ip-address') return '127.0.0.1';
      assert.equal(bin,'ssh');
      if(args.at(-1)==='true') return '';
      return JSON.stringify({uuid:'8E1A0BED-BE5C-4A3C-9814-6543FB229DB7',
        sha256:'50e24e1fb79e89116e939d90aa7738f7af48c442fa1bc2510131e0b39c50348e'});
    },
  });
  const prior = {...process.env};
  process.env.ULD_ARTIFACT_COMMON=common;
  delete process.env.ULD_TIMING_RESERVATION;
  t.after(()=>{for(const k of ['ULD_ARTIFACT_COMMON','ULD_TIMING_RESERVATION'])
    if(prior[k]===undefined) delete process.env[k];else process.env[k]=prior[k];});
  await assert.rejects(vm.withLinuxImageFacts(async () => {
    assert.ok(guestHeld());
    throw Error('observation failed');
  }), /observation failed/);
  assert.equal(state,'stopped');
  assert.equal(guestHeld(),false);
  assert.ok(calls.includes('stop'));
  state='started';
  const before=calls.length;
  await vm.withLinuxImageFacts(async () => assert.equal(guestHeld(),true));
  assert.equal(state,'started');
  assert.ok(!calls.slice(before).includes('stop'));
  let shutdown;
  await vm.withLinuxImageFacts(async () => {
    shutdown = vm.stopVm();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(state, 'started', 'Another caller must wait until the observation finishes');
  });
  await shutdown;
  assert.equal(state,'stopped');
});

test('packed specifications and depth include the first candidate Pagination export', async t => {
  const root = scratch(t);
  cpSync(join(project,'manifests'),join(root,'manifests'),{recursive:true});
  const file = join(root,'manifests/families/pagination.json');
  const row = JSON.parse(readFileSync(file));
  const binding = 'pagination:Pagination';
  row.inventory.api = [binding];
  row.inventory.web = 'exported';
  row.depth = {representative:binding,expectation:'Moves to a page',oracle:'Page changes once',
    evidence:{unit:'tests/pagination.test.tsx | changes page'}, consumerTypes:{
      [binding]:{accept:[{page:1}],reject:[{page:false}]}}};
  writeFileSync(file,JSON.stringify(row));
  const names = ['tokens','ui-web','ui-native'].map(name=>'@ui-lazy-dev/'+name);
  mkdirSync(join(root,'release/evidence'),{recursive:true});
  writeFileSync(join(root,'release/evidence/provenance.json'),JSON.stringify({
    packages:names.map(name=>({name,filename:name.split('/')[1]+'.tgz'}))}));
  const cwd = process.cwd();process.chdir(root);t.after(()=>process.chdir(cwd));
  const fields = new Map([[binding, new Map([['page','number']])]]);
  const details = new Map([[binding, new Map([['page',{defaults:new Set(),refs:new Set()}]])]]);
  const draft = readFileSync(join(project,'docs/components/badge.md'),'utf8').replaceAll('Badge','Pagination')
    .replaceAll('/primitives','/pagination').replaceAll('server-safe','client-only');
  mkdirSync('docs/components',{recursive:true});
  writeFileSync('docs/components/pagination.md',replaceApiTable(draft,renderApiRows([binding],fields,details)));
  for (const path of ['packages/tokens/tokens.json','tests/foundation-specs.test.tsx']) {
    mkdirSync(dirname(path),{recursive:true});cpSync(join(project,path),path);
  }
  const depth = await load(t,'../../../packages/policy/quality/api-depth/run-depth.mjs',{
    './packed-probes.mjs':['validatePacked'],
  },{ validatePacked:(_consumer,_families,bindings)=>{
    assert.deepEqual(bindings,[binding]);return bindings;
  }});
  let checkedSpecs=false;
  const gate = await load(t,'../../../packages/policy/quality/check-staged.mjs',{
    'node:child_process':['execFileSync'],'./specs/validate.mjs':['auditComponentSpecs'],
    './api-depth/run-depth.mjs':['verifyPackedDepth'],
  },{
    execFileSync(tool,args,{cwd}) {
      assert.equal(tool,'npm');
      for (const name of names) mkdirSync(join(cwd,'node_modules',name),{recursive:true});
      const web=join(cwd,'node_modules/@ui-lazy-dev/ui-web');
      writeFileSync(join(web,'package.json'),JSON.stringify({name:'@ui-lazy-dev/ui-web',
        exports:{'./pagination':{types:'./pagination.d.ts'}}}));
      writeFileSync(join(web,'pagination.d.ts'),'export declare function Pagination(props:{page:number}):string;');
      symlinkSync(join(project,'node_modules/typescript'),join(cwd,'node_modules/typescript'),'dir');
    },
    auditComponentSpecs({families}) {
      const report=auditComponentSpecs({root,families:families.filter(f=>f.id==='Pagination'),declarations:fields,details});
      assert.deepEqual(report.issues,[]);
      checkedSpecs=true;
      return report;
    },
    verifyPackedDepth(consumer,inputs) {
      return depth.verifyPackedDepth(consumer,inputs,undefined,root,['Pagination']);
    },
  });
  await gate.packedDepth();
  assert.ok(checkedSpecs);
  const oldFile=join(root,'manifests/families/button.json');
  const button=JSON.parse(readFileSync(oldFile));
  button.depth.evidence.native.pop();
  writeFileSync(oldFile,JSON.stringify(button));
  await assert.rejects(gate.packedDepth(),/Button/);
});

test('cloud proposal fetches a current merge with an ancestral opening base', async t => {
  const root=scratch(t), upstream=join(root,'upstream'), local=join(root,'local');
  const git=(cwd,...args)=>execFileSync('git',['-c','user.name=Fixture','-c','user.email=test@example.invalid',...args],
    {cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  for(const dir of [upstream,local]) git(root,'init','--quiet','--template=',dir);
  const path=join(upstream,'.github/workflows/qualify.yml');
  mkdirSync(dirname(path),{recursive:true});writeFileSync(path,'fixture');
  git(upstream,'add','.');
  const tree=git(upstream,'write-tree'), commit=(...parents)=>git(upstream,'commit-tree',tree,...parents.flatMap(p=>['-p',p]),'-m','fixture');
  const opening=commit(), base=commit(opening), head=commit(base), merge=commit(base,head);
  git(upstream,'update-ref','refs/heads/feat/enterprise-ui',base);
  git(upstream,'update-ref','refs/pull/7/merge',merge);
  git(local,'remote','add','origin',upstream);
  const pr={number:7,state:'open',base:{repo:{id:repositoryId},ref:'feat/enterprise-ui',sha:opening},
    head:{repo:{id:repositoryId},ref:'family/pagination',sha:head},merge_commit_sha:merge};
  const {cloudProposal}=await load(t,'../cloud/proposal.mjs',{
    'node:child_process':['execFileSync'],'../typed-tools.mjs':['typedControlDigest']},{
    typedControlDigest:()=> 'fixture', execFileSync(tool,args,{cwd}) {
      assert.equal(tool,'git');
      if(args.includes('get-url')) return 'https://github.com/roopism/ThestralUI';
      return git(cwd,...args);
    }});
  assert.equal(cloudProposal(local,base,merge,pr).tree,tree);
  assert.throws(()=>cloudProposal(local,base,merge,{...pr,base:{...pr.base,sha:head}}));
  assert.throws(()=>cloudProposal(local,base,merge,{...pr,head:{...pr.head,sha:opening}}));
  git(upstream,'update-ref','refs/heads/feat/enterprise-ui',head);
  assert.throws(()=>cloudProposal(local,base,merge,pr));
});

test('the ordinary visual matrix returns identities from every verified execution shard', async t => {
  const projects=['chromium','firefox','webkit'];
  const roster={projects,cases:projects.map(p=>p+' | suite.visual.ts | appearance')};
  const report=engines=>({errors:[],config:{rootDir:'.'},suites:[{title:'suite.visual.ts',
    specs:[{title:'appearance',tests:engines.map(projectName=>({projectName,expectedStatus:'passed',
      status:'expected',results:[{status:'passed'}]}))}]}]});
  const run=(args)=>report([args.find(s=>s.startsWith('--project=')).slice(10)]);
  assert.deepEqual(runBrowserShards(report(projects),roster,new Map(),[],run),roster);
  assert.throws(()=>runBrowserShards(report(projects),roster,new Map(),[],args=>{
    const shard=run(args);shard.suites[0].specs[0].tests[0].results=[];return shard;
  }));

  const root=scratch(t), id=randomUUID(), name='Mac visual comparisons';
  const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
  git('init','--quiet','--template=');
  mkdirSync(join(root,'tests/acceptance'),{recursive:true});
  writeFileSync(join(root,'tests/acceptance/visual-matrix.json'),JSON.stringify(roster));
  git('add','tests');
  const tree=git('write-tree'), common=join(root,'.git');
  const cwd=process.cwd(), argv=process.argv;
  const env=Object.fromEntries(['ULD_ARTIFACT_COMMON','ULD_ANDROID_TIMING_ATTEMPT','ULD_FRESH_ANDROID_TIMING'].map(k=>[k,process.env[k]]));
  t.after(()=>{
    process.chdir(cwd);process.argv=argv;
    for(const [key,value] of Object.entries(env)) {
      if(value===undefined) delete process.env[key];else process.env[key]=value;
    }
  });
  process.chdir(root);
  process.argv=[process.execPath,'local-run.mjs',root,tree,tree,'qualification',id,'--reuse-operation',name];
  process.env.ULD_ARTIFACT_COMMON=common;
  const complete=Error('Visual subprocess completed');
  t.mock.method(process,'exit',code=>{assert.equal(code,0);throw complete;});
  await assert.rejects(load(t,'../local-run.mjs',{
    'node:child_process':['execFileSync','spawn'],'../selection/local-device.mjs':['deviceScope'],
    './qualification-attempt.mjs':['readAttempt'],'../workers/lock.mjs':['releaseLocksOnSignal','withLock'],
    '../../packages/policy/quality/browser-matrix.mjs':['browserMatrix','scenarioMatrix'],
  },{
    releaseLocksOnSignal:()=>{},deviceScope:()=>({}),readAttempt:()=>({id}),
    execFileSync:(tool,args)=>{assert.equal(tool,'git');assert.deepEqual(args,['rev-parse','HEAD^{tree}']);return tree;},
    browserMatrix:(file,config)=>{
      assert.deepEqual([file,config],['tests/acceptance/visual-matrix.json','tests/browser/motion.visual.config.ts']);
      return runBrowserShards(report(projects),roster,new Map(),[],run);
    },
  }),error=>error===complete);
  const path=join(common,'visual-coverage-'+id+'.json');
  const coverage=readVisualCoverage({root,tree},path);
  const receipt={id,reuseSchema:1,base:tree,commit:tree,tree,mode:'qualification',status:'passed',
    suites:[{name,result:'passed',durationMs:1,coverage}]};
  sealReceipt(root,receipt);
  requireOriginalReceipt(root,receipt,tree);
  const combined=combineEvidence({base:tree,merge:tree,tree},[{id:'visual',suite:name,lane:'local'}],[],receipt,roster);
  assert.deepEqual(combined.local[0].coverage,{tree,...roster});
  writeFileSync(path,JSON.stringify({...coverage,cases:coverage.cases.slice(1)}));
  assert.throws(()=>readVisualCoverage({root,tree},path));
});
