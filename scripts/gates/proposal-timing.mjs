import { isDeepStrictEqual } from 'node:util';
import { deviceInputs } from '../selection/device-inputs.mjs';
import { observedReason, retainedObservations } from '../selection/device-observations.mjs';
import { stagedDiff } from '../selection/staged-tree.mjs';
import { gateCode } from './landing-policy.mjs';

// These checks run outside the measured app, its build, and both timing protocols.
// Unknown gate inputs (including new fixtures and tools) require measurement.
const independentChecks = [
  /^\.githooks\/(?:pre-commit|commit-msg)$/,
  /^\.github\/(?:CODEOWNERS|gate-review\.test\.mjs|workflows\/gate-paths\.yml)$/,
  /^scripts\/gates\/(?:tests\/[\w-]+\.test\.mjs|test-roster\.json)$/,
  /^scripts\/gates\/(?:canaries|device-scope-canaries|maestro-canary|native-role-canaries|gate-path-result|no-weakening|ordered-landing)\.mjs$/,
  /^scripts\/(?:land|verify-preflight|check-api)\.mjs$/,
  /^packages\/(?:style-)?policy\/test\/[\w-]+\.test\.mjs$/,
  /^packages\/style-policy\/(?:(?:cli|css|family-fallback|jsx|native-provenance|policy|tokens)\.mjs|profiles\/(?:elevate|library)(?:\.baseline)?\.json)$/,
];

export function gateTimingSkip(receipt) {
  const changes = receipt?.devicePlan?.paths;
  if (receipt?.mode !== 'qualification' || receipt.noReuse !== false || receipt.trainPlan ||
      ![receipt.base, receipt.commit].every(id => /^[a-f0-9]{40}$/.test(id)) || receipt.base === receipt.commit ||
      receipt.devicePlan?.run !== true || receipt.scope?.iphone !== true || receipt.scope.families !== null ||
      !Array.isArray(changes) || !changes.length) return null;
  const files = [];
  for (const change of changes) {
    const path = change?.path;
    if (!['A', 'M', 'D'].includes(change?.status) || change.classification !== 'gate or tooling' ||
        typeof path !== 'string' || !gateCode(path) || !independentChecks.some(pattern => pattern.test(path))) return null;
    files.push(path);
  }
  return { result: 'skipped', reason: 'gate-only change', files };
}

// The plan describes why each file is independent. Git supplies the complete path list.
export function verifiedTimingSkip(root, receipt) {
  const skip = gateTimingSkip(receipt);
  if (!skip || !/^[a-f0-9]{40}$/.test(receipt.tree)) return null;
  try {
    const { changes } = stagedDiff(root, { parent: receipt.base, tree: receipt.tree });
    const recorded = receipt.devicePlan.paths.map(({ path, status }) => ({ path, status }));
    if (!isDeepStrictEqual(recorded, changes)) return null;
    const keys = new Set([receipt.base, receipt.tree].map(rev => deviceInputs(root, rev).key));
    for (const key of keys) {
      for (const { platforms } of retainedObservations(root, key)) {
        if (changes.some(({ path, status }) => observedReason({ android: platforms.android }, path, status))) return null;
      }
    }
  } catch {
    // An unreadable diff or observation requires both measurements.
    return null;
  }
  return skip;
}

export const timingSuites = { macPerformance: 'Mac browser performance', androidTiming: 'Android standard and low-end' };

export function claimsTimingSkip(receipt) {
  return receipt?.androidTiming?.result === 'skipped' ||
    Object.keys(timingSuites).some(stage => receipt?.lanes?.[stage]?.result === 'skipped') ||
    (Array.isArray(receipt?.suites) && receipt.suites.some(row => row?.result === 'skipped'));
}

function skippedSuite(row, skip) {
  if (!row || row.durationMs !== 0 || row.reusedFrom || row.auditRerun) return false;
  const { name, durationMs, fingerprint, reusedFrom, reuseReason, auditRerun, retries, ...outcome } = row;
  return isDeepStrictEqual(outcome, skip);
}

export function completeTimingSkip(receipt, skip) {
  return Boolean(skip && receipt.macTiming === undefined && isDeepStrictEqual(receipt.androidTiming, skip) &&
    ['mac', 'iphone', 'android', 'audit'].every(stage => receipt.lanes?.[stage]?.result === 'passed') &&
    Object.entries(receipt.lanes).every(([stage, row]) => Object.hasOwn(timingSuites, stage) || row?.result === 'passed') &&
    Object.entries(timingSuites).every(([stage, name]) =>
      isDeepStrictEqual(receipt.lanes?.[stage], skip) &&
      skippedSuite(receipt.suites?.find(row => row.name === name), skip)));
}

// An empty list is an ordinary run. A null verdict rejects an incomplete skip claim.
export function approvedTimingSuites(root, receipt) {
  if (!claimsTimingSkip(receipt)) return [];
  return completeTimingSkip(receipt, verifiedTimingSkip(root, receipt)) ? Object.values(timingSuites) : null;
}
