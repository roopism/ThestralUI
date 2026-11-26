import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { appFingerprint, canonicalFingerprint, treeFingerprint } from '../reuse/fingerprint.mjs';
import { reuseDecision } from '../reuse/policy.mjs';
import { evidencePath, freshHistory, projectStoredPasses, publishRecord, readRecord, receiptGroups, sha256 } from '../reuse/store.mjs';
import { captureOutputs, restoreOutputs } from '../reuse/outputs.mjs';
import { executeChoice, externalInputDigests, requireLandingIdentity, requireOriginalReceipt, sealReceipt } from '../reuse/runner.mjs';
import { fixtureGit, isolateFixtureProcess } from './fixtures/hermetic-git.mjs';

isolateFixtureProcess();

function gitFixture(t) {
  const root = mkdtempSync(join(tmpdir(),'uld-reuse-proof-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  const git = (...args) => fixtureGit(root, args);
  git('init','--quiet','--template=');
  function write(path,text) { mkdirSync(dirname(join(root,path)),{recursive:true});writeFileSync(join(root,path),text); }
  const update=()=>{git('add','--all');return git('write-tree');};
  write('docs/readme.md','description');write('README.md','root docs');write('scripts/gates/check.mjs','check');
  write('src/view.js','source');write('tests/android/device.mjs','driver');write('docs/components/example.scenarios.yaml','scenario');
  const tree=update(), commit=git('commit-tree',tree,'-m','Qualification input');
  git('update-ref','HEAD',commit);
  return {root,git,write,update,tree,commit};
}

test('tree fingerprints bind declared files, modes, environment and trusted pipeline',t=>{
  const f=gitFixture(t);
  const args={root:f.root,base:f.commit,tree:f.tree,groupId:'Catalog build',envFacts:{node:'22',lockfile:'v1'},exclude:['*.md','docs/**']};
  const key=treeFingerprint(args);
  f.write('docs/readme.md','updated');f.write('README.md','updated');
  assert.equal(treeFingerprint({...args,tree:f.update()}),key);
  assert.equal(treeFingerprint({...args,exclude:[...args.exclude].reverse(),envFacts:{lockfile:'v1',node:'22'}}),key);
  f.write('src/view.js','changed');
  assert.notEqual(treeFingerprint({...args,tree:f.update()}),key);
  f.write('src/view.js','source');chmodSync(join(f.root,'src/view.js'),0o755);
  assert.notEqual(treeFingerprint({...args,tree:f.update()}),key);
  assert.notEqual(treeFingerprint({...args,envFacts:{...args.envFacts,node:'24'}}),key);
  f.write('scripts/gates/check.mjs','updated');
  const changed=f.update();assert.notEqual(treeFingerprint({...args,tree:changed}),key);
  assert.notEqual(treeFingerprint({...args,base:changed}),key);
  assert.notEqual(treeFingerprint({...args,groupId:'Different suite'}),key);
  assert.notEqual(treeFingerprint({...args,extraInputs:{cache:'v2'}}),key);
  assert.throws(()=>treeFingerprint({...args,envFacts:{node:'unavailable'}}));
  assert.throws(()=>treeFingerprint({...args,exclude:['scripts/gates/**']}));
  assert.notEqual(canonicalFingerprint(['a','b']),canonicalFingerprint(['b','a']));
  assert.equal(canonicalFingerprint({b:true,a:[null,1]}),canonicalFingerprint({a:[null,1],b:true}));
  assert.throws(()=>canonicalFingerprint({bad:undefined}));
  const receipts=join(f.root,'.git','uld-receipts');
  const cache='uld-cache/build-sample';
  f.write('.git/'+cache+'/input','first');
  const observed=externalInputDigests(receipts,[cache]);
  f.write('.git/'+cache+'/input','second');
  assert.notDeepEqual(externalInputDigests(receipts,[cache]),observed);
  assert.throws(()=>externalInputDigests(receipts,['outside/cache']));
  assert.throws(()=>externalInputDigests(receipts,['uld-cache/../config']));
});

test('app fingerprints bind content, device, scenarios and selected scope',t=>{
  const f=gitFixture(t),app={manifestSha256:sha256('app'),fileSha256:sha256('signature')};
  const args={root:f.root,base:f.commit,tree:f.tree,groupId:'iPhone Simulator',scope:{iphone:true,families:null},
    appManifests:{phone:app},deviceImage:{os:'fixture'},envFacts:{driver:'v1'}};
  const key=appFingerprint(args);
  assert.equal(appFingerprint({...args,appManifests:{phone:{...app,fileSha256:sha256('signature2')}}}),key);
  assert.notEqual(appFingerprint({...args,appManifests:{phone:{...app,manifestSha256:sha256('changed')}}}),key);
  assert.notEqual(appFingerprint({...args,deviceImage:{os:'changed'}}),key);
  assert.notEqual(appFingerprint({...args,envFacts:{driver:'v2'}}),key);
  assert.notEqual(appFingerprint({...args,scope:{iphone:true,families:[]}}),key);
  f.write('docs/components/example.scenarios.yaml','more steps');
  assert.notEqual(appFingerprint({...args,tree:f.update()}),key);
  f.write('tests/android/device.mjs','new driver');
  assert.notEqual(appFingerprint({...args,tree:f.update()}),key);
  assert.throws(()=>appFingerprint({...args,appManifests:{phone:{...app,manifestSha256:'bad'}}}));
  assert.throws(()=>appFingerprint({...args,appManifests:{}}));
  assert.throws(()=>appFingerprint({...args,deviceImage:null}));
});

test('device functional fingerprints bind shared harness fixture contents on both platforms', t => {
  const f = gitFixture(t);
  f.write('tests/driver/read-fixture.mjs', "export const input = new URL('../browser/labels.json', import.meta.url);");
  f.write('tests/browser/labels.json', '{"title":"Welcome"}');
  f.write('docs/sample.txt', 'A fixture read by the phone harness');
  const original = f.update();
  const keys = tree => ['iPhone Simulator', 'Android standard and low-end'].map(groupId => appFingerprint({
    root: f.root, base: f.commit, tree, groupId, scope: { iphone: true, families: null },
    appManifests: { phone: { manifestSha256: sha256('app'), fileSha256: sha256('signature') } },
    deviceImage: { os: 'fixture' }, envFacts: { driver: 'v1' },
  }));
  const before = keys(original);
  for (const [file, contents] of [['tests/browser/labels.json', '{"title":"Settings"}'], ['docs/sample.txt', 'Example']]) {
    f.git('read-tree', '--reset', '-u', original);
    f.write(file, contents);
    const changed = keys(f.update());
    assert.ok(changed.every((key, index) => key !== before[index]), file);
  }
  assert.deepEqual(keys(original), before);
});

const group='Catalog build', now=1800000000000;
const decisionArgs={mode:'qualification',groupId:group,reusable:true,now,
  record:{groupId:group,result:'passed',retries:0,createdAt:new Date(now).toISOString()}, freshHistory:['passed']};
test('reuse policy applies the fresh-run rules and audit window',()=>{
  const run=overrides=>reuseDecision({...decisionArgs,...overrides});
  assert.ok(run({}).reuse);
  const record=decisionArgs.record;
  for(const override of [{mode:'release'},{mode:'fresh'},{mode:'hook'},{mode:'diagnostic'},{reusable:false},{reusable:undefined},
    {record:null},{record:{...record,result:'failed'}},{record:{...record,groupId:'other'}},{record:{...record,retries:1}},
    {record:{...record,createdAt:'unknown'}},{record:{...record,createdAt:new Date(now+1).toISOString()}},
    {record:{...record,createdAt:new Date(now-72*3600000).toISOString()}},{audit:true},
    {freshHistory:null},{freshHistory:[]},{freshHistory:['passed','passed','passed','passed','failed']}])
    assert.equal(run(override).reuse,false,JSON.stringify(override));
  for (const groupId of ['No weakening','Fast','Mac browser performance'])
    assert.equal(run({groupId,record:{...record,groupId}}).reuse,false);
  assert.ok(run({record:{...record,createdAt:new Date(now-72*3600000+1).toISOString()}}).reuse);
  assert.ok(run({freshHistory:['passed','passed','passed','passed','passed','failed']}).reuse);
});

function sourceFixture(t,sealed=true) {
  const f=gitFixture(t),directory=join(f.root,'.git','uld-receipts'),id=randomUUID(),fp=sha256('fingerprint');
  const pointer=join(directory,'reuse',fp+'.json'),ev=join(directory,evidencePath(id,group)),attempt=join(directory,'attempts',id+'.json');
  mkdirSync(dirname(ev),{recursive:true});
  const evidence=JSON.stringify({schema:1,attempt:id,tree:f.tree,groupId:group,fingerprint:fp,outputs:[],logSha256:null});
  const receipt={schema:1,reuseSchema:1,retries:0,status:'passed',mode:'qualification',tree:f.tree,base:f.commit,commit:f.commit,
    id,started:new Date(now-100).toISOString(),finished:new Date(now).toISOString(),scope:{iphone:true},
    suites:receiptGroups.map(name=>({name,result:'passed',retries:0,durationMs:12,reusedFrom:null,
      fingerprint:name===group?fp:null,evidenceSha256:name===group?sha256(evidence):null}))};
  const save=()=>writeFileSync(attempt,JSON.stringify(receipt,null,2)+'\n');
  f.git('update-ref','refs/uld-archive/qualification-attempts/'+id,f.commit);
  writeFileSync(ev,evidence);save();if (sealed) sealReceipt(f.root,receipt);
  const publish=(overrides={})=>publishRecord({mode:'qualification',directory,root:f.root,snapshot:f.root,commit:f.commit,tree:f.tree,attemptId:id,groupId:group,fingerprint:fp,...overrides});
  const read=()=>readRecord(directory,group,fp);
  return {...f,directory,id,fp,pointer,ev,attempt,evidence,receipt,save,publish,read};
}
test('records bind a committed clean source, its evidence and exact group',t=>{
  const f=sourceFixture(t);
  for (const mode of ['hook','diagnostic',undefined]) assert.equal(f.publish({mode}),null);
  const record=f.publish();assert.ok(record);
  assert.deepEqual(f.read(),record);
  assert.deepEqual(freshHistory(f.directory,group),['passed']);
  assert.deepEqual(freshHistory(f.directory,group,f.id),[]);
  const earlier={...f.receipt,id:randomUUID(),started:new Date(now-1000).toISOString(),status:'failed',
    suites:[{name:'Fast',result:'passed',retries:0},{name:group,result:'failed',retries:0}]};
  const prior=join(f.directory,'attempts',earlier.id+'.json');
  writeFileSync(prior,JSON.stringify(earlier));
  assert.deepEqual(freshHistory(f.directory,group),['passed','failed']);
  assert.deepEqual(freshHistory(f.directory,'Fast'),['passed','passed']);
  rmSync(prior);
  assert.equal(readRecord(f.directory,'Fast',f.fp),null);
  writeFileSync(f.pointer,'{');assert.equal(f.read(),null);
  for(const [field,bad] of Object.entries({schema:2,groupId:'other',fingerprint:'bad',sourceAttempt:'bad',sourceReceiptSha256:sha256('other'),
    evidencePath:'unrelated',evidenceSha256:sha256('other'),tree:'a'.repeat(40),result:'failed',retries:1,createdAt:'invalid',extra:true})) {
    writeFileSync(f.pointer,JSON.stringify({...record,[field]:bad}));assert.equal(f.read(),null,field);
  }
  writeFileSync(f.pointer,JSON.stringify(record));rmSync(f.ev);assert.equal(f.read(),null);
  writeFileSync(f.ev,f.evidence+' ');assert.equal(f.read(),null);
  writeFileSync(f.ev,f.evidence);
  for(const [field,bad] of Object.entries({mode:'hook',status:'failed',schema:2,retries:1,reuseSchema:0,finished:'invalid',commit:'b'.repeat(40)})) {
    const old=f.receipt[field];f.receipt[field]=bad;f.save();assert.equal(f.publish(),null,field);f.receipt[field]=old;f.save();
  }
  const row=f.receipt.suites.find(item=>item.name===group);
  for(const [field,bad] of Object.entries({result:'reused',fingerprint:sha256('other'),retries:1,evidenceSha256:'other',reusedFrom:f.id,durationMs:-1})) {
    const old=row[field];row[field]=bad;f.save();assert.equal(f.publish(),null,field);row[field]=old;f.save();
  }
  f.write('src/view.js','dirty');assert.equal(f.publish(),null);
  f.write('src/view.js','source');f.write('uncommitted','text');assert.equal(f.publish(),null);
  assert.equal(f.read().sourceAttempt,f.id);
  // The publisher may verify a seal, but cannot mint one for an unsealed qualification.
  const noSeal=sourceFixture(t,false);
  const missing='refs/uld-archive/reuse-receipts/'+noSeal.id;
  assert.equal(noSeal.publish(),null);
  assert.equal(noSeal.git('for-each-ref','--format=%(refname)',missing),'');
  // The original write-once Git object independently binds the full receipt bytes.
  f.receipt.finished = new Date(now+1).toISOString();f.save();
  writeFileSync(f.pointer,JSON.stringify({...record,createdAt:f.receipt.finished,sourceReceiptSha256:sha256(readFileSync(f.attempt))}));
  assert.equal(f.read(),null);
  rmSync(f.attempt);assert.equal(f.read(),null);
});

test('landing rejects expired, missing or mismatched reuse evidence',t=>{
  const f=sourceFixture(t),record=f.publish();
  const sealed={...f.receipt,id:randomUUID()};
  sealReceipt(f.root,sealed);
  assert.doesNotThrow(()=>requireOriginalReceipt(f.root,sealed,f.commit));
  assert.throws(()=>requireOriginalReceipt(f.root,{...sealed,retries:1},f.commit),/changed after its verdict/);
  assert.throws(()=>sealReceipt(f.root,sealed));
  const row={name:group,result:'reused',reusedFrom:f.id,reuseRecord:record,fingerprint:f.fp};
  const raw={reuseSchema:1,noReuse:false,mode:'qualification',id:randomUUID(),suites:[row]};
  assert.equal(projectStoredPasses(f.directory,raw).suites[0].result,'passed');
  assert.equal(raw.suites[0].result,'reused');
  const choose=at=>reuseDecision({...decisionArgs,now:at,record});
  assert.doesNotThrow(()=>requireLandingIdentity(row,{fingerprint:f.fp},{...choose(now),record}));
  assert.throws(()=>requireLandingIdentity(row,{fingerprint:sha256('different')},{...choose(now),record}));
  assert.throws(()=>requireLandingIdentity(row,{fingerprint:f.fp},{...choose(now+72*3600000),record}));
  assert.throws(()=>requireLandingIdentity(row,null,{reuse:true,record}));
  assert.throws(()=>projectStoredPasses(f.directory,{...raw,noReuse:true}));
  rmSync(f.pointer);
  assert.equal(projectStoredPasses(f.directory,raw).suites[0].result,'passed');
  writeFileSync(f.ev,'changed');assert.throws(()=>projectStoredPasses(f.directory,raw));
});

test('a verified producer restores only its authenticated build outputs',t=>{
  const f=sourceFixture(t);
  f.write('dist/catalog/index.html','catalog');f.write('dist/catalog/deep/chunk.js','script');
  const outputs=captureOutputs(f.directory,f.root,group);
  const target=join(f.root,'dist/catalog');
  rmSync(target,{recursive:true});
  assert.throws(()=>restoreOutputs(f.directory,f.root,group,[...outputs,{...outputs[0],path:'README.md'}]));
  assert.throws(()=>restoreOutputs(f.directory,f.root,group,[...outputs,outputs[0]]));
  restoreOutputs(f.directory,f.root,group,outputs);
  assert.equal(readFileSync(join(target,'deep/chunk.js'),'utf8'),'script');
  assert.throws(()=>restoreOutputs(f.directory,f.root,group,outputs));
  rmSync(target,{recursive:true});
  const damaged=join(dirname(f.directory),'uld-cache','objects',outputs[0].sha.slice(0,2),outputs[0].sha.slice(2));
  chmodSync(damaged,0o600);writeFileSync(damaged,'corrupt');
  assert.throws(()=>restoreOutputs(f.directory,f.root,group,outputs));
});

test('a reused operation skips work and its audit executes fresh',async()=>{
  const calls=[],row={name:group};
  const reuse=()=>calls.push('restore'),fresh=()=>calls.push('run');
  await executeChoice(row,{reuse:true},false,reuse,fresh);
  await executeChoice(row,{reuse:true},true,reuse,fresh);
  await executeChoice(row,{reuse:false},false,reuse,fresh);
  await executeChoice(row,{reuse:true},false,()=>{throw Error('unreadable evidence');},fresh);
  assert.deepEqual(calls,['restore','run','run','run']);
  assert.equal(row.reuseReason,'unreadable evidence');
  await assert.rejects(executeChoice(row,{reuse:false},false,reuse,()=>{throw Error('failed check');}),/failed check/);
});

test('landing rechecks the retained pass after the latest fingerprint pointer moves', async t => {
  const { decideRow } = await import('../reuse/runner.mjs');
  t.mock.method(Date, 'now', () => now + 200);
  const f = sourceFixture(t);
  const retained = f.publish();
  const row = {name:group, fingerprint:f.fp, reusedFrom:f.id, reuseRecord:retained};
  const context = {directory:f.directory, attemptId:randomUUID(), mode:'qualification'};
  const identity = {config:{reusable:true}, fingerprint:f.fp, pipelineChanged:false};
  const next = randomUUID();
  const rel = evidencePath(next, group);
  const data = JSON.stringify({...JSON.parse(f.evidence), attempt:next});
  mkdirSync(dirname(join(f.directory,rel)),{recursive:true});
  writeFileSync(join(f.directory,rel),data);
  const later = structuredClone(f.receipt);
  Object.assign(later,{id:next,started:new Date(now+50).toISOString(),finished:new Date(now+100).toISOString()});
  later.suites.find(s => s.name===group).evidenceSha256 = sha256(data);
  writeFileSync(join(f.directory,'attempts',next+'.json'),JSON.stringify(later,null,2)+'\n');
  f.git('update-ref','refs/uld-archive/qualification-attempts/'+next,f.commit);
  sealReceipt(f.root,later);
  assert.equal(f.publish({attemptId:next}).sourceAttempt,next);
  const check = () => requireLandingIdentity(row,identity,decideRow(context,group,identity,retained));
  assert.doesNotThrow(check);
  t.mock.method(Date, 'now', () => now + 72 * 3600000);
  assert.throws(check);
  t.mock.method(Date, 'now', () => now + 200);
  writeFileSync(join(f.directory,'attempts',next+'.json'),JSON.stringify({...later,suites:[{name:group,result:'failed'}]}));
  assert.throws(check);
  writeFileSync(join(f.directory,'attempts',next+'.json'),JSON.stringify(later,null,2)+'\n');
  const {disableGroup} = await import('../reuse/audit.mjs');
  disableGroup(f.directory,group,'Control disagreement');
  assert.throws(check);
});
