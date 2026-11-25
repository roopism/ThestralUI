import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { selectStaged } from '../../scripts/selection/select.mjs';

function repository(t) {
  // Each fixture models a local commit, even when this suite runs in pull-request CI.
  const previous = process.env.GITHUB_EVENT_NAME;
  delete process.env.GITHUB_EVENT_NAME;
  t.after(() => {
    if (previous === undefined) delete process.env.GITHUB_EVENT_NAME;
    else process.env.GITHUB_EVENT_NAME = previous;
  });
  const root = mkdtempSync(join(tmpdir(), 'family-selector-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  function write(file, contents) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), contents);
  }
  git('init', '-q', '--template=');
  git('config', 'user.name', 'ThestralUI Bot');
  git('config', 'user.email', 'thestral-ui@users.noreply.github.com');
  const names = ['Button', 'Toolbar', 'Panel', 'Avatar'];
  const exports = {};
  const budgets = {};
  const families = names.map(id => {
    const entry = id.toLowerCase();
    exports['./' + entry] = { default: './dist/' + entry + '.js' };
    budgets['@ui-lazy-dev/ui-web/' + entry] = 400;
    return { id, exports: [entry + ':' + id] };
  });
  write('packages/web/package.json', JSON.stringify({ name: '@ui-lazy-dev/ui-web', exports }));
  write('packages/web/tsconfig.json', JSON.stringify({ compilerOptions: { outDir: 'dist', rootDir: 'src' } }));
  write('packages/policy/quality/api-depth/families.json', JSON.stringify({ families }));
  write('tests/packaging/bundle-baseline.json', JSON.stringify(budgets));
  write('tsconfig.json', JSON.stringify({ compilerOptions: { paths: { '@local/*': ['./packages/web/src/*'] } } }));
  write('packages/web/src/button.ts', 'export const Button = 1;');
  write('packages/web/src/toolbar.ts', "import {Button} from './button.js'; export const Toolbar = Button;");
  write('packages/web/src/panel.ts', "export {Toolbar as Panel} from '@local/toolbar';");
  write('packages/web/src/avatar.ts', 'export const Avatar = 4;');
  for (const id of names) {
    const entry = id.toLowerCase();
    for (const suffix of ['.test.ts', '.spec.ts']) {
      const prefix = suffix === '.spec.ts' ? 'tests/browser/' : 'tests/';
      write(prefix + entry + suffix, "import {" + id + "} from '@ui-lazy-dev/ui-web/" + entry + "';\n");
    }
  }
  git('add', '.');
  git('commit', '-qm', 'Initial test fixture');
  return { root, git, write };
}

test('selects a changed family, transitive dependent families and their tests from staged imports', t => {
  const { root, git, write } = repository(t);
  write('packages/web/src/button.ts', 'export const Button = 2;');
  git('add', 'packages/web/src/button.ts');
  write('packages/web/src/toolbar.ts', 'export const Toolbar = 100;');
  write('packages/web/src/avatar.ts', "import {Button} from './button.js'; export const Avatar=Button;");
  write('tests/browser/mystery.spec.ts', 'throw Error("unstaged")');
  const result = selectStaged(root);
  assert.equal(result.tier, 1);
  assert.deepEqual(result.families, ['Button', 'Panel', 'Toolbar']);
  assert.deepEqual(result.unitTests, ['tests/button.test.ts', 'tests/panel.test.ts', 'tests/toolbar.test.ts']);
  assert.deepEqual(result.browserTests, ['tests/browser/button.spec.ts', 'tests/browser/panel.spec.ts', 'tests/browser/toolbar.spec.ts']);
  assert.deepEqual(result.packages, ['@ui-lazy-dev/ui-web']);
  assert.equal(result.budgetEntries.length, 3);
  assert.match(result.reasons.join(' '), /button\.ts/);
  assert.equal(result.tree, git('write-tree').trim());
});
for (const file of [
  'packages/tokens/tokens.json', 'packages/web/src/shared.css', '.githooks/pre-commit',
  'packages/policy/quality/check-staged.mjs', 'scripts/selection/policy.mjs', 'unknown.data',
  'tsconfig.json', 'packages/web/package.json',
]) {
  test(file + ' requires full tier 2 even alongside a known family change', t => {
    const { root, git, write } = repository(t);
    write(file, 'changed');
    write('packages/web/src/button.ts', 'export const Button = 2;');
    git('add', '.');
    const report = selectStaged(root);
    assert.equal(report.tier, 2);
    assert.ok(report.reasons.some(reason => reason.includes(file)));
  });
}
test('removing or renaming a module considers its old path', t => {
  const {root, git} = repository(t);
  git('mv', 'packages/web/src/button.ts', 'packages/web/src/new-button.ts');
  assert.equal(selectStaged(root).tier, 2);
  assert.ok(selectStaged(root).reasons.some(reason => reason.includes('button.ts')));
});
test('unresolved computed local imports force broad coverage', t => {
  const { root, git, write } = repository(t);
  write('packages/web/src/toolbar.ts', 'export const Toolbar = (name: string) => import(name);');
  git('add', '.');
  assert.equal(selectStaged(root).tier, 2);
});
test('an opaque asset glob in production cannot conceal an edge', t => {
  const { root, git, write } = repository(t);
  write('packages/web/src/toolbar.ts', "export const Toolbar = import.meta.glob('./*.ts');");
  git('add', '.');
  assert.equal(selectStaged(root).tier, 2);
});

test('type-only import queries propagate changes to dependent families', t => {
  const { root, git, write } = repository(t);
  write('packages/web/src/toolbar.ts', "export type Toolbar = typeof import('./button.js').Button;");
  git('add', '.');
  git('commit', '-qm', 'Use type-level dependency');
  write('packages/web/src/button.ts', 'export const Button = 2;');
  git('add', '.');
  const result = selectStaged(root);
  assert.deepEqual(result.families, ['Button', 'Panel', 'Toolbar']);
});

test('staged browser fixtures with a known story route are selected through their story imports', t => {
  const { root, git, write } = repository(t);
  write('catalog/Preview.stories.tsx', "import {Avatar} from '@ui-lazy-dev/ui-web/avatar'; export default {title:'Media/Preview'}; export const Preview = Avatar;");
  write('tests/browser/story.spec.ts', "const url='/iframe.html?id=media-preview--preview'; page.goto(url);");
  git('add', '.');
  git('commit', '-qm', 'Add preview journey');
  write('packages/web/src/avatar.ts', 'export const Avatar = 8;');
  git('add', '.');
  assert.ok(selectStaged(root).browserTests.includes('tests/browser/story.spec.ts'));
  git('reset', '-q', 'HEAD');
  write('packages/web/src/button.ts', 'export const Button = 8;');
  git('add', 'packages/web/src/button.ts');
  assert.ok(!selectStaged(root).browserTests.includes('tests/browser/story.spec.ts'));
});

test('a novel production file with no public route forces full tier 2', t => {
  const { root, git, write } = repository(t);
  write('packages/web/src/unmapped.ts', 'export const PolicyA = 5;');
  git('add', '.');
  assert.equal(selectStaged(root).tier, 2);
});

test('the selector CLI emits JSON when the snapshot has a symlinked ancestor', t => {
  const { root, git, write } = repository(t);
  write('packages/web/src/avatar.ts', 'export const Avatar = 8;');
  git('add', 'packages/web/src/avatar.ts');
  const alias = join(root, 'snapshot-alias');
  symlinkSync(join(import.meta.dirname, '../../scripts/selection'), alias, 'junction');
  const output = execFileSync(process.execPath, [join(alias, 'select.mjs')], { cwd: root, encoding: 'utf8' });
  assert.deepEqual(JSON.parse(output).families, ['Avatar']);
});

test('portable scenario specs use their own runner and edits to it require tier 2', t => {
  const { root, git, write } = repository(t);
  const scenarioSpec = 'tests/scenarios/web/scenarios.spec.ts';
  const adapterSpec = 'tests/scenarios/web/adapter-regressions.spec.ts';
  write(scenarioSpec, "import {Avatar} from '@ui-lazy-dev/ui-web/avatar';");
  write(adapterSpec, "page.goto(getFixtureUrl());");
  git('add', '.');
  git('commit', '-qm', 'Add the dedicated scenario project');
  write('packages/web/src/avatar.ts', 'export const Avatar = 8;');
  git('add', '.');
  const result = selectStaged(root);
  assert.equal(result.tier, 1, result.reasons.join('\n'));
  assert.deepEqual(result.browserTests, ['tests/browser/avatar.spec.ts']);
  write(scenarioSpec, "import {Button} from '@ui-lazy-dev/ui-web/button';");
  git('add', scenarioSpec);
  const shared = selectStaged(root);
  assert.equal(shared.tier, 2);
  assert.ok(shared.reasons.some(reason => reason.includes(scenarioSpec)));
});

test('ordinary native changes keep their simulator journey in a scoped run', t => {
  const { root, git, write } = repository(t);
  const native = 'packages/native/src/index.ts';
  write(native, 'export const Button = 1;');
  write('packages/native/package.json', JSON.stringify({
    name: '@ui-lazy-dev/ui-native', exports: { '.': './dist/index.js' },
  }));
  write('packages/native/tsconfig.json', JSON.stringify({ compilerOptions: { outDir: 'dist', rootDir: 'src' } }));
  const registry = 'packages/policy/quality/api-depth/families.json';
  const data = JSON.parse(git('show', 'HEAD:' + registry));
  data.families[0].exports.push('native:Button');
  write(registry, JSON.stringify(data));
  write('tests/native/button.test.cjs', "const {Button} = require('@ui-lazy-dev/ui-native');");
  write('scripts/scenarios/read.cjs', "exports.readScenarios = () => [];");
  const scenarios = 'tests/native/scenarios.test.cjs';
  write(scenarios, "require('../../scripts/scenarios/read.cjs'); require('@ui-lazy-dev/ui-native');");
  git('add', '.');
  git('commit', '-qm', 'Add native fixture');
  write(native, 'export const Button = 2;');
  git('add', native);
  const result = selectStaged(root);
  assert.equal(result.tier, 1, result.reasons.join('\n'));
  assert.equal(result.simulator, true);
  assert.deepEqual(result.nativeUnitTests, ['tests/native/button.test.cjs', scenarios]);
  assert.ok(result.unitTests.includes('tests/button.test.ts'));
  git('rm', '-f', native);
  assert.equal(selectStaged(root).simulator, true);
  git('reset', '-q', 'HEAD');
  write('packages/web/src/avatar.ts', 'export const Avatar = 8;');
  git('add', 'packages/web/src/avatar.ts');
  assert.deepEqual(selectStaged(root).nativeUnitTests, []);
});

test('manifest ownership distinguishes families behind a shared barrel', t => {
  const { root, git, write } = repository(t);
  const names = ['Button', 'Toolbar', 'Panel', 'Avatar'];
  const registry = 'packages/policy/quality/api-depth/families.json';
  write(registry, JSON.stringify({families: names.map(id => ({ id, exports: ['.:' + id] }))}));
  write('packages/web/package.json', JSON.stringify({
    name: '@ui-lazy-dev/ui-web', exports: { '.': { default: './dist/index.js' } },
  }));
  write('tests/packaging/bundle-baseline.json', JSON.stringify({ '@ui-lazy-dev/ui-web': 420 }));
  write('packages/web/src/index.ts', names.map(id => "export * from './" + id.toLowerCase() + ".js';").join('\n'));
  for (const id of names) {
    const slug = id.toLowerCase();
    const path = 'packages/web/src/' + slug + '.ts';
    const unit = 'tests/' + slug + '/behavior.test.tsx';
    const browser = 'tests/browser/' + slug + '.spec.ts';
    const scenario = 'docs/components/' + slug + '.scenarios.yaml';
    write(scenario, '{}');
    write('docs/components/' + slug + '.md', id);
    write(unit, "import {" + id + "} from '../../" + path + "';");
    write(browser, "import {" + id + "} from '../../" + path + "';");
    git('rm', 'tests/' + slug + '.test.ts');
    write('manifests/families/' + slug + '.json', JSON.stringify({
      id, depth: { id }, files: { source: [path], unit: [unit], browser: [browser],
        scenario: [scenario], story: [], nativeSource: [], nativeUnit: [] },
    }));
  }
  git('add', '.');
  git('commit', '-qm', 'Share the public root');
  write('tests/avatar/web-fixtures.tsx', "import {Avatar} from '@ui-lazy-dev/ui-web';");
  git('add', 'tests/avatar/web-fixtures.tsx');
  const fixture = selectStaged(root);
  assert.deepEqual(fixture.families, ['Avatar']);
  assert.deepEqual(fixture.scenarioFiles, ['docs/components/avatar.scenarios.yaml']);
  git('reset', '-q', 'HEAD');
  write('packages/web/src/button.ts', 'export const Button = 8;');
  git('add', 'packages/web/src/button.ts');
  const result = selectStaged(root);
  assert.equal(result.tier, 1, result.reasons.join('\n'));
  assert.deepEqual(result.families, ['Button', 'Panel', 'Toolbar']);
  assert.equal(result.simulator, false);
  for (const event of ['pull_request', 'pull_request_target']) {
    process.env.GITHUB_EVENT_NAME = event;
    assert.equal(selectStaged(root).simulator, true, event + ' must include mobile checks');
  }
  assert.equal(result.unitTests.length, 3);
  assert.equal(result.browserTests.length, 3);
  assert.equal(result.scenarioFiles.length, 3);
  assert.deepEqual(result.budgetEntries, ['@ui-lazy-dev/ui-web']);
  git('reset', '-q', 'HEAD');
  write('docs/components/avatar.md', 'Change label requirements');
  git('add', 'docs/components/avatar.md');
  assert.deepEqual(selectStaged(root).families, ['Avatar']);
});

function styledRepository(t) {
  const repo = repository(t);
  const { git, write } = repo;
  const pkg = JSON.parse(git('show', 'HEAD:packages/web/package.json'));
  const budgets = JSON.parse(git('show', 'HEAD:tests/packaging/bundle-baseline.json'));
  for (const sheet of ['controls', 'primitives', 'motion']) {
    pkg.exports['./' + sheet + '.css'] = './dist/' + sheet + '.css';
    budgets['@ui-lazy-dev/ui-web/' + sheet + '.css'] = 950;
  }
  write('packages/web/package.json', JSON.stringify(pkg));
  write('tests/packaging/bundle-baseline.json', JSON.stringify(budgets));
  const style = 'packages/web/src/button/styles.css';
  const chunk = (sheet, css = '.button { color: inherit; }') => '/* @uld-css-chunk ' + sheet + '.002 */\n' + css;
  write(style, chunk('controls'));
  for (const name of ['Button', 'Toolbar', 'Panel', 'Avatar']) {
    const slug = name.toLowerCase();
    write('docs/components/' + slug + '.md', name);
    write('manifests/families/' + slug + '.json', JSON.stringify({
      id: name, depth: { representative: name }, inventory: { api: [slug + ':' + name] },
      files: { source: ['packages/web/src/' + slug + '.ts'], nativeSource: [],
        unit: ['tests/' + slug + '.test.ts'], browser: ['tests/browser/' + slug + '.spec.ts'],
        nativeUnit: [], story: [], scenario: [], style: name === 'Button' ? [style] : [] },
    }));
  }
  git('add', '.');
  git('commit', '-qm', 'Family-owned CSS chunks and manifests');
  const manifest = 'manifests/families/button.json';
  return { ...repo, manifest, style, chunk, button: JSON.parse(git('show', 'HEAD:' + manifest)) };
}

test('one code, style, scenario, collocated browser and test manifest change stays scoped', t => {
  const { root, git, write, manifest, button, style, chunk } = styledRepository(t);
  const unit = 'tests/button/behavior.test.tsx', web = 'tests/button/keyboard.spec.ts';
  const scenario = 'docs/components/button.scenarios.yaml';
  write('packages/web/src/button.ts', 'export const Button = 10;');
  write(style, chunk('primitives'));
  write(unit, "import {Button} from '@ui-lazy-dev/ui-web/button'");
  write(web, "import {Button} from '@ui-lazy-dev/ui-web/button'");
  write(scenario, '{}');
  button.files.unit.push(unit);
  button.files.browser.push(web);
  button.files.scenario.push(scenario);
  button.inventory.test = unit;
  button.cases = { vitest: [unit + ' | handles activation'], browser: ['button/keyboard.spec.ts | activates'] };
  button.depth.evidence = { unit: unit + ' | handles activation' };
  button.depth.assertions = { [unit + ' | handles activation']: 'expect(onPress).toHaveBeenCalledTimes(1)' };
  write(manifest, JSON.stringify(button));
  git('add', '.');
  // These working edits must not change the staged selection or CSS budgets.
  write(style, chunk('motion'));
  write(manifest, '{}');
  const result = selectStaged(root);
  assert.equal(result.tier, 1, result.reasons.join('\n'));
  assert.deepEqual(result.families, ['Button', 'Panel', 'Toolbar']);
  assert.deepEqual(result.budgetEntries.filter(key => key.endsWith('.css')), [
    '@ui-lazy-dev/ui-web/controls.css', '@ui-lazy-dev/ui-web/primitives.css',
  ]);
  assert.ok(result.unitTests.includes(unit) && result.browserTests.includes(web));
  assert.deepEqual(result.scenarioFiles, [scenario]);
  assert.equal(result.simulator, true);

  git('reset', '-q', 'HEAD');
  git('add', 'packages/web/src/button.ts');
  {
    const result = selectStaged(root);
    assert.equal(result.simulator, false);
  }
});

test('a collocated native renderer test always demands a simulator', t => {
  const { root, git, write, manifest, button } = styledRepository(t);
  const native = 'tests/button/native.test.cjs';
  write(native, "require('@ui-lazy-dev/ui-web/button');");
  button.files.nativeUnit.push(native);
  button.cases = { native: [native + ' | supports touch'] };
  write(manifest, JSON.stringify(button));
  git('add', '.');
  const result = selectStaged(root);
  assert.equal(result.tier, 1, result.reasons.join('\n'));
  assert.equal(result.simulator, true);
  assert.deepEqual(result.nativeUnitTests, [native]);
  const contract = 'docs/components/button.scenarios.yaml';
  button.files.scenario.push(contract);
  write(contract, '{}');
  write(manifest, JSON.stringify(button));
  git('add', '.'); git('commit', '-qm', 'Register the native scenario');
  write(contract, '{"changed":"native and web both read this file"}');
  git('add', contract);
  const changed = selectStaged(root);
  assert.equal(changed.tier, 1, changed.reasons.join('\n'));
  assert.equal(changed.simulator, true);
});

test('a CSS import can make an additional public stylesheet consume the edited chunks', t => {
  const { root, git, write, style, chunk } = styledRepository(t);
  write('packages/web/src/_shared/styles/motion.css', chunk('motion', "@import './controls.css';"));
  git('add', '.'); git('commit', '-qm', 'Parent CSS entry');
  write(style, chunk('controls', '.button { display: block; }'));
  git('add', style);
  const result = selectStaged(root);
  assert.equal(result.tier, 1, result.reasons.join('\n'));
  assert.ok(result.budgetEntries.includes('@ui-lazy-dev/ui-web/motion.css'));
});

test('publishing changes, unclassified CSS, case removal and reassigning an owned file require tier 2', t => {
  const { root, git, write, manifest, button, style, chunk } = styledRepository(t);
  function full(path, body) {
    write(path, body); git('add', path);
    const result = selectStaged(root);
    assert.equal(result.tier, 2, path + ' ' + result.reasons.join('\n'));
    git('reset', '-q', 'HEAD');
  }
  full(manifest, JSON.stringify({ ...button, entries: [{ path: './new' }] }));
  full(manifest, JSON.stringify({ ...button, inventory: { api: ['button:Changed'] } }));
  full(manifest, JSON.stringify({ ...button, files: { ...button.files, unit: [] } }));
  full(manifest, JSON.stringify({ ...button, files: { ...button.files, source: ['packages/web/src/avatar.ts'] } }));
  full('packages/web/src/_shared/styles/controls.css', chunk('controls'));
  full('packages/web/src/avatar/unmapped.css', chunk('controls'));
  full(style, chunk('missing'));
  const avatar = 'manifests/families/avatar.json';
  const a = JSON.parse(git('show', 'HEAD:' + avatar));
  a.files.style.push(style);
  write(avatar, JSON.stringify(a));
  write(manifest, JSON.stringify({ ...button, files: { ...button.files, style: [] } }));
  git('add', avatar, manifest);
  assert.equal(selectStaged(root).tier, 2);
});

test('a registered web fixture owns its statically reachable family helpers', t => {
  const { root, git, write, manifest, button } = styledRepository(t);
  const scenario = 'docs/components/button.scenarios.yaml';
  const fixture = 'tests/button/web-fixtures.tsx';
  const helper = 'tests/button/consumer-fixtures/save.tsx';
  write(scenario, '{}');
  button.files.scenario.push(scenario);
  write(manifest, JSON.stringify(button));
  write(fixture, "export { fixtures } from './consumer-fixtures/index';");
  write('tests/button/consumer-fixtures/index.ts', "export { fixtures } from './save';");
  write(helper, "import { Button } from '@ui-lazy-dev/ui-web/button'; export const fixtures = { save: Button };");
  git('add', '.');
  const added = selectStaged(root);
  assert.equal(added.tier, 1, added.reasons.join('\n'));
  assert.deepEqual(added.families, ['Button', 'Panel', 'Toolbar']);
  git('commit', '-qm', 'Register the split Button fixture');

  write(helper, "import { Button } from '@ui-lazy-dev/ui-web/button'; export const fixtures = { submit: Button };");
  git('add', helper);
  write(fixture, 'export const fixtures = {};');
  const changed = selectStaged(root);
  assert.equal(changed.tier, 1, changed.reasons.join('\n'));
  assert.deepEqual(changed.families, ['Button', 'Panel', 'Toolbar']);
  assert.deepEqual(changed.scenarioFiles, [scenario]);
  assert.equal(changed.simulator, false);

  const orphan = 'tests/button/consumer-fixtures/unregistered.ts';
  write(orphan, 'export const unused = 1;');
  git('add', orphan);
  assert.equal(selectStaged(root).tier, 2);
  git('reset', '-q', 'HEAD', orphan);

  write(fixture, git('show', 'HEAD:' + fixture) + '\nexport const extra = path => import(path);');
  git('add', fixture);
  assert.equal(selectStaged(root).tier, 2);
  git('reset', '-q', 'HEAD', fixture);

  const native = 'tests/button/native.test.cjs';
  write(native, "require('./consumer-fixtures/save');");
  git('add', native);
  assert.equal(selectStaged(root).simulator, true);
  git('reset', '-q', 'HEAD', native);

  const other = 'tests/avatar/foreign.ts';
  write(other, "export { fixtures } from '../button/consumer-fixtures/save';");
  git('add', other);
  git('commit', '-qm', 'Share the helper between family directories');
  write(helper, 'export const fixtures = {};');
  git('add', helper);
  assert.equal(selectStaged(root).tier, 2);
});

test('native subpath edits select the owning family and its device test', t => {
  const { root, git, write } = repository(t);
  write('packages/native/package.json', JSON.stringify({ name: '@ui-lazy-dev/ui-native',
    exports: { '.': './dist/index.js', './appearance': './dist/appearance.js' } }));
  write('packages/native/tsconfig.json', JSON.stringify({ compilerOptions: { outDir: 'dist', rootDir: 'src' } }));
  write('packages/native/src/index.ts', 'export const Control = 1;');
  const appearance = 'packages/native/src/appearance.ts';
  write(appearance, 'export const Control = 2;');
  const registry = 'packages/policy/quality/api-depth/families.json';
  const data = JSON.parse(git('show', 'HEAD:' + registry));
  data.families.find(row => row.id === 'Button').exports.push('native:Control');
  data.families.find(row => row.id === 'Avatar').exports.push('native/appearance:Control');
  write(registry, JSON.stringify(data));
  const nativeTest = 'tests/native/appearance.test.cjs';
  write(nativeTest, "const {Control} = require('@ui-lazy-dev/ui-native/appearance');");
  git('add', '.');
  git('commit', '-qm', 'Add independent native entries');
  write(appearance, 'export const Control = 3;');
  git('add', appearance);
  const result = selectStaged(root);
  assert.equal(result.tier, 1, result.reasons.join('\n'));
  assert.deepEqual(result.families, ['Avatar']);
  assert.ok(result.nativeUnitTests.includes(nativeTest));
  assert.equal(result.simulator, true);
});
