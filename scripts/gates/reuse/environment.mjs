import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, fstatSync, openSync, readFileSync, readSync } from 'node:fs';
import { isIPv4 } from 'node:net';
import { homedir } from 'node:os';
import { join } from 'node:path';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const command = (bin, args, options) => execFileSync(bin, args, {
  encoding: 'utf8', timeout: 30_000, maxBuffer: 32 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'], ...options,
}).trim();
const sorted = values => [...values].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));

function digestFile(path) {
  const digest = createHash('sha256'), block = Buffer.allocUnsafe(1024 * 1024);
  const fd = openSync(path, 'r');
  try {
    const before = fstatSync(fd, { bigint: true });
    assert.ok(before.isFile());
    let length;
    while ((length = readSync(fd, block)) > 0) digest.update(block.subarray(0, length));
    const after = fstatSync(fd, { bigint: true });
    assert.ok(before.ctimeNs === after.ctimeNs && before.size === after.size, 'Image changed while hashing');
    return digest.digest('hex');
  } finally { closeSync(fd); }
}

function androidImages(root, sdk) {
  const matrix = JSON.parse(readFileSync(join(root, 'tests/android/profiles.json')));
  assert.deepEqual(matrix.profiles.map(p => p.id).sort(), ['low-end', 'standard']);
  const images = {};
  for (const profile of matrix.profiles) {
    const platform = profile.platform ?? matrix.platform, image = profile.image ?? matrix.image;
    assert.match(platform, /^android-\d+(?:\.\d+)?$/);
    assert.match(image, /^[a-z0-9_]+$/);
    const abi = process.arch === 'arm64' ? 'arm64-v8a' : 'x86_64';
    const directory = join(sdk, 'system-images', platform, image, abi);
    const properties = readFileSync(join(directory, 'build.prop'), 'utf8');
    const declared = /^ro\.system\.build\.fingerprint=(\S+)$/m.exec(properties)?.[1];
    assert.ok(declared, 'Missing Android system image fingerprint');
    // The SDK property can describe a different signing tag than the booted
    // image. Bind the actual installed system, vendor and boot bytes as well.
    const boot = ['system.img', 'vendor.img', 'kernel-ranchu', 'ramdisk.img', 'source.properties', 'build.prop']
      .map(file => [file, digestFile(join(directory, file))]);
    images[profile.id] = [platform, image, abi, declared, hash(JSON.stringify(boot))];
  }
  return JSON.stringify(Object.entries(images).sort());
}

// The same read-only program inspects the browser installations on either host.
// It consumes package metadata without loading any proposed package code.
const browserProbe = `
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const exec = require('node:child_process').execFileSync;
const root = process.cwd(), mac = process.platform === 'darwin';
if (process.arch !== 'arm64' || (!mac && process.platform !== 'linux')) throw Error('Unknown browser host');
const platform = mac ? 'mac' + exec('/usr/bin/sw_vers', ['-productVersion'], {encoding:'utf8'}).split('.')[0] + '-arm64'
  : 'ubuntu24.04-arm64';
const cache = process.env.PLAYWRIGHT_BROWSERS_PATH || (mac ? path.join(os.homedir(), 'Library/Caches/ms-playwright')
  : path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), 'ms-playwright'));
if (!path.isAbsolute(cache)) throw Error('Unknown browser cache');
const prefix = mac ? 'mac-arm64' : 'linux-arm64';
const binaries = {
  chromium: mac ? 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' : 'chrome-linux-arm64/chrome',
  'chromium-headless-shell': 'chrome-headless-shell-' + prefix + '/chrome-headless-shell',
  firefox: mac ? 'firefox/Nightly.app/Contents/MacOS/firefox' : 'firefox/firefox',
  webkit: 'pw_run.sh', ffmpeg: mac ? 'ffmpeg-mac' : 'ffmpeg-linux'
};
const descriptors = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/playwright-core/browsers.json'))).browsers;
const rows = Object.entries(binaries).map(([name, binary]) => {
  const matching = descriptors.filter(item => item.name === name);
  if (matching.length !== 1) throw Error('Missing browser descriptor ' + name);
  const override = matching[0].revisionOverrides?.[platform];
  const revision = override || matching[0].revision;
  if (!/^[0-9]+$/.test(revision)) throw Error('Invalid browser revision');
  const folder = (override ? name + '_' + platform + '_special' : name).replaceAll('-', '_') + '-' + revision;
  const dir = path.join(cache, folder);
  fs.accessSync(path.join(dir, binary), fs.constants.X_OK);
  if (!fs.statSync(path.join(dir, 'INSTALLATION_COMPLETE')).isFile()) throw Error('Incomplete browser installation');
  return [name, revision];
});
`;

const guestProbe = browserProbe + `
const digest = bytes => require('node:crypto').createHash('sha256').update(bytes).digest('hex');
if (os.hostname() !== 'uld-linux' || !/^VERSION_ID="24\\.04"$/m.test(fs.readFileSync('/etc/os-release', 'utf8')))
  throw Error('Unexpected qualification guest');
const image = JSON.parse(fs.readFileSync('/etc/uld-image.json'));
const fontList = exec('fc-list', ['--format', '%{family}|%{style}|%{fontversion}|%{file}\\n'], {encoding:'utf8'});
if (!fontList.trim()) throw Error('Missing Linux fonts');
console.log(JSON.stringify({image, node:process.version + '/' + process.platform + '/' + process.arch,
  lockfile:digest(fs.readFileSync('package-lock.json')), fonts:digest(JSON.stringify(fontList.trim().split('\\n').sort())),
  browsers:JSON.stringify([rows,os.release(),digest(fs.readFileSync('/var/lib/dpkg/status'))])}));
`;

function guestFacts(run, root) {
  const utm = '/Applications/UTM.app/Contents/MacOS/utmctl', vm = 'uld-linux';
  assert.equal(run(utm, ['status', vm]), 'started', 'The Linux guest is not running');
  const address = run(utm, ['ip-address', vm]).split(/\s+/).find(isIPv4);
  assert.ok(address);
  const options = ['-F', join(homedir(), 'Library/Application Support/ui-lazy-dev/linux-vm/ssh-config'),
    '-o', 'ForwardAgent=no', '-o', 'ClearAllForwardings=yes', '-o', 'StrictHostKeyChecking=yes',
    '-o', 'HostName=' + address, vm, 'cd "$HOME/qualification" && node --input-type=commonjs'];
  const guest = JSON.parse(run('ssh', options, { input: guestProbe }));
  assert.equal(guest.image.uuid, '8E1A0BED-BE5C-4A3C-9814-6543FB229DB7');
  assert.match(guest.image.sha256, /^[0-9a-f]{64}$/);
  assert.equal(guest.lockfile, hash(readFileSync(join(root, 'package-lock.json'))));
  assert.equal(guest.node, 'v22.23.2/linux/arm64');
  assert.match(guest.fonts, /^[0-9a-f]{64}$/);
  assert.ok(typeof guest.browsers === 'string' && guest.browsers.length > 0);
  return guest;
}

export function environmentFacts(ids, { root, groupId, run = command, androidSdk, maestro } = {}) {
  const result = {};
  let guest, queried = false;
  const linux = () => {
    if (!queried) {
      queried = true;
      guest = guestFacts(run, root);
    }
    assert.ok(guest, 'Live guest facts are unavailable');
    return guest;
  };
  const onGuest = groupId === 'Linux browser behavior';
  const value = id => {
    switch (id) {
      case 'node': return onGuest ? linux().node : [process.version, process.platform, process.arch].join('/');
      case 'lockfile': return hash(readFileSync(join(root, 'package-lock.json')));
      case 'vm-image': return linux().image.sha256;
      case 'playwright-browsers': return onGuest ? linux().browsers :
        run(process.execPath, ['--input-type=commonjs', '-e', browserProbe + '\nconsole.log(JSON.stringify(rows))'], { cwd: root });
      case 'macos-build': return run('/usr/bin/sw_vers', ['-buildVersion']);
      case 'hardware-model': return run('/usr/sbin/sysctl', ['-n', 'hw.model']);
      case 'gpu': {
        const gpus = JSON.parse(run('/usr/sbin/system_profiler', ['SPDisplaysDataType', '-json'])).SPDisplaysDataType;
        assert.ok(gpus.length && gpus.every(gpu => gpu.sppci_model || gpu._name));
        return JSON.stringify(sorted(gpus.map(gpu => JSON.stringify([gpu.sppci_model ?? gpu._name,
          gpu.spdisplays_device_id ?? null, gpu.spdisplays_vendor ?? null, gpu.sppci_cores ?? null]))));
      }
      case 'display-scale': {
        const script = "ObjC.import('AppKit'); JSON.stringify($.NSScreen.screens.js.map(s => Number(s.backingScaleFactor)).sort())";
        const scales = JSON.parse(run('/usr/bin/osascript', ['-l', 'JavaScript', '-e', script]));
        assert.ok(scales.length && scales.every(n => Number.isFinite(n) && n > 0));
        return JSON.stringify(scales);
      }
      case 'fonts': {
        if (onGuest) return linux().fonts;
        const fonts = JSON.parse(run('/usr/sbin/system_profiler', ['SPFontsDataType', '-json'])).SPFontsDataType;
        assert.ok(fonts.length && fonts.every(font => font._name));
        return hash(JSON.stringify(sorted(fonts.map(font => JSON.stringify([font._name, font.enabled ?? null,
          font.path ?? null, sorted((font.typefaces ?? []).map(face => JSON.stringify([face._name, face.version ?? null,
            face.enabled ?? null])))])))));
      }
      case 'xcode': return run('xcodebuild', ['-version']);
      case 'ios-runtime': {
        const runtimes = JSON.parse(run('xcrun', ['simctl','list','runtimes','--json'])).runtimes;
        const devices = JSON.parse(run('xcrun', ['simctl','list','devices','available','--json'])).devices;
        const phones = Object.keys(devices).filter(key => key.includes('.iOS-')).reverse().flatMap(key =>
          devices[key].filter(phone => phone.isAvailable && phone.name.startsWith('iPhone')).map(phone => ({...phone, key})));
        const phone = process.env.UI_SIMULATOR_ID ? phones.find(p => p.udid === process.env.UI_SIMULATOR_ID) :
          phones.find(p => p.state === 'Booted') ?? phones[0];
        const runtime = runtimes.find(r => r.isAvailable && r.identifier === phone?.key);
        assert.ok(runtime?.buildversion && phone.udid && phone.deviceTypeIdentifier);
        return JSON.stringify([runtime.identifier, runtime.buildversion, phone.udid, phone.deviceTypeIdentifier]);
      }
      case 'android-system-image': return androidImages(root, androidSdk ?? process.env.ANDROID_HOME ??
        process.env.ANDROID_SDK_ROOT ?? join(homedir(), 'Library/Android/sdk'));
      case 'maestro': return run(maestro ?? process.env.MAESTRO_BIN ?? join(homedir(), '.maestro/bin/maestro'), ['--version']);
      default: return 'unavailable';
    }
  };
  for (const id of sorted(new Set(ids))) {
    try {
      const observed = value(id);
      result[id] = typeof observed === 'string' && observed.trim() ? observed.trim() : 'unavailable';
    } catch { result[id] = 'unavailable'; }
  }
  return result;
}
