import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { requireObservedSource } from './android-host-activity.mjs';
import { enforceBudget, summarizeTrials } from '../../tests/android/frame-budget.mjs';
import { legacyFrameReport, pairedProtocolSha256 } from './timing/strategy.mjs';
import { readTimingConfig } from './timing/config-policy.mjs';
import { hostMismatch } from './timing/host.mjs';
import { evaluatePairs } from './timing/paired-ab.mjs';

const hash = /^[a-f0-9]{64}$/;
export const apkDigest = bytes => createHash('sha256').update(bytes).digest('hex');

export function apkIdentity(apk) {
  const script = fileURLToPath(new URL('./apk-identity.py', import.meta.url));
  return JSON.parse(execFileSync('python3', [script, apk], { encoding: 'utf8' }));
}

// The original integration receipt predates entry manifests. Verify its retained
// signed APK against the recorded file digest before deriving the missing hash.
function baseManifest(receipt, common) {
  const source = receipt?.androidTiming;
  if (source?.entryManifestSha256) return source.entryManifestSha256;
  if (receipt?.status !== 'passed' || receipt.mode !== 'incumbent' || !receipt.androidReport) return;
  const apk = join(common, dirname(receipt.androidReport), 'android/apk/app-release.apk');
  if (!existsSync(apk)) return;
  const identity = apkIdentity(apk);
  if (identity.apkSha256 === source?.apkSha256) return identity.entryManifestSha256;
}

function pairedReplay(report, config, limits) {
  assert.equal(report?.strategy, 'paired-ab', 'Missing paired timing report');
  assert.equal(report.protocolSha256, pairedProtocolSha256(), 'Paired timing uses another measurement protocol');
  assert.deepEqual(report.config, config, 'Paired timing configuration differs from the required protocol');
  const result = evaluatePairs({ trials: report.trials, journeys: ['press', 'scroll'], limits, config });
  assert.equal(result.verdict, 'pass', 'Paired timing replay: ' + result.reason);
  assert.equal(report.verdict, result.verdict, 'Paired timing verdict differs from replay');
  assert.equal(report.reason, result.reason, 'Paired timing reason differs from replay');
  assert.deepEqual(report.evidence, result.evidence, 'Paired timing evidence differs from replay');
  return legacyFrameReport(report, limits);
}

export function requirePairedReference(budgets, config) {
  const reference = budgets.reference.paired;
  assert.ok(reference, 'Missing same-device paired timing calibration');
  assert.equal(hostMismatch(budgets.reference, reference.facts), null, 'Paired calibration uses another timing host');
  assert.match(reference.base?.tree ?? '', /^[a-f0-9]{40}$/, 'Missing paired calibration tree');
  assert.match(reference.base.apkSha256 ?? '', hash, 'Missing paired calibration APK');
  assert.match(reference.base.entryManifestSha256 ?? '', hash, 'Missing paired calibration manifest');
  assert.deepEqual(reference.base, reference.candidate, 'Paired calibration requires the same reference app in both arms');
  pairedReplay(reference, config, budgets.limits);
  for (const [journey, fields] of Object.entries(budgets.limits)) {
    for (const [metric, limit] of Object.entries(fields)) {
      const median = reference.evidence.comparisons[journey][metric].baseMedian;
      const ceiling = metric === 'deadlineMissFraction' ? median + budgets.allowance.missFractionIncrease
        : median * (1 + budgets.allowance.timingFraction);
      assert.ok(limit <= Number(ceiling.toFixed(6)), 'Limit exceeds paired calibration for ' + journey + '.' + metric);
    }
  }
}

export function requirePairedMeasurement(timing, tree, baseTree, low, config, budgets) {
  requirePairedReference(budgets, config);
  const report = timing.strategyReport;
  assert.ok(report, 'Missing paired timing report for the measured application');
  assert.deepEqual(JSON.parse(readFileSync(join(low, 'timing/strategy-result.json'))), report, 'Retained paired timing report differs');
  assert.equal(timing.baseTree, baseTree, 'Paired timing uses another integration tree');
  const arms = [
    ['base', baseTree, timing.baseApkSha256, timing.baseEntryManifestSha256],
    ['candidate', tree, timing.apkSha256, timing.entryManifestSha256],
  ];
  for (const [arm, expectedTree, apkSha256, entryManifestSha256] of arms) {
    assert.match(apkSha256, hash, 'Missing paired ' + arm + ' APK hash');
    assert.match(entryManifestSha256, hash, 'Missing paired ' + arm + ' manifest hash');
    assert.deepEqual(report[arm], { tree: expectedTree, apkSha256, entryManifestSha256 }, 'Paired ' + arm + ' application differs');
  }
  assert.equal(hostMismatch(budgets.reference, report.facts), null, 'Paired timing host differs from the reference');
  assert.deepEqual(pairedReplay(report, config, budgets.limits), timing.frameBudget, 'Paired timing projection differs');
}

// Historical receipts use their committed tree's protocol when replayed as evidence.
export function apkReplayForTree(root, tree) {
  const config = readTimingConfig(root, tree);
  return (receipt, baseTree, apk, limits, manifest, baseManifest) =>
    timingForIdenticalApk(receipt, baseTree, apk, limits, manifest, baseManifest, config);
}

export function timingForIdenticalApk(receipt, baseTree, apkSha256, limits, entryManifestSha256,
  baseEntryManifestSha256 = receipt?.androidTiming?.entryManifestSha256, config) {
  const source = receipt?.androidTiming;
  if (receipt?.tree !== baseTree || receipt.status !== 'passed' ||
      !['qualification', 'release', 'incumbent'].includes(receipt.mode) ||
      !hash.test(source?.apkSha256) || !hash.test(apkSha256)) return;
  const identicalFile = apkSha256 === source.apkSha256;
  const identicalEntries = hash.test(entryManifestSha256) && entryManifestSha256 === baseEntryManifestSha256;
  if (!identicalFile && !identicalEntries) return;
  try {
    const report = source.strategyReport;
    const strategy = config?.active['android-low-end'] ?? 'absolute';
    if (strategy !== (report?.strategy ?? 'absolute')) return;
    if (report && (report.verdict !== 'pass' || !['absolute', 'paired-ab'].includes(report.strategy))) return;
    if (report?.strategy === 'paired-ab' &&
        !isDeepStrictEqual(pairedReplay(report, config, limits), source.frameBudget)) return;
    if (receipt.androidHostActivityPolicy===1 && !['timing measured','timing reused: identical app'].includes(source.result)) return;
    if (source.admission || receipt.androidHostActivityPolicy===1 && source.result==='timing measured')
      requireObservedSource(source,receipt);
    for (const journey of ['press', 'scroll']) {
      const recorded = source.frameBudget[journey];
      if (!recorded.trials.every(trial => Number.isInteger(trial.frames) && trial.frames >= 15 &&
          Number.isInteger(trial.inputs) && trial.inputs >= 5)) return;
      const measured = summarizeTrials(recorded.trials);
      if (!isDeepStrictEqual(recorded, measured)) return;
      for (const trial of [...recorded.trials, measured])
        enforceBudget(trial, limits[journey], journey);
    }
  } catch {
    return;
  }
  return source.frameBudget;
}

export async function androidTiming({ apk, common, root, limits, measure, strategy, config, comparisonApp, fresh = false }) {
  const identity = apkIdentity(apk);
  let comparison = { ...identity, baseApkSha256: null, baseEntryManifestSha256: null };
  let budgetComparisonBase;
  if (common) {
    try { ({ budgetComparisonBase } = JSON.parse(readFileSync(join(root, '.git/gate-selection.json')))); }
    catch (error) { if (!['ENOENT', 'ENOTDIR'].includes(error.code)) throw error; }
  }
  if (budgetComparisonBase) {
    const baseTree = execFileSync('git', ['rev-parse', '--verify', '--end-of-options', budgetComparisonBase + '^{tree}'],
      { cwd: root, encoding: 'utf8' }).trim();
    const sourceReceipt = 'uld-receipts/' + baseTree + '.json';
    let source;
    try { source = JSON.parse(readFileSync(join(common, sourceReceipt))); }
    catch (error) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error; }
    const baseEntryManifestSha256 = source?.androidTiming?.apkSha256 === identity.apkSha256
      ? identity.entryManifestSha256 : baseManifest(source, common) ?? null;
    comparison = { ...identity, baseTree, baseApkSha256: source?.androidTiming?.apkSha256 ?? null, baseEntryManifestSha256 };
    const frameBudget = timingForIdenticalApk(source, baseTree, identity.apkSha256, limits,
      identity.entryManifestSha256, baseEntryManifestSha256, config);
    // A paired receipt compares its two original trees. A new proposal needs its own pair.
    if (!fresh && !comparisonApp && frameBudget && (!strategy || (source.androidTiming.strategyReport?.strategy ?? 'absolute') === strategy)) return { result: 'timing reused: identical app', ...comparison, sourceReceipt,
      measuredReceipt: source.androidTiming.measuredReceipt ?? sourceReceipt, admission:source.androidTiming.admission ?? null, strategyReport: source.androidTiming.strategyReport, frameBudget };
  }
  if (comparisonApp) {
    comparison = { ...comparison, baseTree: comparisonApp.tree, baseApkSha256: comparisonApp.apkSha256,
      baseEntryManifestSha256: comparisonApp.entryManifestSha256 };
  }
  return { result: 'timing measured', ...comparison, frameBudget: await measure(identity) };
}
