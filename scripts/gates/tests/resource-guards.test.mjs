import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { withIntegrationGate } from '../../workers/lock.mjs';
import { withTimingReservation } from '../../workers/timing-reservation.mjs';
import { fixtureGit, isolateFixtureProcess } from './fixtures/hermetic-git.mjs';

isolateFixtureProcess();

const source = (path) => readFileSync(new URL('../../../' + path, import.meta.url), 'utf8');
function scratch(t) {
  const root = mkdtempSync(join(tmpdir(), 'uld-resource-check-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  fixtureGit(root, ['init', '--quiet', '--template=']);
  return root;
}

test('worker build and browser commands share the timing reservation', async (t) => {
  const scripts = JSON.parse(source('package.json')).scripts;
  for (const name of ['build:packages', 'build', 'catalog', 'test:browser'])
    assert.match(scripts[name], /reserve-command\.mjs/, name);
  // The temporary repository has its own reservations. The outer suite holds the real one.
  const outerLease = process.env.ULD_TIMING_RESERVATION;
  if (outerLease !== undefined) {
    delete process.env.ULD_TIMING_RESERVATION;
    t.after(() => { process.env.ULD_TIMING_RESERVATION = outerLease; });
  }
  const root = scratch(t);
  const started = Promise.withResolvers();
  const finished = Promise.withResolvers();
  const measurement = withTimingReservation(root, 'measurement', 'benchmark', () => {
    started.resolve();
    return finished.promise;
  });
  await Promise.race([started.promise, measurement]);
  try {
    await assert.rejects(
      withTimingReservation(root, 'activity', 'worker build', () => {}, { timeoutMs: 100 }),
      /Timed out/,
    );
  } finally {
    finished.resolve();
    await measurement;
  }
});

test('each physical device entry reserves the simulator and shared host during preparation', async (t) => {
  const checkout = scratch(t);
  await assert.rejects(withIntegrationGate(checkout, 'unreserved device', () => {}, '', 'simulator'),
    /explicit simulator reservation/);
  await assert.rejects(withIntegrationGate(checkout, 'unrelated cache', () => {}, 'unused', 'ios-host'),
    /explicit simulator reservation/);
  for (const file of ['scripts/verify-ios-simulator.mjs', 'scripts/verify-android-emulator.mjs'])
    assert.match(source(file), /usingSimulator\(/, file);
  for (const [file, platform] of [
    ['scripts/verify-ios-simulator.mjs', 'ios'],
    ['tests/android/host.mjs', 'android'],
  ]) {
    assert.match(source(file), /withHostCache\(/, file);
    const root = scratch(t);
    const { withHostCache } = await import('../../workers/resource-guard.mjs');
    await withHostCache(root, platform, async () => {
      await assert.rejects(
        withHostCache(root, platform, () => {}, { timeoutMs: 100 }),
        /Timed out/,
      );
    });
  }
});

test('timing stops all booted iOS simulators and requires a fresh empty readback', async () => {
  const { shutdownSimulators } = await import('../../workers/resource-guard.mjs');
  const seen = [];
  let reads = 0;
  const sim = (...args) => {
    seen.push(args);
    if (args[0] === 'list')
      return JSON.stringify({ devices: { ios: reads++ ? [] : [{ udid: 'phone' }, { udid: 'tablet' }] } });
    return '';
  };
  shutdownSimulators(sim);
  assert.deepEqual(
    seen
      .filter((args) => args[0] === 'shutdown')
      .map((args) => args[1])
      .sort(),
    ['phone', 'tablet'],
  );
  assert.equal(reads, 2);
  assert.throws(
    () =>
      shutdownSimulators((...args) =>
        args[0] === 'list' ? '{"devices":{"iOS":[{"udid":"still-booted"}]}}' : '',
      ),
    /still booted/i,
  );
  assert.match(source('scripts/gates/local-run.mjs'), /shutdownSimulators\(/);
  assert.match(source('scripts/verify-android-emulator.mjs'), /shutdownSimulators\(/);
});

test('preflight holds the shared activity reservation while preparing and running snapshots', async t => {
  const root = scratch(t);
  const env = { ...process.env };
  delete env.ULD_TIMING_RESERVATION;
  const { withPreflightActivity } = await import('../../verify-preflight.mjs');
  const lease = process.env.ULD_TIMING_RESERVATION;
  delete process.env.ULD_TIMING_RESERVATION;
  t.after(() => { if (lease !== undefined) process.env.ULD_TIMING_RESERVATION = lease; });
  await withPreflightActivity(root, async reserved => {
    assert.match(reserved.ULD_TIMING_RESERVATION, /^[a-f0-9-]{36}$/);
    const script = 'import {withTimingReservation} from ' +
      JSON.stringify(new URL('../../workers/timing-reservation.mjs', import.meta.url).href) +
      ';await withTimingReservation(process.cwd(),"measurement","fixture",()=>{}, {timeoutMs:100})';
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: root, env, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Timed out/);
  });
});
