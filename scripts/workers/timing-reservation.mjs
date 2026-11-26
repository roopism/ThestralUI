import { AsyncLocalStorage } from 'node:async_hooks';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { waitForLock } from './lock-queue.mjs';

const scope = new AsyncLocalStorage();
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const modes = ['activity', 'measurement'];

function processInfo(pid) {
  const raw = execFileSync('ps', ['-p', String(pid), '-o', 'ppid=,pgid=,lstart='], {
    encoding: 'utf8', env: { ...process.env, LC_ALL: 'C', TZ: 'UTC' },
  }).trim();
  const match = /^(\d+)\s+(\d+)\s+(.+)$/.exec(raw);
  if (!match) throw Error('Cannot identify the timing reservation process ' + pid);
  return { parent: Number(match[1]), group: Number(match[2]), birth: match[3] };
}

function alive(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) { if (error.code === 'ESRCH') return false; throw error; }
}

function readOwner(directory, id) {
  if (!uuid.test(id)) throw Error('Unknown timing reservation record');
  const file = join(directory, id);
  try {
    if (!lstatSync(file).isFile()) throw Error('Unknown timing reservation file ' + file);
    const record = JSON.parse(readFileSync(file, 'utf8'));
    if (record.id !== id || record.host !== hostname() || !modes.includes(record.mode) ||
        !['pending', 'active'].includes(record.state) || !Number.isSafeInteger(record.pid) || record.pid < 1 ||
        !Number.isSafeInteger(record.group) || record.group < 1 || typeof record.birth !== 'string' ||
        !Number.isFinite(Date.parse(record.birth)) || typeof record.holder !== 'string' || !record.holder.trim())
      throw Error('Unknown or foreign timing reservation ' + id);
    return record;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}

function blocker(directory, claim, ancestors = new Set()) {
  for (const id of readdirSync(directory)) {
    if (ancestors.has(id) || id === claim.id || id.startsWith('.pending-') && uuid.test(id.slice(9))) continue;
    const owner = readOwner(directory, id);
    if (!owner) continue;
    // A dead owner can leave compilers and drivers behind. Never admit a measurement
    // while a group from an interrupted activity can still be doing work.
    if (!alive(owner.pid) && (owner.state === 'pending' || !alive(-owner.group))) {
      rmSync(join(directory, id), { force: true });
      continue;
    }
    if (owner.mode === 'measurement' || claim.mode === 'measurement') return owner;
  }
}

function parentLease(directory, id, local) {
  const owner = readOwner(directory, id);
  if (owner?.state !== 'active') throw Error('The inherited timing reservation has expired');
  let pid = local ? process.pid : process.ppid;
  while (pid > 1) {
    const info = processInfo(pid);
    if (pid === owner.pid && info.birth === owner.birth) return owner;
    pid = info.parent;
  }
  throw Error('The timing reservation does not belong to a live ancestor');
}

export function currentMeasurement(root) {
  const local = scope.getStore();
  const id = local?.id ?? process.env.ULD_TIMING_RESERVATION;
  if (!id) throw Error('Android timing needs an active measurement reservation');
  const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
    cwd: root, encoding: 'utf8',
  }).trim();
  const owner = parentLease(join(common, 'uld-locks/timing-activities'), id, !!local);
  if (owner.mode !== 'measurement') throw Error('Android timing needs the exclusive measurement reservation');
  return owner.id;
}

// Pass env to work that starts subprocesses. A detached cooperating child registers its own
// group before it does work. An ordinary tool subprocess must stay in its owner's group.
export async function withTimingReservation(root, mode, holder, run, options) {
  options?.signal?.throwIfAborted();
  if (!modes.includes(mode) || !holder?.trim()) throw Error('Expected an activity or measurement and a holder');
  const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
    cwd: root, encoding: 'utf8',
  }).trim();
  const locks = join(common, 'uld-locks');
  const directory = join(locks, 'timing-activities');
  mkdirSync(directory, { recursive: true });
  const local = scope.getStore();
  const env = options?.env ?? process.env;
  const inherited = local?.id ?? env.ULD_TIMING_RESERVATION;
  const parent = inherited && parentLease(directory, inherited, Boolean(local));
  if (parent?.mode === 'activity' && mode === 'measurement') throw Error('An activity cannot upgrade to a measurement');
  const effectiveMode = parent?.mode ?? mode;
  if (options?.activityOnly && effectiveMode !== 'activity')
    throw Error('Functional work cannot borrow a measurement reservation');
  const ancestors = new Set();
  if (parent && effectiveMode === 'measurement') {
    let ancestor = parent;
    while (ancestor) {
      if (ancestors.has(ancestor.id)) throw Error('Invalid timing reservation ancestry');
      ancestors.add(ancestor.id);
      if (!ancestor.parent) break;
      ancestor = readOwner(directory, ancestor.parent);
      if (ancestor?.state !== 'active') throw Error('Measurement ancestor has expired');
    }
  }
  const where = processInfo(process.pid);
  const claim = { id: randomUUID(), host: hostname(), pid: process.pid, group: where.group,
    birth: where.birth, mode: effectiveMode, holder, ...(parent ? { parent: parent.id } : {}) };
  const file = join(directory, claim.id);
  const temporary = join(directory, '.pending-' + claim.id);
  function publish(state) {
    writeFileSync(temporary, JSON.stringify({ ...claim, state }), { flag: 'wx', mode: 0o600 });
    renameSync(temporary, file);
  }
  function checkOthers() {
    const owner = blocker(directory, claim, ancestors);
    if (owner) throw Error('Timing reservation held by ' + owner.holder, { cause: { code: 'EEXIST' } });
  }
  function enter() {
    if (!parent || effectiveMode === 'measurement') checkOthers();
    publish('pending');
    try {
      // A pair of simultaneous queue registrations may briefly each see itself at the front.
      // Publishing intent before rechecking compatibility prevents both conflicting claims entering.
      if (parent) parentLease(directory, inherited, Boolean(local));
      if (!parent || effectiveMode === 'measurement') checkOthers();
      publish('active');
    } catch (error) {
      rmSync(file, { force: true });
      throw error;
    }
  }
  try {
    if (parent) enter();
    else await waitForLock(join(locks, 'timing-admissions-queue'), holder, enter, options);
    return await scope.run(claim, () => run({ ...env, ULD_TIMING_RESERVATION: claim.id }));
  } finally {
    rmSync(temporary, { force: true });
    rmSync(file, { force: true });
  }
}
