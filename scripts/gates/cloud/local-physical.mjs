import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deviceScope } from '../../selection/local-device.mjs';
import { withLock, releaseLocksOnSignal } from '../../workers/lock.mjs';
import { usingSimulator, withTiming } from '../../workers/resource-guard.mjs';
import { buildTypedInputs, requireTypedControls, trustedRoot } from '../typed-tools.mjs';
import { runShard } from './shard.mjs';
import { trustedVerdict } from '../verdict.mjs';
import { whileHostedIdle } from './coordinator.mjs';
import { cases, runBrowserReport, runBrowserShards } from '../../../packages/policy/quality/browser-matrix.mjs';
import { browserCaseOwners } from '../../../packages/policy/quality/browser-shards.mjs';
import { loadManifests } from '../../manifests/generate.mjs';

const run = (tool, args) => execFileSync(tool, args, { stdio: 'inherit' });
const node = (...args) => run(process.execPath, args);
const [root, base, commit, expectedTree, directory] = process.argv.slice(2);
const tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim();
assert.equal(tree, expectedTree);
requireTypedControls(root, base, commit);
const scope = deviceScope(root, base, tree, base === commit);
writeFileSync('.git/local-device-scope.json', JSON.stringify(scope));
writeFileSync('.git/gate-selection.json', JSON.stringify({ budgetComparisonBase: base }));
releaseLocksOnSignal();
const evidence = { id: randomUUID(), base, commit, tree, mode: 'qualification', status: 'running', suites: [] };
async function measure(name, operation) {
  const row = { name, result: 'failed' };
  evidence.suites.push(row);
  const start = performance.now();
  try {
    const coverage = await operation();
    if (coverage) row.coverage = coverage;
    row.result = 'passed';
  }
  finally { row.durationMs = Math.round(performance.now() - start); }
}
try {
  node(join(trustedRoot, 'scripts/gates/no-weakening.mjs'), base, tree, root);
  node(join(trustedRoot, 'scripts/gates/review/qualification-policy.mjs'), root, base, tree);
  await runShard({ suite: 'Fast' }, base, commit);
  await withLock(root, 'integration', 'Local cloud lanes ' + tree, async () => {
    await withTiming('activity', 'Prepare local lane inputs', () => {
      buildTypedInputs();
      node(trustedVerdict('verify-artifacts.mjs'), '--built-snapshot');
      node(join(trustedRoot, 'node_modules/storybook/dist/bin/dispatcher.js'), 'build', '-o', 'dist/catalog', '--disable-telemetry');
    });
    await measure('Mac visual comparisons', () => withTiming('activity', 'Local three-engine visual comparisons', () => {
      const config = 'tests/browser/motion.visual.config.ts';
      // Use the local Darwin snapshot paths and the incumbent tool and configuration.
      execFileSync('git', ['--no-replace-objects', 'diff', '--exit-code', base, commit, '--', config, 'scripts/workers/ports.mjs'], { cwd: root });
      const roster = JSON.parse(execFileSync('git', ['--no-replace-objects', 'show', commit + ':tests/acceptance/visual-matrix.json'], { cwd: root }));
      assert.deepEqual(roster.projects, ['chromium', 'firefox', 'webkit']);
      const args = ['-c', config, '--update-snapshots=none', '--retries=0'];
      const run = flags => runBrowserReport(flags, process.env, join(trustedRoot, 'node_modules/@playwright/test/cli.js'));
      const discovery = run([...args, '--list']);
      const owners = browserCaseOwners(loadManifests(process.cwd()).families, 'visual');
      const observed = [];
      runBrowserShards(discovery, roster, owners, args, flags => {
        const report = run(flags);
        observed.push(...cases(report.suites).map(row => row.name));
        return report;
      });
      return { tree, projects: roster.projects, cases: observed.sort() };
    }));
    await measure('Mac browser performance', () => usingSimulator('Mac browser performance', () => {
      const vm = execFileSync('/Applications/UTM.app/Contents/MacOS/utmctl', ['status', 'uld-linux'], { encoding: 'utf8' }).trim();
      assert.equal(vm, 'stopped', 'The project VM must already be stopped for local timing');
      const booted = JSON.parse(execFileSync('xcrun', ['simctl', 'list', 'devices', 'booted', '-j'])).devices;
      assert.equal(Object.values(booted).flat().length, 0, 'Local timing needs an idle simulator');
      return whileHostedIdle(() => node(join(trustedRoot, 'tests/browser/quality-perf.mjs')));
    }));
    await measure('Android standard and low-end', () => withLock(root, 'simulator', 'Android ' + tree, async () => {
      await withTiming('measurement', 'Android ' + tree, () =>
        whileHostedIdle(() => node(trustedVerdict('verify-android-emulator.mjs'), 'release/evidence')));
      const report = JSON.parse(readFileSync('release/evidence/android-emulator.json'));
      assert.equal(report.passed, true);
      assert.deepEqual(report.profiles.map(row => row.id).sort(), ['low-end', 'standard']);
    }));
  });
  evidence.status = 'passed';
} finally {
  if (evidence.status !== 'passed') evidence.status = 'failed';
  for (const path of ['test-results/ui-runtime', 'test-results/android-emulator', 'release/evidence']) {
    if (existsSync(path)) cpSync(path, join(directory, path), { recursive: true });
  }
  writeFileSync(join(directory, 'local.json'), JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
}
