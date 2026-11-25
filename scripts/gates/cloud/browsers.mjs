import assert from 'node:assert/strict';
import { readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cases, runBrowserReport, runBrowserShards, validateScenarioReport } from '../../../packages/policy/quality/browser-matrix.mjs';
import { browserCaseOwners } from '../../../packages/policy/quality/browser-shards.mjs';
import { loadManifests } from '../../manifests/generate.mjs';

const engineNames = ['chromium', 'firefox', 'webkit'];
const suites = ['Mac browser behavior', 'Mac visual comparisons', 'Linux browser behavior'];
const scenarioReader = createRequire(import.meta.url)('../../scenarios/read.cjs');
const cli = fileURLToPath(new URL('../../../node_modules/@playwright/test/cli.js', import.meta.url));
const config = fileURLToPath(new URL('./playwright.config.ts', import.meta.url));
const matrixFile = kind => 'tests/acceptance/' + kind + '-matrix.json';

export function runEngineShard(suite, engine) {
  assert.ok(suites.includes(suite) && engineNames.includes(engine), 'Unknown browser lane');
  assert.equal(process.platform, suite === 'Linux browser behavior' ? 'linux' : 'darwin');
  assert.equal(process.arch, 'arm64');
  assert.equal(realpathSync(resolve('node_modules/@playwright/test/cli.js')), realpathSync(cli),
    'The candidate fixtures and the trusted launcher must use the same trusted Playwright installation');
  const env = { ...process.env, UI_GATE_SNAPSHOT: '1', CI: '1' };
  delete env.ULD_SCENARIOS;
  const kind = suite === 'Mac visual comparisons' ? 'visual' : 'browser';
  const full = JSON.parse(readFileSync(matrixFile(kind), 'utf8'));
  assert.deepEqual([...full.projects].sort(), engineNames);
  const baseline = { projects: [engine], cases: full.cases.filter(name => name.startsWith(engine + ' | ')) };
  const run = args => runBrowserReport([...args, '--retries=0'],
    { ...env, ULD_CLOUD_BROWSER_KIND: kind === 'visual' ? 'visual' : 'behavior' }, cli);
  const options = ['-c', config];
  const discovery = run([...options, '--project=' + engine, '--list']);
  const owners = browserCaseOwners(loadManifests(process.cwd()).families, kind);
  runBrowserShards(discovery, baseline, owners, options, run);
  const result = { cases: baseline.cases };
  if (suite === 'Linux browser behavior') {
    const ids = scenarioReader.readScenarios(process.cwd()).map(scenario => scenario.id);
    assert.ok(ids.length, 'The portable scenario roster must contain cases');
    const report = runBrowserReport(['-c', config, '--project=' + engine, '--retries=0'],
      { ...env, ULD_CLOUD_BROWSER_KIND: 'scenarios' }, cli);
    validateScenarioReport(report, ids, [engine]);
    result.scenarios = cases(report.suites).map(row => row.name).sort();
  }
  return result;
}
