import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { withFunctionalDeviceGroup } from '../../workers/resource-guard.mjs';
import { withTimingReservation } from '../../workers/timing-reservation.mjs';
import { withLock } from '../../workers/lock.mjs';
import { fixtureGit, isolateFixtureProcess } from './fixtures/hermetic-git.mjs';

isolateFixtureProcess();

const module = new URL('../../workers/timing-reservation.mjs', import.meta.url).href;
const resourceGuard = new URL('../../workers/resource-guard.mjs', import.meta.url).href;
const actor = `
  import { usingFunctionalDevice, withPreflightActivity } from ${JSON.stringify(resourceGuard)};
  import { spawn } from 'node:child_process';
  import { once } from 'node:events';
  import { withTimingReservation } from ${JSON.stringify(module)};
  try {
    const [mode, label, extra] = process.argv.slice(1);
    const reserve = ['iphone','android'].includes(mode)
      ? (run, options) => usingFunctionalDevice(mode, label, run, options)
      : (run, options) => withTimingReservation(process.cwd(), mode, label, run, options);
    const admit = mode === 'preflight' ? run => withPreflightActivity(label, () => run(process.env)) : reserve;
    await admit(async env => {
      if (extra === 'helper') {
        const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 20000)'], { stdio: 'ignore' });
        await once(child, 'spawn');
        process.send({ helper: child.pid });
      }
      if (extra === 'detached') {
        const child = spawn(process.execPath, ['--input-type=module', '-e',
          'import {withTimingReservation as reserve} from ' + JSON.stringify(${JSON.stringify(module)}) +
          ';await reserve(process.cwd(),"activity","detached child",()=>{process.send("ready");return new Promise(resolve=>setTimeout(resolve,20000));});'],
          { env, detached: true, stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
        await once(child, 'message');
        process.send({ helper: child.pid });
      }
      if (extra === 'inherit') {
        const child = spawn(process.execPath, ['--input-type=module', '-e',
          'import {withTimingReservation as reserve} from ' + JSON.stringify(${JSON.stringify(module)}) +
          ';await reserve(process.cwd(),"activity","nested child",()=>{});'], { env, detached: true });
        if ((await once(child, 'exit'))[0] !== 0) throw Error('Nested lease failed');
      }
      process.send({ entered: env.ULD_TIMING_RESERVATION });
      await once(process, 'message');
    }, { timeoutMs: 8000 });
  } catch (error) { process.send({ failed: error.message }); process.exitCode = 1; }
  process.disconnect();
`;

function repository(t) {
  const root = mkdtempSync(join(tmpdir(), 'uld-reservation-test-'));
  fixtureGit(root, ['init', '--quiet', '--template=']);
  const children = [];
  t.after(async () => {
    for (const { child, state } of children) {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      if (state.helper) {
        try { process.kill(state.helper, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
      }
    }
    await Promise.all(children.map(record => record.exit));
    rmSync(root, { recursive: true, force: true });
  });
  function start(mode, label, extra = '', inherited) {
    const env = { ...process.env, ...(typeof inherited === 'object' ? inherited : {}) };
    if (inherited) env.ULD_TIMING_RESERVATION = typeof inherited === 'string' ? inherited : inherited.ULD_TIMING_RESERVATION;
    else delete env.ULD_TIMING_RESERVATION;
    const child = spawn(process.execPath, ['--input-type=module', '-e', actor, mode, label, extra], {
      cwd: root, detached: true, env, stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
    });
    const record = { child, exit: once(child, 'exit'), state: {} };
    child.on('message', message => Object.assign(record.state, message));
    children.push(record);
    return record;
  }
  async function queued(label, queue = 'timing-admissions') {
    await until(() => {
      const directory = join(root, '.git/uld-locks', queue + '-queue');
      try {
        return readdirSync(directory).filter(file => !file.startsWith('.'))
          .some(file => JSON.parse(readFileSync(join(directory, file))).holder === label);
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    });
  }
  return { root, start, queued };
}

async function until(check) {
  const end = Date.now() + 8000;
  while (Date.now() < end) {
    const value = check();
    if (value) return value;
    await delay(15);
  }
  assert.fail('Synthetic reservation did not reach the expected state');
}
const entered = record => until(() => {
  assert.ok(!record.state.failed, record.state.failed);
  return record.state.entered;
});
async function finish(record) {
  record.child.send('done');
  assert.equal((await record.exit)[0], 0);
}

test('ordinary workers can overlap and an awaiting measurement precedes later readers', async t => {
  const { start, queued } = repository(t);
  const catalog = start('activity', 'catalog');
  await entered(catalog);
  const browser = start('activity', 'browser');
  await entered(browser);
  const measure = start('measurement', 'benchmark');
  await queued('benchmark');
  const later = start('activity', 'later worker');
  await queued('later worker');
  const second = start('measurement', 'second benchmark');
  await queued('second benchmark');
  await finish(catalog);
  assert.ok(!measure.state.entered);
  await finish(browser);
  await entered(measure);
  assert.ok(!later.state.entered);
  await finish(measure);
  await entered(later);
  assert.ok(!second.state.entered);
  await finish(later);
  await entered(second);
  await finish(second);
});

test('nested commands prove a live ancestor before inheriting its activity reservation', async t => {
  const { start } = repository(t);
  const parent = start('activity', 'parent', 'inherit');
  const id = await entered(parent);
  const unrelated = start('activity', 'unrelated', '', id);
  assert.match(await until(() => unrelated.state.failed), /ancestor/);
  assert.equal((await unrelated.exit)[0], 1);
  await finish(parent);
});

test('an interrupted reservation remains active until its surviving process group exits', async t => {
  const { start, queued } = repository(t);
  const parent = start('activity', 'interrupted', 'helper');
  await entered(parent);
  const measure = start('measurement', 'measurement after interruption');
  await queued('measurement after interruption');
  parent.child.kill('SIGKILL');
  await parent.exit;
  await delay(400);
  assert.ok(!measure.state.entered);
  process.kill(parent.state.helper, 'SIGTERM');
  delete parent.state.helper;
  await entered(measure);
  await finish(measure);
});

test('a detached cooperating worker keeps its reservation after its parent exits', async t => {
  const { start, queued } = repository(t);
  const parent = start('activity', 'launch detached worker', 'detached');
  await entered(parent);
  const measure = start('measurement', 'measurement after detached worker');
  await queued('measurement after detached worker');
  parent.child.kill('SIGKILL');
  await parent.exit;
  await delay(400);
  assert.ok(!measure.state.entered);
  process.kill(parent.state.helper, 'SIGTERM');
  delete parent.state.helper;
  await entered(measure);
  await finish(measure);
});

test('a foreign or unknown reservation blocks admission for ordinary work', async t => {
  const { root, start } = repository(t);
  const directory = join(root, '.git/uld-locks/timing-activities');
  mkdirSync(directory, { recursive: true });
  const id = '00000000-0000-0000-0000-000000000001';
  const record = join(directory, id);
  writeFileSync(record, JSON.stringify({ id, host: 'other-machine', mode: 'activity' }));
  const foreign = start('activity', 'local worker');
  assert.match(await until(() => foreign.state.failed), /foreign/);
  rmSync(record);
  writeFileSync(join(directory, 'unrecognized-owner'), '{}');
  const unknown = start('activity', 'local worker');
  assert.match(await until(() => unknown.state.failed), /Unknown/);
});

function freshEnvironment() {
  const env = { ...process.env };
  delete env.ULD_TIMING_RESERVATION;
  delete env.ULD_FUNCTIONAL_DEVICE_GROUP;
  return env;
}

test('functional iPhone Android and web overlap once per platform while timing waits for all activity', async t => {
  const { root, start, queued } = repository(t);
  const before = [process.env.ULD_TIMING_RESERVATION, process.env.ULD_FUNCTIONAL_DEVICE_GROUP];
  const prep = start('activity', 'worker preparation'), browser = start('activity', 'browser tests');
  await Promise.all([entered(prep), entered(browser)]);
  let measurement;
  await withFunctionalDeviceGroup(root, 'device wave', async env => {
    const ownedLease = env.ULD_FUNCTIONAL_DEVICE_GROUP;
    assert.equal(await withLock(root, 'simulator', 'nested stage', id => id, { ownedLease }), ownedLease);
    await assert.rejects(withLock(root, 'simulator', 'wrong generation', () => {}, { ownedLease: 'stale' }),
      /own active simulator reservation/);
    const iphone = start('iphone', 'iPhone A', '', env), android = start('android', 'Android A', '', env);
    const [iosId, androidId] = await Promise.all([entered(iphone), entered(android)]);
    assert.notEqual(iosId, androidId);
    assert.deepEqual([process.env.ULD_TIMING_RESERVATION, process.env.ULD_FUNCTIONAL_DEVICE_GROUP], before);
    const next = start('iphone', 'iPhone B', '', env);
    await queued('iPhone B', 'functional-iphone');
    await assert.rejects(withLock(root, 'simulator', 'legacy exclusive', () => {}, { timeoutMs: 120 }), /Timed out/);
    measurement = start('measurement', 'exclusive timing');
    await queued('exclusive timing');
    assert.ok(!next.state.entered && !measurement.state.entered);
    await finish(iphone);
    await entered(next);
    await finish(android);
    await finish(next);
  }, { env: freshEnvironment() });
  assert.ok(!measurement.state.entered);
  await finish(prep);
  assert.ok(!measurement.state.entered);
  await finish(browser);
  await entered(measurement);
  await finish(measurement);
});

test('siblings cannot run two measurements under one inherited timed reservation', async t => {
  const { root, start } = repository(t);
  await withTimingReservation(root, 'measurement', 'timing driver', async env => {
    const first = start('measurement', 'first measured child', '', env);
    await entered(first);
    const sibling = start('measurement', 'second measured child', '', env);
    assert.equal((await sibling.exit)[0], 1);
    assert.match(sibling.state.failed, /Timing reservation held by first measured child/);
    await finish(first);
    const next = start('measurement', 'next measured child', '', env);
    await entered(next);
    await finish(next);
  }, { env: freshEnvironment() });
});

test('a failed functional group drains its active driver before releasing exclusive devices', async t => {
  const { root, start, queued } = repository(t);
  const started = Promise.withResolvers();
  let driver, enteredExclusive = false;
  const group = withFunctionalDeviceGroup(root, 'failed wave', async env => {
    driver = start('android', 'finishing Android', '', env);
    await entered(driver);
    started.resolve();
    throw Error('functional stage failed');
  }, { env: freshEnvironment() });
  const failed = assert.rejects(group, /functional stage failed/);
  await Promise.race([started.promise, group]);
  const exclusive = withLock(root, 'simulator', 'next exclusive stage', () => { enteredExclusive = true; });
  await queued('next exclusive stage', 'simulator');
  assert.equal(enteredExclusive, false);
  await finish(driver);
  await failed;
  await exclusive;
  assert.equal(enteredExclusive, true);
});

test('batch preflight overlaps functional device work and releases the host before timing', async t => {
  const { start, queued, root } = repository(t);
  const fixtureEnv = { ULD_ARTIFACT_COMMON: join(root, '.git') };
  let preflight, timing;
  await withFunctionalDeviceGroup(root, 'device wave', async env => {
    const device = start('iphone', 'iPhone journeys', '', env);
    await entered(device);
    preflight = start('preflight', 'next batch', '', fixtureEnv);
    await entered(preflight);
    timing = start('measurement', 'Android trials');
    await queued('Android trials');
    await finish(device);
  }, { env: freshEnvironment() });
  assert.ok(!timing.state.entered);
  assert.deepEqual(readdirSync(join(root, '.git/uld-locks')).filter(name => ['landing', 'simulator', 'integration'].includes(name)), []);
  await finish(preflight);
  await entered(timing);
  const later = start('preflight', 'third batch', '', fixtureEnv);
  await queued('third batch');
  assert.ok(!later.state.entered);
  await finish(timing);
  await entered(later);
  await finish(later);
});
