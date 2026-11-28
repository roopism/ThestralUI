import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { assertAuditResult, disabledGroups, disableGroup, selectAudit } from '../reuse/audit.mjs';
import { compareFullRun, manualFullRun, sealedClaims } from '../reuse/full-run.mjs';
import { sealReceipt } from '../reuse/runner.mjs';
import { reusePolicyIssues } from '../reuse/strength.mjs';
import { fixtureGit, isolateFixtureProcess } from './fixtures/hermetic-git.mjs';

isolateFixtureProcess();

function scratch(t) {
  const dir = mkdtempSync(join(tmpdir(),'uld-reuse-safety-'));
  t.after(() => rmSync(dir,{recursive:true,force:true}));
  return dir;
}

test('the audit draw is reproducible, independent of group order and reaches each eligible group', () => {
  const groups = ['Mac browser behavior','Catalog build','Scoped styles'];
  const selected = new Set();
  for (let i = 0; i < 30; i++) {
    const seed = i.toString(16).padStart(64,'0');
    const first = selectAudit(groups,seed);
    assert.equal(selectAudit([...groups].reverse(),seed),first);
    selected.add(first);
  }
  assert.deepEqual([...selected].sort(),[...groups].sort());
  assert.equal(selectAudit(['Catalog build'],'01'.repeat(32)),'Catalog build');
  assert.equal(selectAudit([],'01'.repeat(32)),null);
  assert.throws(() => selectAudit(groups,''));
});

test('a disagreeing audit disables its group and preserves the evidence for the owner', t => {
  const dir = join(scratch(t),'uld-receipts');
  assert.deepEqual(disabledGroups(dir),[]);
  const proof = {attempt:'new',sourceAttempt:'original',fingerprint:'05'.repeat(32)};
  assertAuditResult(dir,'Catalog build','passed',proof);
  assert.deepEqual(disabledGroups(dir),[]);
  assert.throws(() => assertAuditResult(dir,'Catalog build','failed',proof),/observed failed/);
  disableGroup(dir,'Scoped styles','Independent comparison failed.');
  assert.deepEqual(disabledGroups(dir),['Catalog build','Scoped styles']);
  assert.match(readFileSync(join(dir,'../uld-delivery/owner-decisions/reuse.md'),'utf8'),/previously passed in original/);
  const folder = join(dir,'reuse-disabled');
  const [evidence] = readdirSync(folder);
  writeFileSync(join(folder,evidence),'{}');
  assert.throws(() => disabledGroups(dir),/Damaged disagreement/);
});

test('a manual full run compares prior reused fingerprints across trees and records each disagreement', async t => {
  const dir = join(scratch(t),'uld-receipts'), match = '0a'.repeat(32), other = '00'.repeat(32);
  const claim = {id:'prior',mode:'qualification',status:'passed',suites:[
    {name:'Catalog build',fingerprint:match,result:'reused',reusedFrom:'source'},
    {name:'Scoped styles',fingerprint:match,result:'reused',reusedFrom:'another source'}]};
  const root=dirname(dir);
  const git = (...args) => fixtureGit(root, args);
  git('init','--quiet','--template=');
  const sealed={...claim,id:'00000000-0000-0000-0000-0000000000af',reuseSchema:1,finished:'2026-01-01T10:00:00Z'};
  const file=join(root,'old-attempt.json');
  writeFileSync(file,JSON.stringify(sealed));
  const original=git('hash-object','-w',file);
  git('update-ref','refs/uld-archive/reuse-receipts/'+sealed.id,original);
  writeFileSync(file,JSON.stringify({...sealed,status:'failed'}));
  assert.deepEqual(sealedClaims(root,'2026-01-01T11:00:00Z'),[sealed]);
  assert.deepEqual(sealedClaims(root,'2026-01-01T09:00:00Z'),[]);
  const fresh = {id:'new',mode:'qualification',noReuse:true,status:'failed',suites:[
    {name:'Catalog build',fingerprint:match,result:'failed'},
    {name:'Scoped styles',fingerprint:other,result:'passed'}]};
  const observations = compareFullRun(dir,fresh,[claim,{...claim,id:'old',status:'failed'}]);
  assert.deepEqual(observations,[{groupId:'Catalog build',fingerprint:match,claims:['prior'],observed:'failed',agrees:false}]);
  assert.deepEqual(disabledGroups(dir),['Catalog build']);
  assert.throws(() => compareFullRun(dir,{...fresh,noReuse:false},[claim]));
  assert.throws(() => compareFullRun(dir,{...fresh,suites:claim.suites},[claim]),/reused suite/);

  const checkout = scratch(t);
  const dailyGit = (...args) => fixtureGit(checkout, args);
  dailyGit('init', '--quiet', '--template=', '-b', 'feat/enterprise-ui');
  mkdirSync(join(checkout, 'tests/acceptance'), { recursive: true });
  writeFileSync(join(checkout, 'tests/acceptance/suite-inputs.json'), JSON.stringify({ groups: { 'Catalog build': {} } }));
  dailyGit('add', 'tests');
  dailyGit('commit', '--quiet', '-m', 'Daily fixture');
  dailyGit('remote', 'add', 'origin', '.');
  const commit = dailyGit('rev-parse', 'HEAD'), tree = dailyGit('rev-parse', 'HEAD^{tree}');
  const now = new Date().toISOString();
  const receipt = { schema: 1, reuseSchema: 1, id: randomUUID(), commit, base: commit, tree, started: now, finished: now,
    noReuse: true, mode: 'qualification', status: 'passed', scope: { iphone: true, families: null },
    suites: [{ name: 'Catalog build', result: 'passed' }], androidTiming: { result: 'timing measured' } };
  const directory = join(checkout, '.git/uld-receipts');
  mkdirSync(join(directory, 'attempts'), { recursive: true });
  sealReceipt(checkout, receipt);
  writeFileSync(join(directory, 'attempts', receipt.id + '.json'), JSON.stringify(receipt));
  const report = await manualFullRun(checkout);
  assert.equal(report.attempt, receipt.id);
  assert.deepEqual(await manualFullRun(checkout), report);
  assert.equal(existsSync(join(directory, 'reuse-shadow/requests')), false);
});

test('trusted reuse guardrails reject relaxed limits, removed facts and disabled sandbox or canary code', t => {
  const dir = scratch(t), rules = 'scripts/gates/reuse/guardrails.json', inputs = 'tests/acceptance/suite-inputs.json';
  const wrapper = 'scripts/gates/reuse/sandbox-mac.mjs', runner='scripts/gates/local-run.mjs', canary='scripts/gates/reuse/canaries.mjs';
  const git = (...args) => fixtureGit(dir, args);
  git('init','--quiet','--template=');
  const write = (path,body) => {
    mkdirSync(dirname(join(dir,path)),{recursive:true}); writeFileSync(join(dir,path),typeof body==='string'?body:JSON.stringify(body));
    git('add','--',path);
  };
  const limits = JSON.parse(readFileSync(new URL('../reuse/guardrails.json',import.meta.url)));
  const group = {reusable:false,mode:'never',envFacts:[],extraInputs:[],exclude:[]};
  const matrix = {contractVersion:1,groups:Object.fromEntries(limits.neverGroups.map(id=>[id,{...group}]))};
  matrix.groups['Catalog build'] = {...group,reusable:true,mode:'tree',envFacts:['node']};
  matrix.groups['Packed consumers min'] = {...group,reusable:true,mode:'tree'};
  write(rules,limits);write(inputs,matrix);
  const enrollment = 'scripts/gates/reuse/store.mjs';
  write(enrollment,"export const receiptGroups = ['Catalog build'];");
  write(wrapper,"export function macCommand(command){return {command:'sandbox-exec',args:[command]};}");
  write(runner,"export function run(command){return macCommand(command);}");
  write(canary,"import assert from 'node:assert/strict'; assert.equal(1+1,2); assert.ok(true);");
  const base = git('write-tree');
  const issues = () => reusePolicyIssues(dir,base,git('write-tree'));
  assert.deepEqual(issues(),[]);
  for (const [field,value] of [['ttlHours',73],['flakeWindow',4],['minAuditGroups',0],
      ['neverExclude',limits.neverExclude.slice(1)],['neverGroups',limits.neverGroups.slice(1)]]) {
    git('read-tree',base); write(rules,{...limits,[field]:value}); assert.ok(issues().length,field);
  }
  for (const [name,adjust,problem] of [
    ['Fast',{reusable:true,mode:'tree'},/always-fresh/],
    ['Catalog build',{envFacts:[]},/environment fact/],
    ['Packed consumers min',{exclude:['docs/**']},/without enforcement/],
    ['Catalog build',{exclude:['scripts/**']},/unknown exclusion/],
  ]) {
    git('read-tree',base); const changed=structuredClone(matrix);Object.assign(changed.groups[name],adjust);
    write(inputs,changed); assert.match(issues().join('\n'),problem);
  }
  git('read-tree',base);write(wrapper,'export function macCommand(command){return {command};}');
  assert.match(issues().join('\n'),/disabled a reuse safeguard/);
  git('read-tree',base);write(runner,'export function run(command){return command;}');
  assert.match(issues().join('\n'),/disabled a reuse safeguard/);
  git('read-tree',base);write(canary,'');
  assert.match(issues().join('\n'),/removed a canary/);
  git('read-tree',base);git('update-index','--force-remove',canary);
  assert.match(issues().join('\n'),/removed a reuse safeguard or canary/);
  git('read-tree',base);const narrowed = structuredClone(matrix);
  narrowed.groups['Catalog build'].exclude=['docs/**'];write(inputs,narrowed);
  assert.deepEqual(issues(),[]);
  narrowed.groups['Packed consumers min'].exclude=['*.md'];write(inputs,narrowed);
  write(enrollment,"export const receiptGroups = ['Catalog build','Packed consumers min'];");
  assert.deepEqual(issues(),[]);
  git('read-tree',base);write(rules,{...limits,ttlHours:48,flakeWindow:6});
  assert.deepEqual(issues(),[]);
});
