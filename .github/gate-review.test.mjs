import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { renderDepthRegistry } from '../scripts/manifests/depth-registry.mjs';
import { checkProposal, checkRevision, gatePaths } from './gate-review.mjs';

const owners = gatePaths(readFileSync(new URL('./CODEOWNERS', import.meta.url), 'utf8'));
const repository = 'thetechgeeek/ThestralUI';
const product = { repository, headRepository: repository, headBranch: 'feat/families' };
const gate = { ...product, headBranch: 'feat/gates' };
const cases = [
  '.github/workflows/gate-paths.yml', '.github/CODEOWNERS', '.github', '.githooks/pre-commit',
  'scripts/verify-android-emulator.mjs', 'tests/android/low-end-budget.json',
  'tests/android/frame-budget.mjs', 'tests/android/profiles.json', 'tests/packaging/default-ceiling.json',
  'tests/browser/quality-perf-baseline.json', 'packages/policy/quality/check-staged.mjs', 'manifests/shared.json',
];
const binding = 'packages/web/src/button/binding.tsx';

test('shared scenario adapters and regressions require owner review while ordinary family fixtures stay on product branches', () => {
  const shared = [
    'tests/native/scenarios.test.cjs', 'tests/scenarios/android.test.cjs',
    'tests/scenarios/read.test.cjs', 'tests/scenarios/web/adapter-regressions.spec.ts',
    'tests/scenarios/web/adapter.ts',
  ];
  const family = ['tests/data-table/native.test.cjs', 'tests/scenarios/web/fixtures.tsx', 'catalog/native/scenarios/DataTable.tsx'];
  checkProposal(shared, owners, gate);
  checkProposal(family, owners, product);
  for (const file of shared) assert.throws(() => checkProposal([file], owners, product), /Propose these gate changes/);
  for (const file of family) assert.throws(() => checkProposal([file], owners, gate), /accepts only gate paths/);
});

test('gate files require the same-repository gate branch and product files stay on product branches', () => {
  checkProposal(cases, owners, gate);
  checkProposal([binding, 'tests/button/controls.test.tsx', 'scripts-extra/x', 'package.json.old'], owners, product);
  for (const path of cases) assert.throws(() => checkProposal([path], owners, product), /Propose these gate changes/);
  assert.throws(() => checkProposal([binding, ...cases], owners, gate), /product changes/);
  assert.throws(() => checkProposal([cases[0], binding], owners, product), /Propose these gate changes/);
  assert.throws(() => checkProposal(cases, owners, { ...gate, headRepository: 'fork/ui-lazy-dev' }));
  assert.throws(() => checkProposal(cases, owners, { ...gate, headRepository: '' }));
  assert.throws(() => checkProposal(['tests'], owners, gate));
  assert.throws(() => checkProposal(['tests'], owners, product));
  checkProposal([], owners, gate);
});

test('the public cascade contract requires gate review while family stylesheets and browser coverage stay on product branches', () => {
  const contract = ['tests/contracts/cascade-layers.test.mjs'];
  const family = ['packages/web/src/button/styles.css', 'tests/button/forced-colors.spec.ts'];
  assert.throws(() => checkProposal(contract, owners, product), /feat.gates/);
  assert.doesNotThrow(() => checkProposal(contract, owners, gate));
  assert.doesNotThrow(() => checkProposal(family, owners, product));
  assert.throws(() => checkProposal(family, owners, gate), /only gate paths/);
});

test('invalid or unowned rules are rejected', () => {
  for (const row of ['* @thetechgeeek', '/scripts/** @thetechgeeek', '/.github/ @someone', '/.github/'])
    assert.throws(() => gatePaths(row));
  assert.throws(() => gatePaths('/scripts/ @thetechgeeek'), /must be owned/);
});

test('the diff uses the base policy and treats both ends of a rename as changes', t => {
  const cwd = mkdtempSync(join(tmpdir(), 'uld-gate-review-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  git('init', '--quiet', '--template=');
  git('config', 'user.name', 'Review fixture');
  git('config', 'user.email', 'fixture@example.invalid');
  mkdirSync(join(cwd, '.github'));
  writeFileSync(join(cwd, '.github/CODEOWNERS'), '/.github/ @thetechgeeek\n');
  writeFileSync(join(cwd, '.github/guard'), 'fixture\n');
  git('add', '.'); git('commit', '-qm', 'base'); const base = git('rev-parse', 'HEAD');
  const filename = 'product\nfile';
  renameSync(join(cwd, '.github/guard'), join(cwd, filename));
  writeFileSync(join(cwd, '.github/CODEOWNERS'), '/.github/ @thetechgeeek\n/product @thetechgeeek\n');
  writeFileSync(join(cwd, 'product'), 'cannot classify its own change\n');
  git('add', '-A'); git('commit', '-qm', 'proposal'); const head = git('rev-parse', 'HEAD');
  assert.throws(() => checkRevision(cwd, base, head, product), /\.github\/guard/);
  assert.throws(() => checkRevision(cwd, base, head, gate), /product\\nfile/);
  assert.throws(() => checkRevision(cwd, base, head, gate), /"product"/);
});

test('family registrations can grow and budgets tighten, while weaker incumbents need an owned gate change', () => {
  const matrix = 'tests/acceptance/browser-matrix.json';
  const budgets = 'tests/packaging/bundle-baseline.json';
  const before = { projects: ['webkit'], cases: ['webkit | button.enabled'] };
  const larger = { ...before, cases: [...before.cases, 'webkit | button.disabled'] };
  checkProposal([matrix, binding], owners, product, () => [before, larger]);
  checkProposal([budgets], owners, product, () => [{ button: 30 }, { button: 29, dialog: 12 }]);
  for (const next of [{ ...before, projects: [] }, { ...before, cases: [] }, null]) {
    assert.throws(() => checkProposal([matrix], owners, product, () => [before, next]));
    assert.throws(() => checkProposal([matrix], owners, gate, () => [before, next]));
    checkProposal([matrix, '.github/decisions/limits.md'], owners, gate, () => [before, next]);
  }
  for (const next of [{ button: 31 }, {}, null, { button: '30' }])
    assert.throws(() => checkProposal([budgets], owners, product, () => [{ button: 30 }, next]));
  const family = 'manifests/families/button.json';
  const old = { id: 'button', cases: {}, budgets: [] };
  checkProposal([family, '.github/decisions/limits.md'], owners, gate, () => [old, { ...old, cases: { node: [] } }]);
  assert.throws(() => checkProposal([family, '.github/decisions/limits.md'], owners, gate,
    () => [old, { ...old, files: {} }]));
});

test('symlink and gitlink replacements at an owned directory remain gated', t => {
  const cwd = mkdtempSync(join(tmpdir(), 'uld-gate-entry-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  git('init', '--quiet', '--template=');
  git('config', 'user.name', 'Review fixture'); git('config', 'user.email', 'fixture@example.invalid');
  mkdirSync(join(cwd, '.github')); mkdirSync(join(cwd, 'scripts'));
  writeFileSync(join(cwd, '.github/CODEOWNERS'), '/.github/ @thetechgeeek\n/scripts/ @thetechgeeek\n');
  writeFileSync(join(cwd, 'scripts/check'), 'gate\n');
  git('add', '.'); git('commit', '-qm', 'ordinary directory'); const base = git('rev-parse', 'HEAD');
  rmSync(join(cwd, 'scripts'), { recursive: true }); symlinkSync('other', join(cwd, 'scripts'));
  git('add', '-A'); git('commit', '-qm', 'symbolic link');
  const link = git('rev-parse', 'HEAD');
  assert.throws(() => checkRevision(cwd, base, link, product), /"scripts"/);
  git('update-index', '--add', '--cacheinfo', '160000,' + base + ',scripts');
  git('commit', '-qm', 'gitlink'); const submodule = git('rev-parse', 'HEAD');
  git('config', 'diff.ignoreSubmodules', 'all');
  assert.throws(() => checkRevision(cwd, link, submodule, product), /"scripts"/);
  checkRevision(cwd, link, submodule, gate);
});

test('only the exact generated depth registry can carry additive product registrations', t => {
  const cwd = mkdtempSync(join(tmpdir(), 'uld-depth-registry-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  const write = (path, value) => {
    mkdirSync(dirname(join(cwd, path)), { recursive: true });
    writeFileSync(join(cwd, path), value);
  };
  const commit = () => {
    git('add', '-A'); git('commit', '-qm', 'registration fixture');
    return git('rev-parse', 'HEAD');
  };
  const registry = 'packages/policy/quality/api-depth/families.json';
  const manifestPath = row => 'manifests/families/' + row.id.toLowerCase() + '.json';
  const shared = { depthRevision: '1' };
  const existing = { id: 'Dialog', order: 1, inventory: { api: ['dialog:Dialog'] },
    depth: { representative: 'dialog:Dialog', expectation: 'Named surface', oracle: 'Closes on Escape',
      evidence: { browser: 'browser/dialog.spec.ts | dismisses' } } };
  const added = { id: 'Sheet', order: 2, inventory: { api: ['sheet:Sheet'] },
    depth: { representative: 'sheet:Sheet', expectation: 'Named sheet', oracle: 'Closes on Back',
      evidence: { native: 'tests/sheet/native.test.cjs | closes' } } };
  const render = rows => {
    for (const row of rows) write(manifestPath(row), JSON.stringify(row));
    write(registry, renderDepthRegistry(rows, shared));
  };
  git('init', '--quiet', '--template=');
  git('config', 'user.name', 'Review fixture'); git('config', 'user.email', 'fixture@example.invalid');
  write('.github/CODEOWNERS', readFileSync(new URL('./CODEOWNERS', import.meta.url)));
  write('manifests/shared.json', JSON.stringify(shared));
  write('.github/gate-review.mjs', readFileSync(new URL('./gate-review.mjs', import.meta.url)));
  for (const name of ['depth-registry.mjs', 'product-registrations.mjs', 'family-manifest-input.mjs'])
    write('scripts/manifests/' + name, readFileSync(new URL('../scripts/manifests/' + name, import.meta.url)));
  render([existing]);
  const base = commit();
  const expanded = structuredClone(existing);
  expanded.inventory.api.push('dialog:useDialog');
  render([expanded, added]);
  const qualified = commit();
  checkRevision(cwd, base, qualified, product);
  const extracted = mkdtempSync(join(tmpdir(), 'gate-workflow-judge-'));
  t.after(() => rmSync(extracted, { recursive: true, force: true }));
  const isolated = join(extracted, 'gate-review.mjs');
  writeFileSync(isolated, execFileSync('git', ['show', base + ':.github/gate-review.mjs'], { cwd }));
  // The production workflow executes this lone extracted file from a PR checkout.
  write('scripts/manifests/depth-registry.mjs', 'throw Error("candidate helper was executed");');
  execFileSync(process.execPath, [isolated, base, qualified], { cwd, env: { ...process.env,
    HEAD_BRANCH: product.headBranch, HEAD_REPOSITORY: product.headRepository, GITHUB_REPOSITORY: product.repository } });
  git('restore', '--', 'scripts/manifests/depth-registry.mjs');
  assert.throws(() => checkProposal([registry + '/file'], owners, product));
  assert.throws(() => checkProposal([dirname(registry)], owners, product));
  assert.throws(() => checkProposal([registry], owners, gate));
  checkProposal([registry, '.github/gate-review.md'], owners, gate);

  write(registry, renderDepthRegistry([existing, added], shared));
  assert.throws(() => checkRevision(cwd, base, commit(), product), /exact generated/);
  for (const change of [
    row => { row.inventory.api = ['dialog:useDialog']; row.depth.representative = 'dialog:useDialog'; },
    row => { row.depth.oracle = 'Always passes'; },
    row => { delete row.depth.evidence; },
  ]) {
    const weakened = structuredClone(expanded);
    change(weakened); render([weakened, added]);
    assert.throws(() => checkRevision(cwd, base, commit(), product), /product-registration/);
  }
  git('reset', '--hard', base);
  write(manifestPath(expanded), JSON.stringify(expanded));
  const stale = commit();
  assert.throws(() => checkRevision(cwd, base, stale, product), /exact generated/);
  assert.throws(() => checkRevision(cwd, base, stale, { ...gate, headRepository: 'fork/ui-lazy-dev' }), /exact generated/);
  git('reset', '--hard', qualified);
  rmSync(join(cwd, registry)); symlinkSync('elsewhere', join(cwd, registry));
  assert.throws(() => checkRevision(cwd, base, commit(), product), /exact generated/);
  git('reset', '--hard', qualified);
  rmSync(join(cwd, manifestPath(added))); symlinkSync('elsewhere', join(cwd, manifestPath(added)));
  assert.throws(() => checkRevision(cwd, base, commit(), product), /Invalid family manifest/);
});

test('only the frozen enterprise budget schedule can authorize the initial source and its matching public routes', t => {
  const cwd = mkdtempSync(join(tmpdir(), 'uld-reviewed-budget-'));
  t.after(() => rmSync(cwd, {recursive: true, force: true}));
  const git = (...args) => execFileSync('git', args, {cwd, encoding: 'utf8'}).trim();
  const write = (path, text) => { mkdirSync(join(cwd, dirname(path)), {recursive: true}); writeFileSync(join(cwd, path), text); };
  const json = (path, value) => write(path, JSON.stringify(value));
  const commit = message => {git('add', '.'); git('commit', '-qm', message); return git('rev-parse', 'HEAD');};
  git('init', '--quiet', '--template='); git('config','user.name','Budget fixture'); git('config','user.email','fixture@example.invalid');
  write('.github/CODEOWNERS', readFileSync(new URL('./CODEOWNERS', import.meta.url)));
  const approved = 'source verified by the frozen test fixture\n';
  const digest = createHash('sha256').update(approved).digest('hex');
  const helper = 'scripts/manifests/reviewed-bundle-budgets.mjs';
  const rules = readFileSync(new URL('../' + helper, import.meta.url), 'utf8').replaceAll(/[a-f0-9]{64}/g, digest);
  write(helper, rules);
  const limitsPath = 'tests/packaging/bundle-baseline.json', pkg = 'packages/web/package.json';
  const family = 'manifests/families/icon-button.json', web = '@ui-lazy-dev/ui-web/';
  const limits = Object.fromEntries(Object.entries({primitives:1135,document:223,'primitives.css':862,'document#Heading':143,navigation:62722}).map(([k,v]) => [web+k,v]));
  json(limitsPath, limits); json(pkg, {exports:{}}); json(family,{id:'Icon button'});
  const base = commit('Before the reviewed family');
  const paths = ['packages/web/src/icon-button/binding.tsx','packages/web/src/icon-button/index.ts','packages/web/src/icon-button/styles.css'];
  const entries = [
    {pkg:'web',path:'./icon-button',target:{types:'./dist/icon-button/index.d.ts',default:'./dist/icon-button/index.js'}},
    {pkg:'web',path:'./icon-button.css',target:'./dist/icon-button.css'},
  ];
  const install = () => {
    json(pkg,{exports:Object.fromEntries(entries.map(e=>[e.path,e.target]))});
    json(family,{id:'Icon button',entries,files:{source:paths.slice(0,2),style:paths.slice(2)}});
    for (const path of paths) write(path,approved);
  };
  const reviewed = {...limits,[web+'primitives']:1513,[web+'primitives.css']:962};
  json(limitsPath,reviewed);
  const early = commit('Premature increase');
  assert.throws(()=>checkRevision(cwd,base,early,product),/Propose these gate changes/);
  install();
  json(limitsPath,{...reviewed,[web+'primitives.css']:862});
  const incomplete=commit('Initial CSS measurement omitted');
  assert.throws(()=>checkRevision(cwd,base,incomplete,product),/Wrong budget for the new checkpoint: primitives.css/);
  json(limitsPath,reviewed);
  const adopted=commit('Exact adoption');
  checkRevision(cwd,base,adopted,product);
  write(paths[0],'different product source\n');const replaced=commit('Replace reviewed implementation');
  assert.throws(()=>checkRevision(cwd,base,replaced,product),/Unreviewed source at first adoption/);
  // Rewriting the candidate's permission must not let it authenticate its own source.
  write(helper,rules.replaceAll(digest,createHash('sha256').update('different product source\n').digest('hex')));
  const tampered=commit('Rewrite proposed allowance');
  assert.throws(()=>checkRevision(cwd,base,tampered,product),/Unreviewed source at first adoption/);
  // Once the reviewed bytes have landed, ordinary product maintenance remains within existing caps.
  checkRevision(cwd,adopted,replaced,product);
});
