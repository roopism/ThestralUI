import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { requireCleanObservation } from '../../scripts/gates/android-host-activity.mjs';
import { requirePhysicalSeal, sealPhysical } from '../../scripts/gates/reuse/runner.mjs';
import { config, requireManagedEmulator } from './emulator.mjs';
import { androidJourneys, requireBothProfiles } from './qualification.mjs';

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
function partPath(common, identity) {
  assert.match(identity.attempt, uuid, 'Split Android verification requires a qualification attempt');
  return join(common, 'uld-receipts', 'attempts', identity.attempt + '-evidence', 'android-functional.json');
}

export function recordAndroidFunctional(common, identity, profiles, host, archives, flows, selectedIds) {
  const file = partPath(common, identity);
  requireBothProfiles(profiles);
  const expected = androidJourneys(flows);
  for (const profile of profiles) {
    requireManagedEmulator(config.profiles.find(p => p.id === profile.id), profile.name, profile.serial);
    assert.deepEqual([...profile.passed].sort(), expected, profile.id + ' did not pass every Android journey');
    assert.deepEqual([...profile.scenarioIds].sort(), [...selectedIds].sort(), profile.id + ' missed a selected native scenario');
    assert.ok(profile.hardware.fingerprint && profile.interaction.heldPixels >= 20);
    assert.equal(profile.frameBudget, undefined, 'Functional evidence unexpectedly contains timing');
  }
  const part = {id:identity.attempt, kind:'android-functional', identity, profiles, host,
    archives:archives.map(({name, sha256}) => ({name, sha256}))};
  sealPhysical(common, part);
  mkdirSync(dirname(file), {recursive:true});
  writeFileSync(file, JSON.stringify(part, null, 2) + '\n', {flag:'wx', mode:0o600});
}

export function readAndroidFunctional(common, identity) {
  const part = JSON.parse(readFileSync(partPath(common,identity), 'utf8'));
  assert.equal(part.kind, 'android-functional');
  assert.equal(part.id, identity.attempt);
  assert.deepEqual(part.identity, identity, 'Functional Android APK, tree or attempt differs');
  requirePhysicalSeal(common, part);
  requireBothProfiles(part.profiles);
  return part;
}

// Complete only the functional low-end row. The ordinary whole-suite verifier still
// checks every journey, scenario, trial and numeric limit before publishing its result.
export function requireTimingDevice(part, hardware, emulator, identity) {
  const low = part.profiles.find(profile => profile.id === 'low-end');
  assert.deepEqual(low.hardware, hardware, 'Low-end hardware changed between Android phases');
  assert.deepEqual([emulator.id, emulator.name, emulator.fingerprint], ['low-end',low.name,low.hardware.fingerprint]);
  requireManagedEmulator(config.profiles.find(p => p.id === 'low-end'), emulator.name, emulator.serial);
  assert.deepEqual(identity, {...part.identity, emulator}, 'Android timing was measured for another app or attempt');
}

export function joinAndroidTiming(common, part, hardware, emulator, timing) {
  requirePhysicalSeal(common, part);
  assert.equal(timing.result, 'timing measured');
  requireTimingDevice(part, hardware, emulator, timing.admission.identity);
  const low = part.profiles.find(profile => profile.id === 'low-end');
  assert.deepEqual([timing.apkSha256, timing.entryManifestSha256],
    [part.identity.apkSha256, part.identity.entryManifestSha256]);
  requireCleanObservation(timing.admission, timing.frameBudget);
  low.frameBudget = timing.frameBudget;
}


export async function runAndroidProfilePhase(phase, measure) {
  if (measure && phase !== '--functional') await measure();
  return phase !== '--timing';
}
