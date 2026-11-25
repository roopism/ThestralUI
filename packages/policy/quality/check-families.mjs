import { packageWorkspaces, runtimeWorkspaces } from '../../../scripts/package-workspaces.mjs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { packedRegistrations } from './api-depth/packed-registrations.mjs';
import { measureBundles } from '../../../scripts/verify-bundles.mjs';
import { familyInputs, previousBundleFamilies } from '../../../scripts/manifests/bundle-parent.mjs';
import { checkPackedBudgetAdoption, incumbentEntries } from '../../../scripts/manifests/reviewed-bundle-budgets.mjs';
import { verifyPackedDepth } from './api-depth/run-depth.mjs';
import { scenarioMatrix, validateBrowser } from './browser-matrix.mjs';
import { auditComponentSpecs } from './specs/validate.mjs';
import { assertCases, unitCases } from './unit-matrix.mjs';

const json = path => JSON.parse(readFileSync(path, 'utf8'));
const run = (command, args, options = {}) => {
  console.log('$', command, ...args);
  return execFileSync(command, args, { stdio: 'inherit', ...options });
};

function verifyUnits(selection, reports) {
  const matrix = json('tests/acceptance/unit-matrix.json');
  for (const [kind, files, args] of [
    ['vitest', selection.unitTests, ['npm', ['run', 'test', '--', '--maxWorkers=1', '--reporter=json']]],
    ['native', selection.nativeUnitTests, ['npm', ['run', 'test:native', '--', '--json', '--runTestsByPath']]],
  ]) {
    if (!files.length) continue;
    const report = join(reports, kind + '.json');
    run(args[0], [...args[1], '--outputFile=' + report, ...files]);
    const expected = matrix[kind].filter(name => files.includes(name.split(' | ')[0]));
    assertCases(unitCases(json(report)), expected);
  }
}

function verifyChromium(selection, reports) {
  const results = join(reports, 'browser.json');
  const playwright = resolve('node_modules/@playwright/test/cli.js');
  const args = ['test', '--project=chromium', '--workers=1'];
  run(process.execPath, [playwright, ...args, '--reporter=line,json', ...selection.browserTests], {
    env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: results },
  });
  const report = json(results);
  const project = report.config.projects.find(entry => entry.name === 'chromium');
  const files = selection.browserTests.map(file => relative(project.testDir, resolve(file)));
  const cases = json('tests/acceptance/browser-matrix.json').cases.filter(name => {
    const [engine, file] = name.split(' | ');
    return engine === 'chromium' && files.includes(file);
  });
  validateBrowser(report, { cases, projects: ['chromium'] });
  if (selection.scenarioFiles.length) {
    const names = selection.scenarioFiles.map(file => basename(file, '.scenarios.yaml'));
    scenarioMatrix(names);
  }
}

function installCandidate(reports, native) {
  const consumer = join(reports, 'consumer');
  mkdirSync(consumer);
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ private: true }));
  if (native) run(process.execPath, ['scripts/verify-artifacts.mjs']);
  const packages = runtimeWorkspaces(packageWorkspaces(process.cwd()), ['@ui-lazy-dev/ui-web', '@ui-lazy-dev/ui-native']);
  for (const { manifest: pkg, directory } of packages.values()) {
    const destination = join(consumer, 'node_modules', pkg.name);
    mkdirSync(destination, { recursive: true });
    const [archive] = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json',
      '--pack-destination', reports], { cwd: directory, encoding: 'utf8' }));
    run('tar', ['-xzf', join(reports, archive.filename), '--strip-components', '1', '-C', destination]);
  }
  return consumer;
}

export async function checkFamilies(selection) {
  assert.ok(selection.families.length && selection.unitTests.length && selection.browserTests.length,
    'An empty family selection requires tier 2');
  const reports = resolve('test-results/affected');
  mkdirSync(reports, { recursive: true });
  run(process.execPath, ['packages/policy/cli.mjs', 'check', '--config', 'ui-policy.json']);
  run(process.execPath, ['packages/style-policy/cli.mjs', '--profile', 'library', '--root', '.']);
  run(process.execPath, ['packages/policy/quality/integrity.mjs']);
  run('npm', ['run', 'build']);
  run('npm', ['run', 'typecheck']);
  const consumer = installCandidate(reports, selection.simulator);
  const inputs = packedRegistrations(process.cwd());
  const specs = auditComponentSpecs({ consumer, families: inputs.published, selectedIds: selection.families });
  assert.deepEqual(specs.issues, [], 'Affected family specifications differ from their packed bindings');
  console.log(await verifyPackedDepth(consumer, inputs, undefined, process.cwd(), selection.families));
  const entries = [...new Set([...selection.budgetEntries, ...incumbentEntries])];
  const measurements = await measureBundles(consumer, { selectedEntries: entries });
  const current = familyInputs(process.cwd());
  checkPackedBudgetAdoption(previousBundleFamilies(process.cwd()), current, measurements);
  console.log(measurements);
  verifyUnits(selection, reports);
  verifyChromium(selection, reports);
}
