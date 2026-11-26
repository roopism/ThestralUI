import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createObservationTestDirectory, dailyObservationFixture, dailyObservationFixtureFiles } from './fixtures/daily-observation.mjs';
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { passing, required } from '../../land.mjs';
import { proposalDevices, proposalScope, requireFullDevices } from '../../selection/proposal-devices.mjs';
import { qualificationStatus } from '../qualification-policy.mjs';
import { compareFullRun } from '../reuse/full-run.mjs';
import { sealReceipt } from '../reuse/runner.mjs';
import { checkDeviceCompleteness } from '../device-completeness.mjs';
import { deviceInputs } from '../../selection/device-inputs.mjs';
import { observation, recordScopeFailure, registerObservation, requireDailyObservation, retainedObservations } from '../../selection/device-observations.mjs';
import { classifyDevicePath } from '../../selection/proposal-devices.mjs';
import { deviceSuites, verifiedDevicePlan } from '../device-verdict.mjs';
import { fixtureGit, isolateFixtureProcess } from './fixtures/hermetic-git.mjs';

isolateFixtureProcess();

function repository(t) {
  const root = createObservationTestDirectory(t, 'uld-proposal-devices-');
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (args, input) => fixtureGit(root, args, input);
  git(['init', '--quiet', '--template=']);
  function edit(parent, files) {
    git(parent ? ['read-tree', parent] : ['read-tree', '--empty']);
    for (const [path, content] of Object.entries(files)) {
      if (content === null) git(['update-index', '--force-remove', '--', path]);
      else {
        const blob = git(['hash-object', '-w', '--stdin'], content);
        git(['update-index', '--add', '--cacheinfo', '100644,' + blob + ',' + path]);
      }
    }
    return git(['write-tree']);
  }
  const tree = edit(null, {
    ...dailyObservationFixtureFiles(),
    'package.json': '{"workspaces":["packages/*"]}', 'tsconfig.json': '{}',
    'packages/native/package.json': '{"name":"@local/native"}', 'packages/native/src/button.js': 'export const button = 1;',
    'packages/tokens/package.json': '{"name":"@local/tokens"}', 'packages/web/package.json': '{"name":"@local/web"}',
    'tests/simulator/host/package.json': '{}', 'scripts/selection/proposal-devices.mjs': '// adopted',
    'scripts/gates/reuse/runner.mjs': '// sealed receipts',
    'tests/acceptance/suite-inputs.json': JSON.stringify({ groups: Object.fromEntries(required.map(name => [name, {}])) }),
    'tests/android/low-end-budget.json': readFileSync(new URL('../../../tests/android/low-end-budget.json', import.meta.url), 'utf8'),
  });
  const commit = (tree, parent) => git(['commit-tree', tree, ...(parent ? ['-p', parent] : []), '-m', 'Device fixture']);
  const base = commit(tree), integration = 'refs/remotes/origin/feat/enterprise-ui';
  git(['update-ref', integration, base]);
  function witness(revision, extraReads = [], finished = '2026-11-25T12:00:00Z') {
    const reads = [['file', 'catalog/native/scenarios/fixtures.cjs'], ...extraReads].map(x => JSON.stringify(x)).join('\n');
    const platforms = Object.fromEntries(['android','iphone'].map(platform => [platform,
      observation(platform, ['index.js','node_modules/@local/native/dist/button.js'], reads,
        new Map([['@local/native','packages/native']]), {})]));
    const existing = git(['rev-parse', integration]);
    if (git(['merge-base', existing, revision]) === existing) git(['update-ref', integration, revision, existing]);
    const receipt = dailyObservationFixture(root, revision, platforms, finished);
    sealReceipt(root, receipt);
    registerObservation(root, receipt);
    return receipt;
  }
  witness(base);
  return { root, base, edit, commit, witness };

}

test('only fresh daily integration qualifications can supply a device observation', t => {
  const { root, base, edit, commit, witness } = repository(t);
  const source = witness(base);
  assert.ok(retainedObservations(root, source.deviceInputs.key).some(row => row.id === source.id));
  const incomplete = source.suites.filter(row => row.name !== 'iPhone Simulator');
  assert.throws(() => requireDailyObservation(root, { ...source, suites: incomplete }), /daily suite roster/);
  const android = row => row.name === 'Android standard and low-end' ? { ...row, reusedFrom: 'old' } : row;
  assert.throws(() => requireDailyObservation(root, { ...source, suites: source.suites.map(android) }), /Android/);
  assert.throws(() => requireDailyObservation(root, { ...source, devices: { ...source.devices,
    android: source.devices.android.slice(0, 1) } }));
  assert.throws(() => requireDailyObservation(root, { ...source, androidTiming: { ...source.androidTiming,
    admission: null } }), /Android timing/);
  assert.throws(() => requireDailyObservation(root, { ...source, mode: 'release' }));
  const tree = edit(base, { 'docs/unmerged.md': 'draft' }), draft = commit(tree, base);
  assert.throws(() => requireDailyObservation(root, { ...source, tree, commit: draft, base: draft }), /integration commit/);
});

test('a daily observation requires every journey and scenario on each device profile', t => {
  const { root, base, witness } = repository(t);
  const source = witness(base);
  requireDailyObservation(root, source);
  const omit = edit => {
    const incomplete = structuredClone(source);
    edit(incomplete);
    return () => requireDailyObservation(root, incomplete);
  };
  assert.throws(omit(r => r.devices.iphone.scenarioIds.pop()), /iPhone.*scenario/);
  assert.throws(omit(r => r.devices.iphone.profiles.pop()), /iPhone.*profile/);
  assert.throws(omit(r => r.devices.iphone.testsPassed--), /iPhone.*journey/);
  assert.throws(omit(r => { delete r.deviceInputs.iphoneJourneys['appearance-dark.xml']; }), /iPhone.*journey/);
  assert.throws(omit(r => { r.deviceInputs.iphoneJourneys['appearance-dark.xml'] = '<testsuite/>'; }), /executed simulator journey/);
  for (const profile of ['standard','low-end']) {
    const observed = r => r.deviceInputs.androidReport.profiles.find(p => p.id === profile);
    assert.throws(omit(r => observed(r).passed.pop()), /did not pass every Android journey/);
    assert.throws(omit(r => observed(r).scenarioIds.pop()), /missed a registered scenario/);
  }
  assert.throws(omit(r => r.deviceInputs.androidReport.profiles.pop()), /Android qualification requires/);
});

test('the first descendant of an absent probed directory requires both devices', t => {
  const { root, base, edit, witness } = repository(t);
  const dir = 'tests/browser/optional-fixtures', proof = join(root, 'optional-read.jsonl');
  execFileSync(process.execPath, ['--require', fileURLToPath(new URL('../device-reads.cjs', import.meta.url)),
    '-e', "require('node:assert/strict').equal(require('node:fs').existsSync(process.argv[1]), false)", dir], {
    cwd: root, env: { ...process.env, ULD_DEVICE_READS: proof, ULD_DEVICE_ROOTS: JSON.stringify([root]) } });
  const reads = readFileSync(proof, 'utf8').trim().split('\n').map(JSON.parse);
  assert.ok(reads.some(([kind, path]) => kind === 'file' && path === dir));
  witness(base, reads);
  assert.equal(proposalDevices(root, base, edit(base, { [dir + '-web/first.json']: '{}' })).run, false);
  for (const suffix of ['/first.json', '/deep/first.json']) {
    const tree = edit(base, { [dir + suffix]: '{}' });
    const plan = proposalDevices(root, base, tree);
    assert.equal(plan.run, true);
    assert.match(plan.reason, /harness read/);
    assert.deepEqual(proposalScope(root, base, tree, plan), { iphone: true, families: null });
  }
});

test('landing retains the cited device witnesses and rejects newly required coverage', t => {
  const { root, base, edit, witness } = repository(t);
  const asset = 'tests/browser/theme.json', tree = edit(base, { [asset]: '{}' });
  const devicePlan = proposalDevices(root, base, tree);
  const receipt = { mode: 'qualification', noReuse: false, reuseSchema: 1, devicePlan, scope: proposalScope(root, base, tree, devicePlan) };
  assert.equal(verifiedDevicePlan(root, base, tree, receipt), 'scoped');
  witness(base);
  assert.equal(verifiedDevicePlan(root, base, tree, receipt), 'scoped');
  const missing = { ...devicePlan, evidence: [randomUUID()] };
  assert.throws(() => verifiedDevicePlan(root, base, tree, { ...receipt, devicePlan: missing }), /diff/);
  witness(base, [['file',asset]]);
  assert.throws(() => verifiedDevicePlan(root, base, tree, receipt), /diff/);
});

test('a failed daily covers all skipped integration proposals since the last full observation', t => {
  const { root, base, edit, commit, witness } = repository(t);
  function change(parent, path) {
    const tree = edit(parent, { [path]: 'fixture' });
    const devicePlan = proposalDevices(root, parent, tree);
    assert.equal(devicePlan.run, false);
    const receipt = { id: randomUUID(), tree, commit: commit(tree, parent), base: parent, devicePlan,
      reuseSchema: 1, mode: 'qualification', status: 'passed' };
    sealReceipt(root, receipt);
    return receipt;
  }
  const early = change(base, 'docs/previous.md');
  witness(early.commit);
  const a = change(early.commit, 'docs/first.md'), b = change(a.commit, 'docs/second.md');
  const sibling = change(early.commit, 'docs/unmerged.md');
  const daily = { id: randomUUID(), tree: b.tree, commit: b.commit, base: b.commit, status: 'failed',
    started: '2026-11-26T12:00:00Z' };
  for (let i = 0; i < 2; i++) recordScopeFailure(root, daily, [early, a, b, sibling]);
  const plan = path => proposalDevices(root, b.commit, edit(b.commit, { [path]: 'changed' }));
  for (const file of ['docs/first.md', 'docs/second.md']) {
    assert.equal(plan(file).paths[0].classification, 'prior daily full failure', file);
    assert.equal(plan(file).run, true, file);
  }
  witness(early.commit); // Repeating the same old observation cannot clear a later failure.
  for (const file of ['docs/previous.md', 'docs/unmerged.md']) {
    assert.equal(plan(file).paths[0].classification, 'documentation', file);
    assert.equal(plan(file).run, true, 'The failed observation cannot authorize another skip');
  }
});

test('a corrupt unrelated checkpoint cannot interrupt attribution of a failed daily', t => {
  const { root, base, edit, commit, witness } = repository(t);
  const last = witness(base);
  const change = (parent, path) => {
    const tree = edit(parent, { [path]: 'changed' });
    const devicePlan = proposalDevices(root, parent, tree);
    assert.equal(devicePlan.run, false);
    const proposal = {id:randomUUID(), base:parent, commit:commit(tree,parent), tree, devicePlan};
    sealReceipt(root, proposal);
    return proposal;
  };
  const a = change(base, 'docs/first.md'), b = change(a.commit, 'docs/second.md');
  const wrongKey = '0'.repeat(64);
  assert.notEqual(wrongKey, last.deviceInputs.key);
  fixtureGit(root, ['update-ref', 'refs/uld-archive/device-maps/' + wrongKey + '/' + last.id,
    'refs/uld-archive/reuse-receipts/' + last.id]);
  const daily = {id:randomUUID(), commit:b.commit, tree:b.tree, status:'failed', started:'2026-11-26T12:00:00Z'};
  recordScopeFailure(root, daily, [a,b]);
  const plan = proposalDevices(root, b.commit, edit(b.commit, {'docs/first.md':'again'}));
  assert.equal(plan.paths[0].classification, 'prior daily full failure');
  assert.equal(plan.run, true);
});

test('Maestro journeys resolve nested flows and shared JavaScript helpers before classifying device inputs', t => {
  const { root, base, edit, commit, witness } = repository(t);
  const journey = 'tests/simulator/workspace.yaml', shared = 'tests/browser/fixtures/shared.yaml';
  const script = 'tests/browser/fixtures/title.js';
  const source = {
    [journey]: 'appId: example.app\n---\n- runFlow: ../browser/fixtures/shared.yaml\n',
    [shared]: 'appId: example.app\n---\n- runFlow:\n    commands:\n      - runScript:\n          file: title.js\n',
    [script]: 'output.title = "Welcome";',
  };
  const parent = commit(edit(base, source), base);
  const inputs = deviceInputs(root, parent);
  assert.equal(inputs.opaque, undefined);
  assert.equal(inputs.classes.get(script), 'transitive device input');
  witness(parent);
  assert.equal(proposalDevices(root, parent, edit(parent, { [script]: 'output.title = "Settings";' })).run, true);
  assert.equal(proposalDevices(root, parent, edit(parent, { 'tests/browser/fixtures/unrelated.js': '// browser only' })).run, false);
  const logged = edit(parent, { [script]: 'console.log("Starting journey");' });
  assert.match(deviceInputs(root, logged).opaque, /unmodeled Maestro script/);
  const lifecycle = edit(parent, { [journey]: 'appId: example.app\nonFlowStart:\n  - runFlow: ../browser/fixtures/shared.yaml\n---\n- launchApp\n' });
  assert.equal(deviceInputs(root, lifecycle).opaque, undefined);
  assert.equal(deviceInputs(root, lifecycle).classes.get(script), 'transitive device input');
  for (const step of ['runScript: missing.js', 'addMedia: picture.png', 'runFlow: ${FLOW}', 'runFlow: shared.yaml']) {
    const unresolved = edit(parent, { [shared]: 'appId: example.app\n---\n- ' + step + '\n' });
    assert.ok(deviceInputs(root, unresolved).opaque, step);
    assert.equal(proposalDevices(root, unresolved, edit(unresolved, { 'docs/guide.md': 'updated' })).run, true);
  }
});

test('device decisions classify the complete integration diff and both ends of a rename', t => {
  const { root, base, edit } = repository(t);
  for (const [path, run] of [
    ['docs/guide.md', false], ['packages/web/src/button.tsx', false], ['catalog/Button.stories.tsx', false],
    ['tests/browser/button.spec.ts', false], ['packages/tokens/colors.json', true], ['package-lock.json', true],
    ['packages/web/package.json', true], ['scripts/gates/rule.mjs', true], ['docs/button.scenarios.yaml', true],
    ['catalog/native/story.stories.tsx', true], ['manifests/families/button.json', true], ['unknown/input', true],
  ]) {
    const plan = proposalDevices(root, base, edit(base, { [path]: '{}' }));
    assert.equal(plan.run, run, path);
    const status = path === 'packages/web/package.json' ? 'M' : 'A';
    assert.deepEqual(plan.paths.map(row => [row.status, row.path]), [[status, path]]);
  }
  const original = 'packages/native/src/button.js', destination = 'packages/web/src/button.js';
  const tree = edit(base, { [original]: null, [destination]: 'export const button = 1;' });
  const renamed = proposalDevices(root, base, tree);
  assert.equal(renamed.run, true);
  assert.deepEqual(renamed.paths.map(row => [row.status, row.path]), [['D', original], ['A', destination]]);
  assert.equal(proposalDevices(root, base, base).run, true);
});

test('native workspace reach includes transitive manifest and source edges and fails closed on ambiguity', t => {
  const { root, base: initial, edit } = repository(t);
  const base = edit(initial, {
    'packages/web/package.json': JSON.stringify({ name: '@local/web', exports: {
      './button': './src/button.js', './gallery': './src/gallery.js',
    } }),
    'packages/web/src/button.js': 'export const button = 1;',
    'packages/web/src/gallery.js': 'export const gallery = 1;',
  });
  const web = { 'packages/web/src/component.tsx': 'export default 1;', 'packages/web/src/button.js': 'export const button = 2;' };
  for (const via of [
    { 'packages/native/src/button.js': "export { button } from '@local/web/button';" },
    { 'packages/native/src/button.js': "const button = require('../../web/src/button');" },
    { 'packages/native/package.json': '{"name":"@local/native","peerDependencies":{"@local/shared":"*"}}',
      'packages/shared/package.json': '{"name":"@local/shared"}',
      'packages/shared/src/bridge.mts': "export const load = () => import('@local/web/button');" },
    { 'catalog/native/Gallery.tsx': "import '@local/web/gallery';" },
    { 'tests/android/screens/sample.tsx': "export * from '@local/web/gallery';" },
  ]) {
    const parent = edit(base, via);
    assert.equal(deviceInputs(root, parent).opaque, undefined);
    const plan = proposalDevices(root, parent, edit(parent, web));
    assert.equal(plan.run, true);
    assert.equal(plan.paths[0].classification, 'native workspace dependency');
    assert.ok(plan.paths.every(row => row.classification === 'native workspace dependency'));
  }
  const ambiguous = edit(base, { 'packages/native/src/loader.js': 'export const load = name => require(name);' });
  const plan = proposalDevices(root, ambiguous, edit(ambiguous, web));
  assert.equal(plan.run, true);
  assert.match(plan.reason, /unresolved source imports/);
  const missingExport = edit(base, {
    'packages/native/package.json': '{"name":"@local/native","dependencies":{"vendor":"1.0.0"}}',
    'package-lock.json': '{"packages":{"node_modules/vendor":{"integrity":"fixture"}}}',
    'packages/native/src/button.js': "import 'vendor/unchecked';",
  });
  assert.match(proposalDevices(root, missingExport, edit(missingExport, web)).reason, /unresolved import vendor/);
});

test('landing replays sealed device decisions and preserves every non-device verdict', t => {
  const { root, base, edit, commit } = repository(t);
  const directory = join(root, '.git', 'uld-receipts');
  mkdirSync(directory);
  const tree = edit(base, { 'docs/guide.md': 'Guide', 'packages/web/src/button.js': 'export default 1;' });
  const devicePlan = proposalDevices(root, base, tree);
  const scope = proposalScope(root, base, tree, devicePlan);
  const receipt = { id: randomUUID(), mode: 'qualification', reuseSchema: 1, base, tree, commit: commit(tree, base),
    status: 'passed', noReuse: false, devicePlan, scope, devices: {}, vm: { browsers: 'fixture', sourceImageSha256: 'fixture' },
    gateTests: { name: 'Trusted gate tests', result: 'passed' },
    suites: required.map(name => deviceSuites.includes(name) ? { name, durationMs: 0, result: 'web-only', reason: devicePlan.reason } :
      { name, durationMs: 1, result: 'passed' }) };
  function save(row, mutate) {
    row = { ...row, id: randomUUID() };
    sealReceipt(root, row);
    if (mutate) row = mutate(row);
    writeFileSync(join(directory, row.tree + '.json'), JSON.stringify(row));
    return () => passing(row.tree, base, directory, { root, commit: row.commit });
  }
  assert.equal(qualificationStatus(receipt.suites, undefined, receipt), 'passed');
  assert.equal(save(receipt)().tree, tree);
  assert.throws(save({ ...receipt, devicePlan: { ...devicePlan, paths: devicePlan.paths.slice(1) } }), /diff/);
  assert.throws(save(receipt, row => ({ ...row, devicePlan: { ...row.devicePlan, paths: [] } })), /changed after its verdict/);
  assert.throws(save({ ...receipt, devicePlan: undefined }), /earlier failed qualification/);
  assert.throws(save({ ...receipt, noReuse: true }));
  assert.throws(save({ ...receipt, suites: receipt.suites.filter(row => row.name !== 'Catalog build') }));
  assert.throws(save({ ...receipt, suites: receipt.suites.map(row => row.name === 'Fast' ? { ...row, result: 'web-only' } : row) }));
  const phone = edit(base, { 'packages/native/src/button.js': 'export const button = 2;' });
  assert.throws(save({ ...receipt, tree: phone, commit: commit(phone, base) }), /diff/);
});

test('the device hold runs the full roster for an ordinary web-only qualification', t => {
  const { root, base, edit } = repository(t);
  const tree = edit(base, { 'docs/guide.md': 'Guide' });
  assert.equal(proposalDevices(root, base, tree).run, false);
  const devicePlan = proposalDevices(root, base, tree, requireFullDevices);
  const scope = proposalScope(root, base, tree, devicePlan);
  assert.equal(devicePlan.run, true);
  assert.deepEqual(scope, { iphone: true, families: null });
  assert.equal(verifiedDevicePlan(root, base, tree, {
    mode: 'qualification', reuseSchema: 1, noReuse: false, devicePlan, scope,
  }), 'measured');
});

test('daily and release device selection always requires the full roster and rejects scoped daily evidence', t => {
  const { root, base, edit } = repository(t);
  const tree = edit(base, { 'docs/guide.md': 'Guide' });
  const plan = proposalDevices(root, base, tree, true);
  assert.equal(plan.run, true);
  assert.deepEqual(proposalScope(root, base, tree, plan), { iphone: true, families: null });
  const scoped = proposalDevices(root, base, tree);
  assert.throws(() => compareFullRun(root, { noReuse: true, mode: 'qualification', devicePlan: scoped, suites: [] }, []),
    /both devices/);
});

test('device closure includes generator refs, CSS assets, Android modes and transitive shared fixtures', t => {
  const { root, base, edit } = repository(t);
  const through = {
    'packages/native/src/button.js': "export * from '../../core/src/model.js';",
    'packages/core/package.json': '{"name":"@local/core","scripts":{"prebuild":"node ../../scripts/generate-core.mjs"}}',
    'scripts/generate-core.mjs': "import seed from '../tests/browser/model.json' with { type: 'json' };",
    'tests/browser/model.json': '{}',
    'packages/core/src/model.ts': "import type { Tag } from '../../../tests/browser/tag'; import './screen.css';",
    'packages/core/src/screen.css': '@import "../../../tests/browser/theme.css";',
    'tests/browser/theme.css': 'a { background: url("./tile.png") }',
    'tests/browser/tile.png': 'pixels', 'tests/browser/tag.ts': 'export type Tag = string;',
    'packages/tokens/source.json': '{"$ref":"../../tests/browser/shared.json"}',
    'tests/browser/shared.json': '{"$ref":"nested.json"}', 'tests/browser/nested.json': '{}',
    'catalog/modes/palette.stories.tsx': 'export default 1;',
    'tests/simulator/scenarios.mjs': "import { read } from '../support/helper.mjs'; read();",
    'tests/support/helper.mjs': "export function read() { return import('../browser/device-data.js'); }",
    'tests/browser/device-data.js': 'export default 1;',
  };
  const parent = edit(base, through);
  const staticMap = deviceInputs(root, parent);
  assert.equal(staticMap.opaque, undefined);
  for (const file of ['tests/browser/tag.ts','tests/browser/tile.png','tests/browser/theme.css',
    'catalog/modes/palette.stories.tsx','tests/browser/nested.json','tests/browser/shared.json','tests/browser/device-data.js','tests/browser/model.json']) {
    const plan = proposalDevices(root, parent, edit(parent, { [file]: through[file] + ' ' }));
    assert.equal(plan.run, true, file);
    assert.match(plan.paths[0].classification, /device/, file);
  }
  const smaller = edit(parent, { 'packages/tokens/source.json': '{}' });
  const shrunk = proposalDevices(root, parent, smaller);
  assert.ok(shrunk.demotions.some(row => row.path === 'tests/browser/nested.json' && row.reason));
  for (const body of ["import './missing';", 'require(key)', 'import.meta.glob("./*.js")']) {
    const broken = edit(base, { 'packages/native/src/button.js': body });
    assert.match(proposalDevices(root, broken, edit(broken, { 'docs/guide.md': 'Guide' })).reason, /unresolved/);
  }
  for (const input of [
    { 'ios/Podfile': "eval(File.read('../docs/input.md'))" },
    { 'android/build.gradle': "apply from: '../docs/input.md'" },
    { 'packages/native/package.json': '{"name":"@local/native","scripts":{"build":"sh generate.sh"}}' },
  ]) {
    const changed = edit(base, input);
    const plan = proposalDevices(root, changed, edit(changed, { 'docs/input.md': 'new' }));
    assert.equal(plan.run, true);
    assert.match(plan.reason, /unmodeled/);
  }
});

test('device completeness checks Metro outputs and inherited harness reads with the production classifier', t => {
  const { root, base, edit, commit, witness } = repository(t);
  const proof = join(root, 'reads.jsonl'), preload = fileURLToPath(new URL('../device-reads.cjs', import.meta.url));
  const src = 'tests/browser/indirect.json', nested = 'docs/calibration.md';
  for (const file of [src, nested]) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), '123');
  }
  const child = "import { readFile, stat, readdir } from 'node:fs/promises'; await stat('docs'); await readdir('tests/browser'); await readFile(new URL('./" +
    nested + "', import.meta.url));";
  execFileSync(process.execPath, ['-e', "require('node:fs').openSync(Buffer.from(" + JSON.stringify(src) + "),'r');" +
    "require('node:child_process').execFileSync(process.execPath,['--input-type=module','-e'," + JSON.stringify(child) + ']);'], {
    cwd: root, env: { ...process.env, NODE_OPTIONS: '--require ' + JSON.stringify(preload),
      ULD_DEVICE_READS: proof, ULD_DEVICE_ROOTS: JSON.stringify([root]) } });
  const reads = readFileSync(proof, 'utf8').trim().split('\n').map(JSON.parse);
  const tree = edit(base, { [src]: '123', [nested]: '123' });
  const daily = witness(commit(tree, base), reads);
  const map = deviceInputs(root, tree);
  checkDeviceCompleteness(map, daily.deviceInputs.platforms);
  assert.throws(() => checkDeviceCompleteness(map, daily.deviceInputs.platforms, (...args) =>
    args[3] === nested ? 'documentation' : classifyDevicePath(...args)), /classified as skippable/);
  for (const file of [src, nested, 'tests/browser/new.spec.ts']) {
    const next = edit(tree, { [file]: '456' });
    assert.equal(proposalDevices(root, tree, next).run, true, file);
  }
  // A changed read can change which other files the harness opens next.
  const changed = edit(tree, { [nested]: '456' });
  const docs = edit(changed, { 'docs/other.md': 'unrelated' });
  assert.equal(proposalDevices(root, changed, docs).run, true);
  assert.throws(() => observation('iphone', ['index.js','node_modules/missing/file','unmapped.ts'], '', new Map(), {}));
});

test('a failed full run permanently promotes paths from a skipped proposal on the exact landed tree', t => {
  const { root, base, edit } = repository(t);
  const file = 'docs/example.md', tree = edit(base, { [file]: 'one' });
  const proposal = { id: randomUUID(), tree, devicePlan: proposalDevices(root, base, tree) };
  assert.equal(proposal.devicePlan.run, false);
  const daily = { id: randomUUID(), tree, status: 'failed' };
  recordScopeFailure(root, { ...daily, tree: base }, [proposal]);
  assert.equal(proposalDevices(root, base, tree).run, false);
  recordScopeFailure(root, daily, [proposal]);
  recordScopeFailure(root, daily, [proposal]);
  const plan = proposalDevices(root, tree, edit(tree, { [file]: 'two' }));
  assert.equal(plan.run, true);
  assert.equal(plan.paths[0].classification, 'prior daily full failure');
});

test('production Metro capture retains the selected platform modules in both built test bundles', t => {
  const host = mkdtempSync(join(tmpdir(), 'metro-device-control-'));
  t.after(() => rmSync(host, { recursive: true, force: true }));
  const project = fileURLToPath(new URL('../../../', import.meta.url)), modules = join(project, 'node_modules');
  const pkg = 'node_modules/@ui-lazy-dev/ui-native';
  mkdirSync(join(host, pkg), { recursive: true });
  for (const name of ['metro','metro-config','metro-runtime'])
    cpSync(join(modules, name), join(host, 'node_modules', name), { recursive: true });
  writeFileSync(join(host, 'index.js'), "module.exports = require('./" + pkg + "/component');");
  for (const platform of ['ios','android'])
    writeFileSync(join(host, pkg, 'component.' + platform + '.js'), 'module.exports = ' + JSON.stringify(platform) + ';');
  const trace = join(host, 'scenario-reads.jsonl');
  const preload = fileURLToPath(new URL('../device-reads.cjs', import.meta.url));
  execFileSync(process.execPath, ['--require', preload, '--input-type=module', '-e',
    "import {readCandidateScenarios} from './scripts/scenarios/fixture-metadata.mjs'; " +
    "if (!readCandidateScenarios(process.cwd()).length) throw Error('Missing device scenarios');"], {
    cwd: project, env: { ...process.env, ULD_DEVICE_ROOTS: JSON.stringify([project]), ULD_DEVICE_READS: trace } });
  const lock = JSON.parse(readFileSync(join(project, 'tests/simulator/host/package-lock.json'))).packages;
  const fixture = repository(t);
  const recorder = fixture.edit(fixture.base, {
    'tests/android/preload.cjs': "require('../../scripts/gates/device-metro.cjs');",
    'scripts/gates/device-metro.cjs': readFileSync(new URL('../device-metro.cjs', import.meta.url), 'utf8'),
    'tests/simulator/host/package-lock.json': JSON.stringify({ packages: lock }),
  });
  assert.equal(deviceInputs(fixture.root, recorder).opaque, undefined, 'The production recorder must resolve in the host');
  const map = deviceInputs(project, 'HEAD'), platforms = {};
  // Use exactly the capture installed in bundleJavaScript; no host or device is required.
  const program = `
    const { getDefaultConfig } = require('metro-config');
    const Metro = require('metro');
    (async () => {
      const config = await getDefaultConfig(process.cwd());
      config.watchFolders = [process.cwd(), require('node:path').dirname(require.resolve('metro-runtime/package.json'))];
      config.resolver.useWatchman = false;
      config.maxWorkers = 1;
      config.cacheStores = [];
      config.reporter = { update() {} };
      const bundle = await Metro.runBuild(config, {entry:'index.js', platform:process.argv[1],
        assets:true, dev:false, minify:false, sourceMap:false});
      require('node:assert/strict').ok(bundle.code.length);
    })();
  `;
  const capture = join(host, 'device-metro.cjs');
  copyFileSync(new URL('../device-metro.cjs', import.meta.url), capture);
  for (const platform of ['ios','android']) {
    const output = join(host, platform + '.json');
    execFileSync(process.execPath, ['--require', capture, '-e', program, platform], {
      cwd: host, env: { ...process.env, NODE_PATH: modules, ULD_METRO_INPUTS: output } });
    const files = JSON.parse(readFileSync(output));
    assert.ok(files.includes('index.js'));
    assert.deepEqual(files.filter(path => path.startsWith(pkg + '/component.')), [pkg + '/component.' + platform + '.js']);
    const device = platform === 'ios' ? 'iphone' : 'android';
    platforms[device] = observation(device, files, readFileSync(trace, 'utf8'),
      new Map([['@ui-lazy-dev/ui-native','packages/native']]), lock, [...map.classes.keys()]);
    assert.ok(platforms[device].files.some(path => path.endsWith('.scenarios.yaml')));
  }
  checkDeviceCompleteness(map, platforms);
});
