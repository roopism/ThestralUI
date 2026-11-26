import { randomUUID } from 'node:crypto';
import { sealReceipt } from '../reuse/runner.mjs';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { withRevisionSnapshot } from '../../../packages/policy/quality/staged-tree.mjs';
import { installSnapshotDependencies } from '../../../packages/policy/quality/snapshot-dependencies.mjs';
import {
  codeOwners, commitHooks, commitMessages, gateIsolation, integrationNoWeakening, phases, policyReview, prepareSnapshot, rosterFiles,
} from '../../verify-preflight.mjs';
import { preflightChecks, preflightRunner, requirePreflight, writePreflightReceipt } from '../preflight-receipt.mjs';
import { fixtureGit, isolateFixtureProcess } from './fixtures/hermetic-git.mjs';

isolateFixtureProcess();

const source = fileURLToPath(new URL('../../../', import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), 'uld-preflight-controls-'));
process.on('exit', () => rmSync(scratch, { recursive: true, force: true }));
const project = join(scratch, 'repo');
fixtureGit(scratch, ['clone', '--quiet', '--shared', '--no-checkout', '--', source, project]);
const git = (args, input) => fixtureGit(project, args, input);
const base = git(['rev-parse', 'HEAD^{commit}']);
const show = (path, revision = base) => git(['show', revision + ':' + path]);

// Plant edits on a parent commit without touching the working tree or its index.
function plant(edits, { parent = base, message = 'test(gates): planted preflight control' } = {}) {
  git(['read-tree', parent + '^{tree}']);
  for (const [path, content] of Object.entries(edits)) {
    if (content === null) git(['update-index', '--force-remove', '--', path]);
    else git(['update-index', '--add', '--cacheinfo', '100644,' + git(['hash-object', '-w', '--stdin'], content) + ',' + path]);
  }
  return git(['commit-tree', git(['write-tree']), '-p', parent, '-m', message]);
}
const context = (commit, branch = 'gates/preflight-control') =>
  ({ root: project, base, commit, tree: git(['rev-parse', commit + '^{tree}']), branch, trusted: source, env: process.env });
const phase = (check, name) => phases.find(entry => entry.check === check && entry.name === name).operation;

// Run snapshot stages exactly as the command does. One installed snapshot checks out each planted tree in turn.
async function inSnapshot(commits, operation) {
  const common = process.env.ULD_ARTIFACT_COMMON ?? git(['-C', source, 'rev-parse', '--path-format=absolute', '--git-common-dir']);
  return withRevisionSnapshot(project, base, async (snapshot, _tree, childEnv) => {
    installSnapshotDependencies(snapshot, join(common, 'uld-dependencies'), childEnv);
    prepareSnapshot(snapshot, base);
    const results = [];
    for (const commit of commits) {
      fixtureGit(snapshot, ['read-tree', '--reset', '-u', commit + '^{tree}']);
      const ctx = { ...context(commit), snapshot, env: { ...childEnv, ULD_ARTIFACT_COMMON: common } };
      try { await operation(ctx); results.push('passed'); } catch (error) { results.push(error.message); }
    }
    return results;
  });
}

test('preflight gate isolation rejects mixed, misplaced and product-only proposal branches', async () => {
  const gate = { 'scripts/gates/preflight-control.mjs': 'export const control = 1;\n' };
  const product = { 'docs/preflight-control.md': 'Control\n' };
  assert.deepEqual(await gateIsolation(context(plant(gate))), []);
  assert.deepEqual(await gateIsolation(context(plant(product), 'docs/preflight-control')), []);
  const mixed = await gateIsolation(context(plant({ ...gate, ...product })));
  assert.ok(mixed.some(issue => /Cannot mix protected gate paths/.test(issue)), mixed.join('\n'));
  const misplaced = await gateIsolation(context(plant(gate), 'family/preflight-control'));
  assert.ok(misplaced.some(issue => /require a gates\/ branch/.test(issue)), misplaced.join('\n'));
  const productOnly = await gateIsolation(context(plant(product)));
  assert.ok(productOnly.some(issue => /must touch only gate paths/.test(issue)), productOnly.join('\n'));
  const unnamed = await gateIsolation(context(plant(gate), 'prep/preflight-control'));
  assert.ok(unnamed.some(issue => /not a family\/, gates\/ or docs\/ proposal branch/.test(issue)), unnamed.join('\n'));
});

test('preflight no-weakening rejects a removed assertion against the integration base', async () => {
  const path = 'tests/contracts/cascade-layers.test.mjs';
  const weakened = show(path).replace(/^\s*assert\.equal\(rule\.type,[^\n]*\n/m, '\n');
  assert.notEqual(weakened, show(path));
  const issues = await integrationNoWeakening(context(plant({ [path]: weakened })));
  assert.ok(issues.some(issue => issue.startsWith(path) && /removed assert/.test(issue)), issues.join('\n'));
  assert.deepEqual(await integrationNoWeakening(context(base)), []);
});

test('preflight policy review rejects an added owner approval line', async () => {
  const issues = await policyReview(context(plant({ 'README.md': show('README.md') + '\nOwner permits this preflight control.\n' })));
  assert.ok(issues.some(issue => /^README\.md changes an owner approval line/.test(issue)), issues.join('\n'));
  assert.deepEqual(await policyReview(context(base)), []);
});

test('preflight generated-file check rejects a stale manifest-generated matrix', async () => {
  const path = 'tests/acceptance/unit-matrix.json';
  const matrix = JSON.parse(show(path));
  matrix.vitest.pop();
  const stale = plant({ [path]: JSON.stringify(matrix, null, 2) + '\n' });
  const [rejected, accepted] = await inSnapshot([stale, base], phase('Generated files', 'manifests'));
  assert.match(rejected, /generate\.mjs --check failed \(1\): [\s\S]*Generated output differs: tests\/acceptance\/unit-matrix\.json/);
  assert.equal(accepted, 'passed');
});

test('preflight roster check rejects unregistered tests and registrations missing on disk', async () => {
  assert.deepEqual(rosterFiles(context(base)), []);
  const unregistered = rosterFiles(context(plant({
    'scripts/gates/tests/preflight-unlisted.test.mjs': "import test from 'node:test';\ntest('unlisted', () => {});\n",
    'tests/preflight-control/unlisted.spec.ts': "import { test } from '@playwright/test';\ntest('unlisted', () => {});\n",
  })));
  assert.ok(unregistered.includes('scripts/gates/tests/preflight-unlisted.test.mjs is not registered in scripts/gates/test-roster.json'), unregistered.join('\n'));
  assert.ok(unregistered.includes('tests/preflight-control/unlisted.spec.ts has no browser matrix entry'), unregistered.join('\n'));
  const roster = JSON.parse(show('scripts/gates/test-roster.json'));
  const visual = JSON.parse(show('tests/acceptance/visual-matrix.json'));
  const missing = rosterFiles(context(plant({
    'scripts/gates/test-roster.json': JSON.stringify([...roster, 'scripts/gates/tests/preflight-gone.test.mjs | gone'], null, 2) + '\n',
    'tests/acceptance/visual-matrix.json': JSON.stringify({ ...visual, cases: [...visual.cases, 'chromium | browser/gone.visual.ts | gone'] }, null, 2) + '\n',
  })));
  assert.ok(missing.some(issue => /lists scripts\/gates\/tests\/preflight-gone\.test\.mjs, which is not in the committed tree/.test(issue)), missing.join('\n'));
  assert.ok(missing.some(issue => /lists tests\/browser\/gone\.visual\.ts, which is not in the committed tree/.test(issue)), missing.join('\n'));
});

test('preflight hook check rejects a cherry-picked commit that weakened its parent', async () => {
  const path = 'tests/contracts/cascade-layers.test.mjs';
  const weakened = show(path).replace(/^\s*assert\.equal\(rule\.type,[^\n]*\n/m, '\n');
  // A pick made without hooks weakens its parent, and a later pick restores the bytes.
  const first = plant({ [path]: weakened, 'package-lock.json': null });
  const restored = plant({ [path]: show(path), 'package-lock.json': show('package-lock.json'), 'docs/preflight-control.md': 'Control\n' },
    { parent: first });
  const ctx = context(restored, 'docs/preflight-control');
  assert.deepEqual(await integrationNoWeakening(ctx), []);
  const issues = await commitHooks(ctx);
  assert.ok(issues.some(issue => issue.startsWith(first.slice(0, 12) + ' ' + path) && /removed assert/.test(issue)), issues.join('\n'));
  assert.ok(issues.includes(first.slice(0, 12) + ' Staged gate requires package-lock.json'), issues.join('\n'));
  assert.deepEqual(await commitHooks(context(plant({ 'docs/preflight-control.md': 'Control\n' }), 'docs/preflight-control')), []);
});

test('preflight Fast and Typed stages reject a style regression and a type error', async () => {
  const path = 'packages/web/src/application-shell/binding.tsx';
  const style = plant({ [path]: show(path) + '\nexport function StyleRegressionCanary(){return <aside style={{borderRadius:"97px"}}/>}\n' });
  const typeError = plant({ [path]: show(path) + "\nexport const preflightTypeControl: number = 'text';\n" });
  const [styled, clean] = await inSnapshot([style, base], phase('Fast and Typed', 'Fast'));
  assert.match(styled, /failed \(1\): [\s\S]*binding\.tsx:\d+ style\/token \[borderRadius\]/);
  assert.equal(clean, 'passed');
  const [typed] = await inSnapshot([typeError], phase('Fast and Typed', 'Typed'));
  assert.match(typed, /failed \(1\): [\s\S]*binding\.tsx\(\d+,\d+\): error TS2322/);
});

test('preflight message and owner checks reject the banned word, a free-form subject and an owned product change', async () => {
  const banned = ['co', 'dex'].join('');
  const docs = { 'docs/preflight-control.md': 'Control\n' };
  const word = plant(docs, { message: 'docs(gates): mention ' + banned });
  const subject = plant(docs, { parent: word, message: 'Picked without hooks' });
  const messages = await commitMessages(context(subject, 'docs/preflight-control'));
  assert.ok(messages.some(issue => issue.startsWith(word.slice(0, 12)) && /forbidden word \(rule R1\)/.test(issue)), messages.join('\n'));
  assert.ok(messages.some(issue => issue.startsWith(subject.slice(0, 12)) && /Conventional Commit subject/.test(issue)), messages.join('\n'));
  assert.deepEqual(await commitMessages(context(plant(docs), 'docs/preflight-control')), []);
  const owners = show('.github/CODEOWNERS');
  const unowned = await codeOwners(context(plant({ '.github/CODEOWNERS': owners + '/docs/ @someone-else\n' })));
  assert.ok(unowned.some(issue => /Unsupported gate CODEOWNERS rule/.test(issue)), unowned.join('\n'));
  const owned = await codeOwners(context(plant({ 'scripts/gates/preflight-control.mjs': 'export {};\n' }), 'family/preflight-control'));
  assert.ok(owned.some(issue => /Propose these gate changes separately/.test(issue)), owned.join('\n'));
  assert.deepEqual(await codeOwners(context(plant(docs), 'docs/preflight-control')), []);
});

test('qualification refuses to start without a passing preflight receipt for the exact commit, tree and base', () => {
  const common = mkdtempSync(join(scratch, 'common-'));
  const commit = plant({ 'scripts/verify-preflight.mjs': readFileSync(join(source, 'scripts/verify-preflight.mjs'), 'utf8') });
  const tree = git(['rev-parse', commit + '^{tree}']);
  // The integration copy judges once it exists. Before adoption the candidate's own copy does.
  const runner = preflightRunner(project, base, commit);
  const refuse = pattern => assert.throws(() => requirePreflight(project, common, base, commit, tree), pattern);
  refuse(/Qualification refused: no passing preflight receipt exists for tree/);
  const checks = preflightChecks.map(name => ({ name, result: 'passed' }));
  const receipt = { schema: 1, kind: 'preflight', reuseSchema: 1, id: randomUUID(), tree, commit, base,
    branch: 'gates/preflight-control', runner, status: 'passed', checks };
  writePreflightReceipt(common, { ...receipt, id: '00000000-0000-4000-8000-000000000002', status: 'failed', checks: [...checks.slice(1), { name: checks[0].name, result: 'failed' }] });
  refuse(/no passing preflight receipt/);
  writePreflightReceipt(common, { ...receipt, base: commit });
  refuse(/integration moved/);
  writePreflightReceipt(common, { ...receipt, runner: { ...runner, blob: '0'.repeat(40) } });
  refuse(/instead of the (?:integration|candidate) script/);
  writePreflightReceipt(common, { ...receipt, checks: checks.slice(1) });
  refuse(/does not record every passing check/);
  sealReceipt(project, receipt);
  writePreflightReceipt(common, receipt);
  assert.equal(requirePreflight(project, common, base, commit, tree).id, receipt.id);
  // A history without the preflight script keeps its earlier qualification protocol.
  const earlier = plant({ 'scripts/verify-preflight.mjs': null });
  if (!git(['ls-tree', base, '--', 'scripts/verify-preflight.mjs']))
    assert.equal(requirePreflight(project, common, base, earlier, git(['rev-parse', earlier + '^{tree}'])), undefined);
});

test('a mixed train applies isolation and ownership to each PR against its tested predecessor', async () => {
  const product = plant({ 'docs/train-control.md': 'Train control' });
  const gate = plant({ 'scripts/gates/train-control.mjs': 'export {};' });
  const combined = plant({ 'scripts/gates/train-control.mjs': 'export {};' }, { parent: product });
  const tree = commit => git(['rev-parse', commit + '^{tree}']);
  const entry = (branch, parent, solo, prefix) => ({ branch, parent, soloCommit: solo, soloTree: tree(solo),
    commit: prefix, tree: tree(prefix) });
  const train = { members: [entry('docs/product', base, product, product), entry('gates/control', product, gate, combined)] };
  const ctx = { ...context(combined), train };
  const isolation = phase('Gate isolation', 'branch paths');
  const owners = phase('Banned words and owners', 'code owners');
  assert.deepEqual(await isolation(ctx), []);
  assert.deepEqual(await owners(ctx), []);
  train.members[1].branch = 'family/control';
  assert.ok((await isolation(ctx)).some(issue => issue.includes('gates/')));
  assert.ok((await owners(ctx)).some(issue => issue.includes('gate changes')));
});

test('train command adoption binds the two manifest blobs, isolated gate PR and expiry', async t => {
  const { checkRevision, trainEntryAdoption } = await import('../../../.github/gate-review.mjs');
  const { requireTypedControls } = await import('../typed-tools.mjs');
  t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 10, 26) });
  const file = 'package.json', branch = 'gates/train-command';
  const content = git(['cat-file', 'blob', '5f2454b6466a9a73c44b6a7ad4c6d4536e1770c6']) + '\n';
  const script = JSON.parse(content);
  script.scripts = Object.fromEntries(Object.entries(script.scripts).flatMap(entry =>
    entry[0] === 'land' ? [entry, ['train', 'node scripts/train.mjs --publish']] : [entry]));
  const edited = JSON.stringify(script, null, 2) + '\n';
  const parent = plant({ [file]: content });
  const head = plant({ [file]: edited }, { parent });
  const tree = git(['rev-parse', head + '^{tree}']);
  const check = name => checkRevision(project, parent, head, { headBranch: name, headRepository: 'local', repository: 'local' });
  assert.doesNotThrow(() => requireTypedControls(project, parent, tree));
  assert.doesNotThrow(() => check(branch));
  assert.throws(() => check('family/train-command'));
  assert.throws(() => check('gates/unrelated'));
  assert.deepEqual(await gateIsolation({ ...context(head, branch), tree, base: parent }), []);
  for (const edits of [{ [file]: edited, 'docs/extra.md': 'extra' }, { [file]: edited.replace('tsc --noEmit', 'echo') }]) {
    const candidate = plant(edits, { parent });
    assert.throws(() => requireTypedControls(project, parent, git(['rev-parse', candidate + '^{tree}'])));
  }
  assert.equal(trainEntryAdoption(project, parent, head, Date.UTC(2026, 11, 31)), false);
});
