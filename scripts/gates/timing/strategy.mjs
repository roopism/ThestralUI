import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { summarizeTrials } from '../../../tests/android/frame-budget.mjs';
import { measure as absolute } from './absolute.mjs';
import { measure as paired } from './paired-ab.mjs';
import { measure as physical } from './real-device.mjs';
import { measure as dedicated } from './dedicated-host.mjs';
import { hostMismatch } from './host.mjs';

export const timingConfig = (path = new URL('../../../tests/android/timing-strategy.json', import.meta.url)) =>
  JSON.parse(readFileSync(path, 'utf8'));
const strategies = { absolute, 'paired-ab': paired, 'real-device': physical, 'dedicated-host': dedicated };

export function pairedProtocolSha256() {
  const hash = createHash('sha256');
  for (const path of ['./paired-ab.mjs', './android.mjs', './strategy.mjs', '../../../tests/android/frame-budget.mjs',
    '../../../tests/android/FrameActivity.kt', '../../../tests/android/FrameFixture.js',
    '../../../tests/android/index.js', '../../../tests/android/profiles.json']) {
    const bytes = readFileSync(new URL(path, import.meta.url));
    hash.update(createHash('sha256').update(bytes).digest());
  }
  return hash.digest('hex');
}

export async function measure(options) {
  const { device, evidenceDir } = options;
  const config = options.config ?? timingConfig();
  const strategy = config.active['android-low-end'];
  const run = Object.hasOwn(strategies, strategy) && strategies[strategy];
  if (!run) throw Error('Unknown Android timing strategy ' + strategy);
  mkdirSync(evidenceDir, { recursive: true });
  let facts, result;
  try {
    facts = await device.hostFacts();
    const reason = hostMismatch(device.reference, facts);
    result = reason ? { verdict: 'inconclusive', reason, trials: [], evidence: {} }
      : await run({ ...options, config });
  } catch (error) {
    result = { verdict: 'inconclusive', reason: error.message, trials: [], evidence: {} };
  }
  const appIdentity = app => app && ({
    apkSha256: app.apkSha256, entryManifestSha256: app.entryManifestSha256, tree: app.tree,
  });
  const trials = result.trials.map(row => row.reports ? { ...row, reports: relative(evidenceDir, row.reports) } : row);
  const report = { ...result, trials, strategy, config, facts, base: appIdentity(options.base), candidate: appIdentity(options.candidate) };
  if (strategy === 'paired-ab') report.protocolSha256 = pairedProtocolSha256();
  writeFileSync(join(evidenceDir, 'strategy-result.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}

// The phase-5 device report has three slots per journey. Supply the first three
// candidate observations eligible under this protocol. The strategy receipt
// remains authoritative for all pairs, including contaminated and extra pairs.
export function legacyFrameReport(report, limits) {
  if (report.strategy === 'absolute') return report.evidence.frameBudget;
  if (report.verdict !== 'pass') return;
  const eligible = report.trials.filter(trial => trial.arm === 'candidate' &&
    Object.entries(limits).every(([journey, fields]) =>
      Object.entries(fields).every(([name, limit]) => trial.metrics[journey][name] <= limit)));
  const result = {};
  for (const journey of ['press', 'scroll']) {
    result[journey] = summarizeTrials(eligible.slice(0, 3).map(trial => trial.metrics[journey]));
  }
  return result;
}
