import { spawn } from 'node:child_process';
import { hostname } from 'node:os';
import { lockOwner } from './lock.mjs';

// An npm child normally shares the terminal's process group. A dedicated group
// lets recovery distinguish surviving build tools from an unrelated open shell.
export async function inCommandGroup(run, device = false) {
  let leader = true;
  try {
    process.kill(-process.pid, 0);
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
    leader = false;
  }
  if (leader) return run();
  const env = { ...process.env };
  if (device) {
    const owner = lockOwner(env.ULD_ARTIFACT_COMMON || process.cwd(), 'simulator');
    if (owner?.host === hostname() && owner.pid === process.ppid) env.ULD_SIMULATOR_RESERVATION = owner.id;
  }
  const child = spawn(process.execPath, process.argv.slice(1), { detached: true, stdio: 'inherit', env });
  const listeners = new Map();
  for (const signal of ['SIGINT', 'SIGTERM']) {
    const forward = () => {
      try { process.kill(-child.pid, signal); } catch (error) { if (error.code !== 'ESRCH') throw error; }
    };
    listeners.set(signal, forward);
    process.on(signal, forward);
  }
  try {
    const [code, signal] = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code, signal) => resolve([code, signal]));
    });
    if (code !== 0) throw Error('Command group exited with ' + (signal ?? code));
  } finally {
    for (const [signal, listener] of listeners) process.off(signal, listener);
  }
}
