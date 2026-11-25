import { randomUUID } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { dirname, join } from 'node:path';
import { hasWaiters, waitForLock } from './lock-queue.mjs';

function lockDirectory(root, resource) {
  if (resource === 'ios-host' || resource === 'android-host') return join(root, '.uld-locks', resource);
  if (!['integration', 'simulator', 'landing'].includes(resource)) throw Error('Unknown shared resource ' + resource);
  const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
    cwd: root, encoding: 'utf8',
  }).trim();
  const parent = join(common, 'uld-locks');
  return join(parent, resource);
}

function readOwner(directory) {
  return JSON.parse(readFileSync(join(directory, 'owner.json'), 'utf8'));
}

export function lockOwner(root, resource) {
  try { return readOwner(lockDirectory(root, resource)); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
}

function requireFinishedSuite(directory, reservation) {
  const file = join(directory, 'suite-' + reservation + '.json');
  if (!existsSync(file)) return;
  const { pid } = JSON.parse(readFileSync(file, 'utf8'));
  if (!Number.isSafeInteger(pid) || pid <= 0) throw Error('Cannot identify the integration suite');
  try {
    process.kill(pid, 0);
    throw Error('A live qualification process is using the integration reservation');
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
}

function groupAlive(id) {
  try { process.kill(-id, 0); return true; }
  catch (error) { if (error.code === 'ESRCH') return false; throw error; }
}

function requireFinishedGroup(owner, signal) {
  if (owner.processGroup === undefined) return;
  if (owner.processGroup !== owner.pid) throw Error('Cannot identify the qualification process group');
  if (signal) {
    const processes = spawnSync('ps', ['-A', '-o', 'pid=,pgid='], { encoding: 'utf8' });
    if (processes.status !== 0) throw Error('Cannot verify live qualification subprocesses');
    const members = processes.stdout.trim().split('\n').map(line => line.trim().split(/\s+/).map(Number));
    if (members.every(([pid, group]) => group !== owner.pid || pid === owner.pid || pid === processes.pid)) return;
  } else if (!groupAlive(owner.pid)) return;
  throw Error('A live qualification subprocess still owns this resource');
}

// Manual recovery retains the historical age check. Admission can recover a
// freshly abandoned generation after proving its owner and suite have exited.
export function recoverStaleLock(root, resource, request) {
  const directory = lockDirectory(root, resource);
  const owner = readOwner(directory);
  if (typeof owner.id !== 'string' || !/^[a-f0-9-]{36}$/.test(owner.id)
    || owner.host !== hostname() || !Number.isSafeInteger(owner.pid) || owner.pid <= 0
    || !Number.isFinite(Date.parse(owner.started)) || (request !== deadHolder && Date.now() - Date.parse(owner.started) <= 30 * 60_000))
    throw Error('Stale local ownership cannot be confirmed for ' + resource);
  try {
    process.kill(owner.pid, 0);
    throw Error('A live process holds the ' + resource + ' lock');
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
  // Serialize reapers for this exact generation, then verify that a contender
  // has not replaced the lock since it was inspected.
  const recovery = directory + '-recovery-' + owner.id;
  mkdirSync(recovery);
  try {
    if (readOwner(directory).id !== owner.id)
      throw Error('The ' + resource + ' lock has changed owners');
    requireFinishedGroup(owner, false);
    requireFinishedSuite(directory, owner.id);
    renameSync(directory, join(recovery, 'stale'));
  } finally {
    rmSync(recovery, { force: true, recursive: true });
  }
  return owner;
}

const deadHolder = Symbol('recover a confirmed dead holder on admission');
const heldLocks = new Set();

export function releaseLocksOnSignal(forward) {
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      if (forward?.(signal)) return;
      for (const release of [...heldLocks].reverse()) {
        try { release(signal); } catch (error) { console.error(error.message); }
      }
      process.kill(process.pid, signal);
    });
  }
}

const admitted = Symbol('queued holder');

export function acquireLock(root, resource, holder, ticket, recovered = false) {
  if (!holder?.trim()) throw Error('A lock holder is required');
  const directory = lockDirectory(root, resource);
  if (ticket !== admitted && hasWaiters(directory + '-queue')) throw Error(resource + ' has queued holders');
  mkdirSync(dirname(directory), { recursive: true });
  const owner = { holder, host: hostname(), pid: process.pid, started: new Date().toISOString(), id: randomUUID() };
  if (groupAlive(process.pid)) owner.processGroup = process.pid;
  try {
    mkdirSync(directory);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let detail = 'another holder';
    try {
      const existing = readOwner(directory);
      if (!recovered && existing.host === hostname() && Number.isSafeInteger(existing.pid) && existing.pid > 0) {
        let dead = false;
        try { process.kill(existing.pid, 0); } catch (probe) { dead = probe.code === 'ESRCH'; }
        if (dead) {
          try { recoverStaleLock(root, resource, deadHolder); }
          catch (recoveryError) {
            throw Error(resource + ' lock held pending safe recovery: ' + recoveryError.message, { cause: error });
          }
          return acquireLock(root, resource, holder, ticket, true);
        }
      }
      detail = existing.holder + ' (PID ' + existing.pid + ' on ' + existing.host + ', since ' + existing.started + ')';
    } catch (readError) {
      if (readError.code !== 'ENOENT') throw readError;
    }
    throw Error(resource + ' lock held by ' + detail, { cause: error });
  }
  try {
    writeFileSync(join(directory, 'owner.json'), JSON.stringify(owner) + '\n');
  } catch (error) {
    rmSync(directory, { recursive: true });
    throw error;
  }
  let active = true;
  function release(signal) {
    if (!active) return;
    const current = readOwner(directory);
    if (current.id !== owner.id) throw Error('Refusing to release another holder’s ' + resource + ' lock');
    // Move ownership away in one operation before cleaning up, so a new
    // process can acquire the public path while cleanup runs.
    requireFinishedSuite(directory, owner.id);
    if (signal) requireFinishedGroup(owner, signal);
    const candidate = directory + '-' + owner.id;
    renameSync(directory, candidate);
    active = false;
    heldLocks.delete(release);
    rmSync(candidate, { recursive: true });
  }
  release.id = owner.id;
  heldLocks.add(release);
  return release;
}

export async function withLock(root, resource, holder, run, options) {
  if (!holder?.trim()) throw Error('A lock holder is required');
  const directory = lockDirectory(root, resource);
  const release = await waitForLock(directory + '-queue', holder, () => acquireLock(root, resource, holder, admitted), options);
  try {
    return await run(release.id);
  } finally {
    release();
  }
}

// An integration transaction runs Git hooks as child processes. They can enter
// that exact reservation one at a time while MAIN retains it across the batch.
export async function withIntegrationGate(root, holder, run, reservation = process.env.ULD_INTEGRATION_LEASE, resource = 'integration') {
  if (resource !== 'integration' && (resource !== 'simulator' || !reservation))
    throw Error('An explicit simulator reservation is required to borrow the device');
  if (!reservation) return withLock(root, 'integration', holder, run);
  const directory = lockDirectory(root, resource);
  const owner = readOwner(directory);
  if (owner.id !== reservation || owner.host !== hostname()) throw Error('Invalid integration reservation');
  process.kill(owner.pid, 0);
  const file = join(directory, 'suite-' + reservation + '.json');
  try {
    writeFileSync(file, JSON.stringify({ pid: process.pid }), { flag: 'wx' });
  } catch (error) {
    if (error.code === 'EEXIST') throw Error('Another suite is using the integration reservation');
    throw error;
  }
  try {
    if (readOwner(directory).id !== reservation) throw Error('Integration reservation changed');
    return await run();
  } finally {
    if (readOwner(directory).id === reservation) unlinkSync(file);
  }
}
