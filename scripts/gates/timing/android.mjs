import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { androidTree } from '../../../tests/android/interaction.mjs';
import { enforceBudget, measureFrameBudget, measureFrameTrial } from '../../../tests/android/frame-budget.mjs';
import { requirePairedReference } from '../android-timing-reuse.mjs';
import { hostFacts } from './host.mjs';
import { prepareBaseApp } from './base-app.mjs';
import { legacyFrameReport, measure, timingConfig } from './strategy.mjs';

export function measureAndroid({ common, profile, device, budgets, base, candidate, reports, config, preparationError }) {
  const tree = () => androidTree(device).nodes;
  const adapter = {
    reference: budgets.reference,
    hostFacts() {
      if (preparationError) throw Error('Could not prepare the integration APK: ' + preparationError);
      return hostFacts(common, profile, device);
    },
    measureAbsolute: () => measureFrameBudget({ device, tree, reports }),
    async measureTrial({ app, reports: trialDir }) {
      mkdirSync(trialDir, { recursive: true });
      device('install', '-r', app.apk);
      return measureFrameTrial({ device, tree, reports: trialDir });
    },
  };
  return measure({ device: adapter, journeys: ['press', 'scroll'], limits: budgets.limits, base, candidate,
    evidenceDir: join(reports, 'timing'), config });
}

export async function prepareTimingStrategy({ root, common, tools, reports }, cacheOnly = false) {
  const file = join(root, 'tests/android/timing-strategy.json');
  const config = existsSync(file) ? timingConfig(file) : { active: { 'android-low-end': 'absolute', 'mac-browser': 'absolute' } };
  if (config.active['android-low-end'] !== 'paired-ab') return { config };
  common ??= execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: root, encoding: 'utf8' }).trim();
  let base;
  try {
    base = JSON.parse(readFileSync(join(root, '.git/gate-selection.json'), 'utf8')).budgetComparisonBase;
  } catch (error) {
    if (!['ENOENT', 'ENOTDIR'].includes(error.code)) throw error;
  }
  base ??= execFileSync('git', ['--git-dir', common, 'rev-parse', 'refs/remotes/origin/feat/enterprise-ui'],
    { encoding: 'utf8' }).trim();
  const missing = () => { throw Error('The functional phase must prepare the integration APK before timing'); };
  const baseApp = await prepareBaseApp({ root, common, base, tools, reports: join(reports, 'base-build') }, cacheOnly ? missing : undefined);
  return { config, base: baseApp };
}

export async function measureTimingStrategy({ common, profile, device, budgets, strategy, apk, reports, identity }) {
  const { config, base } = strategy;
  if (config.active['android-low-end'] === 'paired-ab') requirePairedReference(budgets, config);
  const candidate = { apk, apkSha256: identity.apkSha256, entryManifestSha256: identity.entryManifestSha256, tree: identity.tree };
  let report;
  try {
    report = await measureAndroid({ common, profile, device, budgets, config, base, candidate, reports });
  } finally {
    if (config.active['android-low-end'] === 'paired-ab') device('install', '-r', apk);
  }
  if (report.verdict !== 'pass') throw Error('Android timing ' + report.verdict + ': ' + report.reason);
  const frames = legacyFrameReport(report, budgets.limits);
  writeFileSync(join(reports, 'frame-measurements.json'), JSON.stringify(frames, null, 2) + '\n');
  for (const trial of report.trials.filter(row => row.arm === 'candidate')) {
    for (const journey of ['press', 'scroll']) {
      enforceBudget(trial.metrics[journey], budgets.limits[journey], 'candidate pair ' + trial.pair + ' ' + journey);
    }
  }
  return { frames, report };
}
