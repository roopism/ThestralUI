import { inCommandGroup } from './workers/isolated-command.mjs';
import { withHostCache, usingSimulator } from './workers/resource-guard.mjs';
import {
  bundleJavaScript,
  buildIosHost,
  hostsDir,
  deviceHost,
  injectIosApp,
  installArchives,
  iosBundleId,
  iosHermesc,
  iosHostKey,
  stageIosJavaScript,
} from './build-cache/device-host.mjs';
import { packageWorkspaces, runtimeWorkspaces, selectArchives } from './package-workspaces.mjs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  accessSync,
  constants,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SaxesParser } from 'saxes';
import { withMaestroSession } from '../tests/simulator/maestro-session.mjs';
import { iosWindow } from '../tests/simulator/window-ready.mjs';
import { runNativeScenarios } from '../tests/simulator/scenarios.mjs';

const root = process.cwd();
const evidence = join(root, 'release/evidence');
const hostFixture = join(root, 'tests/simulator/host');
const bundleId = iosBundleId;
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

export function findCocoaPods(searchPath = process.env.PATH, fallback = ['/opt/homebrew/bin', '/usr/local/bin']) {
  for (const folder of [...(searchPath ?? '').split(delimiter).filter(Boolean), ...fallback]) {
    const candidate = join(folder, 'pod');
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'EACCES') throw error;
    }
  }
  throw Error('The iPhone gate requires the CocoaPods executable recorded in tests/simulator/host/Podfile.lock.');
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
    : (phones.find((device) => device.state === 'Booted') ?? phones[0]);
  assert.ok(phone, 'Install an available iPhone Simulator runtime in Xcode');
  return phone;
}

function candidateArchives() {
  const provenance = JSON.parse(readFileSync(join(evidence, 'provenance.json'), 'utf8'));
  const needed = runtimeWorkspaces(packageWorkspaces(root), ['@ui-lazy-dev/ui-native']);
  return selectArchives(provenance.packages, needed).map(item => {
    const name = item.name.slice('@ui-lazy-dev/'.length);
    const path = join(evidence, item.filename);
    const digest = createHash('sha256').update(readFileSync(path)).digest('hex');
    assert.equal(digest, item.sha256, 'Candidate archive changed');
    return { ...item, path, name };
  });
}

function setProfile(phoneId, appearance, textSize, control = sim) {
  control('ui', phoneId, 'appearance', appearance);
  control('ui', phoneId, 'content_size', textSize);
  assert.equal(control('ui', phoneId, 'appearance'), appearance, 'iPhone appearance differs from the requested profile');
  assert.equal(control('ui', phoneId, 'content_size'), textSize, 'iPhone text size differs from the requested profile');
}

// UIKit can keep the previous appearance even after simctl reports the new setting.
export function startIOSJourneySession(phoneId, cold, control = sim) {
  const current = () => pickPhone(JSON.parse(control('list', 'devices', 'available', '-j')).devices, phoneId).state;
  if (cold && current() !== 'Shutdown') {
    control('shutdown', phoneId);
    assert.equal(current(), 'Shutdown', 'The iPhone did not shut down before the journey');
  }
  control('bootstatus', phoneId, '-b');
  assert.equal(current(), 'Booted', 'The iPhone did not finish booting');
}

export function prepareIOSJourney(phoneId, app, appearance, textSize, control = sim, reconnect) {
  const dataContainer = () => {
    const directory = control('get_app_container', phoneId, bundleId, 'data');
    assert.ok(isAbsolute(directory) && existsSync(directory), 'Missing qualification app data');
    return directory;
  };
  if (control('ui', phoneId, 'appearance') !== appearance) {
    startIOSJourneySession(phoneId, true, control);
    reconnect?.();
  }
  const marker = 'journey-' + randomUUID();
  const documents = join(dataContainer(), 'Documents');
  mkdirSync(documents, { recursive: true });
  writeFileSync(join(documents, marker), 'previous journey\n', { flag: 'wx' });
  control('uninstall', phoneId, bundleId);
  setProfile(phoneId, appearance, textSize, control);
  control('install', phoneId, app);
  assert.ok(!existsSync(join(dataContainer(), 'Documents', marker)), 'iPhone retained the previous journey data');
}

function runJourneys(phoneId, app, maestro, env, reports, run, reconnect) {
  let passed = 0;
  for (const [flow, appearance, textSize] of profiles) {
    prepareIOSJourney(phoneId, app, appearance, textSize, sim, reconnect);
    iosWindow(sim, phoneId, bundleId);
    const name = flow + '-' + appearance;
    const resultFile = join(reports, name + '.xml');
    rmSync(resultFile, { force: true });
    run(
      root,
      maestro,
      [
        '--device',
        phoneId,
        'test',
        '--format',
        'JUNIT',
        '--output',
        resultFile,
        '--test-output-dir',
        reports,
        '--debug-output',
        join(reports, name),
        '-e',
        'APP_ID=' + bundleId,
        '-e',
        'APPEARANCE=' + (appearance === 'light' ? 'Light' : 'Dark'),
        '-e',
        'TEXT_SCALE=' + (textSize === 'large' ? 'Standard' : 'Enlarged'),
        'tests/simulator/' + flow + '.yaml',
      ],
      { stdio: 'inherit', env },
    );
    passed += checkFlow(readFileSync(resultFile, 'utf8'));
  }
  return passed;
}

export function qualify() {
  // Missing packed inputs must fail before competing for a device or timing reservation.
  accessSync(join(evidence, 'provenance.json'), constants.R_OK);
  return usingSimulator('iPhone Simulator', async () => {
    assert.equal(process.platform, 'darwin', 'The iPhone Simulator gate requires macOS and Xcode');
    mkdirSync(evidence, { recursive: true });
    const report = join(evidence, 'ios-simulator.json');
    rmSync(report, { force: true });
    const archives = candidateArchives();
    const pods = findCocoaPods();
    const lock = readFileSync(join(hostFixture, 'Podfile.lock'), 'utf8');
    const version = /^COCOAPODS: ([0-9A-Za-z.-]+)$/m.exec(lock)?.[1];
    assert.ok(version, 'The simulator host must pin CocoaPods');
    assert.equal(run(root, pods, ['--version']).trim(), version, 'Installed CocoaPods differs from the host lock');

    const userMaestro = join(homedir(), '.maestro/bin/maestro');
    const maestro = process.env.MAESTRO_BIN || (existsSync(userMaestro) ? userMaestro : 'maestro');
    const devices = JSON.parse(sim('list', 'devices', 'available', '-j')).devices;
    const phone = pickPhone(devices, process.env.UI_SIMULATOR_ID);
    // Keep the iPhone booted between runs. Each journey still reinstalls the app with empty
    // data, and an appearance change that UIKit does not apply restarts the device.
    startIOSJourneySession(phone.udid, false);
    const driverEnv = {
      ...process.env,
      MAESTRO_DRIVER_STARTUP_TIMEOUT: process.env.MAESTRO_DRIVER_STARTUP_TIMEOUT ?? '360000',
    };
    const maestroVersion = run(root, maestro, ['--version'], { env: driverEnv }).trim();

    const reports = join(root, 'test-results/ios-simulator');
    mkdirSync(reports, { recursive: true });
    writeFileSync(join(reports, 'device.json'), JSON.stringify({
      name: phone.name, runtime: phone.runtime, udid: phone.udid, maestroVersion,
    }));
    const initialAppearance = sim('ui', phone.udid, 'appearance');
    const initialSize = sim('ui', phone.udid, 'content_size');
    try {
      const started = Date.now();
      const key = iosHostKey(root, archives, { runtime: phone.runtime, pods });
      const { host, bundle, app } = await withHostCache(hostsDir(), 'ios', () => {
        const host = deviceHost(hostsDir(), 'ios', key, (dir) =>
          buildIosHost(root, dir, { archives, phoneId: phone.udid, pods }),
        );
        installArchives(host.dir, archives);
        stageIosJavaScript(root, host.dir);
        const bundle = bundleJavaScript(host.dir, {
          platform: 'ios',
          hermesc: iosHermesc(host.dir),
          out: join(reports, 'bundle'),
        });
        const app = injectIosApp(host.dir, bundle, join(reports, 'app'));
        return { host, bundle, app };
      });
      const setupSeconds = Math.round((Date.now() - started) / 1000);
      console.log(
        (host.built ? 'Built the iPhone host ' : 'Reused the iPhone host ') + key.slice(0, 12) +
          '; app ready in ' + setupSeconds + ' s.',
      );
      assert.ok(existsSync(join(app, 'main.jsbundle')), 'Missing compiled application bundle');
      sim('install', phone.udid, app);
      const installed = join(sim('get_app_container', phone.udid, bundleId, 'app'), 'main.jsbundle');
      assert.equal(
        createHash('sha256').update(readFileSync(installed)).digest('hex'),
        bundle.sha256,
        'The installed app does not run this candidate\'s JavaScript',
      );
      iosWindow(sim, phone.udid, bundleId);
      const { testsPassed, scenarioIds } = withMaestroSession({
        platform: 'ios', device: phone.udid, maestro, env: driverEnv, reports,
      }, (sessionRun, { reconnectIOS: reconnect }) => {
        const testsPassed = runJourneys(phone.udid, app, maestro, driverEnv, reports, sessionRun, reconnect);
        const reset = () => {
          prepareIOSJourney(phone.udid, app, 'light', 'large', sim, reconnect);
          iosWindow(sim, phone.udid, bundleId);
        };
        const scenarioIds = runNativeScenarios({ root, appId: bundleId, maestro, device: phone.udid,
          env: driverEnv, run: sessionRun, reports, reset });
        return { testsPassed, scenarioIds };
      });
      const native = archives.find(archive => archive.name === 'ui-native');
      const tokens = archives.find(archive => archive.name === 'tokens');
      const result = {
        passed: true,
        host: { key, built: host.built, setupSeconds, bundleSha256: bundle.sha256 },
        deviceType: 'iPhone Simulator',
        model: phone.name,
        runtime: phone.runtime,
        xcode: run(root, 'xcodebuild', ['-version']).trim(),
        maestro: maestroVersion,
        testsPassed,
        scenarioIds,
        failed: 0,
        skipped: 0,
        nativeSha256: native.sha256,
        tokensSha256: tokens.sha256,
        profiles,
      };
      writeFileSync(report, JSON.stringify(result, null, 2) + '\n');
      console.log('Passed ' + testsPassed + ' native journeys and ' + scenarioIds.length + ' scenarios on ' + phone.name + '.');
    } finally {
      setProfile(phone.udid, initialAppearance, initialSize);
    }
  });
}

if (
  process.argv[1] &&
  existsSync(process.argv[1]) &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
) {
  await inCommandGroup(qualify, true);
}
