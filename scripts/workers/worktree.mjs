import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { workerPorts } from './ports.mjs';

export function workerWorktree(root, holder, task) {
  const port = workerPorts(holder);
  if (holder === 'MAIN' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(task ?? ''))
    throw Error('Usage: node scripts/workers/worktree.mjs W1|W2|W3 task-name');
  if (!['W1', 'W2', 'W3'].includes(holder)) throw Error('Usage: only W1, W2 and W3 may create worker checkouts');
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  const common = git(root, 'rev-parse', '--path-format=absolute', '--git-common-dir');
  const main = dirname(common);
  const parent = join(main, '.worktrees');
  mkdirSync(parent, { recursive: true });
  if (realpathSync(parent) !== join(realpathSync(main), '.worktrees'))
    throw Error('The worker directory must be inside the library checkout');
  const worktree = join(parent, task);
  let branch = 'family/' + task;
  if (existsSync(worktree)) {
    if (lstatSync(worktree).isSymbolicLink() || git(worktree, 'rev-parse', '--show-toplevel') !== worktree)
      throw Error('Path is not an independent worker worktree: ' + worktree);
    const linked = git(worktree, 'rev-parse', '--path-format=absolute', '--git-common-dir');
    branch = git(worktree, 'branch', '--show-current');
    if (linked !== common || !['family/' + task, 'feat/' + task, 'wip/' + task].includes(branch))
      throw Error('Existing worktree belongs to another task: ' + worktree);
  } else {
    git(main, 'worktree', 'add', '-b', branch, worktree, 'feat/enterprise-ui');
  }
  return { worktree, branch, port };
}

// Each worktree has a private Git administration folder. Keep installation
// state there so sibling checkouts cannot share a lock or a cached install.
export function installWorkerDependencies(worker, install = cwd => {
  execFileSync('npm', ['ci', '--prefer-offline', '--no-audit', '--no-fund'], {
    cwd, stdio: 'inherit', env: { ...process.env, ULD_PORT_BASE: String(worker.port) },
  });
}) {
  const cwd = worker.worktree;
  const admin = execFileSync('git', ['rev-parse', '--absolute-git-dir'], { cwd, encoding: 'utf8' }).trim();
  const lock = join(admin, 'uld-install-lock');
  const stamp = join(admin, 'uld-install.sha256');
  const fingerprint = createHash('sha256').update(readFileSync(join(cwd, 'package-lock.json'))).digest('hex');
  try {
    mkdirSync(lock);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    throw Error('A dependency install is already running in ' + cwd);
  }
  try {
    if (existsSync(join(cwd, 'node_modules/.package-lock.json')) && existsSync(stamp)
      && readFileSync(stamp, 'utf8').trim() === fingerprint) return;
    // Mark the old installation invalid before npm starts replacing its files.
    rmSync(stamp, { force: true });
    install(cwd);
    writeFileSync(join(lock, 'hash'), fingerprint + '\n');
    renameSync(join(lock, 'hash'), stamp);
  } finally {
    rmSync(lock, { recursive: true });
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const worker = workerWorktree(process.cwd(), ...process.argv.slice(2));
  console.log(worker.branch + ' in ' + worker.worktree);
  console.log('Use this export in the worker shell: export ULD_PORT_BASE=' + worker.port);
  installWorkerDependencies(worker);
}
