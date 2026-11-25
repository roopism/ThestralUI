import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  archiveNativeInputs,
  deviceHost,
  installArchives,
  nativeKey,
} from '../../scripts/build-cache/device-host.mjs';

function scratch(t) {
  const dir = mkdtempSync(join(tmpdir(), 'uld-device-host-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function pack(dir, name, { manifest = {}, files = {} }) {
  const source = join(dir, 'src-' + name);
  rmSync(source, { recursive: true, force: true });
  mkdirSync(join(source, 'package'), { recursive: true });
  writeFileSync(
    join(source, 'package/package.json'),
    JSON.stringify({ name: '@ui-lazy-dev/ui-native', version: '1.0.0', ...manifest }),
  );
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(join(source, 'package', path, '..'), { recursive: true });
    writeFileSync(join(source, 'package', path), contents);
  }
  const archive = join(dir, name + '.tgz');
  execFileSync('tar', ['-czf', archive, '-C', source, 'package']);
  return archive;
}

const base = (archives) => ({
  platform: 'ios',
  files: { 'tests/simulator/host/package-lock.json': 'a', 'tests/simulator/host/Podfile.lock': 'b' },
  tools: ['Xcode 26.3', 'v22.23.2'],
  archives,
});

test('a JavaScript-only library change keeps the compiled app, a native requirement does not', (t) => {
  const dir = scratch(t);
  const peers = { peerDependencies: { react: '^19.0.0', 'react-native': '>=0.88' } };
  const first = archiveNativeInputs(pack(dir, 'first', { manifest: peers, files: { 'lib/button.js': 'one' } }));
  const second = archiveNativeInputs(pack(dir, 'second', { manifest: peers, files: { 'lib/button.js': 'two' } }));
  assert.deepEqual(first, second);
  assert.equal(nativeKey(base([first])), nativeKey(base([second])));

  const peer = archiveNativeInputs(
    pack(dir, 'peer', {
      manifest: { peerDependencies: { ...peers.peerDependencies, 'react-native-reanimated': '4.8.0' } },
      files: { 'lib/button.js': 'one' },
    }),
  );
  assert.notEqual(nativeKey(base([peer])), nativeKey(base([first])));
  const dependency = archiveNativeInputs(
    pack(dir, 'dependency', { manifest: { ...peers, dependencies: { 'lucide-react-native': '1.77.0' } } }),
  );
  assert.notEqual(nativeKey(base([dependency])), nativeKey(base([first])));
  const native = archiveNativeInputs(
    pack(dir, 'native', { manifest: peers, files: { 'lib/button.js': 'one', 'ios/Haptics.mm': 'native' } }),
  );
  assert.notEqual(nativeKey(base([native])), nativeKey(base([first])));
  const podspec = archiveNativeInputs(
    pack(dir, 'podspec', { manifest: peers, files: { 'lib/button.js': 'one', 'UiNative.podspec': 'spec' } }),
  );
  assert.notEqual(nativeKey(base([podspec])), nativeKey(base([first])));
});

test('every host file, tool version and platform is part of the key', () => {
  const key = nativeKey(base([]));
  assert.equal(nativeKey(base([])), key);
  const changed = (patch) => nativeKey({ ...base([]), ...patch });
  assert.notEqual(changed({ platform: 'android' }), key);
  assert.notEqual(changed({ tools: ['Xcode 26.4', 'v22.23.2'] }), key);
  assert.notEqual(changed({ files: { ...base([]).files, 'tests/simulator/host/Podfile.lock': 'c' } }), key);
  assert.notEqual(changed({ files: { ...base([]).files, 'tests/android/FrameActivity.kt': null } }), key);
});

test('a host is built once per key, survives an interrupted build and keeps one host per platform', (t) => {
  const common = scratch(t);
  let builds = 0;
  const build = (dir) => {
    builds++;
    writeFileSync(join(dir, 'app'), 'compiled');
  };
  const first = deviceHost(common, 'ios', 'a1', build);
  assert.equal(first.built, true);
  assert.equal(deviceHost(common, 'ios', 'a1', build).built, false);
  assert.equal(builds, 1);

  assert.throws(() =>
    deviceHost(common, 'ios', 'b2', () => {
      throw new Error('Xcode stopped');
    }),
  );
  assert.equal(existsSync(join(common, 'ios-b2/ready.json')), false);
  assert.equal(deviceHost(common, 'ios', 'b2', build).built, true);
  assert.equal(builds, 2);
  deviceHost(common, 'android', 'c3', build);
  assert.deepEqual(readdirSync(common).sort(), ['android-c3', 'ios-b2']);
});

test('each run installs exactly the candidate archives and removes extras from the previous run', (t) => {
  const dir = scratch(t);
  const host = join(dir, 'host');
  mkdirSync(join(host, 'node_modules'), { recursive: true });
  const nativeArchive = { name: 'ui-native', path: pack(dir, 'native', { files: { 'lib/index.js': 'v1' } }) };
  const icons = {
    name: '@ui-lazy-dev/icons',
    path: pack(dir, 'icons', { manifest: { name: '@ui-lazy-dev/icons' }, files: { 'lib/index.js': 'icons' } }),
  };
  installArchives(host, [nativeArchive, icons]);
  assert.ok(existsSync(join(host, 'node_modules/@ui-lazy-dev/icons/lib/index.js')));
  writeFileSync(join(host, 'node_modules/@ui-lazy-dev/ui-native/stale.js'), 'old');
  installArchives(host, [nativeArchive]);
  assert.equal(existsSync(join(host, 'node_modules/@ui-lazy-dev/icons')), false);
  assert.equal(existsSync(join(host, 'node_modules/@ui-lazy-dev/ui-native/stale.js')), false);
  assert.ok(existsSync(join(host, 'node_modules/@ui-lazy-dev/ui-native/lib/index.js')));
  assert.throws(() => installArchives(host, [{ name: 'ui-web', path: nativeArchive.path }]));
});

test('an emulator counts as snapshot-booted only when the saved state actually loaded', async () => {
  const { readySnapshot, snapshotLoaded } = await import('../android/emulator.mjs');
  const loading = "INFO         | Loading snapshot '" + readySnapshot + "'...\n";
  assert.equal(
    snapshotLoaded(loading + "INFO         | Successfully loaded snapshot '" + readySnapshot + "' using 3415 ms\n"),
    true,
  );
  assert.equal(
    snapshotLoaded(
      loading +
        "WARNING      | Device 'encrypt' does not have the requested snapshot '" + readySnapshot + "'\n" +
        "WARNING      | Failed to load snapshot '" + readySnapshot + "'\n" +
        "USER_INFO    | The emulator is performing a cold boot without a saved state.\n",
    ),
    false,
  );
  assert.equal(snapshotLoaded('INFO         | Boot completed in 31002 ms\n'), false);
});
