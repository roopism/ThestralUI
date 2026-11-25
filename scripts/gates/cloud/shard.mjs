import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { globSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planAt } from './plan.mjs';
import { runEngineShard } from './browsers.mjs';
import { iphonePartition, requireIphoneEvidence, selectHostedIphone } from './iphone.mjs';
import { buildTypedInputs, requireTypedControls, trustedRoot } from '../typed-tools.mjs';
import { typed } from '../fast-typed.mjs';
import { trustedVerdict } from '../verdict.mjs';
import { packedDepth, checkNewBudgets } from '../../../packages/policy/quality/check-staged.mjs';
import { verifyPackedCeiling } from '../../../packages/policy/quality/size-ceiling.mjs';
import { cases, runBrowserReport, validateScenarioReport } from '../../../packages/policy/quality/browser-matrix.mjs';
import { readCandidateScenarios } from '../../scenarios/fixture-metadata.mjs';
import { generate, loadManifests } from '../../manifests/generate.mjs';
import reader from '../../scenarios/read.cjs';

const node = (...args) => execFileSync(process.execPath, args, { stdio: 'inherit' });
const control = path => join(trustedRoot, path);
const json = path => JSON.parse(readFileSync(path));
const playwright = control('node_modules/@playwright/test/cli.js');
const config = fileURLToPath(new URL('./playwright.config.ts', import.meta.url));
const root = process.cwd();
function catalog() {
  buildTypedInputs();
  node(control('node_modules/storybook/dist/bin/dispatcher.js'), 'build', '-o', 'dist/catalog', '--disable-telemetry');
}
function packages() {
  buildTypedInputs();
  node(trustedVerdict('verify-artifacts.mjs'), '--built-snapshot');
}
function listBrowserCases() {
  for (const [kind, file] of [['behavior', 'browser'], ['visual', 'visual']]) {
    const report = runBrowserReport(['-c', config, '--list'], { ...process.env, ULD_CLOUD_BROWSER_KIND: kind }, playwright);
    const baseline = json('tests/acceptance/' + file + '-matrix.json');
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.config.projects.map(project => project.name).sort(), baseline.projects);
    assert.deepEqual(cases(report.suites).map(row => row.name).sort(), baseline.cases);
  }
}
export async function runShard(shard, base, merge) {
  requireTypedControls(root, base, merge);
  const evidence = 'release/evidence';
  switch (shard.suite) {
    case 'No weakening': {
      node(control('scripts/gates/review/qualification-policy.mjs'), root, base, merge);
      node(control('scripts/gates/no-weakening.mjs'), base, merge, root);
      node(control('scripts/gates/canaries.mjs'), merge);
      node(control('scripts/gates/device-scope-canaries.mjs'), merge);
      node(control('scripts/gates/maestro-canary.mjs'), '--offline');
      const tests = globSync('scripts/gates/tests/*.test.mjs', { cwd: trustedRoot }).sort();
      assert.ok(tests.includes('scripts/gates/tests/hardening.test.mjs'));
      node('--test', ...tests.map(control));
      break;
    }
    case 'Fast':
      node(control('packages/policy/cli.mjs'), 'check', '--config', 'ui-policy.json');
      node(control('packages/style-policy/cli.mjs'), '--profile', 'library', '--root', '.', '--prove');
      node(control('packages/policy/quality/integrity.mjs'));
      for (const [file, generated] of generate(loadManifests(root), root)) {
        assert.equal(readFileSync(join(root, file), 'utf8'), generated, 'Generated output differs: ' + file);
      }
      break;
    case 'Typed and unit rosters': await typed(); break;
    case 'Browser and visual rosters': buildTypedInputs(); listBrowserCases(); break;
    case 'Catalog build': catalog(); break;
    case 'Packed component specifications': packages(); await packedDepth(); break;
    case 'Packed consumers min':
    case 'Packed consumers max': packages(); node(trustedVerdict('verify-consumers.mjs'), evidence, shard.suite.split(' ').at(-1)); break;
    case 'Packed bundle limits':
      packages(); node(trustedVerdict('verify-consumers.mjs'), evidence, 'max');
      await checkNewBudgets(root, base, json(evidence + '/bundles.json'));
      verifyPackedCeiling(root);
      break;
    case 'Native package consumer': packages(); node(trustedVerdict('verify-native-consumer.mjs'), evidence); break;
    case 'Mac browser behavior':
    case 'Mac visual comparisons':
    case 'Linux browser behavior': catalog(); return runEngineShard(shard.suite, shard.engine);
    case 'Portable web scenarios': {
      catalog();
      const ids = reader.readScenarios(root).map(s => s.id);
      assert.ok(ids.length);
      const report = runBrowserReport(['-c', config, '--retries=0'], { ...process.env, ULD_CLOUD_BROWSER_KIND: 'scenarios' }, playwright);
      validateScenarioReport(report, ids, ['chromium', 'firefox', 'webkit']);
      break;
    }
    case 'Scoped styles': catalog(); node(control('tests/browser/quality-style-scope.mjs')); break;
    case 'iPhone Simulator': {
      packages();
      const prepared = selectHostedIphone((...args) =>
        execFileSync('xcrun', ['simctl', ...args], { encoding: 'utf8' }));
      const devices = JSON.parse(execFileSync('xcrun', ['simctl', 'list', 'devices', 'available', '--json'])).devices;
      const phone = devices['com.apple.CoreSimulator.SimRuntime.iOS-26-2']?.find(row => row.name === 'iPhone 17' && row.isAvailable);
      assert.ok(phone, 'Pinned iPhone 17 with iOS 26.2 must exist for the shard user');
      process.env.UI_SIMULATOR_ID = phone.udid;
      assert.equal(phone.udid, prepared);
      const scope = iphonePartition(readCandidateScenarios(root), shard.shard, shard.shards);
      writeFileSync('.git/local-device-scope.json', JSON.stringify({ iphone: true, families: scope.families }));
      node(trustedVerdict('verify-ios-simulator.mjs'));
      return requireIphoneEvidence(json(evidence + '/ios-simulator.json'), scope);
    }
    default: throw Error('No hosted evaluator for ' + shard.suite);
  }
  return {};
}

if (import.meta.main) {
  const [base, merge, id, out] = process.argv.slice(2);
  const shard = planAt(root, base, merge).find(item => item.id === id);
  assert.ok(shard && shard.lane !== 'local');
  assert.equal(shard.lane, process.platform === 'darwin' ? 'github-macos' : 'github-linux');
  assert.equal(process.arch, 'arm64');
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), merge);
  writeFileSync('.git/gate-selection.json', JSON.stringify({ budgetComparisonBase: base }));
  const coverage = await runShard(shard, base, merge);
  writeFileSync(out, JSON.stringify(coverage), { flag: 'wx' });
}
