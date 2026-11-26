import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync,
  renameSync, rmSync, writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { installSnapshotDependencies } from '../../../packages/policy/quality/snapshot-dependencies.mjs';
import { withRevisionSnapshot } from '../../../packages/policy/quality/staged-tree.mjs';
import { preparePackedApk } from '../../../tests/android/host.mjs';
import { apkIdentity } from '../android-timing-reuse.mjs';

const hash = /^[a-f0-9]{64}$/;
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const integration = 'refs/remotes/origin/feat/enterprise-ui';

function baseTree(common, base) {
  const git = ref => execFileSync('git', [
    '--no-replace-objects', '--git-dir', common, 'rev-parse', '--verify', '--end-of-options', ref,
  ], { encoding: 'utf8' }).trim();
  assert.equal(base, git(integration + '^{commit}'), 'Android timing base must be the fetched integration tip');
  return git(base + '^{tree}');
}

function receiptIdentity(common, tree) {
  const file = join(common, 'uld-receipts', tree + '.json');
  if (!existsSync(file)) return;
  const receipt = read(file);
  assert.equal(receipt.tree, tree, 'Wrong integration tree in Android timing receipt');
  if (receipt.status !== 'passed' || !receipt.androidTiming) return;
  assert.ok(['incumbent', 'release', 'qualification'].includes(receipt.mode), 'Unknown timing receipt mode');
  const { apkSha256, entryManifestSha256 } = receipt.androidTiming;
  assert.match(apkSha256, hash);
  if (entryManifestSha256 !== undefined) {
    assert.match(entryManifestSha256, hash);
    return { apkSha256, entryManifestSha256 };
  }
  // Older incumbent receipts identify a retained APK by its signed-file hash alone.
  if (receipt.mode === 'incumbent' && receipt.androidReport) {
    const apk = join(common, dirname(receipt.androidReport), 'android/apk/app-release.apk');
    if (existsSync(apk)) {
      const identity = apkIdentity(apk);
      assert.equal(identity.apkSha256, apkSha256, 'Retained integration APK differs from its receipt');
      return identity;
    }
  }
  return { apkSha256 };
}

function matchesReceipt(identity, receipt) {
  if (!receipt) return true;
  return receipt.entryManifestSha256
    ? identity.entryManifestSha256 === receipt.entryManifestSha256
    : identity.apkSha256 === receipt.apkSha256;
}

function readRecord(file) {
  try { return read(file); }
  catch (error) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error; }
}

function readObject(objects, entryManifestSha256, apkSha256) {
  if (![entryManifestSha256, apkSha256].every(value => typeof value === 'string' && hash.test(value))) return;
  const apk = join(objects, entryManifestSha256, apkSha256 + '.apk');
  if (!lstatSync(apk, { throwIfNoEntry: false })?.isFile()) return;
  try {
    const identity = apkIdentity(apk);
    if (identity.apkSha256 === apkSha256 && identity.entryManifestSha256 === entryManifestSha256)
      return { apk, ...identity };
  } catch (error) {
    // A partial or damaged zip cannot supply either arm of a timing run.
    if (error.status !== 1) throw error;
  }
}

async function buildBaseApk({ snapshot, tree, env, common, base, tools, reports }) {
  installSnapshotDependencies(snapshot, join(common, 'uld-dependencies'), env);
  const options = { cwd: snapshot, env: { ...env, ULD_ARTIFACT_COMMON: common }, stdio: 'inherit' };
  writeFileSync(join(snapshot, '.git/gate-selection.json'), JSON.stringify({ budgetComparisonBase: base }));
  execFileSync('npm', ['run', 'build:packages'], options);
  execFileSync(process.execPath, ['scripts/verify-artifacts.mjs', '--built-snapshot'], options);
  const evidence = join(snapshot, 'release/evidence');
  assert.equal(read(join(evidence, 'provenance.json')).trackedTree, tree, 'Wrong tree in base package provenance');
  return (await preparePackedApk(snapshot, evidence, tools, join(reports, 'base-app'))).apk;
}

// The caller prepares both APKs before the measurement reservation. Only this trusted
// builder supplies the base, including on the first qualification without a timing receipt.
export async function prepareBaseApp({ root, common, base, tools, reports }, build = buildBaseApk) {
  const tree = baseTree(common, base);
  const sourceTree = execFileSync('git', [
    '--no-replace-objects', '-C', root, 'rev-parse', '--verify', '--end-of-options', base + '^{tree}',
  ], { encoding: 'utf8' }).trim();
  assert.equal(sourceTree, tree, 'The source checkout does not contain the integration tree');
  const receipt = receiptIdentity(common, tree);
  const cache = join(common, 'uld-cache', 'android-base-app');
  const objects = join(cache, 'objects');
  const index = join(cache, 'commits', base + '.json');
  const record = readRecord(index);
  let app;
  if (record?.commit === base && record.tree === tree && matchesReceipt(record, receipt))
    app = readObject(objects, record.entryManifestSha256, record.apkSha256);
  if (!app && receipt?.entryManifestSha256) {
    const directory = join(objects, receipt.entryManifestSha256);
    if (existsSync(directory)) {
      for (const name of readdirSync(directory).sort()) {
        if (!name.endsWith('.apk')) continue;
        app = readObject(objects, receipt.entryManifestSha256, basename(name, '.apk'));
        if (app) break;
      }
    }
  }
  const cacheHit = Boolean(app);
  if (!app) {
    app = await withRevisionSnapshot(root, base, async (snapshot, actualTree, env) => {
      assert.equal(actualTree, tree, 'Integration snapshot contains the wrong tree');
      const apk = await build({ snapshot, tree, env, common, base, tools, reports });
      const identity = apkIdentity(apk);
      assert.ok(matchesReceipt(identity, receipt), 'Built base APK differs from the passing integration receipt');
      const directory = join(objects, identity.entryManifestSha256);
      mkdirSync(directory, { recursive: true });
      const target = join(directory, identity.apkSha256 + '.apk');
      const temporary = join(directory, randomUUID() + '.tmp');
      try {
        copyFileSync(apk, temporary);
        assert.deepEqual(apkIdentity(temporary), identity, 'Base APK changed during cache publication');
        renameSync(temporary, target);
      } finally { rmSync(temporary, { force: true }); }
      return { apk: target, ...identity };
    }, { ...process.env, GIT_NO_REPLACE_OBJECTS: '1' });
  }
  assert.equal(baseTree(common, base), tree, 'Integration moved while preparing the base APK');
  if (!cacheHit || record?.commit !== base || record.tree !== tree ||
      record.apkSha256 !== app.apkSha256 || record.entryManifestSha256 !== app.entryManifestSha256) {
    mkdirSync(dirname(index), { recursive: true });
    const tmp = index + '.' + randomUUID() + '.tmp';
    try {
      writeFileSync(tmp, JSON.stringify({ commit: base, tree, apkSha256: app.apkSha256,
        entryManifestSha256: app.entryManifestSha256 }) + '\n');
      renameSync(tmp, index);
    } finally { rmSync(tmp, { force: true }); }
  }
  return { ...app, commit: base, tree, cacheHit };
}
