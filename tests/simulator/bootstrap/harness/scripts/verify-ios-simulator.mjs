import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SaxesParser } from 'saxes';

const root = process.cwd();
const evidence = join(root, 'release/evidence');
const hostFixture = join(root, 'tests/simulator/host');
const bundleId = 'org.uilazydev.qualification';
const profiles = [
  ['workspace', 'light', 'large'],
  ['appearance', 'light', 'large'],
  ['appearance', 'dark', 'accessibility-extra-large'],
];

function run(cwd, command, args, options = {}) {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    timeout: 25 * 60_000,
    maxBuffer: 32 * 1024 * 1024,
    ...options,
  });
}

function sim(...args) {
  return run(root, 'xcrun', ['simctl', ...args]).trim();
}

export function checkFlow(xml) {
  let passed = 0;
  const parser = new SaxesParser();
  parser.on('opentag', (tag) => {
    if (tag.name === 'testsuite' || tag.name === 'testsuites') {
      for (const attribute of ['failures', 'errors', 'skipped', 'disabled']) {
        assert.equal(
          Number(tag.attributes[attribute] ?? 0),
          0,
          'Simulator suite reports ' + attribute,
        );
      }
    }
    assert.ok(
      !['skipped', 'failure', 'error'].includes(tag.name),
      'Simulator flow failed or skipped',
    );
    if (tag.name === 'testcase') {
      const status = tag.attributes.status;
      assert.ok(
        !status || ['passed', 'SUCCESS', 'PASSED'].includes(status),
        'Simulator case did not pass',
      );
      passed++;
    }
  });
  parser.write(xml).close();
  assert.equal(passed, 1, 'Required exactly one executed simulator journey');
  return passed;
}

export function pickPhone(devices, id) {
  const phones = Object.entries(devices)
    .filter(([runtime]) => runtime.includes('.iOS-'))
    .reverse()
    .flatMap(([runtime, devicesForRuntime]) =>
      devicesForRuntime
        .filter((device) => device.isAvailable && device.name.startsWith('iPhone'))
        .map((device) => ({ ...device, runtime })),
    );
  const phone = id
    ? phones.find((device) => device.udid === id)
    : phones.find((device) => device.state === 'Booted') ?? phones[0];
  assert.ok(phone, 'Install an available iPhone Simulator runtime in Xcode');
  return phone;
}

function candidateArchives() {
  const provenance = JSON.parse(readFileSync(join(evidence, 'provenance.json'), 'utf8'));
  const version = JSON.parse(readFileSync('packages/native/package.json', 'utf8')).version;
  return ['tokens', 'ui-native'].map((name) => {
    const item = provenance.packages.find((entry) => entry.name === '@ui-lazy-dev/' + name);
    assert.equal(item?.version, version, 'Pack the current candidate before testing');
    const path = join(evidence, item.filename);
    const digest = createHash('sha256').update(readFileSync(path)).digest('hex');
    assert.equal(digest, item.sha256, 'Candidate archive changed');
    return { ...item, path, name };
  });
}

function prepareHost(host) {
  mkdirSync(host, { recursive: true });
  for (const file of ['package.json', 'package-lock.json']) {
    cpSync(join(hostFixture, file), join(host, file));
  }
  run(host, 'npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], { stdio: 'inherit' });

  const template = join(host, 'node_modules/@react-native-community/template/template');
  cpSync(join(template, 'ios'), join(host, 'ios'), { recursive: true });
  renameSync(join(host, 'ios/_xcode.env'), join(host, 'ios/.xcode.env'));
  for (const file of ['app.json', 'index.js', 'babel.config.js', 'metro.config.js']) {
    cpSync(join(template, file), join(host, file));
  }
  writeFileSync(
    join(host, 'index.js'),
    "import { AppRegistry } from 'react-native';\n" +
      "import Gallery from './App';\n" +
      "AppRegistry.registerComponent('HelloWorld', () => Gallery);\n",
  );
  writeFileSync(
    join(host, 'ios/.xcode.env.local'),
    'export NODE_BINARY=' + JSON.stringify(process.execPath) + '\n',
  );
}

function buildAndInstallGallery(host, phoneId, archives) {
  prepareHost(host);
  for (const archive of archives) {
    const destination = join(host, 'node_modules/@ui-lazy-dev', archive.name);
    mkdirSync(destination, { recursive: true });
    run(host, 'tar', ['-xzf', archive.path, '--strip-components', '1', '-C', destination]);
  }
  cpSync(join(root, 'catalog/native/Gallery.tsx'), join(host, 'App.tsx'));

  const ios = join(host, 'ios');
  cpSync(join(hostFixture, 'Podfile.lock'), join(ios, 'Podfile.lock'));
  run(ios, 'pod', ['install', '--deployment'], {
    stdio: 'inherit',
    env: { ...process.env, COCOAPODS_DISABLE_STATS: 'true' },
  });

  // Cache native compilation while rebuilding the release JS bundle from the candidate archives.
  const derivedData =
    process.env.UI_IOS_DERIVED_DATA || join(homedir(), 'Library/Caches/ui-lazy-dev/simulator-derived');
  run(
    host,
    'xcodebuild',
    [
      '-quiet',
      '-workspace', 'ios/HelloWorld.xcworkspace',
      '-scheme', 'HelloWorld',
      '-configuration', 'Release',
      '-destination', 'platform=iOS Simulator,id=' + phoneId,
      '-derivedDataPath', derivedData,
      'PRODUCT_BUNDLE_IDENTIFIER=' + bundleId,
      'CODE_SIGNING_ALLOWED=NO',
      'build',
    ],
    {
      stdio: 'inherit',
      env: { ...process.env, NODE_BINARY: process.execPath, FORCE_BUNDLING: '1' },
    },
  );
  const app = join(derivedData, 'Build/Products/Release-iphonesimulator/HelloWorld.app');
  assert.ok(
    existsSync(join(app, 'main.jsbundle')),
    'Simulator app must contain the production JS bundle',
  );
  sim('install', phoneId, app);
}

function setProfile(phoneId, appearance, textSize) {
  sim('ui', phoneId, 'appearance', appearance);
  sim('ui', phoneId, 'content_size', textSize);
}

function runJourneys(phoneId, maestro, env, reports) {
  let passed = 0;
  for (const [flow, appearance, textSize] of profiles) {
    setProfile(phoneId, appearance, textSize);
    const name = flow + '-' + appearance;
    const resultFile = join(reports, name + '.xml');
    rmSync(resultFile, { force: true });
    run(
      root,
      maestro,
      [
        '--device', phoneId,
        'test',
        '--format', 'JUNIT',
        '--output', resultFile,
        '--test-output-dir', reports,
        '--debug-output', join(reports, name),
        '-e', 'APP_ID=' + bundleId,
        '-e', 'APPEARANCE=' + (appearance === 'light' ? 'Light' : 'Dark'),
        '-e', 'TEXT_SCALE=' + (textSize === 'large' ? 'Standard' : 'Enlarged'),
        'tests/simulator/' + flow + '.yaml',
      ],
      { stdio: 'inherit', env },
    );
    passed += checkFlow(readFileSync(resultFile, 'utf8'));
  }
  return passed;
}

export function qualify() {
  assert.equal(process.platform, 'darwin', 'The iPhone Simulator gate requires macOS and Xcode');
  mkdirSync(evidence, { recursive: true });
  const report = join(evidence, 'ios-simulator.json');
  rmSync(report, { force: true });
  const archives = candidateArchives();

  const userMaestro = join(homedir(), '.maestro/bin/maestro');
  const maestro = process.env.MAESTRO_BIN || (existsSync(userMaestro) ? userMaestro : 'maestro');
  const devices = JSON.parse(sim('list', 'devices', 'available', '-j')).devices;
  const phone = pickPhone(devices, process.env.UI_SIMULATOR_ID);
  if (phone.state !== 'Booted') sim('boot', phone.udid);
  sim('bootstatus', phone.udid, '-b');
  const driverEnv = {
    ...process.env,
    MAESTRO_DRIVER_STARTUP_TIMEOUT: process.env.MAESTRO_DRIVER_STARTUP_TIMEOUT ?? '360000',
  };
  const maestroVersion = run(root, maestro, ['--version'], { env: driverEnv }).trim();

  const host = mkdtempSync(join(tmpdir(), 'ui-rn-host-'));
  const reports = join(root, 'test-results/ios-simulator');
  mkdirSync(reports, { recursive: true });
  const initialAppearance = sim('ui', phone.udid, 'appearance');
  const initialSize = sim('ui', phone.udid, 'content_size');
  try {
    buildAndInstallGallery(host, phone.udid, archives);
    const testsPassed = runJourneys(phone.udid, maestro, driverEnv, reports);
    const [tokens, native] = archives;
    const result = {
      passed: true,
      deviceType: 'iPhone Simulator',
      model: phone.name,
      runtime: phone.runtime,
      xcode: run(root, 'xcodebuild', ['-version']).trim(),
      maestro: maestroVersion,
      testsPassed,
      failed: 0,
      skipped: 0,
      nativeSha256: native.sha256,
      tokensSha256: tokens.sha256,
      profiles,
    };
    writeFileSync(report, JSON.stringify(result, null, 2) + '\n');
    console.log('Passed all three native journeys on ' + phone.name + '.');
  } finally {
    try {
      setProfile(phone.udid, initialAppearance, initialSize);
    } finally {
      rmSync(host, { recursive: true, force: true });
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  qualify();
}
