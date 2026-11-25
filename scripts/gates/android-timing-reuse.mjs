import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { enforceBudget, summarizeTrials } from '../../tests/android/frame-budget.mjs';

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

export function timingForIdenticalApk(receipt, baseTree, apkSha256, limits, entryManifestSha256,
  baseEntryManifestSha256 = receipt?.androidTiming?.entryManifestSha256) {
  const source = receipt?.androidTiming;
  if (receipt?.tree !== baseTree || receipt.status !== 'passed' ||
      !['qualification', 'release', 'incumbent'].includes(receipt.mode) ||
      !hash.test(source?.apkSha256) || !hash.test(apkSha256)) return;
  const identicalFile = apkSha256 === source.apkSha256;
  const identicalEntries = hash.test(entryManifestSha256) && entryManifestSha256 === baseEntryManifestSha256;
  if (!identicalFile && !identicalEntries) return;
  try {
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

export async function androidTiming({ apk, common, root, limits, measure }) {
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
      identity.entryManifestSha256, baseEntryManifestSha256);
    if (frameBudget) return { result: 'timing reused: identical app', ...comparison, sourceReceipt,
      measuredReceipt: source.androidTiming.measuredReceipt ?? sourceReceipt, frameBudget };
  }
  return { result: 'timing measured', ...comparison, frameBudget: await measure() };
}
