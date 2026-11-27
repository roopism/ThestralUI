import { inCommandGroup } from './isolated-command.mjs';
import { withTimingReservation } from './timing-reservation.mjs';
import { execFileSync } from 'node:child_process';
import { hostname } from 'node:os';
import { withFunctionalGroupLock, withFunctionalPlatformSlot, withIntegrationGate, withLock, lockOwner } from './lock.mjs';

const reservationRoot = () => process.env.ULD_ARTIFACT_COMMON || process.cwd();

function ancestor(pid) {
  let current = process.pid;
  while (current > 1) {
    if (current === pid) return true;
    current = Number(execFileSync('ps', ['-p', String(current), '-o', 'ppid='], { encoding: 'utf8' }).trim());
  }
  return false;
}

export function withTiming(mode, holder, run) {
  return withTimingReservation(reservationRoot(), mode, holder, async env => {
    const prior = process.env.ULD_TIMING_RESERVATION;
    process.env.ULD_TIMING_RESERVATION = env.ULD_TIMING_RESERVATION;
    try { return await run(); } finally {
      if (prior === undefined) delete process.env.ULD_TIMING_RESERVATION;
      else process.env.ULD_TIMING_RESERVATION = prior;
    }
  });
}

// Hold an activity through snapshot setup and every child of the preflight.
export function withPreflightActivity(holder, run) {
  return inCommandGroup(() => withTiming('activity', holder, run));
}

export function withFunctionalDeviceGroup(root, holder, run, options) {
  const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'],
    { cwd: root, encoding: 'utf8' }).trim();
  return withFunctionalGroupLock(root, holder, id => withTimingReservation(root, 'activity', holder,
    env => run({ ...env, ULD_ARTIFACT_COMMON: common, ULD_FUNCTIONAL_DEVICE_GROUP: id }),
    { ...options, activityOnly: true }), options);
}

export function usingFunctionalDevice(platform, holder, run, options) {
  const env = options?.env ?? process.env;
  const root = env.ULD_ARTIFACT_COMMON, id = env.ULD_FUNCTIONAL_DEVICE_GROUP;
  if (!root || !id || !env.ULD_TIMING_RESERVATION) throw Error('Functional device group environment required');
  const owner = lockOwner(root, 'simulator');
  if (owner?.id !== id || owner.host !== hostname() || !ancestor(owner.pid))
    throw Error('Functional device group must belong to a live ancestor');
  return withFunctionalPlatformSlot(root, platform, holder, id,
    () => withTimingReservation(root, 'activity', holder, run, { ...options, env, activityOnly: true }), options);
}

export function withHostCache(parent, platform, run, options) {
  if (!['ios', 'android'].includes(platform)) throw Error('Unknown device host platform');
  return withLock(parent, platform + '-host', 'Prepare ' + platform + ' host', run, options);
}

export function usingSimulator(name, run, functionalPlatform) {
  if (functionalPlatform) return usingFunctionalDevice(functionalPlatform, name, run);
  const root = reservationRoot();
  const owner = lockOwner(root, 'simulator');
  const work = () => withTiming('measurement', name, run);
  if (owner?.host === hostname() && (owner.pid === process.ppid ||
      (owner.id === process.env.ULD_SIMULATOR_RESERVATION && ancestor(owner.pid))))
    return withIntegrationGate(root, name, work, owner.id, 'simulator');
  return withLock(root, 'simulator', name, work);
}

export function shutdownSimulators(
  sim = (...args) => execFileSync('xcrun', ['simctl', ...args], { encoding: 'utf8' }),
) {
  const booted = () => Object.values(JSON.parse(sim('list', 'devices', 'booted', '-j')).devices).flat();
  if (process.env.ULD_CLOUD_LOCAL !== '1') {
    for (const device of booted()) sim('shutdown', device.udid);
  }
  const remaining = booted();
  if (remaining.length)
    throw Error(
      'iOS simulators still booted before timing: ' + remaining.map((device) => device.udid).join(', '),
    );
}
