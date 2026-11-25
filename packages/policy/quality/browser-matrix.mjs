import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { checkMatrix } from './integrity.mjs';
import { browserCaseOwners, discoverShards } from './browser-shards.mjs';
import { loadManifests } from '../../../scripts/manifests/generate.mjs';

export function cases(suites, parents = []) {
  return suites.flatMap((suite) => {
    const path = [...parents, suite.title];
    return [
      ...(suite.specs ?? []).flatMap((spec) =>
        spec.tests.map((test) => ({
          name: [test.projectName, ...path, spec.title].join(' | '),
          test,
        })),
      ),
      ...cases(suite.suites ?? [], path),
    ];
  });
}
export function validateBrowser(report, baseline) {
  assert.equal(report.errors?.length, 0, 'Playwright collection/execution errors');
  const rows = cases(report.suites);
  assert.deepEqual(
    rows.map((r) => r.name).sort(),
    baseline.cases,
    'Required cases changed. Review missing or newly discovered tests and regenerate the matrix.',
  );
  checkMatrix(
    baseline.projects.map((engine) => {
      const items = rows.filter((row) => row.test.projectName === engine);
      return {
        engine,
        passed: items.filter(
          (r) =>
            r.test.expectedStatus === 'passed' &&
            r.test.status === 'expected' &&
            r.test.results.length === 1 &&
            r.test.results[0].status === 'passed',
        ).length,
        skipped: items.filter((r) => r.test.status === 'skipped').length,
        flaky: items.filter((r) => r.test.status === 'flaky').length,
        failed: items.filter(
          (r) =>
            r.test.status === 'unexpected' ||
            r.test.expectedStatus !== 'passed' ||
            r.test.results.length !== 1 ||
            r.test.results[0].status !== 'passed',
        ).length,
      };
    }),
    baseline.projects,
  );
  assert.equal(
    new Set(rows.map((r) => r.test.projectName)).size,
    baseline.projects.length,
    'Unregistered browser project',
  );
}
export function runBrowserReport(args, env = process.env, command = resolve('node_modules/@playwright/test/cli.js')) {
  const scratch = mkdtempSync(join(tmpdir(), 'ui-browser-report-'));
  const file = join(scratch, 'results.json');
  try {
    const result = spawnSync(process.execPath, [command, 'test', ...args, '--reporter=line,json', '--workers=1'], {
      stdio: 'inherit', env: { ...env, PLAYWRIGHT_JSON_OUTPUT_FILE: file },
    });
    if (result.status !== 0) throw Error('Browser suite failed; see the browser report above');
    return JSON.parse(readFileSync(file));
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

export function chromiumMatrix(manifest, config) {
  const full = JSON.parse(readFileSync(manifest));
  assert.ok(full.projects.includes('chromium'), 'Missing Chromium project');
  const baseline = { projects:['chromium'], cases:full.cases.filter(name => name.startsWith('chromium | ')) };
  const args = config ? ['-c', config] : [];
  const discovery = runBrowserReport([...args, '--project=chromium', '--list']);
  const kind = manifest.endsWith('/visual-matrix.json') ? 'visual' : 'browser';
  const owners = browserCaseOwners(loadManifests(process.cwd()).families, kind);
  return runBrowserShards(discovery, baseline, owners, args, runBrowserReport);
}

export function browserMatrix(manifest, config, record = false) {
  const args = config ? ['-c', config] : [];
  const report = runBrowserReport([...args, '--list']);
  if (!record) {
    const baseline = JSON.parse(readFileSync(manifest));
    const kind = manifest.endsWith('/visual-matrix.json') ? 'visual' : 'browser';
    const owners = browserCaseOwners(loadManifests(process.cwd()).families, kind);
    return runBrowserShards(report, baseline, owners, args, runBrowserReport);
  }
  const rows = cases(report.suites);
  assert.ok(rows.length && !report.errors.length, 'No complete browser inventory');
  writeFileSync(manifest, JSON.stringify({
    projects: [...new Set(rows.map(row => row.test.projectName))].sort(),
    cases: rows.map(row => row.name).sort(),
  }, null, 2) + '\n');
}

export function runBrowserShards(discovery, baseline, owners, args, run) {
  const combined = { suites: [], errors: [] };
  for (const shard of discoverShards(discovery, baseline, owners, cases)) {
    // Playwright treats CLI file arguments as regular expressions on absolute paths.
    // Anchor and quote each discovered path. Two files can have the same basename.
    const patterns = shard.files.map(file => '^' +
      resolve(discovery.config.rootDir, file).replace(/[.*+?^$\x7b\x7d()|\[\]\\]/g, '\\$&') + '$');
    const result = run([...args, '--project=' + shard.project, ...patterns]);
    validateBrowser(result, { projects: [shard.project], cases: shard.cases });
    combined.suites.push(...result.suites);
    combined.errors.push(...result.errors);
  }
  validateBrowser(combined, baseline);
  console.log('Browser matrix passed', baseline.cases.length, 'cases across', baseline.projects.length, 'engines.');
}

export function validateScenarioReport(report, ids, projects) {
  const names = cases(report.suites).map(row => row.name).sort();
  const behavior = names.filter(name => name.split(' | ')[1] === 'scenarios.spec.ts');
  assert.deepEqual(behavior, projects.flatMap(engine => ids.map(id =>
    [engine, 'scenarios.spec.ts', id].join(' | '))).sort(),
    'Every selected neutral scenario must execute in each required browser');
  validateBrowser(report, { projects, cases: names });
}

export function scenarioMatrix(families) {
  const { readScenarios } = createRequire(import.meta.url)('../../../scripts/scenarios/read.cjs');
  const ids = readScenarios(process.cwd(), families).map(s => s.id);
  assert.ok(ids.length, 'No neutral scenarios selected');
  const projects = families ? ['chromium'] : JSON.parse(readFileSync('tests/acceptance/browser-matrix.json')).projects;
  const args = ['-c', 'tests/scenarios/web/playwright.config.ts', ...projects.map(name => '--project=' + name)];
  const env = { ...process.env };
  if (families) env.ULD_SCENARIOS = families.join(',');
  else delete env.ULD_SCENARIOS;
  validateScenarioReport(runBrowserReport(args, env), ids, projects);
}
