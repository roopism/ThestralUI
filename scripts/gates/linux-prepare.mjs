import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { accessSync, closeSync, constants, copyFileSync, existsSync, fstatSync, globSync, lstatSync,
  mkdirSync, mkdtempSync, openSync, readFileSync, readSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const hash = (input) => createHash('sha256').update(input).digest('hex');

export function guestOperations(root) {
  const require = createRequire(join(root, 'package.json'));
  const install = (bin, args) => execFileSync(bin, args, { cwd: root, stdio: ['ignore', 2, 2] });
  return {
    playwrightVersion: () => require('playwright-core/package.json').version,
    browsersPresent() {
      const { registry } = require('playwright-core/lib/coreBundle').registry;
      return ['chromium', 'chromium-headless-shell', 'firefox', 'webkit', 'ffmpeg'].every((name) => {
        const file = registry.findExecutable(name)?.executablePath();
        if (!file) return false;
        try {
          accessSync(file, constants.X_OK);
          return true;
        } catch {
          return false;
        }
      });
    },
    installBrowsers: () =>
      install(process.execPath, [
        'node_modules/@playwright/test/cli.js',
        'install',
        '--with-deps',
        'chromium',
        'firefox',
        'webkit',
      ]),
  };
}

function installationInputs(root, runtime) {
  const project = realpathSync(root), lockfile = 'package-lock.json';
  const read = path => {
    const file = join(project, path);
    if (realpathSync(file) !== file || !lstatSync(file).isFile()) throw Error('Unsafe guest install input ' + path);
    return readFileSync(file);
  };
  const lock = read(lockfile);
  const lockSha256 = hash(lock), packages = JSON.parse(lock).packages;
  const roots = Object.keys(packages).filter(path => !path.split('/').includes('node_modules')).sort();
  if (roots[0] !== '' || roots.some(path => path && !path.split('/').every(part => /^[\w@-][\w@.-]*$/.test(part))))
    throw Error('Invalid workspace paths in the guest lock');
  const patterns = JSON.parse(read('package.json')).workspaces ?? [];
  const workspaces = Array.isArray(patterns) ? patterns : patterns.packages;
  if (!Array.isArray(workspaces) || workspaces.some(pattern => typeof pattern !== 'string' ||
    pattern.startsWith('/') || pattern.startsWith('!') || pattern.split('/').includes('..')))
    throw Error('Unsupported guest workspace configuration');
  const discovered = globSync(workspaces.map(pattern => pattern + '/package.json'), { cwd: project,
    exclude: ['**/node_modules/**', '**/.git/**'] }).map(dirname).sort();
  if (JSON.stringify(discovered) !== JSON.stringify(roots.slice(1))) throw Error('Guest lock workspace registration differs');
  for (const [path, item] of Object.entries(packages)) {
    if (roots.includes(path)) continue;
    if (item.link ? !roots.slice(1).includes(item.resolved) :
      !/^https:\/\//.test(item.resolved ?? '') || !/^sha(?:256|384|512)-/.test(item.integrity ?? ''))
      throw Error('Guest dependency lacks a locked, integrity-checked source: ' + path);
  }
  const files = [lockfile, ...roots.map(path => join(path, 'package.json'))];
  for (const path of roots.slice(1)) {
    const manifest = JSON.parse(read(join(path, 'package.json')));
    if (manifest.directories?.bin) throw Error('Guest workspace must declare its executable files explicitly');
    const targets = typeof manifest.bin === 'string' ? [manifest.bin] : Object.values(manifest.bin ?? {});
    for (const target of new Set(targets)) {
      const local = typeof target === 'string' && target.replace(/^\.\//, '');
      if (!local || !local.split('/').every(part => /^[\w@-][\w@.-]*$/.test(part)))
        throw Error('Invalid guest workspace executable in ' + path);
      files.push(join(path, local));
    }
  }
  if (existsSync(join(project, '.npmrc'))) files.push('.npmrc');
  const installationKey = hash(JSON.stringify([1, runtime, files.map(file => [file, hash(read(file))])]));
  return { roots, files, installationKey, lockSha256 };
}

function matchingInputs(root, runtime, key) {
  if (runtime.os !== process.platform || runtime.arch !== process.arch || runtime.node !== process.version)
    throw Error('Guest runtime differs from the host-verified installation identity');
  const inputs = installationInputs(root, runtime);
  if (inputs.installationKey !== key) throw Error('Guest checkout differs from the host-verified installation inputs');
  return inputs;
}

// A fresh directory contains only dependency inputs and the bin targets npm must link. Lifecycle scripts stay disabled.
export function buildGuestArchive(root, runtime, key, output, install = stage =>
  execFileSync('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: stage, stdio: ['ignore', 2, 2] })) {
  const { files, roots } = matchingInputs(root, runtime, key);
  const stage = mkdtempSync(join(tmpdir(), 'uld-linux-install-'));
  try {
    for (const file of files) {
      mkdirSync(dirname(join(stage, file)), { recursive: true });
      copyFileSync(join(root, file), join(stage, file));
    }
    matchingInputs(stage, runtime, key);
    install(stage);
    const dirs = roots.map(path => join(path, 'node_modules')).filter(path => existsSync(join(stage, path)));
    if (!dirs.includes('node_modules') || !lstatSync(join(stage, 'node_modules/.package-lock.json')).isFile())
      throw Error('Guest install did not produce the locked dependency tree');
    execFileSync('tar', ['-czf', '-', '--', ...dirs], { cwd: stage, stdio: ['ignore', output, 2] });
  } finally { rmSync(stage, { recursive: true, force: true }); }
}

export function restoreGuestArchive(root, runtime, key, input) {
  matchingInputs(root, runtime, key);
  execFileSync('find', ['.', '-xdev', '-name', '.git', '-prune', '-o', '-name', 'node_modules',
    '-prune', '-exec', 'rm', '-rf', '--', '{}', '+'], { cwd: root });
  execFileSync('tar', ['-xzf', '-'], { cwd: root, stdio: [input, 2, 2] });
  const body = readFileSync(join(root, 'node_modules/.package-lock.json'));
  if (!Object.keys(JSON.parse(body).packages ?? {}).every(path =>
    !path.startsWith('/') && !path.split('/').includes('..') && existsSync(join(root, path))))
    throw Error('Restored guest install is missing a locked package');
  return hash(body);
}

function archiveDigest(fd) {
  if (!fstatSync(fd).isFile()) throw Error('Guest dependency archive must be a regular file');
  const digest = createHash('sha256'), buffer = Buffer.allocUnsafe(1024 * 1024);
  let offset = 0, count;
  // Positional reads leave the very same verified descriptor at byte zero for SSH.
  while ((count = readSync(fd, buffer, 0, buffer.length, offset)) > 0) {
    digest.update(buffer.subarray(0, count));
    offset += count;
  }
  return digest.digest('hex');
}

export function prepareGuest(root, operations, cache = operations.cache, runtime = { node: process.version, arch: process.arch, os: process.platform }) {
  const { installationKey, lockSha256 } = installationInputs(root, runtime);
  mkdirSync(cache, { recursive: true, mode: 0o700 });
  const directory = join(cache, installationKey);
  const warm = existsSync(directory);
  const working = warm ? directory : mkdtempSync(join(cache, '.install-'));
  const stamp = join(working, 'stamp.json'), archive = join(working, 'node_modules.tgz');
  const browserStamp = join(cache, 'browsers-' + hash(JSON.stringify(runtime)) + '.json');
  try {
    let previous, provenance;
    try {
      previous = JSON.parse(readFileSync(browserStamp, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
    }
    if (warm) {
      if (!lstatSync(working).isDirectory() || !lstatSync(stamp).isFile()) throw Error('Unsafe guest cache provenance');
      provenance = JSON.parse(readFileSync(stamp, 'utf8'));
      if (JSON.stringify(provenance?.runtime) !== JSON.stringify(runtime) || provenance.installationKey !== installationKey ||
          provenance.lockSha256 !== lockSha256 || !/^[a-f0-9]{64}$/.test(provenance.archiveSha256) ||
          !/^[a-f0-9]{64}$/.test(provenance.installedLock))
        throw Error('Guest dependency archive provenance differs');
    } else {
      const output = openSync(archive, 'wx', 0o600);
      try {
        if (operations.buildArchive) operations.buildArchive(installationKey, output);
        else buildGuestArchive(root, runtime, installationKey, output, operations.installDependencies);
      } finally { closeSync(output); }
    }
    const input = openSync(archive, constants.O_RDONLY | constants.O_NOFOLLOW);
    let archiveSha256, installedLock;
    try {
      archiveSha256 = archiveDigest(input);
      if (warm && provenance.archiveSha256 !== archiveSha256) throw Error('Guest dependency archive digest differs');
      installedLock = operations.restoreArchive ? operations.restoreArchive(installationKey, input) :
        restoreGuestArchive(root, runtime, installationKey, input);
    } finally { closeSync(input); }
    if (!/^[a-f0-9]{64}$/.test(installedLock) || (warm && installedLock !== provenance.installedLock))
      throw Error('Restored guest dependency lock differs');
    let browsers = 'reused';
    const playwright = operations.playwrightVersion();
    if (previous?.playwright !== playwright || !operations.browsersPresent()) {
      operations.installBrowsers();
      if (!operations.browsersPresent())
        throw Error('Playwright installation is missing a required executable');
      browsers = 'installed';
    }
    const result = { dependencies: warm ? 'reused' : 'installed', browsers, lockSha256, installationKey,
      archiveSha256, installedLock, playwright, runtime };
    const temporary = stamp + '.' + process.pid;
    writeFileSync(temporary, JSON.stringify(result) + '\n', { mode: 0o600 });
    renameSync(temporary, stamp);
    if (!warm) renameSync(working, directory);
    const latest = browserStamp + '.' + process.pid;
    writeFileSync(latest, JSON.stringify({ playwright }) + '\n', { mode: 0o600 });
    renameSync(latest, browserStamp);
    return result;
  } finally { if (!warm && existsSync(working)) rmSync(working, { recursive: true, force: true }); }
}
