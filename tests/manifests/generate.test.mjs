import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { generate, loadManifests, materializeCommitOutputs } from '../../scripts/manifests/generate.mjs';

test('family changes reach the inventory, registry, matrices, package surface and budget', async () => {
  const data = loadManifests();
  const button = data.families.find((row) => row.id === 'Button');
  button.inventory.api.push('.:Action');
  button.budgets.push({ name: '@ui-lazy-dev/ui-web/action#Action', bytes: 322 });
  button.entries = [{ pkg: 'web', path: './action', target: './dist/action.js' }];
  button.rootExports = [{ pkg: 'web', from: './action.js', names: ['Action'] }];
  button.cases.vitest.push('tests/action.test.tsx | announces an action');
  button.cases.visual = ['action.visual.ts | light'];
  button.cases.browser.push('action.spec.ts | submits');
  const outputs = generate(data);
  const parsed = (path) => JSON.parse(outputs.get(path));
  const moduleSource = outputs.get('docs/component-inventory.mjs');
  const inventory = await import('data:text/javascript;base64,' + Buffer.from(moduleSource).toString('base64'));
  assert.ok(inventory.families.find((family) => family.id === 'Button').api.includes('.:Action'));
  assert.ok(parsed('packages/policy/quality/api-depth/families.json').families.find((family) => family.id === 'Button').exports.includes('.:Action'));
  assert.ok(parsed('tests/acceptance/unit-matrix.json').vitest.includes('tests/action.test.tsx | announces an action'));
  for (const project of data.shared.projects) {
    assert.ok(parsed('tests/acceptance/visual-matrix.json').cases.includes(project + ' | action.visual.ts | light'));
    assert.ok(parsed('tests/acceptance/browser-matrix.json').cases.includes(project + ' | action.spec.ts | submits'));
  }
  assert.equal(parsed('tests/packaging/bundle-baseline.json')['@ui-lazy-dev/ui-web/action#Action'], 322);
  assert.equal(parsed('packages/web/package.json').exports['./action'], './dist/action.js');
  assert.ok(outputs.get('packages/web/src/index.tsx').includes("export { Action } from './action.js';"));
});

test('generation preserves package settings and existing component implementations', (t) => {
  const data = loadManifests();
  const output = generate(data);
  const read = (path) => readFileSync(path, 'utf8');
  const web = 'packages/web/package.json';
  assert.deepEqual(JSON.parse(output.get(web)).peerDependencies, JSON.parse(read(web)).peerDependencies);
  for (const pkg of ['web', 'native']) {
    const path = 'packages/' + pkg + '/src/index.tsx';
    assert.equal(output.get(path), read(path));
  }
  const fixture = mkdtempSync(join(tmpdir(), 'ui-manifest-workspaces-'));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  for (const path of [...output.keys()].filter((name) => name.startsWith('packages/') && /(?:package\.json|src\/index\.tsx)$/.test(name))) {
    mkdirSync(dirname(join(fixture, path)), { recursive: true });
    cpSync(path, join(fixture, path));
  }
  mkdirSync(join(fixture, 'packages/messages/locales'), { recursive: true });
  assert.deepEqual(generate(data, fixture), output);
  rmSync(join(fixture, 'packages/native/package.json'));
  assert.throws(() => generate(data, fixture), /Missing package manifest for native/);
});

test('two independent families cannot silently overwrite the same bundle budget', () => {
  const data = loadManifests();
  const button = data.families.find((row) => row.id === 'Button');
  data.families[0].budgets = [button.budgets[0]];
  assert.throws(() => generate(data), /Multiple manifests own @ui-lazy-dev\/ui-web#Button/);
});

test('a validator fixture replacement removes retired case names and preserves family cases', () => {
  const data = loadManifests();
  const previous = 'tests/contracts/component-specs.test.mjs | old draft validator';
  const current = 'tests/contracts/component-specs.test.mjs | a missing required section fails';
  data.shared.cases.node = [previous];
  const button = data.families.find((family) => family.id === 'Button');
  const interactions = button.cases.native;
  button.cases.node = [...(button.cases.node ?? []), 'tests/contracts/button.test.mjs | accepts its public action'];
  const familyCases = [...new Set(data.families.flatMap(family => family.cases?.node ?? []))];
  const matrix = () => JSON.parse(generate(data).get('tests/acceptance/unit-matrix.json'));
  assert.deepEqual(matrix().node, [...familyCases, previous].sort());
  data.shared.cases.node = [current];
  const updated = matrix();
  assert.deepEqual(updated.node, [...familyCases, current].sort());
  for (const interaction of interactions) assert.ok(updated.native.includes(interaction));
});

test('worker snapshots derive shared files and reject a staged output that disagrees with its manifest', t => {
  const root = mkdtempSync(join(tmpdir(), 'ui-commit-manifests-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const outputs = generate(loadManifests());
  cpSync('manifests', join(root, 'manifests'), { recursive: true });
  for (const [path, contents] of outputs) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), contents);
  }
  const path = 'manifests/families/button.json';
  const button = JSON.parse(readFileSync(join(root, path), 'utf8'));
  const identity = 'tests/button/new.test.tsx | announces the completed action';
  button.cases.vitest.push(identity);
  writeFileSync(join(root, path), JSON.stringify(button));
  const matrix = 'tests/acceptance/unit-matrix.json';
  assert.throws(() => materializeCommitOutputs(root, [path, matrix]), /Staged generated output differs/);
  materializeCommitOutputs(root, [path]);
  assert.ok(JSON.parse(readFileSync(join(root, matrix), 'utf8')).vitest.includes(identity));
  materializeCommitOutputs(root, [path, matrix]);
});
