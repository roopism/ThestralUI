import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { admission, claimDiagnostic, measureAdmitted, observationIssues, quiet, requireCleanObservation, waitForQuiet } from '../android-host-activity.mjs';
import { summarizeTrials } from '../../../tests/android/frame-budget.mjs';
import { timingForIdenticalApk } from '../android-timing-reuse.mjs';

const time=1800000000000;
const sample=(atMs=time,idle=120000,load1=1,cpus=8)=>({atMs,hidIdleNs:String(idle*1e6),load1,cpus,loadPerCpu:load1/cpus});
const metrics={frames:30,inputs:10,p95FrameMs:10,deadlineMissFraction:0,p95InputToCommitMs:12};
const frames=t=>({press:summarizeTrials([metrics,metrics,metrics]),scroll:summarizeTrials([t,metrics,metrics])});
const limit={p95FrameMs:15,deadlineMissFraction:0.1,p95InputToCommitMs:20};
const limits={press:limit,scroll:limit};
const identity={tree:'1'.repeat(40),apkSha256:'a'.repeat(64),entryManifestSha256:'a'.repeat(64),attempt:randomUUID()};
const read=file=>JSON.parse(readFileSync(file,'utf8'));
function fixture(t) {
  const common=mkdtempSync(join(tmpdir(),'android-host-activity-test-'));
  t.after(()=>rmSync(common,{recursive:true,force:true}));
  return {common,reports:join(common,'reports'),limits,identity};
}

test('Android host admission waits at most twenty minutes and identifies input, load and missing observations',async()=>{
  assert.ok(quiet(sample()));assert.ok(!quiet(sample(time,59000)));assert.ok(!quiet(sample(time,120000,8)));
  let elapsed=0,count=0;
  const start=await waitForQuiet(()=>{count++;},{sample:()=>sample(time+elapsed,0,8),
    monotonic:()=>elapsed,wait:async ms=>{elapsed+=ms;}});
  assert.equal(elapsed,20*60*1000);assert.equal(count,241);assert.ok(!quiet(start));
  assert.deepEqual(observationIssues(sample(),[sample(time+5000)]),[]);
  assert.ok(observationIssues(sample(),[sample(time+5000,100)]).includes('input occurred during timing'));
  assert.ok(observationIssues(sample(),[sample(time+5000,120000,8)]).includes('heavy load during timing'));
  assert.ok(observationIssues(sample(),[sample(time+admission.maxSampleGapMs+1)]).includes('incomplete timing coverage'));
  assert.ok(observationIssues(sample(),[{atMs:time+1000,error:'unavailable'}]).includes('host sample unavailable'));
});

test('Android timing retains all trials and one contention diagnostic cannot replace the original failure',async t=>{
  const f=fixture(t),good=frames(metrics),bad=frames({...metrics,p95InputToCommitMs:22});
  const samples=[sample(),sample(time+2000,120000,12),sample(time+3000),sample(time+5000)];
  const visited=[];
  const measure=async reports=>{
    visited.push(reports);const value=visited.length===1?bad:good;
    writeFileSync(join(reports,'frame-measurements.json'),JSON.stringify(value));
    return value;
  };
  await assert.rejects(measureAdmitted({...f,measure},{sample:()=>samples.shift()}),/exceeds 20/);
  const primary=read(join(f.reports,'timing-admission.json')), diagnostic=read(join(f.reports,'timing-diagnostic/timing-admission.json'));
  assert.equal(primary.verdict,'failed');assert.equal(diagnostic.kind,'diagnostic-only');assert.equal(diagnostic.verdict,'passed');
  assert.equal(claimDiagnostic(f.common,primary),false);
  assert.equal(claimDiagnostic(f.common,{...primary,identity:{...identity,attempt:randomUUID()}}),false);
  assert.equal(claimDiagnostic(f.common,{...primary,samples:[sample(time+1000,0)]}),false);
  assert.deepEqual(read(join(f.reports,'frame-measurements.json')),bad);
  assert.deepEqual(read(join(visited[1],'frame-measurements.json')),good);
  assert.deepEqual(read(join(f.common,'uld-receipts/attempts',identity.attempt+'-evidence/android/low-end/timing-admission.json')),primary);
  assert.throws(()=>requireCleanObservation(diagnostic,good));assert.throws(()=>requireCleanObservation(primary,bad));
  const clean=[sample(),sample(time+3000)];
  const other=join(f.common,'ordinary-pass');
  assert.deepEqual(await measureAdmitted({...f,reports:other,measure:async()=>good},{sample:()=>clean.shift()}),good);
  const proof=read(join(other,'timing-admission.json'));requireCleanObservation(proof,good);
  assert.throws(()=>requireCleanObservation(proof,bad));
  const recent=[sample(),sample(time+500,0)];
  await assert.rejects(measureAdmitted({...f,reports:join(f.common,'active'),measure:async()=>good},
    {sample:()=>recent.shift()}),/Contaminated|failed/);
  const base=identity.tree,apkSha256=identity.apkSha256, source={id:identity.attempt,tree:base,status:'passed',mode:'qualification',androidHostActivityPolicy:1,
    androidTiming:{result:'timing measured',apkSha256,entryManifestSha256:identity.entryManifestSha256,admission:proof,frameBudget:good}};
  assert.deepEqual(timingForIdenticalApk(source,base,apkSha256,limits),good);
  assert.equal(timingForIdenticalApk({...source,androidTiming:{...source.androidTiming,admission:primary}},base,apkSha256,limits),undefined);
  assert.equal(timingForIdenticalApk({...source,androidTiming:{...source.androidTiming,admission:null}},base,apkSha256,limits),undefined);
});
