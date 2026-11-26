import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import * as checks from '../train-checks.mjs';
import { diagnosePrefixes } from '../train-bisect.mjs';
import { sealPhysical } from '../reuse/runner.mjs';
import { deviceSuites } from '../device-verdict.mjs';
import { fixtureGit, isolateFixtureProcess } from './fixtures/hermetic-git.mjs';

isolateFixtureProcess();

test('train members require fresh iPhone and both Android profiles on solo and cumulative trees', async () => {
  const member = { number: 2, parent: 'first', commit: 'combined', tree: 'both', soloTree: 'second', soloCommit: 'alone' };
  const seen = [];
  const result = await checks.runMemberDevices('base', member, async (target, suite) => {
    seen.push([target.commit, suite]);
    return { commit: target.commit, suite };
  });
  const expected = ['alone', 'combined'].flatMap(commit => deviceSuites.map(suite => [commit, suite]));
  assert.deepEqual(seen, expected);
  assert.deepEqual(result.map(row => [row.commit, row.suite]), expected);
  assert.throws(() => checks.requireTrainMemberDevices('.', { base: 'base', members: [member], cheapChecks: [{ result: {} }] }));
  const first = { ...member, soloCommit: member.commit, soloTree: member.tree };
  assert.equal((await checks.runMemberDevices('base', first, async () => true)).length, 2);
});

test('train diagnosis runs both device drivers on each proper prefix and attributes each failure to its own suite', async t => {
  const folder = mkdtempSync(join(tmpdir(), 'uld-device-prefix-'));
  t.after(() => rmSync(folder, { recursive:true, force:true }));
  const members = ['one','two','three'].map((tree, i) => ({number:i+1, tree, commit:tree, parent:i?'previous':'base'}));
  const train = {id:'train', qualificationId:'attempt', base:'base', baseTree:'start', finalTree:'three', members,
    cheapChecks:members.map(m=>({number:m.number, tree:m.tree, status:'passed', result:{tree:m.tree}}))};
  const [ios, android] = deviceSuites;
  const receipt = {id:'attempt', tree:'three', status:'failed', suites:[{name:android,result:'failed'}]};
  const seen = [];
  const old = {train,receipt,folder,check:()=>assert.fail('recorded cheap checks'),testSuite:() => {}};
  await diagnosePrefixes(old);
  const report = await diagnosePrefixes({...old, freshDevices:true, verifyDevice:(_member,suite,row) => {
    assert.equal(row.suite,suite);
  }, testSuite:async (m,suite,dir) => {
    seen.push([m.tree,suite]);
    writeFileSync(join(dir,'suite.log'),m.tree+' '+suite);
    if(m.tree==='one' && suite===ios) throw Error('iPhone driver failed');
    if(m.tree==='two' && suite===android) throw Error('Android assertion failed');
    return {suite};
  }});
  assert.deepEqual(seen,['start','one','two'].flatMap(tree=>[ios,android].map(suite=>[tree,suite])));
  assert.deepEqual(report.suspects.filter(row=>row.suite===android).map(row=>row.number),[2]);
  assert.ok(report.journal.some(row=>row.prefix===1 && row.suite===ios && row.reason==='iPhone driver failed'));
});


test('train device evidence binds retained driver files and refuses skipped or substituted reports', t => {
  const root = mkdtempSync(join(tmpdir(),'uld-train-evidence-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  fixtureGit(root, ['init', '--quiet', '--template=']);
  const base = 'a'.repeat(40), target = {commit:'b'.repeat(40),tree:'c'.repeat(40)};
  const suite = deviceSuites[0], directory = 'uld-delivery/train-member-devices/fixture';
  const dir = join(root,'.git',directory);
  mkdirSync(join(dir,'test-results/ios-simulator'),{recursive:true});
  mkdirSync(join(dir,'release/evidence'),{recursive:true});
  const report = {passed:true,failed:0,skipped:0,scenarioIds:['a.b']}, raw = {};
  const log = 'test-results/ios-simulator/driver.xml';
  for (const [path,bytes] of [[log,'fixture driver output'],['suite.log','fixture verifier output'],['release/evidence/ios-simulator.json',JSON.stringify(report)]]) {
    writeFileSync(join(dir,path),bytes);
    raw[path]=createHash('sha256').update(bytes).digest('hex');
  }
  const proof = {kind:'full-train-device-v1',id:randomUUID(),base,...target,suite,verdict:'passed',
    directory,report,scenarioIds:['a.b'],raw};
  sealPhysical(root,proof);
  checks.requirePrefixDevice(root,base,target,suite,proof);
  assert.throws(()=>checks.requirePrefixDevice(root,base,target,suite,{...proof,verdict:'web-only'}));
  assert.throws(()=>checks.requirePrefixDevice(root,base,{...target,tree:base},suite,proof));
  const changedRoster = {...proof,id:randomUUID(),scenarioIds:['a.b','a.c']};
  sealPhysical(root,changedRoster);
  assert.throws(()=>checks.requirePrefixDevice(root,base,target,suite,changedRoster));
  writeFileSync(join(dir,log),'different output');
  assert.throws(()=>checks.requirePrefixDevice(root,base,target,suite,proof), /differ from the sealed evidence/);
});


function scopedTrainFixture(t, suite) {
  const root = mkdtempSync(join(tmpdir(), 'uld-requested-prefix-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  fixtureGit(root, ['init', '--quiet', '--template=']);
  const folder = join(root, '.git/uld-delivery/train-diagnostics');
  const members = ['one','two'].map((tree,i) => ({number:i+1, commit:tree, tree, parent:i?'one':'base'}));
  const train = {id:'train', qualificationId:'attempt', base:'base', baseTree:'start', finalTree:'two', members,
    cheapChecks:members.map(m=>({number:m.number, tree:m.tree, status:'passed', result:{tree:m.tree}}))};
  const receipt = {id:'attempt', tree:'two', status:'failed', suites:[{name:suite,result:'failed'}]};
  return {root, folder, train, receipt, check:() => assert.fail('cheap checks already passed')};
}

test('a requested phone diagnostic replays its sealed full-suite evidence under ordinary scoping', async t => {
  const suite = deviceSuites[0];
  const options = scopedTrainFixture(t, suite);
  const { root, train } = options, runs = [], verified = [];
  let retainedLog;
  options.verifyDevice = (member, name, evidence) => {
    checks.requirePrefixDevice(root, train.base, member, name, evidence);
    verified.push(member.tree);
  };
  options.testSuite = (member, name, dir) => {
    assert.equal(name, suite);
    runs.push(member.tree);
    const report = {passed:true, failed:0, skipped:0, scenarioIds:['button.press','switch.toggle']};
    const raw = {};
    mkdirSync(join(dir,'release/evidence'), {recursive:true});
    mkdirSync(join(dir,'test-results/ios-simulator'), {recursive:true});
    for (const [path, bytes] of [['suite.log','fixture verifier output'], ['test-results/ios-simulator/driver.xml','fixture driver output'],
      ['release/evidence/ios-simulator.json',JSON.stringify(report)]]) {
      writeFileSync(join(dir,path), bytes);
      raw[path] = createHash('sha256').update(bytes).digest('hex');
    }
    const proof = {kind:'full-train-device-v1', id:randomUUID(), base:train.base, commit:member.commit, tree:member.tree,
      suite, verdict:'passed', directory:relative(join(root,'.git'),dir), report, scenarioIds:report.scenarioIds, raw};
    sealPhysical(root,proof);
    retainedLog = join(dir,'suite.log');
    return proof;
  };
  const result = await diagnosePrefixes(options);
  assert.deepEqual(result.suspects.map(s=>s.number), [2]);
  assert.deepEqual(runs, ['start','one']);
  assert.deepEqual(verified, runs);
  const replay = await diagnosePrefixes(options);
  assert.deepEqual(replay.suspects, result.suspects);
  assert.deepEqual(runs, ['start','one']);
  assert.deepEqual(verified, [...runs,...runs]);
  writeFileSync(retainedLog, 'different verifier output');
  await assert.rejects(() => diagnosePrefixes(options), /differ from the sealed evidence/);
});

test('an inconclusive physical diagnostic cannot attribute a member or hide another failed suite', async t => {
  const suite = deviceSuites[1];
  const options = scopedTrainFixture(t, suite);
  const web = 'Mac browser behavior';
  options.receipt.suites.push({name:web,result:'failed'});
  const seen = [];
  options.testSuite = (member, name) => {
    seen.push([member.tree,name]);
    if (name === suite && member.tree === 'one') throw Error('could not prepare the fixture');
    if (name === suite) return {commit:member.commit, suite};
  };
  options.verifyDevice = (member,name,row) => assert.deepEqual(row,{commit:member.commit,suite:name});
  const result = await diagnosePrefixes(options);
  assert.deepEqual(result.suspects.map(s=>[s.suite,s.number]), [[web,2]]);
  assert.ok(result.journal.some(row=>row.suite===suite && row.status==='inconclusive' && /prepare the fixture/.test(row.reason)));
  const count = seen.length;
  const replay = await diagnosePrefixes(options);
  assert.deepEqual(replay.suspects,result.suspects);
  assert.equal(seen.length,count);
});


test('a requested iPhone or Android train suite selects the complete roster when solo scoping is enabled', t => {
  const {root} = scopedTrainFixture(t,deviceSuites[0]);
  const git = (...args) => fixtureGit(root, args);
  const base = git('write-tree');
  writeFileSync(join(root,'README.md'),'Docs only.');
  git('add','README.md');
  const tree = git('write-tree');
  for (const suite of deviceSuites) {
    const {devicePlan, scope} = checks.trainSuiteDeviceScope(root,base,tree,suite,false);
    assert.equal(devicePlan.full,true);
    assert.equal(devicePlan.run,true);
    assert.deepEqual(scope,{iphone:true,families:null});
  }
  assert.equal(checks.trainSuiteDeviceScope(root,base,tree,'Mac browser behavior',false).devicePlan.full,false);
});
