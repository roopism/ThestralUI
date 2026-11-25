import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { availableParallelism, loadavg } from 'node:os';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { enforceBudget, summarizeTrials } from '../../tests/android/frame-budget.mjs';

export const admission = Object.freeze({ idleMs:60000, maximumLoadPerCpu:1, pollMs:5000, maxWaitMs:1200000, maxSampleGapMs:15000 });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = file => JSON.parse(readFileSync(file,'utf8'));
const uid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;

export function sampleHost() {
  try {
    // Filter inside the pipe. Only the system-wide idle counter reaches this process.
    const output=execFileSync('/bin/sh',['-c',
      '/usr/sbin/ioreg -r -c IOHIDSystem -d 1 -l -w 0 | /usr/bin/awk -F "= " \'/"HIDIdleTime" = [0-9]+$/ { print $2 }\''],
      {encoding:'utf8',timeout:2000,stdio:['ignore','pipe','ignore']}).trim().split(/\s+/);
    assert.ok(output.length && output.every(x=>/^\d+$/.test(x)));
    const hidIdleNs=output.map(BigInt).reduce((a,b)=>a<b?a:b).toString();
    const load1=loadavg()[0], cpus=availableParallelism();
    return {atMs:Date.now(),hidIdleNs,load1,cpus,loadPerCpu:load1/cpus};
  } catch { return {atMs:Date.now(),error:'Aggregate host activity unavailable'}; }
}

export function validSample(s) {
  return s && Number.isSafeInteger(s.atMs) && typeof s.hidIdleNs==='string' && /^\d+$/.test(s.hidIdleNs) &&
    Number.isFinite(Number(s.hidIdleNs)) && Number.isFinite(s.load1) && s.load1>=0 &&
    Number.isInteger(s.cpus) && s.cpus>0 && s.loadPerCpu===s.load1/s.cpus;
}

export const quiet = s => validSample(s) && Number(s.hidIdleNs)/1e6>=admission.idleMs && s.loadPerCpu<admission.maximumLoadPerCpu;

export function observationIssues(start, samples) {
  const reasons = new Set();
  if (!quiet(start)) reasons.add('host busy or unavailable at timing admission');
  if (!samples.length) reasons.add('no final sample');
  let previous=start;
  for (const sample of samples) {
    if (!validSample(sample)) reasons.add('host sample unavailable');
    else {
      if (sample.loadPerCpu>=admission.maximumLoadPerCpu) reasons.add('heavy load during timing');
      if (sample.atMs-Number(sample.hidIdleNs)/1e6>=start.atMs) reasons.add('input occurred during timing');
    }
    if (sample.atMs<previous.atMs || sample.atMs-previous.atMs>admission.maxSampleGapMs) reasons.add('incomplete timing coverage');
    previous=sample;
  }
  return [...reasons];
}

export async function waitForQuiet(onSample,{sample=sampleHost,wait=sleep,monotonic=()=>performance.now()}={}) {
  const start=monotonic();
  for (;;) {
    const value=sample();
    onSample(value);
    const remaining=admission.maxWaitMs-(monotonic()-start);
    if (quiet(value) || remaining<=0) return value;
    await wait(Math.min(admission.pollMs,remaining));
  }
}

export function requireCleanObservation(record,frames) {
  assert.equal(record?.schema,1,'Missing Android timing admission');
  assert.equal(record.kind,'primary');
  assert.equal(record.verdict,'passed');
  assert.equal(record.numericVerdict,'passed');
  assert.deepEqual(record.policy,admission);
  assert.equal(record.frameSha256,hash(JSON.stringify(frames)),'Android admission belongs to different trials');
  assert.ok(record.wait.length && record.samples.length,'Missing Android timing samples');
  assert.deepEqual(record.start,record.wait.at(-1));
  assert.deepEqual(observationIssues(record.start,record.samples),[],'Contaminated Android timing');
}

export function requireObservedSource(timing,receipt) {
  requireCleanObservation(timing?.admission,timing.frameBudget);
  const identity=timing.admission.identity;
  assert.match(identity.tree,/^[a-f0-9]{40}$/);
  assert.match(identity.attempt,uid);
  assert.match(identity.entryManifestSha256,/^[a-f0-9]{64}$/);
  assert.equal(identity.entryManifestSha256,timing.entryManifestSha256);
  if (timing.result==='timing measured') {
    assert.equal(identity.tree,receipt.tree);
    assert.equal(identity.attempt,receipt.id);
    assert.equal(identity.apkSha256,timing.apkSha256);
  }
}

function budgetVerdict(frames,limits) {
  for (const name of ['press','scroll']) {
    const result=frames[name];
    assert.deepEqual(result,summarizeTrials(result.trials));
    for (const [index,trial] of result.trials.entries()) {
      assert.ok(Number.isInteger(trial.frames) && trial.frames>=15 && Number.isInteger(trial.inputs) && trial.inputs>=5);
      enforceBudget(trial,limits[name],name+' trial '+(index+1));
    }
    enforceBudget(result,limits[name],name+' median');
  }
}

function save(path,record) {
  const temporary=path+'.'+randomUUID()+'.tmp';
  writeFileSync(temporary,JSON.stringify(record,null,2)+'\n',{flag:'wx',mode:0o600});
  renameSync(temporary,path);
}

export function claimDiagnostic(common,record) {
  if (!common || !record.identity.attempt || record.kind!=='primary' || record.numericVerdict!=='failed' ||
      ![record.start,...record.samples].some(s=>validSample(s) && s.loadPerCpu>=admission.maximumLoadPerCpu)) return false;
  const {tree,entryManifestSha256,attempt}=record.identity;
  assert.match(tree,/^[a-f0-9]{40}$/);assert.match(entryManifestSha256,/^[a-f0-9]{64}$/);assert.match(attempt,uid);
  const path=join(common,'uld-delivery','android-timing-diagnostics',tree+'-'+entryManifestSha256+'.json');
  mkdirSync(dirname(path),{recursive:true});
  try { writeFileSync(path,JSON.stringify({tree,entryManifestSha256,attempt,claimedAt:new Date().toISOString()}),{flag:'wx',mode:0o600}); }
  catch (error) { if (error.code==='EEXIST') return false; throw error; }
  return true;
}

export async function measureAdmitted({reports,identity,common,limits,measure},options={}) {
  const sample=options.sample??sampleHost;
  async function run(folder,kind) {
    mkdirSync(folder,{recursive:true});
    const path=join(folder,'timing-admission.json');
    const report={schema:1,kind,identity,policy:admission,wait:[],samples:[],verdict:'pending'};
    // The file is updated after every sample, including during a partial or interrupted measurement.
    const retained=common && identity.attempt ? join(common,'uld-receipts','attempts',identity.attempt+'-evidence','android','low-end',
      ...(kind==='primary'?[]:['timing-diagnostic']),'timing-admission.json') : null;
    if (retained) mkdirSync(dirname(retained),{recursive:true});
    const persist=()=>{save(path,report);if(retained) save(retained,report);};
    const start=await waitForQuiet(value=>{report.wait.push(value);persist();},options);
    report.start=start;persist();
    const tick=()=>{report.samples.push(sample());persist();};
    const clock=setInterval(tick,admission.pollMs);
    let frames,error;
    try {
      frames=await measure(folder);
      report.frameSha256=hash(JSON.stringify(frames));
      budgetVerdict(frames,limits);
      report.numericVerdict='passed';
    } catch (cause) {
      error=cause;
      report.numericVerdict=cause.code==='android/frame-budget'?'failed':'unavailable';
      report.error=String(cause.message);
    } finally {
      clearInterval(clock);
      tick();
      report.issues=observationIssues(start,report.samples);
      report.verdict=error || report.issues.length?'failed':'passed';
      persist();
    }
    return {frames,error,report};
  }
  const primary=await run(reports,'primary');
  if (claimDiagnostic(common,primary.report)) {
    // Diagnostics have independent trial paths and never produce a reusable receipt.
    try { await run(join(reports,'timing-diagnostic'),'diagnostic-only'); }
    catch (error) { writeFileSync(join(reports,'timing-diagnostic-error.txt'),String(error.message)+'\n',{flag:'wx'}); }
  }
  if (primary.error) throw primary.error;
  if (primary.report.issues.length) throw Error('Contaminated Android timing: '+primary.report.issues.join(', ')+
    '. See '+join(reports,'timing-admission.json'));
  requireCleanObservation(primary.report,primary.frames);
  return primary.frames;
}

export function observedIdentity(root,common,apkIdentity) {
  const tree=execFileSync('git',['rev-parse','--verify','HEAD^{tree}'],{cwd:root,encoding:'utf8'}).trim();
  const attempt=process.env.ULD_ANDROID_TIMING_ATTEMPT ?? null;
  if (attempt) {
    assert.match(attempt,uid);
    const receipt=json(join(common,'uld-receipts','attempts',attempt+'.json'));
    assert.equal(receipt.tree,tree);assert.equal(receipt.id,attempt);assert.equal(receipt.status,'running');
    return {tree,attempt,commit:receipt.commit,base:receipt.base,...apkIdentity};
  }
  return {tree,attempt,...apkIdentity};
}
