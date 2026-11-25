import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, realpathSync, readdirSync, lstatSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
import { treeFingerprint, appFingerprint, canonicalFingerprint, gitInputs } from './fingerprint.mjs';
import { environmentFacts } from './environment.mjs';
import { reuseDecision } from './policy.mjs';
import { disabledGroups, selectAudit } from './audit.mjs';
import { readDeviceReuse } from './device-run.mjs';
import { captureOutputs, restoreOutputs } from './outputs.mjs';
import { evidencePath, freshHistory, projectStoredPasses, readRecord, sha256, verifiedSource } from './store.mjs';
import { timingForIdenticalApk } from '../android-timing-reuse.mjs';
import { deviceScope } from '../../selection/local-device.mjs';

const matrix = 'tests/acceptance/suite-inputs.json';
const vm = fileURLToPath(new URL('../linux-vm.mjs',import.meta.url));
function groupConfig(root,tree,name) {
  const raw = execFileSync('git',['--no-replace-objects','show',tree+':'+matrix],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
  const config = JSON.parse(raw);
  assert.equal(config.contractVersion,1);
  const group = config.groups[name];
  assert.deepEqual(Object.keys(group).sort(),['envFacts','exclude','extraInputs','mode','reusable']);
  assert.ok(group.reusable === true && ['app','tree'].includes(group.mode));
  for (const list of [group.envFacts, group.exclude, group.extraInputs])
    assert.ok(Array.isArray(list) && list.every(item=>typeof item==='string' && item.length) && list.length===new Set(list).size);
  return group;
}

// Named inputs live under the two local qualification caches. Unrecognized locations stay fresh.
export function externalInputDigests(directory,names) {
  const inputs = {};
  function hashEntry(path) {
    const item = lstatSync(path);
    if (item.isFile()) return [item.mode & 0o777,sha256(readFileSync(path))];
    assert.ok(item.isDirectory() && !item.isSymbolicLink(),'Unsupported external input');
    return readdirSync(path).sort().map(name=>[name,hashEntry(join(path,name))]);
  }
  for (const name of names) {
    const parts = name.split('/');
    assert.ok(['uld-cache','uld-dependencies'].includes(parts[0]) && parts.length>1 &&
      parts.every(part=>part && part!=='.' && part!=='..'),'Unknown named external input');
    const path = join(realpathSync(dirname(directory)),...parts);
    assert.equal(realpathSync(path),path,'External inputs must stay within the named cache');
    inputs[name] = canonicalFingerprint(hashEntry(path));
  }
  return inputs;
}

export function rowIdentity(context,name,app,inputs) {
  const {root,snapshot,tree,base,scope} = context;
  inputs ??= gitInputs(root,tree,base);
  const config = groupConfig(root,tree,name);
  const envFacts = name === 'Linux browser behavior'
    ? JSON.parse(execFileSync(process.execPath,[vm,'--reuse-image',snapshot,JSON.stringify(config.envFacts)],
      {cwd:snapshot,encoding:'utf8',env:{...process.env,ULD_ARTIFACT_COMMON:dirname(context.directory)}}))
    : environmentFacts(config.envFacts,{root:snapshot,groupId:name});
  assert.deepEqual(Object.keys(envFacts).sort(),[...config.envFacts].sort());
  const extraInputs = externalInputDigests(context.directory,config.extraInputs);
  const shared = {root,tree,base,groupId:name,envFacts,inputs};
  const fingerprint = config.mode==='app'
    ? appFingerprint({...shared,...app,scope,envFacts:{...envFacts,extraInputs}})
    : treeFingerprint({...shared,exclude:config.exclude,extraInputs});
  return {config,fingerprint,pipelineChanged:inputs.pipelineChanged};
}

export function decideRow(context,name,identity,retainedRecord) {
  const {directory,attemptId,noReuse,mode} = context;
  if (!identity) return {reuse:false,reason:'inputs unavailable'};
  const { config, fingerprint, pipelineChanged } = identity;
  if (pipelineChanged) return {reuse:false,reason:'pipeline changes require fresh verification'};
  const record = retainedRecord ?? readRecord(directory,name,fingerprint);
  const history = freshHistory(directory,name,attemptId);
  let enabled = false;
  try { enabled = config.reusable && !disabledGroups(directory).includes(name); } catch {}
  const decision = reuseDecision({mode:noReuse?'fresh':mode,groupId:name,reusable:enabled,record,freshHistory:history});
  return {...decision, record};
}

export function useRecord(context,row,record) {
  const {source,evidence} = verifiedSource(context.directory,record);
  restoreOutputs(context.directory,context.snapshot,row.name,evidence.outputs);
  Object.assign(row,{result:'reused',reusedFrom:record.sourceAttempt,reuseRecord:record,
    sourceDurationMs:source.suites.find(item=>item.name===row.name).durationMs});
  return source;
}

export function readVisualCoverage({root, tree}, path) {
  const coverage = JSON.parse(readFileSync(path));
  const roster = JSON.parse(execFileSync('git', ['--no-replace-objects','show',tree+':tests/acceptance/visual-matrix.json'], {cwd:root}));
  assert.deepEqual(coverage, {tree, projects:roster.projects, cases:roster.cases});
  return coverage;
}

export function saveFreshEvidence(context,row,logSha256,durationMs) {
  const rel = evidencePath(context.attemptId,row.name), out = join(context.directory,rel);
  mkdirSync(dirname(out),{recursive:true,mode:0o700});
  assert.equal(realpathSync(dirname(out)),join(realpathSync(context.directory),dirname(rel)));
  const evidence = {schema:1,attempt:context.attemptId,tree:context.tree,groupId:row.name,fingerprint:row.fingerprint,
    durationMs,logSha256,outputs:captureOutputs(context.directory,context.snapshot,row.name)};
  const bytes = Buffer.from(JSON.stringify(evidence)+'\n');
  writeFileSync(out,bytes,{flag:'wx',mode:0o600});
  row.evidenceSha256 = sha256(bytes);
}

export function requireLandingIdentity(row,identity,decision) {
  assert.ok(identity && row.fingerprint===identity.fingerprint,'Merge inputs differ from reused '+row.name);
  assert.ok(decision.reuse && isDeepStrictEqual(decision.record,row.reuseRecord),'Reuse is no longer eligible for '+row.name);
}

function receiptRef(receipt, kind = 'reuse-receipts') {
  assert.match(receipt.id,/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
  return 'refs/uld-archive/'+kind+'/'+receipt.id;
}

// Bind the trusted runner's in-memory final verdict before it publishes the JSON attempt.
function writeSeal(root,receipt,ref) {
  const cwd = {cwd:root,encoding:'utf8'};
  const bytes = JSON.stringify(receipt,null,2)+'\n';
  const blob = execFileSync('git',['hash-object','-w','--stdin'],{...cwd,input:bytes}).trim();
  execFileSync('git',['update-ref',ref,blob,'0'.repeat(40)],cwd);
}

export function sealReceipt(root,receipt) {
  writeSeal(root,receipt,receiptRef(receipt));
}

export function sealPhysical(root,report) {
  writeSeal(root,report,receiptRef(report,'cloud-physical'));
}

function readSeal(root,ref) {
  return execFileSync('git',['--no-replace-objects','cat-file','blob',ref],{cwd:root,maxBuffer:64*1024*1024});
}

export function requirePhysicalSeal(root,report) {
  const sealed = JSON.parse(readSeal(root,receiptRef(report,'cloud-physical')));
  assert.deepEqual(sealed,report,'The physical report changed after its verdict');
}

export function requireOriginalReceipt(root,receipt,base) {
  const opts = {cwd:root,encoding:'utf8'};
  const adopted = spawnSync('git',['--no-replace-objects','cat-file','-e',base+':scripts/gates/reuse/runner.mjs'],opts);
  if (receipt.reuseSchema!==1 && adopted.status!==0) return;
  assert.equal(receipt.reuseSchema,1,'An adopted base requires the original sealed runner verdict');
  const bytes = readSeal(root,receiptRef(receipt));
  assert.deepEqual(JSON.parse(bytes),receipt,'The qualification receipt changed after its verdict');
}

export function verifyLandingReuse({directory,root,snapshot},receipt) {
  const claims = receipt.suites.filter(row=>row.result==='reused');
  const audits = receipt.suites.filter(row=>row.auditRerun);
  if (!claims.length && !audits.length) return;
  assert.equal(receipt.mode,'qualification');
  assert.equal(receipt.noReuse,false);
  const scope = deviceScope(root,receipt.base,receipt.tree);
  assert.deepEqual(receipt.scope,scope);
  const context = {directory,root,snapshot,scope,base:receipt.base,tree:receipt.tree,attemptId:receipt.id,mode:receipt.mode};
  const ids = [...claims,...audits].map(row=>row.name);
  assert.equal(audits.length,1,'Missing unique fresh audit');
  assert.equal(audits[0].result,'passed');
  assert.equal(selectAudit(ids,receipt.auditSeed),audits[0].name);
  const inputs = gitInputs(root,receipt.tree,receipt.base);
  for (const row of claims) {
    const app = ['iPhone Simulator','Android standard and low-end'].includes(row.name)
      ? readDeviceReuse({...context,groupId:row.name,receipt}) : null;
    const identity = rowIdentity(context,row.name,app,inputs);
    requireLandingIdentity(row,identity,decideRow(context,row.name,identity,row.reuseRecord));
    const {source} = verifiedSource(directory,row.reuseRecord);
    if (row.name==='Linux browser behavior') assert.deepEqual(receipt.vm,source.vm);
    if (row.name==='iPhone Simulator') assert.deepEqual(receipt.devices.iphone,source.devices.iphone);
    if (row.name==='Android standard and low-end') {
      assert.deepEqual(receipt.devices.android,source.devices.android);
      const appId = app.appManifests['low-end'];
      const {limits} = JSON.parse(execFileSync('git',['--no-replace-objects','show',receipt.tree+':tests/android/low-end-budget.json'],{cwd:root}));
      assert.ok(timingForIdenticalApk(receipt,receipt.tree,appId.fileSha256,limits,appId.manifestSha256),
        'Independent Android timing must pass every trial for this app');
    }
  }
  projectStoredPasses(directory,receipt);
}


export async function executeChoice(entry,decision,audit,reuse,fresh) {
  if (decision.reuse && !audit) {
    try {
      await reuse();
      return;
    } catch (error) {
      Object.assign(entry,{result:'pending',reusedFrom:null,reuseReason:String(error.message)});
      delete entry.reuseRecord;
    }
  }
  await fresh();
}
