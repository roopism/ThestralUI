import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { apkIdentity } from '../android-timing-reuse.mjs';
import { prepareBaseApp } from '../timing/base-app.mjs';
import { prepareTimingStrategy } from '../timing/android.mjs';
import { fixtureGit, isolateFixtureProcess } from './fixtures/hermetic-git.mjs';

isolateFixtureProcess();

const integration = 'refs/remotes/origin/feat/enterprise-ui';
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'uld-base-app-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const common = join(root, '.git');
  const git = (...args) => fixtureGit(root, args);
  git('init', '--quiet', '--template=');
  function promote(contents) {
    writeFileSync(join(root, 'app.txt'), contents);
    git('add', '--', 'app.txt');
    const commit = git('commit-tree', git('write-tree'), '-m', contents);
    git('update-ref', integration, commit);
    return commit;
  }
  const base = promote('calendar');
  return { root, common, base, git, promote, reports: join(root, 'reports') };
}

function archive(path, content, signature = 'first') {
  execFileSync('python3', ['-c', [
    'import sys, zipfile',
    'with zipfile.ZipFile(sys.argv[1], "w") as archive:',
    '    archive.writestr("assets/app.txt", sys.argv[2])',
    '    archive.writestr("META-INF/DEMO.SF", sys.argv[3])',
  ].join('\n'), path, content, signature]);
  return path;
}

function publishReceipt(f, identity) {
  const tree = f.git('rev-parse', f.base + '^{tree}');
  const file = join(f.common, 'uld-receipts', tree + '.json');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ tree, status: 'passed', mode: 'qualification', androidTiming: identity }));
}

test('the Android base app uses the committed integration tree and survives snapshot removal and relocation', async t => {
  const f = fixture(t);
  writeFileSync(join(f.root, 'app.txt'), 'uncommitted notebook');
  await assert.rejects(prepareTimingStrategy(f, true), /functional phase must prepare/);
  let snapshotPath;
  const first = await prepareBaseApp(f, ({ snapshot }) => {
    snapshotPath = snapshot;
    const content = readFileSync(join(snapshot, 'app.txt'), 'utf8');
    assert.equal(content, 'calendar');
    return archive(join(snapshot, 'base.apk'), content);
  });
  assert.equal(existsSync(snapshotPath), false);
  const cached = await prepareTimingStrategy(f, true);
  assert.equal(cached.base.apkSha256, first.apkSha256);
  assert.equal(cached.base.cacheHit, true);
  assert.equal(first.cacheHit, false);
  assert.deepEqual(apkIdentity(first.apk), { apkSha256: first.apkSha256, entryManifestSha256: first.entryManifestSha256 });
  const relocated = f.root + '-relocated';
  renameSync(f.root, relocated);
  t.after(() => rmSync(relocated, { recursive: true, force: true }));
  const hit = await prepareBaseApp({ ...f, root: relocated, common: join(relocated, '.git') }, assert.fail);
  assert.equal(hit.cacheHit, true);
  assert.equal(hit.apkSha256, first.apkSha256);
  assert.ok(hit.apk.startsWith(join(relocated, '.git/uld-cache') + '/'));
});

test('a passing integration receipt selects an identical cached app across commits and signatures', async t => {
  const f = fixture(t);
  const first = await prepareBaseApp(f, ({ snapshot }) => archive(join(snapshot, 'base.apk'), 'calendar'));
  f.base = f.promote('calendar documentation');
  const resigned = apkIdentity(archive(join(f.root, 'resigned.apk'), 'calendar', 'next'));
  assert.notEqual(resigned.apkSha256, first.apkSha256);
  assert.equal(resigned.entryManifestSha256, first.entryManifestSha256);
  publishReceipt(f, resigned);
  const hit = await prepareBaseApp(f, assert.fail);
  assert.equal(hit.cacheHit, true);
  assert.equal(hit.commit, f.base);
  assert.equal(hit.tree, f.git('rev-parse', f.base + '^{tree}'));
  assert.equal(hit.apkSha256, first.apkSha256);
  await assert.rejects(prepareBaseApp({ ...f, base: first.commit }, assert.fail), /fetched integration tip/);
});

test('corrupt Android cache records and APK bytes are rebuilt and a mismatched base receipt fails closed', async t => {
  const f = fixture(t);
  let builds = 0;
  function build({ snapshot }) {
    builds++;
    return archive(join(snapshot, 'base.apk'), 'calendar');
  }
  const first = await prepareBaseApp(f, build);
  publishReceipt(f, { apkSha256: first.apkSha256, entryManifestSha256: first.entryManifestSha256 });
  const index = join(f.common, 'uld-cache/android-base-app/commits', f.base + '.json');
  writeFileSync(index, '{incomplete');
  const other = archive(join(f.root, 'other.apk'), 'notebook');
  copyFileSync(other, first.apk);
  const rebuilt = await prepareBaseApp(f, build);
  assert.equal(rebuilt.cacheHit, false);
  assert.equal(builds, 2);
  assert.equal(rebuilt.entryManifestSha256, first.entryManifestSha256);
  assert.equal(apkIdentity(rebuilt.apk).entryManifestSha256, first.entryManifestSha256);
  publishReceipt(f, apkIdentity(other));
  await assert.rejects(prepareBaseApp(f, build), /differs from the passing integration receipt/);
  assert.equal(builds, 3);
});

test('moving the integration ref during a base build prevents publishing its commit record', async t => {
  const f = fixture(t);
  await assert.rejects(prepareBaseApp(f, ({ snapshot }) => {
    f.promote('new integration');
    return archive(join(snapshot, 'base.apk'), 'calendar');
  }), /fetched integration tip/);
  assert.equal(existsSync(join(f.common, 'uld-cache/android-base-app/commits', f.base + '.json')), false);
});
