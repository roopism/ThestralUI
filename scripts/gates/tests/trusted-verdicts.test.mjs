import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const project = fileURLToPath(new URL('../../../', import.meta.url));
const helper = join(project, 'scripts/gates/verdict.mjs');

test('qualification routes every device, package and unit verdict through the trusted entry point', async () => {
  const sources = ['fast-typed.mjs', 'local-run.mjs'].map(name =>
    readFileSync(join(project, 'scripts/gates', name), 'utf8'));
  for (const [index, names] of [
    ['unit-matrix', 'verify-artifacts', 'verify-version', 'verify-inventory'],
    ['verify-consumers', 'verify-native-consumer', 'verify-ios-simulator', 'verify-android-emulator'],
  ].entries()) {
    for (const name of names) assert.ok(sources[index].includes("trustedVerdict('" + name + ".mjs')"), name);
    assert.doesNotMatch(sources[index], /['"]scripts\/(?:verify-[\w-]+|unit-matrix)\.mjs['"]/);
  }
  assert.match(readFileSync(join(project, 'scripts/verify-android-emulator.mjs'), 'utf8'),
    /requireCompletedProfiles\(profiles, flows,/);
  const { requireCompletedProfiles } = await import('../../../tests/android/qualification.mjs');
  assert.throws(() => requireCompletedProfiles([], [], [], {}), /exactly one standard and one low-end profile/);
});

test('a candidate with no verdict still runs the trusted check against its own records', async t => {
  const home = mkdtempSync(join(tmpdir(), 'uld-fictional-verdict-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const trusted = join(home, 'trusted'), candidate = join(home, 'candidate');
  mkdirSync(join(trusted, 'scripts/gates'), { recursive: true });
  mkdirSync(candidate);
  const route = join(trusted, 'scripts/gates/verdict.mjs');
  copyFileSync(helper, route);
  const { trustedVerdict } = await import(pathToFileURL(route));
  for (const file of ['verify-artifacts.mjs', 'verify-bundles.mjs', 'verify-policy.mjs', 'package-workspaces.mjs'])
    copyFileSync(join(project, 'scripts', file), join(trusted, 'scripts', file));
  for (const path of ['node_modules', 'packages', 'scripts/manifests', 'scripts/build-cache'])
    symlinkSync(join(project, path), join(trusted, path), 'dir');
  for (const path of ['tests/packaging', 'manifests/families', 'packages/almanac'])
    mkdirSync(join(candidate, path), { recursive: true });
  writeFileSync(join(candidate, 'tests/packaging/bundle-baseline.json'), '{}');
  writeFileSync(join(candidate, 'manifests/shared.json'), '{"entries":[{"pkg":"almanac","path":"./season"}]}');
  writeFileSync(join(candidate, 'packages/almanac/package.json'), '{"name":"@example/almanac"}');
  writeFileSync(join(trusted, 'scripts/verify-fiction.mjs'), [
    "import assert from 'node:assert/strict';",
    "import { readFileSync } from 'node:fs';",
    "import { join } from 'node:path';",
    "import { verdictInputRoot } from './gates/verdict.mjs';",
    "import { root } from './verify-artifacts.mjs';",
    "import { bundleImports } from './verify-bundles.mjs';",
    "assert.equal(root, process.cwd());",
    "assert.ok(bundleImports().get('@example/almanac').has('./season'));",
    "const items = JSON.parse(readFileSync(join(verdictInputRoot, 'records.json')));",
    "assert.ok(items.includes('winter'), 'missing winter record');",
  ].join('\n'));
  writeFileSync(join(trusted, 'records.json'), '["winter"]');
  const input = join(candidate, 'records.json');
  const check = () => spawnSync(process.execPath, [trustedVerdict('verify-fiction.mjs')], {
    cwd: candidate, env: { ...process.env, UI_GATE_SNAPSHOT: '1' }, encoding: 'utf8',
  });
  writeFileSync(input, '["spring"]');
  const rejected = check();
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /missing winter record/);
  writeFileSync(input, '["spring","winter"]');
  const accepted = check();
  assert.equal(accepted.status, 0, accepted.stderr);
});

test('the trusted device reader includes newly registered candidate fixtures and validates their descriptors', async t => {
  const { readCandidateScenarios } = await import('../../scenarios/fixture-metadata.mjs');
  const candidate = mkdtempSync(join(tmpdir(), 'uld-candidate-catalog-'));
  t.after(() => rmSync(candidate, { recursive: true, force: true }));
  const file = 'catalog/native/scenarios/fixtures.cjs';
  mkdirSync(join(candidate, 'catalog/native/scenarios'), { recursive: true });
  cpSync(join(project, 'docs/components'), join(candidate, 'docs/components'), { recursive: true });
  const original = readFileSync(join(project, file), 'utf8');
  const writeRegistry = renderer => writeFileSync(join(candidate, file),
    original.replace('module.exports = {', "module.exports = {\n  'calendar.winter': { label: 'Season', render: " + renderer + ' },'));
  writeRegistry('() => null');
  writeFileSync(join(candidate, 'docs/components/calendar.scenarios.yaml'), JSON.stringify({
    family: 'Calendar', scenarios: [{ id: 'calendar.winter', fixture: 'winter',
      steps: [{ expect: 'visible', target: { role: 'text', name: 'Winter' } }] }],
  }));
  assert.ok(readCandidateScenarios(candidate).some(row => row.fixtureId === 'calendar.winter'));
  writeRegistry('null');
  assert.throws(() => readCandidateScenarios(candidate), /Invalid native fixture calendar\.winter/);
});
