import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { proposalDevices, proposalScope } from '../selection/proposal-devices.mjs';

export const deviceSuites = ['iPhone Simulator', 'Android standard and low-end'];

export function scopedSkip(receipt, row) {
  return receipt?.mode === 'qualification' && receipt.noReuse === false && receipt.devicePlan?.run === false &&
    receipt.scope?.iphone === false && deviceSuites.includes(row?.name) &&
    row.result === 'web-only' && row.reason === receipt.devicePlan.reason;
}

export function verifiedDevicePlan(root, base, tree, receipt) {
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
  const plan = proposalDevices(root, base, tree, receipt.mode !== 'qualification' || receipt.noReuse);
  assert.deepEqual(receipt.devicePlan, plan, 'Device decision differs from the integration-to-proposal diff');
  assert.deepEqual(receipt.scope, proposalScope(root, base, tree, plan));
  return plan.run ? 'measured' : 'scoped';
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
