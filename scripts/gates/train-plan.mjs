import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { proposalDevices, requireFullDevices } from '../selection/proposal-devices.mjs';
import { requirePreflight } from './preflight-receipt.mjs';
import { inspectTrain, trainGit } from './merge-train.mjs';

export function archiveTrainObject(root, ref, value) {
  const blob = execFileSync('git', ['hash-object', '-w', '--stdin'], {
    cwd: root, input: JSON.stringify(value) + '\n', encoding: 'utf8',
  }).trim();
  trainGit(root, 'update-ref', 'refs/uld-archive/' + ref, blob, '0'.repeat(40));
  return blob;
}

export async function checkedPlan(root, blob, base, commit, tree) {
  assert.match(blob, /^[a-f0-9]{40}$/);
  assert.ok(trainGit(root, 'for-each-ref', '--format=%(refname)', '--points-at', blob, 'refs/uld-archive/train-plans/'),
    'Expected a plan archived after train member checks');
  const plan = JSON.parse(trainGit(root, 'cat-file', 'blob', blob));
  assert.deepEqual([plan.base, plan.finalCommit, plan.finalTree], [base, commit, tree]);
  const rebuilt = await inspectTrain({
    root, base: () => base, member: n => plan.members.find(m => m.number === n),
    history() {}, judge() {},
  }, plan.members.map(m => m.number));
  assert.deepEqual(rebuilt, plan, 'Train plan differs from its Git stack');
  return plan;
}

// The combined diff can hide a device input changed back by a later PR.
// Use the full selector if any solo or prefix requires coverage absent from the combined selection.
export function trainScope(plan, select) {
  const combined = select(plan.base, plan.finalTree);
  const covers = scope => Object.entries(scope).every(([key, value]) => {
    if (key === 'families') return combined.families === null ||
      Array.isArray(value) && value.every(family => combined.families.includes(family));
    return typeof value === 'boolean' ? !value || combined[key] === true : combined[key] === value;
  });
  for (const m of plan.members) {
    if (!covers(select(plan.base, m.soloTree)) || !covers(select(plan.base, m.tree)) || !covers(select(m.parent, m.tree)))
      return select(plan.base, plan.finalTree, true);
  }
  return combined;
}

const trainIdFormat = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;

export function requirePlanRef(root, trainId, plan) {
  assert.match(trainId, trainIdFormat);
  assert.match(plan, /^[a-f0-9]{40}$/);
  assert.equal(trainGit(root, 'rev-parse', 'refs/uld-archive/train-plans/' + trainId), plan);
}

export function bindTrainPreflight(root, receipt) {
  requirePlanRef(root, receipt.trainId, receipt.trainPlan);
  assert.match(receipt.id, trainIdFormat);
  assert.equal(receipt.status, 'passed');
  const original = 'refs/uld-archive/preflight-receipts/' + receipt.id;
  assert.deepEqual(JSON.parse(trainGit(root, 'cat-file', 'blob', original)), receipt);
  trainGit(root, 'update-ref', 'refs/uld-archive/train-preflights/' + receipt.trainId, original, '0'.repeat(40));
}

export function requireTrainPreflight(root, common, base, commit, tree, trainId) {
  assert.match(trainId, trainIdFormat);
  const sealed = JSON.parse(trainGit(root, 'cat-file', 'blob', 'refs/uld-archive/train-preflights/' + trainId));
  assert.equal(sealed.trainId, trainId);
  requirePlanRef(root, trainId, sealed.trainPlan);
  const receipt = requirePreflight(root, common, base, commit, tree, sealed.id);
  assert.deepEqual(receipt, sealed, 'The train must start from the exact sealed preflight');
  return receipt;
}

// A phone input in any solo, cumulative prefix or per-member delta requires both
// devices, their full roster and fresh timing. Retain the evidence for each comparison.
export function trainDeviceCoverage(root, plan, forceFull = requireFullDevices, classify = proposalDevices) {
  const checks = [], byRange = new Map();
  function check(kind, number, base, tree) {
    const key = base + '/' + tree;
    if (!byRange.has(key)) byRange.set(key, classify(root, base, tree, false));
    checks.push({ kind, number, base, tree, plan: byRange.get(key) });
  }
  check('combined', null, plan.base, plan.finalTree);
  for (const member of plan.members) {
    check('solo', member.number, plan.base, member.soloTree);
    check('prefix', member.number, plan.base, member.tree);
    if (member.parent !== plan.base) check('delta', member.number, member.parent, member.tree);
  }
  const all = { iphone: true, families: null }, none = { iphone: false, families: [] };
  const scope = trainScope(plan, (p, t, full) => full || byRange.get(p + '/' + t).run ? all : none);
  const run = forceFull || scope.iphone;
  return { checks, scope: run ? all : none, devicePlan: run
    ? classify(root, plan.base, plan.finalTree, true) : checks[0].plan };
}
