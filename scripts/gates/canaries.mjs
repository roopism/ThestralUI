import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { androidTiming, apkDigest, apkIdentity, timingForIdenticalApk } from './android-timing-reuse.mjs';
import { summarizeTrials } from '../../tests/android/frame-budget.mjs';
import { reuseCanaries } from './reuse/canaries.mjs';
import { noWeakening } from './no-weakening.mjs';
import { depthRegistry, derivedRegistrations } from './registrations.mjs';
import { renderDepthRegistry } from '../manifests/depth-registry.mjs';

const root = process.cwd();
const dir = mkdtempSync(join(tmpdir(), 'uld-gate-canaries-'));
const env = { ...process.env, GIT_INDEX_FILE: join(dir, 'index') };
const git = (args, input) => execFileSync('git', args, { cwd: root, env, input, encoding: 'utf8' }).trim();
const base = git(['rev-parse', '--verify', (process.argv[2] ?? 'HEAD') + '^{tree}']);
function writeBlob(path, content) {
  const blob = git(['hash-object', '-w', '--stdin'], content);
  git(['update-index', '--add', '--cacheinfo', '100644,' + blob + ',' + path]);
}
function canary(path, edit, expected, seed) {
  git(['read-tree', base]);
  if (seed !== undefined) writeBlob(path, seed);
  const parent = git(['write-tree']);
  const before = git(['show', parent + ':' + path]);
  const after = edit(before);
  assert.notEqual(before, after);
  writeBlob(path, after);
  const errors = noWeakening(root, parent, git(['write-tree']));
  if (!expected) {
    assert.deepEqual(errors, []);
    console.log('Allowed tightening', path);
    return;
  }
  assert.ok(errors.some(issue => issue.startsWith(path) && expected.test(issue)), errors.join('\n'));
  console.log('Rejected', path, errors[0]);
}
try {
  assert.deepEqual(noWeakening(root, base, base), []);
  console.log('Unchanged tree passed.');
  reuseCanaries();
  console.log('Verified result reuse and its independent audit.');
  const sample = { frames: 20, inputs: 10, p95FrameMs: 12, p95InputToCommitMs: 15, deadlineMissFraction: 0 };
  const measured = summarizeTrials([sample, sample, sample]);
  const frameBudget = { press: measured, scroll: measured };
  const limits = { press: sample, scroll: sample };
  const apk = Buffer.from([0, 1, 2, 3]);
  const original = apkDigest(apk);
  const passing = { tree: base, status: 'passed', mode: 'qualification', androidTiming: { apkSha256: original, frameBudget } };
  assert.deepEqual(timingForIdenticalApk(passing, base, apkDigest(Buffer.from(apk)), limits), frameBudget);
  apk[3] ^= 1;
  assert.equal(timingForIdenticalApk(passing, base, apkDigest(apk), limits), undefined);
  assert.equal(timingForIdenticalApk({ ...passing, status: 'failed' }, base, original, limits), undefined);
  assert.equal(timingForIdenticalApk(passing, 'different-base', original, limits), undefined);
  console.log('Identical APK reuses passing base timing. A single changed byte forces live timing.');
  function fixture(name, signature, content, year) {
    const apk = join(dir, name + '.apk');
    execFileSync('python3', ['-c', `
import sys, zipfile
apk, signature, content, year = sys.argv[1:]
with zipfile.ZipFile(apk, "w") as archive:
    for name, value in [("classes.dex", content), ("META-INF/MANIFEST.MF", "keep"), ("META-INF/CERT.RSA", signature)]:
        archive.writestr(zipfile.ZipInfo(name, (int(year), 1, 1, 0, 0, 0)), value)
`, apk, signature, content, year]);
    return apk;
  }
  const originalIdentity = apkIdentity(fixture('original', 'first', 'abc', '2024'));
  const resigned = fixture('resigned', 'other', 'abc', '2025');
  const changed = fixture('changed', 'other', 'abd', '2025');
  const manifestReceipt = { ...passing, androidTiming: { ...originalIdentity, frameBudget } };
  // Exercise the stage's real receipt lookup and live-measurement callback.
  const checkout = join(dir, 'checkout');
  execFileSync('git', ['init', '--quiet', checkout]);
  writeFileSync(join(checkout, '.git/objects/info/alternates'), git(['rev-parse', '--path-format=absolute', '--git-path', 'objects']) + '\n');
  writeFileSync(join(checkout, '.git/gate-selection.json'), JSON.stringify({ budgetComparisonBase: base }));
  mkdirSync(join(dir, 'uld-receipts'));
  writeFileSync(join(dir, 'uld-receipts', base + '.json'), JSON.stringify(manifestReceipt));
  let calls = 0;
  const runApk = apk => androidTiming({ apk, root: checkout, common: dir, limits, measure: () => { calls++; return frameBudget; } });
  const reused = await runApk(resigned);
  assert.equal(reused.result, 'timing reused: identical app');
  assert.equal(calls, 0);
  assert.notEqual(reused.apkSha256, originalIdentity.apkSha256);
  assert.equal(reused.baseApkSha256, originalIdentity.apkSha256);
  assert.equal(reused.entryManifestSha256, originalIdentity.entryManifestSha256);
  assert.equal(reused.sourceReceipt, 'uld-receipts/' + base + '.json');
  const live = await runApk(changed);
  assert.equal(live.result, 'timing measured');
  assert.notEqual(live.entryManifestSha256, originalIdentity.entryManifestSha256);
  assert.equal(calls, 1);
  console.log('A new signature and ZIP timestamps reuse timing. One changed app byte forces live timing.');
  canary('tests/contracts/cascade-layers.test.mjs', text =>
    text.replace(/^\s*assert\.equal\(rule\.type,[^\n]*\n/m, '\n'), /removed assert/);
  canary('tests/packaging/default-ceiling.json', text => {
    const data = JSON.parse(text);
    data.defaultCeiling++;
    return JSON.stringify(data);
  }, /numeric limit/);
  canary('packages/style-policy/profiles/library.baseline.json', text => {
    const rows = JSON.parse(text);
    rows[0].entries.push(rows[0].entries[0]);
    return JSON.stringify(rows);
  }, /baseline gained/);
  canary('tests/packaging/bundle-baseline.json', text => {
    const rows = JSON.parse(text), [first] = Object.keys(rows);
    return JSON.stringify({ ...rows, [first]: rows[first] + 1 });
  }, /baseline gained/);
  canary('tests/packaging/bundle-baseline.json', text =>
    JSON.stringify({ ...JSON.parse(text), '@ui-lazy-dev/ui-web/unowned-canary': 1 }), /no single new family budget/);
  canary('tests/acceptance/control.spec.ts', text => text + "\ntest.describe.skip('group', () => {});",
    /focused or skipped/, "test('case', () => { assert.ok(true); });");
  canary('tests/acceptance/control-policy.json', () => '{"exceptions":[{"rule":"scope","path":"a.css"}]}',
    /exception lacks/, '{"exceptions":[]}');
  canary('tests/acceptance/Control.java', text => text.replace('assert enabled;', ''),
    /removed assertion/, 'class Control { void verify() { assert enabled; } }');
  canary('tests/acceptance/Control.kt', text => text.replace('<= 10', '<= 9'),
    null, 'fun verify(size: Int) { check(size <= 10) }');
  const guard = 'class Control { void validate(int size) { if (size >= 10) throw new Error(); } }';
  canary('tests/acceptance/Control.java', text => text.replace('> 10', '> 11'),
    /numeric limit/, guard.replace('>=', '>'));
  canary('tests/acceptance/Control.java', text => text.replace('>= 10', '>= 9'),
    null, guard);
  canary('scripts/gates/control.mjs', () => '', /removed registered suite/,
    "step('Control', () => run('engine'));");
  execFileSync(process.execPath, ['--test', fileURLToPath(new URL('./tests/landing-evidence.test.mjs', import.meta.url))],
    { stdio: 'inherit' });
  // A family branch may carry only its own regenerated API-depth row.
  const manifests = git(['ls-tree', '--name-only', base + ':manifests/families']).split('\n')
    .map(name => [name, git(['show', base + ':manifests/families/' + name])]);
  const shared = JSON.parse(git(['show', base + ':manifests/shared.json']));
  function registration(edit) {
    git(['read-tree', base]);
    const rows = manifests.map(([name, body]) => ({ name, row: JSON.parse(body) }));
    const before = rows.map(({ row }) => JSON.stringify(row));
    edit(new Map(rows.map(({ row }) => [row.id, row])));
    rows.forEach(({ name, row }, index) => {
      if (JSON.stringify(row) !== before[index]) writeBlob('manifests/families/' + name, JSON.stringify(row, null, 2) + '\n');
    });
    const ordered = rows.map(({ row }) => row).sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
    writeBlob(depthRegistry, renderDepthRegistry(ordered, shared));
    return git(['write-tree']);
  }
  const addBinding = families => families.get('Breadcrumb').inventory.api.push('breadcrumb:Breadcrumbs');
  assert.deepEqual([...derivedRegistrations(root, base, registration(addBinding), 'family/breadcrumb')], [depthRegistry]);
  console.log('Allowed a family registering its own depth row');
  for (const [name, branch, edit, expected] of [
    ['another family', 'family/badge', addBinding, /owned by family\/breadcrumb/],
    ['a removed row', 'family/breadcrumb', families => { delete families.get('Breadcrumb').depth; }, /removed or reordered/],
    ['a malformed row', 'family/breadcrumb', families => { families.get('Breadcrumb').depth.waiver = true; }, /product-registration/],
  ]) {
    assert.throws(() => derivedRegistrations(root, base, registration(edit), branch), expected);
    console.log('Rejected depth registration from', name);
  }
  // Attaching the caught error as `cause` keeps a rejection. Any other change to it does not.
  const rejection = "export function guard(value) {\n  try { value(); } catch (error) {\n" +
    "    throw Object.assign(Error('Control rejected'), { code: 'ECONTROL' });\n  }\n}\n";
  const caused = rejection.replace("Error('Control rejected')", "Error('Control rejected', { cause: error })");
  canary('scripts/gates/control-throw.mjs', () => caused, null, rejection);
  for (const [edit, seed] of [
    [text => text.replace('Control rejected', 'Control failed'), caused],
    [text => text.replace("'ECONTROL'", "'EOTHER'"), caused],
    [text => text.replace('Error(', 'TypeError('), caused],
    [text => text.replace(/^ {4}throw [^\n]*\n/m, ''), caused],
    [text => text.replace(', { cause: error }', ''), caused],
    [text => text.replace('cause: error', 'cause: value'), caused],
  ]) canary('scripts/gates/control-throw.mjs', edit, /removed reject/, seed);
  const guarded = rejection.replace('    throw', "    if (Error('guard').cause) throw");
  const nested = rejection.replace("Error('Control rejected')", "Error(Error('detail').message)");
  for (const [seed, edit] of [
    [guarded, text => text.replace("Error('guard')", "Error('guard', { cause: error })")],
    [nested, text => text.replace("Error('detail')", "Error('detail', { cause: error })")],
    [rejection, () => caused.replace('cause: error', 'cause: value')],
  ]) canary('scripts/gates/control-throw.mjs', edit, /removed reject/, seed);

} finally {
  rmSync(dir, { recursive: true, force: true });
}
