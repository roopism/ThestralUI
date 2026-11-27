import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { join, relative } from 'node:path';

// A device host holds the native test app for one set of native inputs. The app is
// compiled once per key; each run bundles the candidate JavaScript with Metro, compiles
// it with the same Hermes compiler a Release build uses, and places it in a copy of the
// compiled app. Raise the recipe when the build steps below change in a way the hashed
// inputs do not capture.
export const recipe = 1;

const digest = (value) => createHash('sha256').update(value).digest('hex');
const sorted = (entries) => [...entries].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

export function nativeKey({ platform, files, tools, archives }) {
  return digest(
    JSON.stringify({
      recipe,
      platform,
      files: sorted(Object.entries(files)),
      tools,
      archives: [...archives].sort((a, b) => (a.name < b.name ? -1 : 1)),
    }),
  );
}

export function fileInputs(root, paths) {
  return Object.fromEntries(
    paths.map((path) => {
      const file = join(root, path);
      return [path, existsSync(file) ? digest(readFileSync(file)) : null];
    }),
  );
}

// Only the parts of a library archive that change the compiled app belong to the key:
// what it asks the host to provide, and any native code it ships.
const nativeEntry = /^package\/(?:ios|android|apple|cpp)\/|\.podspec$|(?:^|\/)react-native\.config\.[cm]?js$/;
export function archiveNativeInputs(path) {
  const entries = execFileSync('tar', ['-tzf', path], { encoding: 'utf8', maxBuffer: 64 << 20 })
    .split('\n')
    .filter(Boolean);
  const read = (entry) => execFileSync('tar', ['-xOzf', path, entry], { maxBuffer: 64 << 20 });
  const manifest = JSON.parse(read('package/package.json'));
  const pick = (field) => sorted(Object.entries(manifest[field] ?? {}));
  return {
    name: manifest.name,
    dependencies: pick('dependencies'),
    optionalDependencies: pick('optionalDependencies'),
    peerDependencies: pick('peerDependencies'),
    native: entries
      .filter((entry) => nativeEntry.test(entry))
      .sort()
      .map((entry) => [entry, digest(read(entry))]),
  };
}

const capture = (command, args, options = {}) =>
  execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options }).trim();

// Metro skips every file under a `.git` directory, so hosts cannot live in the git
// common directory. They are keyed by content, so clones can share them.
export function hostsDir() {
  return process.env.ULD_DEVICE_HOSTS || join(homedir(), 'Library/Caches/ui-lazy-dev/device-host');
}

const hostFixture = 'tests/simulator/host';
const sharedFiles = [
  'scripts/build-cache/device-host.mjs',
  hostFixture + '/package.json',
  hostFixture + '/package-lock.json',
  hostFixture + '/babel.config.js',
];

export function iosHostKey(root, archives, { runtime, pods }) {
  const tools = [
    capture('xcodebuild', ['-version']),
    capture('xcode-select', ['-p']),
    capture('xcrun', ['--sdk', 'iphonesimulator', '--show-sdk-build-version']),
    capture('npm', ['--version']),
    capture(pods, ['--version']),
    process.version,
    process.arch,
    process.env.DEVELOPER_DIR ?? '',
    runtime,
  ];
  return nativeKey({
    platform: 'ios',
    files: fileInputs(root, [...sharedFiles, hostFixture + '/Podfile.lock']),
    tools,
    archives: archives.map((archive) => archiveNativeInputs(archive.path)),
  });
}

function verifiedAlertReader(root) {
  const path = 'tests/android/MainActivity.kt';
  const trusted = readFileSync(new URL('../../' + path, import.meta.url));
  assert.ok(trusted.equals(readFileSync(join(root, path))), 'Android alert reader mismatch');
  return trusted;
}

export function androidHostKey(root, archives, android, abi, probes) {
  const alertReader = verifiedAlertReader(root);
  const list = (folder) => {
    const path = join(android.sdk, folder);
    return existsSync(path) ? readdirSync(path).sort() : [];
  };
  const javaRelease = join(android.env.JAVA_HOME ?? '', 'release');
  const tools = [
    android.env.JAVA_HOME ?? '',
    existsSync(javaRelease) ? readFileSync(javaRelease, 'utf8') : '',
    android.sdk,
    list('build-tools'),
    list('platforms'),
    list('ndk'),
    list('cmake'),
    capture('npm', ['--version']),
    process.version,
    process.arch,
    abi,
  ];
  return nativeKey({
    platform: 'android',
    files: {
      ...fileInputs(root, sharedFiles),
      trustedAlertReader: digest(alertReader),
      calibratedFrameActivity: digest(readFileSync(join(probes, 'FrameActivity.kt'))),
    },
    tools,
    archives: archives.map((archive) => archiveNativeInputs(archive.path)),
  });
}

// Reuse the host for this key, or build it in place. `ready.json` is written last, so an
// interrupted build is discarded and rebuilt. Hosts for other keys of the same platform
// are removed to bound disk use.
export function deviceHost(parent, platform, key, build) {
  const dir = join(parent, platform + '-' + key);
  const ready = join(dir, 'ready.json');
  let built = false;
  if (!existsSync(ready) || JSON.parse(readFileSync(ready, 'utf8')).key !== key) {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const started = Date.now();
    build(dir);
    writeFileSync(
      ready,
      JSON.stringify({ key, platform, recipe, seconds: Math.round((Date.now() - started) / 1000) }) + '\n',
    );
    built = true;
  }
  for (const name of readdirSync(parent)) {
    if (name.startsWith(platform + '-') && name !== platform + '-' + key)
      rmSync(join(parent, name), { recursive: true, force: true });
  }
  return { dir, key, built };
}

function step(cwd, command, args, env = process.env) {
  execFileSync(command, args, { cwd, env, stdio: 'inherit', timeout: 45 * 60_000 });
}

function freshCopy(from, to) {
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
}

// Replace every library package from the candidate archives, and drop any package a
// previous run installed that this candidate no longer has.
export function installArchives(host, archives) {
  const record = join(host, 'installed-archives.json');
  const previous = existsSync(record) ? JSON.parse(readFileSync(record, 'utf8')) : [];
  for (const name of previous) rmSync(join(host, 'node_modules', name), { recursive: true, force: true });
  const names = [];
  for (const archive of archives) {
    const name = archive.name.startsWith('@') ? archive.name : '@ui-lazy-dev/' + archive.name;
    const destination = join(host, 'node_modules', name);
    rmSync(destination, { recursive: true, force: true });
    mkdirSync(destination, { recursive: true });
    step(host, 'tar', ['-xzf', archive.path, '--strip-components', '1', '-C', destination]);
    assert.equal(JSON.parse(readFileSync(join(destination, 'package.json'), 'utf8')).name, name);
    names.push(name);
  }
  writeFileSync(record, JSON.stringify(names) + '\n');
}

function filesUnder(folder) {
  if (!existsSync(folder)) return [];
  return readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(folder, join(entry.parentPath, entry.name)))
    .sort();
}

// The same Metro and Hermes commands a Release build runs (react-native-xcode.sh on iOS,
// BundleHermesCTask on Android), writing the JavaScript to the same path the build uses:
// Hermes records that path in the bytecode, so the result is byte for byte the Release one.
const releaseSource = {
  ios: 'DerivedData/Build/Products/Release-iphonesimulator/main.jsbundle',
  android: 'android/app/build/generated/assets/react/release/index.android.bundle',
};
const releaseSourceMap = 'android/app/build/intermediates/sourcemaps/react/release/index.android.bundle.packager.map';

export function bundleJavaScript(host, { platform, hermesc, out, extra = [] }) {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, 'assets'), { recursive: true });
  const source = join(host, releaseSource[platform]);
  mkdirSync(join(source, '..'), { recursive: true });
  rmSync(source, { force: true });
  const env = { ...process.env, NODE_BINARY: process.execPath };
  let cli;
  if (platform === 'ios') {
    cli = [
      'node_modules/react-native/scripts/bundle.js',
      'bundle',
      '--entry-file',
      'index.js',
      '--platform',
      'ios',
      '--dev',
      'false',
      '--reset-cache',
      '--bundle-output',
      source,
      '--assets-dest',
      join(out, 'assets'),
      '--minify',
      'false',
      '--config-cmd',
      "'" + process.execPath + "' '" + join(host, 'node_modules/react-native/cli.js') + "' config",
    ];
  } else {
    const map = join(host, releaseSourceMap);
    mkdirSync(join(map, '..'), { recursive: true });
    cli = [
      'node_modules/react-native/cli.js',
      'bundle',
      '--platform',
      'android',
      '--dev',
      'false',
      '--reset-cache',
      '--entry-file',
      'index.js',
      '--bundle-output',
      source,
      '--assets-dest',
      join(out, 'assets'),
      '--sourcemap-output',
      map,
      '--minify',
      'false',
      ...extra,
    ];
  }
  if (env.ULD_DEVICE_READS) {
    env.ULD_METRO_INPUTS = join(out, 'metro-inputs.json');
    // Resolve the hook's literal Metro import against the same install as the Release CLI.
    const capture = join(host, 'device-metro.cjs');
    cpSync(fileURLToPath(new URL('../gates/device-metro.cjs', import.meta.url)), capture);
    cli.unshift('--require', capture);
  }
  step(host, process.execPath, cli, env);
  const output = join(out, platform === 'ios' ? 'main.jsbundle' : 'index.android.bundle');
  const compiled = platform === 'ios' ? output : source + '.hbc';
  const flags = platform === 'ios' ? ['-O'] : ['-O', '-output-source-map'];
  step(host, hermesc, ['-emit-binary', '-max-diagnostic-width=80', '-out', compiled, source, ...flags]);
  if (compiled !== output) renameSync(compiled, output);
  return { file: output, sha256: digest(readFileSync(output)), assets: filesUnder(join(out, 'assets')) };
}

// iOS ---------------------------------------------------------------------------------

export const iosBundleId = 'org.uilazydev.qualification';

export function stageIosJavaScript(root, host) {
  freshCopy(join(root, 'catalog/native/Gallery.tsx'), join(host, 'App.tsx'));
  freshCopy(join(root, 'catalog/native/ScenarioGallery.tsx'), join(host, 'ScenarioGallery.tsx'));
  freshCopy(join(root, 'catalog/native/scenarios'), join(host, 'scenarios'));
}

export function buildIosHost(root, host, { archives, phoneId, pods }) {
  const fixture = join(root, hostFixture);
  for (const file of ['package.json', 'package-lock.json']) cpSync(join(fixture, file), join(host, file));
  step(host, 'npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund']);
  const template = join(host, 'node_modules/@react-native-community/template/template');
  cpSync(join(template, 'ios'), join(host, 'ios'), { recursive: true });
  renameSync(join(host, 'ios/_xcode.env'), join(host, 'ios/.xcode.env'));
  for (const file of ['app.json', 'index.js', 'babel.config.js', 'metro.config.js'])
    cpSync(join(template, file), join(host, file));
  writeFileSync(
    join(host, 'index.js'),
    "import { AppRegistry } from 'react-native';\n" +
      "import Gallery from './App';\n" +
      "AppRegistry.registerComponent('HelloWorld', () => Gallery);\n",
  );
  writeFileSync(join(host, 'ios/.xcode.env.local'), 'export NODE_BINARY=' + JSON.stringify(process.execPath) + '\n');
  installArchives(host, archives);
  stageIosJavaScript(root, host);
  const ios = join(host, 'ios');
  cpSync(join(fixture, 'Podfile.lock'), join(ios, 'Podfile.lock'));
  step(ios, pods, ['install', '--deployment'], { ...process.env, COCOAPODS_DISABLE_STATS: 'true' });
  step(
    host,
    'xcodebuild',
    [
      '-quiet',
      '-workspace',
      'ios/HelloWorld.xcworkspace',
      '-scheme',
      'HelloWorld',
      '-configuration',
      'Release',
      '-destination',
      'platform=iOS Simulator,id=' + phoneId,
      '-derivedDataPath',
      join(host, 'DerivedData'),
      'PRODUCT_BUNDLE_IDENTIFIER=' + iosBundleId,
      'CODE_SIGNING_ALLOWED=NO',
      'build',
    ],
    { ...process.env, NODE_BINARY: process.execPath, FORCE_BUNDLING: '1' },
  );
  const built = join(host, 'DerivedData/Build/Products/Release-iphonesimulator/HelloWorld.app');
  assert.ok(existsSync(join(built, 'main.jsbundle')), 'The Release app must contain the production JS bundle');
  mkdirSync(join(host, 'app'));
  step(host, 'cp', ['-c', '-R', built, join(host, 'app/HelloWorld.app')]);
  // Prove that the per-run bundling reproduces the Release build byte for byte.
  const own = bundleJavaScript(host, { platform: 'ios', hermesc: iosHermesc(host), out: join(host, 'check') });
  assert.equal(
    own.sha256,
    digest(readFileSync(join(built, 'main.jsbundle'))),
    'Per-run bundling differs from the Release build; the cached app cannot be reused',
  );
  rmSync(join(host, 'check'), { recursive: true, force: true });
}

export const iosHermesc = (host) => join(host, 'ios/Pods/hermes-engine/destroot/bin/hermesc');

// Copy the compiled app and give it this run's JavaScript and assets.
export function injectIosApp(host, bundle, out) {
  const app = join(out, 'HelloWorld.app');
  rmSync(app, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  step(host, 'cp', ['-c', '-R', join(host, 'app/HelloWorld.app'), app]);
  rmSync(join(app, 'main.jsbundle'), { force: true });
  rmSync(join(app, 'assets'), { recursive: true, force: true });
  cpSync(bundle.file, join(app, 'main.jsbundle'));
  const assets = join(dirnameOf(bundle.file), 'assets');
  for (const name of readdirSync(assets)) cpSync(join(assets, name), join(app, name), { recursive: true });
  assert.equal(digest(readFileSync(join(app, 'main.jsbundle'))), bundle.sha256);
  return app;
}

const dirnameOf = (file) => file.slice(0, file.lastIndexOf('/'));

// Android -----------------------------------------------------------------------------

export const androidAppId = 'org.uilazydev.qualification';
export const androidHermesc = (host) => join(host, 'node_modules/hermes-compiler/hermesc/osx-bin/hermesc');

export function stageAndroidJavaScript(root, host, probes) {
  freshCopy(join(root, 'catalog/native'), join(host, 'catalog/native'));
  rmSync(join(host, 'catalog/modes'), { recursive: true, force: true });
  if (existsSync(join(root, 'catalog/modes'))) cpSync(join(root, 'catalog/modes'), join(host, 'catalog/modes'), { recursive: true });
  cpSync(join(probes, 'FrameFixture.js'), join(host, 'FrameFixture.js'));
  cpSync(join(probes, 'index.js'), join(host, 'index.js'));
}

export function buildAndroidHost(root, host, { archives, android, abi, probes }) {
  const alertReader = verifiedAlertReader(root);
  const fixture = join(root, hostFixture);
  for (const file of ['package.json', 'package-lock.json']) cpSync(join(fixture, file), join(host, file));
  const env = { ...android.env, NODE_BINARY: process.execPath };
  step(host, 'npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund', '--prefer-offline'], env);
  const template = join(host, 'node_modules/@react-native-community/template/template');
  cpSync(join(template, 'android'), join(host, 'android'), { recursive: true });
  for (const name of ['app.json', 'babel.config.js', 'metro.config.js']) cpSync(join(template, name), join(host, name));
  installArchives(host, archives);
  stageAndroidJavaScript(root, host, probes);
  writeFileSync(join(host, 'android/app/src/main/java/com/helloworld/MainActivity.kt'), alertReader);
  cpSync(join(probes, 'FrameActivity.kt'), join(host, 'android/app/src/main/java/com/helloworld/FrameActivity.kt'));
  const manifest = join(host, 'android/app/src/main/AndroidManifest.xml');
  const xml = readFileSync(manifest, 'utf8');
  assert.ok(xml.includes('</application>'), 'Missing Android application');
  writeFileSync(
    manifest,
    xml.replace(
      '</application>',
      '<activity android:name="com.helloworld.FrameActivity" android:exported="true" /></application>',
    ),
  );
  const babel = join(fixture, 'babel.config.js');
  if (existsSync(babel)) cpSync(babel, join(host, 'babel.config.js'));
  const appGradle = join(host, 'android/app/build.gradle');
  const original = readFileSync(appGradle, 'utf8');
  assert.ok(original.includes('applicationId "com.helloworld"'), 'Unexpected RN release host template');
  writeFileSync(
    appGradle,
    original
      .replace('applicationId "com.helloworld"', 'applicationId "' + androidAppId + '"')
      .replace('autolinkLibrariesWithApp()', "extraPackagerArgs = ['--max-workers','2']\n    autolinkLibrariesWithApp()"),
  );
  gradleRelease(host, env, abi);
  const built = join(host, 'android/app/build/outputs/apk/release/app-release.apk');
  const files = capture('unzip', ['-Z1', built], { maxBuffer: 64 << 20 }).split('\n');
  assert.ok(
    files.includes('assets/index.android.bundle') && files.includes('lib/' + abi + '/libhermesvm.so'),
    'Expected a standalone release bundle and native Hermes runtime in ' + built,
  );
  mkdirSync(join(host, 'app'));
  cpSync(built, join(host, 'app/app-release.apk'));
  const own = bundleJavaScript(host, { platform: 'android', hermesc: androidHermesc(host), out: join(host, 'check'), extra: ['--max-workers', '2'] });
  assert.equal(
    own.sha256,
    digest(execFileSync('unzip', ['-p', built, 'assets/index.android.bundle'], { maxBuffer: 256 << 20 })),
    'Per-run bundling differs from the Release build; the cached APK cannot be reused',
  );
  rmSync(join(host, 'check'), { recursive: true, force: true });
}

function gradleRelease(host, env, abi) {
  step(
    join(host, 'android'),
    'sh',
    ['gradlew', ':app:assembleRelease', '--no-daemon', '--max-workers=2', '--build-cache', '-PreactNativeArchitectures=' + abi],
    env,
  );
}

function buildTools(android, host) {
  const declared = /buildToolsVersion\s*=\s*"([^"]+)"/.exec(readFileSync(join(host, 'android/build.gradle'), 'utf8'))?.[1];
  const available = readdirSync(join(android.sdk, 'build-tools')).sort();
  const version = declared && available.includes(declared) ? declared : available.at(-1);
  return join(android.sdk, 'build-tools', version);
}

// Copy the compiled APK, replace its JavaScript and sign it with the host's own debug key,
// as the Release build does. Bundles that emit Android resources need aapt, so those runs
// rebuild the APK incrementally in the host instead.
export function injectAndroidApk(host, bundle, out, { android, abi }) {
  mkdirSync(out, { recursive: true });
  const signed = join(out, 'app-release.apk');
  rmSync(signed, { force: true });
  if (bundle.assets.length) {
    console.log('Bundle emits ' + bundle.assets.length + ' Android resources; rebuilding the APK in the host.');
    gradleRelease(host, { ...android.env, NODE_BINARY: process.execPath }, abi);
    cpSync(join(host, 'android/app/build/outputs/apk/release/app-release.apk'), signed);
    return signed;
  }
  const work = join(out, 'unsigned.apk');
  const aligned = join(out, 'aligned.apk');
  for (const file of [work, aligned]) rmSync(file, { force: true });
  cpSync(join(host, 'app/app-release.apk'), work);
  const stored = /\bStored\b/.test(capture('unzip', ['-v', work, 'assets/index.android.bundle']));
  step(out, 'zip', ['-q', '-d', work, 'assets/index.android.bundle']);
  const stage = join(out, 'stage');
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(join(stage, 'assets'), { recursive: true });
  cpSync(bundle.file, join(stage, 'assets/index.android.bundle'));
  step(stage, 'zip', ['-q', '-X', ...(stored ? ['-0'] : []), work, 'assets/index.android.bundle']);
  const tools = buildTools(android, host);
  step(out, join(tools, 'zipalign'), ['-f', '-p', '4', work, aligned]);
  step(out, join(tools, 'apksigner'), [
    'sign',
    '--ks',
    join(host, 'android/app/debug.keystore'),
    '--ks-pass',
    'pass:android',
    '--key-pass',
    'pass:android',
    '--ks-key-alias',
    'androiddebugkey',
    '--out',
    signed,
    aligned,
  ]);
  step(out, join(tools, 'apksigner'), ['verify', signed]);
  assert.equal(
    digest(execFileSync('unzip', ['-p', signed, 'assets/index.android.bundle'], { maxBuffer: 256 << 20 })),
    bundle.sha256,
  );
  return signed;
}
