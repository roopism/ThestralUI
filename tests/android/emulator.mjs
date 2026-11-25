import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';
import { verdictInputRoot } from '../../scripts/gates/verdict.mjs';
import { setTimeout as delay } from 'node:timers/promises';

export const config = JSON.parse(readFileSync(join(verdictInputRoot, 'tests/android/profiles.json'), 'utf8'));
export const abi = process.arch === 'arm64' ? 'arm64-v8a' : 'x86_64';

export function profileImagePackage(profile, architecture = abi) {
  return [
    'system-images',
    profile.platform ?? config.platform,
    profile.image ?? config.image,
    architecture,
  ].join(';');
}

function avdName(profile) {
  const api = (profile.platform ?? config.platform).slice('android-'.length).replaceAll('.', '-');
  return 'uld-api' + api + '-' + profile.id + '-' + abi;
}

export function androidTools() {
  const sdk =
    process.env.ANDROID_HOME ||
    process.env.ANDROID_SDK_ROOT ||
    join(
      homedir(),
      ...(process.platform === 'darwin' ? ['Library', 'Android', 'sdk'] : ['Android', 'Sdk']),
    );
  const avdManager = process.env.AVDMANAGER_BIN || join(sdk, 'cmdline-tools/latest/bin/avdmanager');
  assert.ok(
    existsSync(avdManager),
    'Install the command-line tools in the same Android SDK as the pinned image',
  );
  const env = {
    ...process.env,
    ANDROID_HOME: sdk,
    ANDROID_SDK_ROOT: sdk,
    PATH: [join(sdk, 'platform-tools'), join(sdk, 'emulator'), process.env.PATH].join(delimiter),
  };
  const java = '/Library/Java/JavaVirtualMachines/openlogic-openjdk-17.jdk/Contents/Home';
  if (!env.JAVA_HOME && existsSync(java)) env.JAVA_HOME = java;
  return {
    sdk,
    env,
    avdManager,
    emulator: join(sdk, 'emulator/emulator'),
    adb: join(sdk, 'platform-tools/adb'),
  };
}

function execute(command, args, env, options = {}) {
  return execFileSync(command, args, {
    env,
    encoding: 'utf8',
    timeout: 120000,
    stdio: ['pipe', 'pipe', 'pipe'],
    ...options,
  }).trim();
}

export function prepareAvd(profile, tools) {
  const home =
    tools.env.ANDROID_AVD_HOME ||
    join(tools.env.ANDROID_USER_HOME || join(homedir(), '.android'), 'avd');
  mkdirSync(home, { recursive: true });
  const name = avdName(profile);
  const image = profileImagePackage(profile);
  const dir = join(home, name + '.avd');
  const configPath = join(dir, 'config.ini');
  if (!existsSync(configPath)) {
    execute(
      tools.avdManager,
      [
        'create',
        'avd',
        '--name',
        name,
        '--package',
        image,
        '--device',
        profile.device,
        '--path',
        dir,
      ],
      tools.env,
      { input: 'no\n' },
    );
  }
  const ini = readFileSync(configPath, 'utf8');
  const path = image.replaceAll(';', '/') + '/';
  const installedImage = ini.match(/^image\.sysdir\.1\s*=\s*(.+?)\s*$/m)?.[1];
  assert.equal(installedImage, path, 'Pinned AVD image mismatch in ' + configPath);
  const fixed = new Map(
    Object.entries({
      'hw.ramSize': profile.ramMiB,
      'hw.cpu.ncore': profile.cores,
      'hw.lcd.width': profile.width,
      'hw.lcd.height': profile.height,
      'hw.lcd.density': profile.density,
      'vm.heapSize': profile.heapMiB,
      'disk.dataPartition.size': '2G',
      'hw.sdCard': 'no',
      showDeviceFrame: 'no',
    }),
  );
  const updated = ini.split('\n').filter((line) => line && !fixed.has(line.split('=')[0].trim()));
  for (const [key, value] of fixed) updated.push(key + '=' + value);
  writeFileSync(configPath, updated.join('\n') + '\n');
  return name;
}

// The emulator logs "Loading snapshot 'uld-ready'..." on every boot, then a warning and
// a cold boot when the snapshot is missing or incompatible.
export function snapshotLoaded(log) {
  return (
    log.includes("Loading snapshot '" + readySnapshot + "'") &&
    !/Failed to load snapshot|performing a cold boot|does not have the requested snapshot/i.test(log)
  );
}

async function until(probe, timeout, message) {
  const end = Date.now() + timeout;
  do {
    if (await probe()) return;
    await delay(1000);
  } while (Date.now() < end);
  throw new Error(message);
}

// Each run boots from a snapshot taken right after the first cold boot, and never saves
// over it, so every run starts from the same clean, settled device in seconds.
export const readySnapshot = 'uld-ready';

export async function withEmulator(profile, tools, reports, task) {
  const name = avdName(profile);
  const adb = (...args) => execute(tools.adb, args, tools.env);
  function devices() {
    return adb('devices')
      .split('\n')
      .slice(1)
      .map((line) => line.split(/\s+/)[0])
      .filter(Boolean);
  }
  // Only start and stop our own virtual device. Let the emulator choose an available console port.
  const original = new Set(devices());
  for (const serial of original) {
    if (serial.startsWith('emulator-')) {
      try {
        assert.notEqual(
          adb('-s', serial, 'emu', 'avd', 'name').split(/\r?\n/)[0],
          name,
          name + ' is already running',
        );
      } catch (error) {
        if (error.code === 'ERR_ASSERTION') throw error;
      }
    }
  }
  prepareAvd(profile, tools);
  mkdirSync(reports, { recursive: true });
  const log = join(reports, 'emulator.log');
  const fd = openSync(log, 'w');
  const child = spawn(
    tools.emulator,
    [
      '-avd',
      name,
      '-no-window',
      '-no-audio',
      '-snapshot',
      readySnapshot,
      '-no-snapshot-save',
      '-no-boot-anim',
      '-gpu',
      process.platform === 'darwin' ? 'host' : 'swiftshader_indirect',
      '-memory',
      String(profile.ramMiB),
      '-cores',
      String(profile.cores),
    ],
    { env: tools.env, stdio: ['ignore', fd, fd] },
  );
  closeSync(fd);
  let serial;
  let launchError;
  let stopped = false;
  child.once('error', (error) => {
    launchError = error;
  });
  child.once('close', () => {
    stopped = true;
  });
  try {
    await until(
      () => {
        if (launchError || stopped)
          throw new Error('Emulator exited before boot. See ' + log, { cause: launchError });
        // Match by AVD name only: a just-stopped emulator can stay listed as offline under
        // the console port this one reuses, so a serial seen before launch may still be ours.
        for (const item of devices().filter((item) => item.startsWith('emulator-'))) {
          try {
            if (adb('-s', item, 'emu', 'avd', 'name').split(/\r?\n/)[0] !== name) continue;
            serial = item;
            if (adb('-s', item, 'shell', 'getprop', 'sys.boot_completed') === '1') return true;
          } catch {
            /* adb transport appears before Android is ready */
          }
        }
        return false;
      },
      300000,
      'Android did not boot: ' + log,
    );
    const device = (...args) => adb('-s', serial, ...args);
    device('shell', 'am', 'wait-for-broadcast-idle');
    device('shell', 'svc', 'power', 'stayon', 'true');
    device('shell', 'input', 'keyevent', 'KEYCODE_WAKEUP');
    device('shell', 'wm', 'dismiss-keyguard');
    const loaded = snapshotLoaded(readFileSync(log, 'utf8'));
    if (!loaded) {
      // A missing or incompatible snapshot means this was a cold boot: record it now,
      // before anything is installed, for the next run.
      device('emu', 'avd', 'snapshot', 'delete', readySnapshot);
      const saved = device('emu', 'avd', 'snapshot', 'save', readySnapshot);
      if (!/^OK/m.test(saved)) console.warn(name + ' could not save its snapshot: ' + saved);
    }
    console.log(name + (loaded ? ' booted from its snapshot.' : ' cold-booted and saved its snapshot.'));
    return await task({ serial, name, device, snapshot: loaded });
  } finally {
    if (serial && !stopped) {
      try {
        if (adb('-s', serial, 'emu', 'avd', 'name').split(/\r?\n/)[0] === name)
          adb('-s', serial, 'emu', 'kill');
        else child.kill('SIGTERM');
      } catch {
        child.kill('SIGTERM');
      }
    } else if (!stopped) child.kill('SIGTERM');
    try {
      await until(() => stopped, 15000, 'Emulator shutdown timed out');
    } catch {
      child.kill('SIGKILL');
      await until(() => stopped, 10000, 'Could not stop owned ' + name);
    }
  }
}
