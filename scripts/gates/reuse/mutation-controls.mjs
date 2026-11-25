import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import fs, { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { dirname, join } from 'node:path';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');

// A small passing fixture exercises the common case first. Surviving mutations also run the
// registered module tests, including the malformed records and the clean-worktree checks.
export function createMutationControls(folder, store, producers) {
  const root = join(folder,'fixture');
  mkdirSync(root);
  const git = (...args) => execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  git('init','--quiet','--template=');
  git('config','user.name','Mutation Fixture');git('config','user.email','fixture@example.invalid');
  function seal(attemptFile,attemptId) {
    const blob=git('hash-object','-w',attemptFile);
    git('update-ref','refs/uld-archive/reuse-receipts/'+attemptId,blob,'0'.repeat(40));
  }
  // Every mutation runs against the same files, even when its assertion throws.
  function withBytes(file,bytes,check) {
    const before=readFileSync(file);
    writeFileSync(file,bytes);
    try { return check(); } finally { writeFileSync(file,before); }
  }
  const content = {
    'docs/guide.md':'guide','README.md':'name','docs/components/fixture.scenarios.yaml':'scenario',
    'scripts/gates/sample.mjs':'gate','scripts/qualify.mjs':'driver','src/button.js':'button','src/nested.md':'included',
    'tests/android/driver.mjs':'native driver','tests/acceptance/suite-inputs.json':'{}',
    'scripts/other.mjs':'unprotected script','packages/policy/quality/sample.js':'policy',
  };
  for (const [file,body] of Object.entries(content)) {
    mkdirSync(dirname(join(root,file)),{recursive:true});
    writeFileSync(join(root,file),body);
  }
  git('add','--all');
  const tree=git('write-tree'), commit=git('commit-tree',tree,'-m','Mutation control tree');
  git('update-ref','HEAD',commit);
  const blob=git('rev-parse',tree+':README.md');
  git('update-index','--add','--cacheinfo','100644,'+blob+',ordinary\tinput');
  const unsupportedTree=git('write-tree');
  git('read-tree',tree);
  const directory=join(root,'.git','uld-receipts'), id=randomUUID(), groupId='Catalog build';
  const fingerprint=sha('fingerprint'), finished='2026-01-02T00:00:00.000Z';
  const evidencePath=store.evidencePath(id,groupId);
  const producer = join(folder,'producer'), log = 'producer passed';
  mkdirSync(join(producer,'dist/catalog'),{recursive:true});
  writeFileSync(join(producer,'dist/catalog/index.html'),'catalog output');
  const outputs=producers.captureOutputs(directory,producer,groupId);
  const evidence=JSON.stringify({schema:1,attempt:id,tree,groupId,fingerprint,outputs,logSha256:sha(log)});
  const suite=name=>({name,result:'passed',durationMs:0,reusedFrom:null,retries:0,
    fingerprint:name===groupId?fingerprint:null,evidenceSha256:name===groupId?sha(evidence):null});
  const source={id,schema:1,reuseSchema:1,tree,commit,base:commit,mode:'qualification',status:'passed',
    started:finished,finished,retries:0,scope:{iphone:false},suites:store.receiptGroups.map(suite)};
  source.suites.find(row=>row.name==='iPhone Simulator').result='web-only';
  const priorId=randomUUID(),priorGroup='Scoped styles',priorFp=sha('style fingerprint');
  const prior={...source,id:priorId,started:'2026-01-01T12:00:00.000Z',suites:source.suites.map(row=>({...row}))};
  const priorEvidence=JSON.stringify({schema:1,attempt:priorId,tree,groupId:priorGroup,fingerprint:priorFp,outputs:[],logSha256:null});
  const priorPath=join(directory,store.evidencePath(priorId,priorGroup));
  const priorRow=prior.suites.find(row=>row.name===priorGroup);
  Object.assign(priorRow,{fingerprint:priorFp,evidenceSha256:sha(priorEvidence)});
  mkdirSync(dirname(priorPath),{recursive:true});
  writeFileSync(priorPath,priorEvidence);
  writeFileSync(join(directory,'attempts',priorId+'.json'),JSON.stringify(prior));
  git('update-ref','refs/uld-archive/qualification-attempts/'+priorId,commit);
  seal(join(directory,'attempts',priorId+'.json'),priorId);
  const priorRecord=store.publishRecord({mode:'qualification',directory,root,snapshot:root,tree,commit,attemptId:priorId,
    groupId:priorGroup,fingerprint:priorFp});
  assert.ok(priorRecord,'Failed to create directed producer control');
  Object.assign(source.suites.find(row=>row.name===priorGroup),{result:'reused',fingerprint:priorFp,
    reusedFrom:priorId,reuseRecord:priorRecord});
  const receipt=JSON.stringify(source);
  mkdirSync(dirname(join(directory,evidencePath)),{recursive:true});
  writeFileSync(join(directory,evidencePath),evidence);
  writeFileSync(join(directory,evidencePath.slice(0,-5)+'.log'),log);
  writeFileSync(join(directory,'attempts',id+'.json'),receipt);
  git('update-ref','refs/uld-archive/qualification-attempts/'+id,commit);
  const pointer={schema:1,fingerprint,groupId,result:'passed',tree,retries:0,sourceAttempt:id,
    sourceReceiptSha256:sha(receipt),evidencePath,evidenceSha256:sha(evidence),createdAt:finished};
  seal(join(directory,'attempts',id+'.json'),id);
  const seed=store.publishRecord({mode:'qualification',directory,root,snapshot:root,tree,commit,attemptId:id,groupId,fingerprint});
  assert.deepEqual(seed,pointer);
  const args={root,tree,base:commit,envFacts:{node:'22',enabled:true},groupId,exclude:['docs/**','*.md']};
  const historyKinds=['failed','reused','web-only','blocked','pending','other group'];
  for (const kind of historyKinds) {
    const event=randomUUID(), row = {...suite(groupId),result:kind};
    if (kind==='other group') { row.name='Unrelated'; row.result='passed'; }
    writeFileSync(join(directory,'attempts',event+'.json'),JSON.stringify({
      id:event,started:'2026-01-01T00:00:00.000Z',suites:[row]}));
  }
  writeFileSync(join(directory,'attempts',randomUUID()+'.text'),'ordinary unrelated file');
  writeFileSync(join(directory,'attempts','unrelated.json'),'ordinary unrelated file');
  const argsPublish={mode:'qualification',directory,root,snapshot:root,commit,tree,attemptId:id,groupId,fingerprint};
  const pointerFile=join(directory,'reuse',fingerprint+'.json');
  const artifact=join(dirname(directory),'uld-cache/objects',outputs[0].sha.slice(0,2),outputs[0].sha.slice(2));
  chmodSync(artifact,0o600);
  const invalidSources=[];
  const cases=[
    r=>{r.suites.find(row=>row.name===groupId).durationMs=-1;},
    r=>{r.suites.find(row=>row.name===groupId).durationMs='1';},
    r=>{r.suites.find(row=>row.name===groupId).reusedFrom=priorId;},
    r=>{r.suites[0].result='failed';},
    r=>{r.suites[0].result='web-only';},
    r=>{r.scope.iphone=true;},
    r=>{r.suites[0].retries=1;},
  ];
  for (const invalid of cases) {
    const testDirectory=join(root,'.git','control-'+invalidSources.length);
    const attempt=randomUUID(), rel=store.evidencePath(attempt,groupId);
    const doc=JSON.stringify({...JSON.parse(evidence),attempt});
    const sourceCase=structuredClone(source);sourceCase.id=attempt;
    sourceCase.suites.find(row=>row.name===groupId).evidenceSha256=sha(doc);
    invalid(sourceCase);
    const sourceBytes=JSON.stringify(sourceCase);
    const file=join(testDirectory,'attempts',attempt+'.json');
    mkdirSync(dirname(join(testDirectory,rel)),{recursive:true});
    writeFileSync(join(testDirectory,rel),doc);
    writeFileSync(join(testDirectory,rel.slice(0,-5)+'.log'),log);
    writeFileSync(file,sourceBytes);
    git('update-ref','refs/uld-archive/qualification-attempts/'+attempt,commit);
    seal(file,attempt);
    invalidSources.push({directory:testDirectory,pointer:{...pointer,evidencePath:rel,evidenceSha256:sha(doc),
      sourceReceiptSha256:sha(sourceBytes),sourceAttempt:attempt}});
  }
  return {
    policy(api) {
      const attempt={mode:'qualification',groupId,reusable:true,record:pointer,freshHistory:['passed'],audit:false,
        now:Date.parse(finished)};
      assert.equal(api.reuseDecision(attempt).reuse,true);
      assert.equal(api.reuseDecision({...attempt,audit:true}).reuse,false);
      assert.equal(api.reuseDecision({...attempt,mode:'release'}).reuse,false);
      const now=attempt.now, history=Array(5).fill('passed'), ttl=72*3600000;
      for (const override of [{reusable:false},{record:null},
        {groupId:'Fast',record:{...pointer,groupId:'Fast'}},{record:{...pointer,result:'failed'}},
        {record:{...pointer,groupId:'Other'}},{record:{...pointer,retries:1}},
        {now:now-1},{now:now+ttl},{freshHistory:null},{freshHistory:[]},
        {freshHistory:[...history.slice(0,4),'failed']}]) assert.equal(api.reuseDecision({...attempt,...override}).reuse,false);
      for (const override of [{now:now+ttl-1},{freshHistory:[...history,'failed']}])
        assert.equal(api.reuseDecision({...attempt,...override}).reuse,true);
    },
    fingerprint(api) {
      assert.equal(api.canonicalFingerprint({z:[false,true,null,2],a:'string'}),
        sha('{"a":"string","z":[false,true,null,2]}'));
      assert.throws(()=>api.canonicalFingerprint({value:undefined}));
      for (const value of [new Date(0),NaN]) assert.throws(()=>api.canonicalFingerprint({value}));
      assert.throws(()=>api.treeFingerprint({...args,envFacts:{}}));
      assert.throws(()=>api.treeFingerprint({...args,envFacts:null}));
      assert.throws(()=>api.treeFingerprint({...args,exclude:['other/**']}));
      const inputs=api.gitInputs(root,tree,commit);
      assert.equal(inputs.pipelineChanged,false);
      assert.equal(inputs.candidate.length,Object.keys(content).length);
      const pipelineFiles=['scripts/gates/sample.mjs','scripts/qualify.mjs','scripts/other.mjs','tests/android/driver.mjs',
        'packages/policy/quality/sample.js','tests/acceptance/suite-inputs.json'];
      assert.equal(inputs.basePipeline,api.canonicalFingerprint(inputs.candidate.filter(row=>pipelineFiles.includes(row.path))));
      assert.throws(()=>api.gitInputs(root,unsupportedTree,commit));
      const key=api.treeFingerprint({...args,inputs});
      assert.match(key,/^[a-f0-9]{64}$/);
      for (const bad of [undefined,null,'','unavailable'])
        assert.throws(()=>api.treeFingerprint({...args,inputs,envFacts:{node:bad}}));
      const changed = path => ({...inputs,candidate:inputs.candidate.map(row=>row.path===path?{...row,oid:'0'.repeat(40)}:row)});
      for (const file of Object.keys(content)) {
        const update=api.treeFingerprint({...args,inputs:changed(file)});
        assert.equal(update===key,file.startsWith('docs/') || file==='README.md',file);
      }
      const app = {...args,inputs,scope:{families:null},deviceImage:{os:'test'},
        appManifests:{ios:{fileSha256:sha('file'),manifestSha256:sha('manifest')}}};
      const appKey = api.appFingerprint(app);
      for (const [file,affects] of [['scripts/qualify.mjs',true],['scripts/gates/sample.mjs',true],
        ['tests/android/driver.mjs',true],['docs/components/fixture.scenarios.yaml',true],['src/button.js',false]])
        assert.equal(api.appFingerprint({...app,inputs:changed(file)})!==appKey,affects,file);
      assert.notEqual(api.appFingerprint({...app,inputs:changed('scripts/other.mjs')}),appKey);
      assert.throws(()=>api.appFingerprint({...app,appManifests:{}}));
      assert.throws(()=>api.appFingerprint({...app,deviceImage:null}));
      assert.throws(()=>api.appFingerprint({...app,deviceImage:{}}));
      assert.throws(()=>api.appFingerprint({...app,envFacts:{node:null}}));
    },
    store(api) {
      // The source and consumer are ordinary fixture receipts in a disposable Git repository.
      assert.deepEqual(api.verifiedSource(directory,pointer).source,source);
      const freshOnly={suites:[suite('Fast')]};
      assert.equal(api.projectStoredPasses(directory,freshOnly),freshOnly);
      const row={name:groupId,result:'reused',reusedFrom:id,fingerprint,reuseRecord:pointer};
      const consumer={id:'consumer',reuseSchema:1,mode:'qualification',noReuse:false,suites:[row,suite('Other')]};
      assert.deepEqual(api.projectStoredPasses(directory,consumer).suites.map(s=>s.result),['passed','passed']);
      const blocked = structuredClone(source);
      blocked.suites.find(item=>item.name==='Scoped styles').result='blocked';
      const incomplete = JSON.stringify(blocked);
      const file = join(directory,'attempts',id+'.json');
      writeFileSync(file,incomplete);
      try {
        assert.throws(()=>api.verifiedSource(directory,{...pointer,sourceReceiptSha256:sha(incomplete)}));
      } finally { writeFileSync(file,receipt); }
      const stored=api.publishRecord(argsPublish);
      assert.deepEqual(stored,pointer);
      assert.deepEqual(api.readRecord(directory,groupId,fingerprint),pointer);
      assert.deepEqual(api.freshHistory(directory,groupId),['passed','passed','failed']);
      assert.deepEqual(api.freshHistory(directory,groupId,id),['passed','failed']);
      for(const mode of [undefined,'diagnostic','hook']) assert.equal(api.publishRecord({...argsPublish,mode}),null);
      for (const relative of ['attempts/./'+id+'.json','attempts//'+id+'.json','attempts/../attempts/'+id+'.json'])
        assert.throws(()=>api.readBytes(directory,relative));
      for(const item of invalidSources) assert.throws(()=>api.verifiedSource(item.directory,item.pointer));
      assert.throws(()=>api.verifiedSource(directory,{...pointer,sourceReceiptSha256:sha('a different receipt')}));
      const changedReceipt=receipt+' ';
      withBytes(file,changedReceipt,()=>assert.throws(()=>api.verifiedSource(directory,{...pointer,sourceReceiptSha256:sha(changedReceipt)})));
      withBytes(pointerFile,JSON.stringify({...pointer,schema:0}),()=>assert.equal(api.readRecord(directory,groupId,fingerprint),null));
      assert.throws(()=>api.projectStoredPasses(directory,{...consumer,suites:[{...row,reuseRecord:{...pointer,schema:0}}]}));
      withBytes(join(directory,evidencePath),evidence+' ',()=>{
        assert.throws(()=>api.verifiedSource(directory,pointer));
        withBytes(pointerFile,readFileSync(pointerFile),()=>assert.equal(api.publishRecord(argsPublish),null));
      });
      withBytes(join(directory,evidencePath.slice(0,-5)+'.log'),'different log',()=>assert.throws(()=>api.verifiedSource(directory,pointer)));
      withBytes(artifact,'different producer output',()=>assert.throws(()=>api.verifiedSource(directory,pointer)));
      for (const x of [true,false]) {
        const retry={id:randomUUID(),suites:[{name:groupId,result:'passed',retries:x?1:0}],started:'2026-01-05T00:00:00Z'};
        const file=join(directory,'attempts',retry.id+'.json');writeFileSync(file,JSON.stringify(retry));
        try {assert.equal(api.freshHistory(directory,groupId)[0],x?'failed':'passed');}
        finally {rmSync(file);}
      }
      // Another process must see the preceding pointer until the filesystem commits its replacement.
      // Simulate a real rename error once. The same source must remain readable after rollback.
      const originalRename=fs.renameSync, before=readFileSync(pointerFile);
      const previous=Buffer.from('previous complete lookup');
      writeFileSync(pointerFile,previous);
      let attempted=false;
      fs.renameSync=(from,to)=>{
        if (to!==pointerFile) return originalRename(from,to);
        attempted=true;
        assert.deepEqual(readFileSync(to),previous);
        assert.deepEqual(JSON.parse(readFileSync(from)),pointer);
        throw Object.assign(new Error('Simulated interrupted publication'),{code:'EIO'});
      };
      syncBuiltinESMExports();
      try {
        assert.equal(api.publishRecord(argsPublish),null);assert.equal(attempted,true);
        assert.deepEqual(readFileSync(pointerFile),previous);
      } finally { fs.renameSync=originalRename;syncBuiltinESMExports();writeFileSync(pointerFile,before); }
    },
  };
}
