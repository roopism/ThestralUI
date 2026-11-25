import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  constants, cpSync, existsSync, globSync, mkdirSync, mkdtempSync, readFileSync,
  renameSync, rmSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

function copyModules(source, target) {
  mkdirSync(dirname(target), { recursive: true });
  // Preserve the relative workspace links. Resolving them here would copy
  // working sources into the snapshot instead of using the staged packages.
  if (process.platform === 'darwin') {
    // Clone the private, freshly installed APFS directory in one operation.
    // Walking each dependency separately dominates the warm hook on large installs.
    const clone = spawnSync('/usr/bin/python3', ['-c', [
      'import ctypes, os, sys',
      'clone = ctypes.CDLL(None, use_errno=True).clonefile',
      'clone.argtypes = [ctypes.c_char_p, ctypes.c_char_p, ctypes.c_int]',
      'sys.exit(0 if clone(os.fsencode(sys.argv[1]), os.fsencode(sys.argv[2]), 0) == 0 else 1)',
    ].join('\n'), source, target]);
    if (clone.status === 0) return;
  }
  cpSync(source, target, {
    recursive: true, verbatimSymlinks: true, mode: constants.COPYFILE_FICLONE,
  });
}

export function installSnapshotDependencies(snapshot, cache, env, install = () =>
  execFileSync('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], {
    cwd: snapshot, env, stdio: 'inherit',
  }),
) {
  const lock = readFileSync(join(snapshot, 'package-lock.json'));
  const manifest = JSON.parse(readFileSync(join(snapshot, 'package.json')));
  const patterns = manifest.workspaces?.packages ?? manifest.workspaces ?? [];
  // npm accepts exclusion patterns. Use npm's workspace discovery when the
  // local glob implementation cannot reproduce the configuration.
  if (!Array.isArray(patterns) || patterns.some(pattern => typeof pattern !== 'string' || pattern.startsWith('!'))) {
    install();
    return;
  }
  const hash = createHash('sha256').update(lock)
    .update([process.version, process.platform, process.arch].join('/'));
  // npm also checks the manifests when validating its lockfile. Never let a
  // cached install hide an unrecorded addition to workspace dependencies.
  const manifests = globSync(patterns.map(pattern => pattern + '/package.json'), {
    cwd: snapshot, exclude: ['**/node_modules/**', '**/.git/**'],
  }).sort();
  const roots = ['', ...manifests.map(file => dirname(file))];
  for (const root of roots) {
    const data = JSON.parse(readFileSync(join(snapshot, root, 'package.json'), 'utf8'));
    // Staged workspace links expose these fields directly. npm ci ignores
    // lifecycle scripts here, so a new public entry can reuse its locked install.
    for (const field of ['exports', 'imports', 'files', 'scripts']) delete data[field];
    hash.update(root).update('\0').update(JSON.stringify(data)).update('\0');
  }
  if (existsSync(join(snapshot, '.npmrc'))) hash.update(readFileSync(join(snapshot, '.npmrc')));
  const cached = join(cache, hash.digest('hex'));
  const directories = roots.map(root => join(root, 'node_modules'));
  if (existsSync(cached)) {
    for (const dir of directories) {
      if (existsSync(join(cached, dir))) copyModules(join(cached, dir), join(snapshot, dir));
    }
    return;
  }
  install();
  mkdirSync(cache, { recursive: true });
  const staging = mkdtempSync(join(cache, 'install-'));
  try {
    for (const dir of directories) {
      if (existsSync(join(snapshot, dir))) copyModules(join(snapshot, dir), join(staging, dir));
    }
    if (!existsSync(join(staging, 'node_modules/.package-lock.json'))) {
      throw Error('npm ci did not create the dependency tree for the staged lockfile');
    }
    try {
      renameSync(staging, cached);
    } catch (error) {
      if (!['ENOTEMPTY', 'EEXIST'].includes(error.code) || !existsSync(cached)) throw error;
    }
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}
