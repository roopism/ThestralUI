import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { withTiming } from '../workers/resource-guard.mjs';
import { prepareGuest } from './linux-prepare.mjs';
import { isIPv4 } from 'node:net';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const utm = '/Applications/UTM.app/Contents/MacOS/utmctl';
const vm = 'uld-linux';
const config = join(homedir(), 'Library/Application Support/ui-lazy-dev/linux-vm/ssh-config');
const sshOptions = ['-F', config, '-o', 'StrictHostKeyChecking=yes', '-o', 'ForwardAgent=no', '-o', 'ClearAllForwardings=yes'];
const exec = (bin, args, options = {}) => execFileSync(bin, args, { encoding: 'utf8', ...options });
const state = () => exec(utm, ['status', vm]).trim();
export async function stopVm() {
  if (state() === 'stopped') return;
  assert.notEqual(process.env.ULD_CLOUD_LOCAL, '1', 'Local cloud timing requires the project VM to already be stopped');
  exec(utm, ['stop', vm, '--request']);
  for (let n = 0; n < 60; n++) {
    if (state() === 'stopped') return;
    await delay(1000);
  }
  throw Error('Linux guest is still active. Timing cannot start.');
}
export function requireGuestCacheIsolation(shares, mounts, devices) {
  assert.deepEqual(shares, [], 'Disable the UTM shared directories before guest qualification');
  const local = new Set(['ext2', 'ext3', 'ext4', 'vfat', 'iso9660', 'squashfs', 'tmpfs', 'devtmpfs', 'devpts',
    'proc', 'sysfs', 'cgroup', 'cgroup2', 'securityfs', 'pstore', 'efivarfs', 'bpf', 'tracefs', 'debugfs',
    'hugetlbfs', 'mqueue', 'configfs', 'fusectl', 'autofs', 'binfmt_misc', 'ramfs', 'nsfs']);
  assert.ok(mounts.length && mounts.every(type => local.has(type)),
    'Unknown guest filesystem or active filesystem share');
  assert.ok(devices.length && devices.every(id => /^0x[0-9a-f]+$/i.test(id) && ![9, 26].includes(Number(id))),
    'Guest qualification cannot expose a VirtFS or virtio-fs sharing device');
}

export function prepareLinuxDependencies(root, sshArgs, image, cache) {
  const registry = join(homedir(), 'Library/Containers/com.utmapp.UTM/Data/Library/Preferences/com.utmapp.UTM.plist');
  const shares = JSON.parse(exec('/usr/bin/plutil', ['-extract', 'Registry.' + image.uuid + '.SharedDirectories', 'json', '-o', '-', registry]));
  const ssh = (command, options) => exec('ssh', [...sshArgs, command], options);
  const mounts = ssh('findmnt -rn -o FSTYPE').trim().split(/\s+/);
  const devices = ssh('cat /sys/bus/virtio/devices/virtio*/device').trim().split(/\s+/);
  requireGuestCacheIsolation(shares, mounts, devices);
  const npm = ssh('npm --version').trim();
  assert.match(npm, /^\d+\.\d+\.\d+$/);
  const runtime = { os: 'linux', arch: 'arm64', node: 'v22.23.2', npm, image: image.sha256 };
  const source = readFileSync(new URL('./linux-prepare.mjs', import.meta.url), 'utf8');
  // Only base code goes into the remote command. stdin and stdout carry the archive without a guest cache file.
  const guest = (statement, stdio = ['ignore', 'pipe', 'inherit']) => {
    const program = Buffer.from(source + '\n' + statement).toString('base64');
    return ssh("cd ~/qualification && node --input-type=module -e 'await import(\"data:text/javascript;base64," + program + "\")'", { stdio });
  };
  const args = key => 'process.cwd(),' + JSON.stringify(runtime) + ',' + JSON.stringify(key);
  return prepareGuest(root, {
    buildArchive: (key, fd) => guest('buildGuestArchive(' + args(key) + ',1)', ['ignore', fd, 'inherit']),
    restoreArchive: (key, fd) => guest('console.log(restoreGuestArchive(' + args(key) + ',0))',
      [fd, 'pipe', 'inherit']).trim(),
    playwrightVersion: () => guest('console.log(guestOperations(process.cwd()).playwrightVersion())').trim(),
    browsersPresent: () => JSON.parse(guest('console.log(guestOperations(process.cwd()).browsersPresent())')),
    installBrowsers: () => guest('guestOperations(process.cwd()).installBrowsers()', ['ignore', 'inherit', 'inherit']),
  }, cache, runtime);
}

export async function withLinuxImageFacts(observe) {
  return withTiming('activity', 'Read current Linux guest identity', async () => {
    try {
      if (state() === 'stopped') exec(utm, ['start', vm]);
      let sshArgs;
      for (let n = 0; n < 60; n++) {
        try {
          const address = exec(utm, ['ip-address', vm], { stdio: ['ignore', 'pipe', 'pipe'] }).split(/\s+/).find(isIPv4);
          assert.ok(address);
          sshArgs = [...sshOptions, '-o', 'HostName=' + address, vm];
          exec('ssh', [...sshArgs, 'true'], { stdio: 'ignore' });
          break;
        } catch (error) { if (n === 59) throw error; await delay(1000); }
      }
      const image = JSON.parse(exec('ssh', [...sshArgs, 'cat /etc/uld-image.json']));
      assert.equal(image.uuid, '8E1A0BED-BE5C-4A3C-9814-6543FB229DB7');
      assert.equal(image.sha256, '50e24e1fb79e89116e939d90aa7738f7af48c442fa1bc2510131e0b39c50348e');
      return await observe(image, sshArgs);
    } finally { await stopVm(); }
  });
}

function withGuestReadRestrictions(sshArgs, exclude, commands) {
  assert.ok(exclude.length && exclude.every(glob => ['docs/**', '*.md'].includes(glob)));
  const source = readFileSync(new URL('./reuse/sandbox-linux.mjs', import.meta.url)).toString('base64');
  const script = [
    'set -eu', 'cd "$HOME/qualification"', 'proof=$(mktemp -d)', "trap 'rm -rf -- \"$proof\"' EXIT",
    'printf %s ' + source + ' | base64 --decode > "$proof/sandbox-linux.mjs"',
    'restricted() { node "$proof/sandbox-linux.mjs" "$globs" -- "$@"; }',
    'globs="$1"', ...commands,
  ].join('\n');
  exec('ssh', [...sshArgs, "bash -s -- '" + JSON.stringify(exclude) + "'"], { input: script, stdio: ['pipe', 'inherit', 'inherit'] });
}

function runLinuxBrowserGroups(sshArgs, exclude) {
  if (exclude.length) {
    withGuestReadRestrictions(sshArgs, exclude, [
      'mkdir -p dist release test-results playwright-report',
      'restricted npm run build',
      'UI_GATE_SNAPSHOT=1 CI=1 restricted node scripts/gates/linux-browser-suites.mjs',
    ]);
  } else {
    exec('ssh', [...sshArgs, 'cd ~/qualification && npm run build && UI_GATE_SNAPSHOT=1 CI=1 node scripts/gates/linux-browser-suites.mjs'],
      { stdio: 'inherit' });
  }
}

export async function linuxBrowsers(root, commit, record, { exclude = [] } = {}) {
  assert.match(commit, /^[a-f0-9]{40}$/);
  try {
    if (state() === 'stopped') exec(utm, ['start', vm]);
    let identity, address, sshArgs;
    for (let n = 0; n < 60; n++) {
      try {
        address = exec(utm, ['ip-address', vm], { stdio: ['ignore', 'pipe', 'pipe'] }).split(/\s+/).find(isIPv4);
        assert.ok(address, 'Waiting for the local guest network');
        sshArgs = [...sshOptions, '-o', 'HostName=' + address, vm];
        const raw = exec('ssh', [...sshArgs, 'cat /etc/os-release; hostname; uname -m; node --version; cat /sys/class/dmi/id/product_uuid 2>/dev/null || true'],
          { stdio: ['ignore', 'pipe', 'pipe'] });
        assert.match(raw, /^VERSION_ID="24\.04"$/m);
        assert.match(raw, /^uld-linux$/m);
        assert.match(raw, /^aarch64$/m);
        assert.match(raw, /^v22\.23\.2$/m);
        identity = raw;
        break;
      } catch (error) {
        if (n === 59) throw error;
        await delay(1000);
      }
    }
    const image = JSON.parse(exec('ssh', [...sshArgs, 'cat /etc/uld-image.json']));
    assert.equal(image.uuid, '8E1A0BED-BE5C-4A3C-9814-6543FB229DB7');
    assert.equal(image.sha256, '50e24e1fb79e89116e939d90aa7738f7af48c442fa1bc2510131e0b39c50348e');
    const metadata = { os: identity, image, sourceImageSha256: image.sha256 };
    record(metadata);
    const ssh = "ssh -o HostName=" + address + " -o ForwardAgent=no -o StrictHostKeyChecking=yes -F '" + config.replaceAll("'", "'\\''") + "'";
    exec('git', ['-c', 'push.followTags=false', '-c', 'core.sshCommand=' + ssh, 'push',
      vm + ':repo.git', commit + ':refs/qualification/' + commit], { cwd: root, stdio: 'inherit' });
    const script = [
      'set -eu', 'cd "$HOME/qualification"', 'git diff --exit-code HEAD --',
      'test -z "$(git ls-files --others --exclude-standard)"',
      'git fetch --no-tags origin "$1"', 'git checkout --detach "$1"', 'test "$(git rev-parse HEAD)" = "$1"',
    ].join('\n');
    exec('ssh', [...sshArgs, 'bash -s -- ' + commit], { input: script, stdio: ['pipe', 'inherit', 'inherit'] });
    const cache = join(homedir(), 'Library/Application Support/ui-lazy-dev/linux-vm/dependency-cache');
    const preparation = prepareLinuxDependencies(process.cwd(), sshArgs, image, cache);
    metadata.preparation = preparation;
    record(metadata);
    runLinuxBrowserGroups(sshArgs, exclude);
    metadata.enforcedExclusions = [...exclude];
    const browsers = exec('ssh', [...sshArgs, 'cd ~/qualification && node node_modules/@playwright/test/cli.js --version']).trim();
    return { ...metadata, browsers };
  } finally {
    await stopVm();
  }
}

if (import.meta.main && process.argv[2] === '--reuse-image') {
  const [snapshot, encoded] = process.argv.slice(3);
  const facts = await withLinuxImageFacts(async (image, sshArgs) => {
    if (!snapshot && !encoded) return image;
    const ids = JSON.parse(encoded);
    assert.ok(Array.isArray(ids) && ids.length && ids.every(id => typeof id === 'string'));
    // Prove that this guest still enforces read exclusions before admitting a cached result.
    const probe = 'const fs=require("node:fs"),assert=require("node:assert/strict");' +
      'assert.ok(fs.readFileSync("package.json").length);' +
      'assert.throws(()=>fs.readFileSync("README.md"),e=>e.code==="EACCES"||e.code==="EPERM");';
    withGuestReadRestrictions(sshArgs, ['*.md'], ['test -s README.md', "restricted node -e '" + probe + "'"]);
    const { environmentFacts } = await import('./reuse/environment.mjs');
    return environmentFacts(ids, { root: snapshot, groupId: 'Linux browser behavior' });
  });
  console.log(JSON.stringify(facts));
}
