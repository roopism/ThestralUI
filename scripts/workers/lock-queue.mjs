import { randomUUID } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const defaultTimeout = 60 * 60_000;
const ticket = /^([0-9]{16})-([a-f0-9-]{36})$/;

function waiting(directory) {
  try {
    return readdirSync(directory).filter(name => ticket.test(name)).sort();
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

export function hasWaiters(directory) {
  return Boolean(firstLive(directory));
}

// Publish the complete record atomically. A later request gets a greater number
// than every published request. Simultaneous entrants break ties by UUID.
function register(directory, holder) {
  mkdirSync(directory, { recursive: true });
  const last = waiting(directory).at(-1);
  const number = last ? Number(last.slice(0, 16)) + 1 : 1;
  if (!Number.isSafeInteger(number)) throw Error('Shared resource queue sequence exhausted');
  const id = randomUUID();
  const name = String(number).padStart(16, '0') + '-' + id;
  const temporary = join(directory, '.' + id);
  const owner = { id, holder, host: hostname(), pid: process.pid, requested: new Date().toISOString() };
  try {
    writeFileSync(temporary, JSON.stringify(owner), { flag: 'wx' });
    renameSync(temporary, join(directory, name));
  } finally {
    rmSync(temporary, { force: true });
  }
  return name;
}

function firstLive(directory) {
  for (const name of waiting(directory)) {
    const path = join(directory, name);
    let owner;
    try {
      owner = JSON.parse(readFileSync(path, 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    if (owner.host !== hostname() || owner.id !== ticket.exec(name)[2]
        || !Number.isSafeInteger(owner.pid) || owner.pid <= 0) return name;
    try {
      process.kill(owner.pid, 0);
    } catch (error) {
      // Only remove a wait ticket for a definitely exited local process. Its UUID
      // is never reused. The front waiter attempts generation-checked recovery at admission.
      if (error.code !== 'ESRCH') return name;
      rmSync(path, { force: true });
      continue;
    }
    return name;
  }
}

export async function waitForLock(directory, holder, acquire, { timeoutMs = defaultTimeout, signal } = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > defaultTimeout)
    throw Error('Shared resource wait must be between 1 ms and one hour');
  signal?.throwIfAborted();
  const end = performance.now() + timeoutMs;
  const name = register(directory, holder);
  let blocker;
  let announced = false;
  try {
    while (performance.now() < end) {
      signal?.throwIfAborted();
      blocker = firstLive(directory);
      if (blocker === name) {
        try {
          return acquire();
        } catch (error) {
          if (error.cause?.code !== 'EEXIST') throw error;
          blocker = error.message;
        }
      }
      if (!announced) {
        console.log('Queued', holder, 'for', directory, 'with a', timeoutMs, 'ms admission deadline.');
        announced = true;
      }
      await delay(Math.min(250, Math.max(1, end - performance.now())), undefined, { signal });
    }
    throw Error('Timed out waiting for ' + directory + ' as ' + holder + '; last blocker: ' + blocker);
  } finally {
    rmSync(join(directory, name), { force: true });
  }
}
