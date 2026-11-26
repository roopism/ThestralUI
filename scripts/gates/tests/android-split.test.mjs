import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { requireCompletedProfiles } from '../../../tests/android/qualification.mjs';
import { abi, config, requireManagedEmulator } from '../../../tests/android/emulator.mjs';
import { joinAndroidTiming, readAndroidFunctional, recordAndroidFunctional, runAndroidProfilePhase } from '../../../tests/android/split-qualification.mjs';
import { admission } from '../android-host-activity.mjs';
import { fixtureGit, isolateFixtureProcess } from './fixtures/hermetic-git.mjs';

isolateFixtureProcess();

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'uld-split-android-'));
  t.after(() => rmSync(root, {recursive:true, force:true}));
  fixtureGit(root, ['init', '-q', '--template=']);
  const common = join(root,'.git'), hardware = {fingerprint:'fixture-low-end'};
  const flows = ['workspace.yaml','appearance.yaml'], ids = ['button.save-once','stack.child-order'];
  const profiles = config.profiles.map(profile => ({id:profile.id, hardware, serial:'emulator-5554',
    name:'uld-api' + (profile.platform ?? config.platform).slice('android-'.length).replaceAll('.','-') + '-' + profile.id + '-' + abi,
    passed:['appearance-dark','appearance-light','workspace-light'],
    scenarioIds:ids, interaction:{heldPixels:20}}));
  const identity = {attempt:randomUUID(), commit:'a'.repeat(40), base:'b'.repeat(40), tree:'c'.repeat(40),
    apkSha256:'d'.repeat(64), entryManifestSha256:'e'.repeat(64)};
  const trial = {frames:20, inputs:8, p95FrameMs:14, p95InputToCommitMs:12, deadlineMissFraction:0};
  const measurements = {...trial, frames:60, inputs:24, trials:[trial,trial,trial]};
  const frameBudget = {press:measurements,scroll:measurements}, limits = {press:trial,scroll:trial};
  const quiet = {atMs:100_000, hidIdleNs:'80000000000', load1:1, cpus:4, loadPerCpu:0.25};
  const emulator = {id:'low-end', name:profiles.find(p => p.id==='low-end').name, fingerprint:hardware.fingerprint, serial:'emulator-5556'};
  const timing = {result:'timing measured', apkSha256:identity.apkSha256, entryManifestSha256:identity.entryManifestSha256,
    frameBudget, admission:{schema:1,kind:'primary',verdict:'passed',numericVerdict:'passed',policy:admission,
      frameSha256:createHash('sha256').update(JSON.stringify(frameBudget)).digest('hex'), identity:{...identity,emulator},
      start:quiet, wait:[quiet], samples:[quiet]}};
  const save = () => recordAndroidFunctional(common,identity,profiles,{key:'host'},[],flows,ids);
  const read = () => readAndroidFunctional(common,identity);
  const validate = rows => requireCompletedProfiles(rows,flows,ids,limits);
  return {common, profiles, identity, hardware, emulator, timing, save, read, validate};
}

test('Android joins both functional profiles only with fresh timing for the same APK and attempt', t => {
  const f = fixture(t);
  assert.throws(f.read, {code:'ENOENT'});
  f.save();
  assert.throws(() => f.validate(f.read().profiles), /Missing low-end frame/);
  for (const key of ['attempt','tree','apkSha256','entryManifestSha256']) {
    const timing = structuredClone(f.timing);
    timing.admission.identity[key] = 'different';
    assert.throws(() => joinAndroidTiming(f.common,f.read(),f.hardware,f.emulator,timing), /another app or attempt/);
  }
  for (const result of ['timing failed','timing reused: identical app']) {
    assert.throws(() => joinAndroidTiming(f.common, f.read(), f.hardware, f.emulator, {...f.timing,result}));
  }
  assert.throws(() => joinAndroidTiming(f.common,f.read(),{fingerprint:'different'},f.emulator,f.timing), /hardware changed/);
  const contaminated = structuredClone(f.timing);
  contaminated.admission.samples[0].load1 = 20;
  contaminated.admission.samples[0].loadPerCpu = 5;
  assert.throws(() => joinAndroidTiming(f.common,f.read(),f.hardware,f.emulator,contaminated), /Contaminated Android timing/);
  const part = f.read();
  joinAndroidTiming(f.common,part,f.hardware,f.emulator,f.timing);
  f.validate(part.profiles);
});

test('Android functional evidence rejects missing journeys, scenarios, profiles and altered records', t => {
  const f = fixture(t);
  const saved = structuredClone(f.profiles);
  f.profiles.pop();
  assert.throws(f.save, /exactly one standard and one low-end/);
  f.profiles.push(saved[1]);
  f.profiles[0].passed.pop();
  assert.throws(f.save, /every Android journey/);
  f.profiles[0].passed = saved[0].passed;
  f.profiles[0].scenarioIds = [];
  assert.throws(f.save, /missed a selected native scenario/);
  f.profiles[0].scenarioIds = saved[0].scenarioIds;
  f.save();
  assert.throws(() => readAndroidFunctional(f.common,{...f.identity,apkSha256:'f'.repeat(64)}), /APK, tree or attempt differs/);
  const file = join(f.common,'uld-receipts','attempts',f.identity.attempt+'-evidence','android-functional.json');
  const changed = JSON.parse(readFileSync(file));
  changed.profiles[0].interaction.heldPixels++;
  writeFileSync(file,JSON.stringify(changed));
  assert.throws(f.read, /physical report changed/);
  assert.throws(() => joinAndroidTiming(f.common,changed,f.hardware,f.emulator,f.timing), /physical report changed/);
});


test('Android functional and timing phases preserve the standalone warm-up order and refuse hardware serials', async () => {
  const events = [];
  const measurement = async () => { await Promise.resolve(); events.push('timing'); };
  const journeys = () => events.push('journeys');
  for (const [phase, expected] of [[undefined,['journeys','timing','journeys']],
    ['--functional',['journeys','journeys']], ['--timing',['timing']]]) {
    events.length = 0;
    if (phase !== '--timing' && await runAndroidProfilePhase(phase)) journeys();
    if (await runAndroidProfilePhase(phase, measurement)) journeys();
    assert.deepEqual(events,expected);
  }
  assert.throws(() => requireManagedEmulator(config.profiles[0], 'uld-phone', 'AB1234'), /emulator serial/);
  assert.throws(() => requireManagedEmulator(config.profiles[0], 'unmanaged', 'emulator-5554'), /configured Android AVD/);
});
