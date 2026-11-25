import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {diagnosePrefixes} from '../train-bisect.mjs';
import {needsMacBehavior, runMemberChecks} from '../train-checks.mjs';

test('a failed train retains its verdict and bisects prefixes without a second run of a tree',async t=>{
  const folder=mkdtempSync(join(tmpdir(),'uld-train-diagnosis-'));
  t.after(()=>rmSync(folder,{recursive:true,force:true}));
  const members=['one','two','two','four','five'].map((tree,i)=>({tree,number:i+1,parent:'parent'+i,commit:'commit'+i}));
  const train={id:'fixture',base:'base',baseTree:'base-tree',members,finalTree:'five',qualificationId:'failed-attempt',
    cheapChecks:members.map(m=>({tree:m.tree, number:m.number, status:'passed', result:{tree:m.tree}}))};
  const receipt={id:train.qualificationId,tree:'five',status:'failed',suites:[{name:'Mac browser behavior',result:'failed'}]};
  const path=join(folder,'receipt.json');
  const bytes=JSON.stringify(receipt);
  writeFileSync(path,bytes);
  const seen=new Set();
  const ops={train,receipt,folder,check:()=>assert.fail('Already passed cheap checks'),testSuite(member,suite,evidenceDir){
    writeFileSync(join(evidenceDir,'suite.log'), 'fictional suite diagnostics', {flag:'wx'});
    assert.equal(suite,'Mac browser behavior');
    assert.ok(!seen.has(member.tree) && member.tree!==train.finalTree);
    seen.add(member.tree);
    if(member.tree==='four') throw Error('same browser assertion as final');
  }};
  const result=await diagnosePrefixes(ops);
  assert.equal(result.suspects[0].number,4);
  const count=seen.size;
  const repeat=await diagnosePrefixes(ops);
  assert.deepEqual(repeat.suspects,result.suspects);
  assert.equal(seen.size,count);
  assert.equal(readFileSync(path,'utf8'),bytes);
});

test('train preflight includes web behavior for shared code, catalog and unknown paths',()=>{
  for(const path of ['packages/web/src/button.tsx','package.json','catalog/X.stories.tsx','unclassified','docs/example.tsx']) {
    assert.equal(needsMacBehavior([path]),true);
  }
  assert.equal(needsMacBehavior(['docs/process.md','README.md']),false);
  assert.equal(needsMacBehavior(['tests/android/FrameActivity.kt']),false);
});

test('member preflight requires fast and typed checks, changed gate tests and applicable browser behavior in order', () => {
  const cases = ['scripts/gates/tests/changed.test.mjs'];
  const canary = 'scripts/gates/maestro-canary.mjs';
  const paths = [canary, ...cases, 'packages/web/src/button.tsx'];
  const seen = [];
  const operations = {
    preflight: () => seen.push('preflight'),
    canary: file => { assert.equal(file, canary); seen.push('canary'); },
    tests: files => { assert.deepEqual(files, cases); seen.push('tests'); },
    browser: () => seen.push('browser'),
  };
  assert.deepEqual(runMemberChecks(paths, new Set(cases), operations), {
    fast: 'passed', typedAndUnit: 'passed', changedGateTests: cases, changedCanaries: [canary], macBehavior: 'passed',
  });
  assert.deepEqual(seen, ['preflight', 'canary', 'tests', 'browser']);
  seen.length = 0;
  assert.throws(() => runMemberChecks(paths, new Set(cases), { ...operations,
    tests: () => { throw Error('Fixture gate test failed'); } }), /Fixture gate test failed/);
  assert.deepEqual(seen, ['preflight', 'canary']);
  seen.length = 0;
  assert.equal(runMemberChecks(['README.md'], new Set(), operations).macBehavior, 'no-web-inputs');
  assert.deepEqual(seen, ['preflight']);
});
