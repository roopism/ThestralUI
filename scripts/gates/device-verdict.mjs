import { claimsTimingSkip, completeTimingSkip, timingSuites, verifiedTimingSkip } from './proposal-timing.mjs';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readAndroidFunctional } from '../../tests/android/split-qualification.mjs';
import { replayProposalDevices, proposalScope } from '../selection/proposal-devices.mjs';

export const deviceSuites = ['iPhone Simulator', 'Android standard and low-end'];

export function scopedSkip(receipt, row) {
  return receipt?.mode === 'qualification' && receipt.noReuse === false && receipt.devicePlan?.run === false &&
    receipt.scope?.iphone === false && deviceSuites.includes(row?.name) &&
    row.result === 'web-only' && row.reason === receipt.devicePlan.reason;
}

export function verifiedDevicePlan(root, base, tree, receipt) {
  const timingSkipped = claimsTimingSkip(receipt);
  if (timingSkipped) {
    assert.equal(receipt.devicePlan?.run, true, 'Timing skips require a full functional device plan');
    assert.deepEqual([receipt.base, receipt.tree], [base, tree]);
  }
  const path = 'scripts/selection/proposal-devices.mjs';
  if (!Object.hasOwn(receipt, 'devicePlan')) {
    // Receipts produced before adoption retain the original measured-Android protocol.
    const adopted = spawnSync('git', ['--no-replace-objects', 'cat-file', '-e', base + ':' + path],
      { cwd: root, stdio: 'ignore' });
    if (adopted.error) throw adopted.error;
    assert.notEqual(adopted.status, 0, 'Missing device plan for adopted integration base');
    return 'measured';
  }
  assert.equal(receipt.reuseSchema, 1);
  assert.equal(typeof receipt.noReuse, 'boolean');
  const plan = replayProposalDevices(root, base, tree, receipt.mode !== 'qualification' || receipt.noReuse || receipt.devicePlan?.full === true, receipt.devicePlan);
  assert.deepEqual(receipt.devicePlan, plan, 'Device decision differs from the integration-to-proposal diff');
  assert.deepEqual(receipt.scope, proposalScope(root, base, tree, plan));
  if (timingSkipped) {
    assert.ok(completeTimingSkip(receipt, verifiedTimingSkip(root, receipt)), 'Timing skip differs from the integration-to-proposal diff');
  }
  return timingSkipped ? 'gate-only timing' : plan.run ? 'measured' : 'scoped';
}

export function functionalAndroidDevices(common, identity) {
  const { profiles } = readAndroidFunctional(common, identity);
  for (const profile of profiles) {
    for (const journey of ['workspace-light', 'appearance-light', 'appearance-dark']) assert.ok(profile.passed.includes(journey), journey);
    for (const scenario of ['button.save-once', 'stack.child-order']) assert.ok(profile.scenarioIds.includes(scenario), scenario);
  }
  return profiles.map(({ id, hardware }) => ({ id, hardware }));
}

export function requireGateTimingEvidence(root, receipt) {
  assert.equal(receipt.androidHostActivityPolicy, 1);
  assert.ok(receipt.devices.iphone?.passed && receipt.vm?.browsers && receipt.vm.sourceImageSha256);
  assert.equal(receipt.gateTests?.result, 'passed');
  assert.ok(!receipt.gateTests.reusedFrom);
  for (const stage of ['mac', 'iphone', 'android', 'audit']) assert.equal(receipt.lanes[stage]?.result, 'passed');
  for (const row of receipt.suites) {
    assert.ok(Number.isFinite(row.durationMs) && row.durationMs >= 0 && !row.reusedFrom);
    if (!Object.values(timingSuites).includes(row.name)) assert.equal(row.result, 'passed', row.name);
  }
  const identity = receipt.androidFunctional;
  assert.deepEqual([identity.attempt, identity.base, identity.commit, identity.tree],
    [receipt.id, receipt.base, receipt.commit, receipt.tree]);
  const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: root, encoding: 'utf8' }).trim();
  assert.deepEqual(receipt.devices.android, functionalAndroidDevices(common, identity));
}

export function requireScopedEvidence(receipt) {
  assert.deepEqual(receipt.devices, {});
  assert.equal(receipt.androidTiming, undefined);
  assert.ok(receipt.vm?.browsers && receipt.vm?.sourceImageSha256);
  assert.equal(receipt.gateTests?.result, 'passed');
  for (const row of receipt.suites) {
    assert.ok(Number.isFinite(row.durationMs) && row.durationMs >= 0);
    if (deviceSuites.includes(row.name)) assert.ok(scopedSkip(receipt, row));
    else assert.equal(row.result, 'passed', row.name);
  }
}
