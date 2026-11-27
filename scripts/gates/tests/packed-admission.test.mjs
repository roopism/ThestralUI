import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { withRevisionSnapshot } from '../../../packages/policy/quality/staged-tree.mjs';
import { commitHooks, integrationNoWeakening } from '../../verify-preflight.mjs';
import { noWeakening } from '../no-weakening.mjs';
import { fixtureGit } from './fixtures/hermetic-git.mjs';
import { compareWithBase } from './fixtures/protected-inputs.mjs';

const trusted = fileURLToPath(new URL('../../../', import.meta.url));
const baseline = 'tests/packaging/bundle-baseline.json';
const entry = '@ui-lazy-dev/ui-web/sample.css';
const css = '.sample{color:red}\n';
const bytes = gzipSync('@layer uld.reset,uld.tokens,uld.components,uld.utilities;@layer uld.components{.sample{color:red}}\n', { level: 9 }).length;
const styleFile = 'packages/web/src/sample/styles.css', sharedFile = 'packages/web/src/shared.css';
const chunk = (order, source) => '/* @uld-css-chunk sample.' + order + ' */\n' + source + '\n';
const web = '@ui-lazy-dev/ui-web', tokens = '@ui-lazy-dev/tokens';
const version = '1.0.0', json = JSON.stringify;
const packageFile = (name, exports = {}) => ({ name, version, exports });
const archives = Object.fromEntries([tokens, web].map(name =>
  [name, 'file:../candidate/' + name.slice(1).replace('/', '-') + '-' + version + '.tgz']));
const app = { name: 'ui-release-fixture', version, dependencies: archives };
const consumerLock = { name: app.name, version, lockfileVersion: 3, packages: {
  '': app, ...Object.fromEntries(Object.entries(archives).map(([name, resolved]) => ['node_modules/' + name, { version, resolved }])),
} };
// Use the trusted compiler and token generator with two tiny TypeScript packages.
// Empty ambient workspace declarations keep this fixture's install entirely local.
const typePackages = ['@types/node', '@types/react', '@types/react-dom', 'vite'];
const workspaceFiles = {}, workspaceLock = {};
for (const name of typePackages) {
  const path = 'ambient/' + name.split('/').at(-1);
  workspaceFiles[path + '/package.json'] = json({ name, version, types: 'index.d.ts' });
  workspaceFiles[path + (name === 'vite' ? '/client.d.ts' : '/index.d.ts')] = 'export {};';
  workspaceLock[path] = { name, version };
  workspaceLock['node_modules/' + name] = { resolved: path, link: true };
}
const project = { name: 'packing-control', version, workspaces: ['packages/*', 'ambient/*'], scripts: {
  'build:packages': 'node build.cjs',
} };
const baseFiles = {
  ...workspaceFiles,
  ...Object.fromEntries(fixtureGit(trusted, ['ls-files', '--', 'packages/tokens', 'tsconfig.json',
    'packages/web/tsconfig.json', 'packages/native/tsconfig.json']).split('\n').map(path => [path, readFileSync(join(trusted, path), 'utf8')])),
  'package.json': json(project),
  'build.cjs': '',
  [sharedFile]: chunk(1, ''),
  'packages/web/src/index.ts': 'export {};',
  'packages/native/src/index.ts': 'export {};',
  'package-lock.json': json({ name: project.name, version, lockfileVersion: 3, packages: {
    '': { name: project.name, version, workspaces: project.workspaces }, ...workspaceLock,
    'packages/web': { name: web, version }, 'packages/tokens': { name: tokens, version },
    ['node_modules/' + web]: { resolved: 'packages/web', link: true },
    ['node_modules/' + tokens]: { resolved: 'packages/tokens', link: true },
  } }),
  'packages/web/package.json': json(packageFile(web)), 'packages/tokens/package.json': json(packageFile(tokens)),
  'tests/packaging/locks/web-max.json': json(consumerLock),
};

async function check(t, review, repairFinal = false, buildChange = {}) {
  const compare = compareWithBase(t, baseline, '{}', baseFiles, undefined, async (root, baseTree, tree) => {
    const git = (...args) => fixtureGit(root, args);
    const base = git('commit-tree', baseTree, '-m', 'base');
    const first = git('commit-tree', tree, '-p', base, '-m', 'family');
    // A later commit can repair a bad historical tree without changing its size declaration.
    const doc = fixtureGit(root, ['hash-object', '-w', '--stdin'], 'published');
    git('update-index', '--add', '--cacheinfo', '100644,' + doc + ',docs/control.md');
    if (repairFinal) {
      const fixed = fixtureGit(root, ['hash-object', '-w', '--stdin'], chunk(2, css));
      git('update-index', '--add', '--cacheinfo', '100644,' + fixed + ',' + styleFile);
    }
    const finalTree = git('write-tree'), commit = git('commit-tree', finalTree, '-p', first, '-m', 'docs');
    git('read-tree', base);
    git('update-index', '--add', '--cacheinfo', '100644,' + doc + ',docs/previous.md');
    const predecessor = git('commit-tree', git('write-tree'), '-p', base, '-m', 'previous');
    const stacked = git('merge-tree', '--write-tree', predecessor, first);
    // This independent predecessor changes the packed bytes only in the combined tree.
    const sheet = fixtureGit(root, ['hash-object', '-w', '--stdin'], chunk(1, '.stacked{color:blue}'));
    git('update-index', '--add', '--cacheinfo', '100644,' + sheet + ',' + sharedFile);
    const changed = git('commit-tree', git('write-tree'), '-p', base, '-m', 'shared style');
    const changedStack = git('merge-tree', '--write-tree', changed, first);
    return review({ root, base, tree: finalTree, commit, trusted, first, predecessor, stacked, changed, changedStack });
  });
  const candidate = source => ({
    'packages/web/package.json': json(packageFile(web, { './sample.css': './dist/sample.css' })),
    [styleFile]: chunk(2, source), ...buildChange,
    'manifests/families/sample.json': json({ id: 'Sample', band: 'primitives',
      entries: [{ pkg: 'web', path: './sample.css', target: './dist/sample.css' }], budgets: [{ name: entry, bytes }] }),
  });
  assert.deepEqual(await compare(json({ [entry]: bytes }), candidate(css)), []);
  assert.match((await compare(json({ [entry]: bytes }), candidate('.changed-selector{color:purple}'))).join('\n'),
    /differs from the packed measurement/);
}

test('preflight measures the exact family tree before admitting a new row', async t => {
  await check(t, integrationNoWeakening);
  await check(t, ({ root, base, tree }) => noWeakening(root, base, tree, root));
});
test('preflight measures the parent comparison for a historical proposal commit', t => check(t, commitHooks, true));
test('the train judge measures standalone and stacked tree comparisons', t => check(t, ({ root, base, first, predecessor, stacked, changed, changedStack }) =>
  withRevisionSnapshot(root, base, (snapshot, _tree, env) => {
    const issues = [];
    const compare = (parent, candidate) => {
      const result = spawnSync(process.execPath, [join(trusted, 'scripts/gates/no-weakening.mjs'), parent, candidate, root],
        { cwd: snapshot, env, encoding: 'utf8' });
      assert.equal(result.signal, null);
      return result.status === 0 ? '' : result.stderr;
    };
    for (const [parent, candidate] of [[base, first], [predecessor, stacked]]) {
      const finding = compare(parent, candidate);
      if (finding) issues.push(finding);
    }
    assert.match(compare(changed, changedStack), /differs from the packed measurement/);
    return issues;
  })));

test('packed measurement builds the candidate inputs with the trusted implementation', t =>
  check(t, integrationNoWeakening, false, { 'build.cjs': [
    "const fs = require('node:fs');",
    "fs.mkdirSync('packages/web/dist', { recursive: true });",
    "fs.writeFileSync('packages/web/dist/sample.css', '.legacy{display:block}');",
  ].join('\n') }));
