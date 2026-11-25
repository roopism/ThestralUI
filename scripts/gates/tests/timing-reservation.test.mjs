import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';

const module = new URL('../../workers/timing-reservation.mjs', import.meta.url).href;
const actor = `
  import { spawn } from 'node:child_process';
  import { once } from 'node:events';
  import { withTimingReservation } from ${JSON.stringify(module)};
  try {
    const [mode, label, extra] = process.argv.slice(1);
    await withTimingReservation(process.cwd(), mode, label, async env => {
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
  execFileSync('git', ['init', '--quiet', '--template=', root]);
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
    const env = { ...process.env };
    if (inherited) env.ULD_TIMING_RESERVATION = inherited;
    else delete env.ULD_TIMING_RESERVATION;
    const child = spawn(process.execPath, ['--input-type=module', '-e', actor, mode, label, extra], {
      cwd: root, detached: true, env, stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
    });
    const record = { child, exit: once(child, 'exit'), state: {} };
    child.on('message', message => Object.assign(record.state, message));
    children.push(record);
    return record;
  }
  async function queued(label) {
    await until(() => {
      const directory = join(root, '.git/uld-locks/timing-admissions-queue');
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
