import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { runQualificationLanes } from '../qualification-lanes.mjs';

const functional = ['mac', 'iphone', 'android'];
const timed = ['macPerformance', 'androidTiming'];
const stages = [...functional, ...timed];
const pass = () => ({ result: 'passed' });

function setup(t) {
  const dir = mkdtempSync(join(tmpdir(), 'qualification-lanes-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'stages.json');
  const events = [], leases = [];
  const settings = {
    functional: Object.fromEntries(functional.map(stage => [stage, pass])),
    timed: Object.fromEntries(timed.map(stage => [stage, pass])),
    ready: () => true,
    async reserveTiming(stage, run) {
      assert.equal(leases.length, 0);
      leases.push(stage);
      try { return await run(); }
      finally { assert.equal(leases.pop(), stage); }
    },
    record(stage, row) {
      events.push({ stage, ...row });
      writeFileSync(file, JSON.stringify(events));
    },
  };
  return { settings, leases, retained: () => JSON.parse(readFileSync(file)) };
}

test('functional lanes overlap after their prerequisites and timing drains both devices before taking the host', { timeout: 5000 }, async t => {
  const { settings, leases, retained } = setup(t);
  const started = Object.fromEntries(stages.map(stage => [stage, Promise.withResolvers()]));
  const done = Object.fromEntries(stages.map(stage => [stage, Promise.withResolvers()]));
  const phoneReady = Promise.withResolvers();
  settings.ready = stage => stage === 'iphone' ? phoneReady.promise : true;
  for (const stage of stages) (functional.includes(stage) ? settings.functional : settings.timed)[stage] = async () => {
    assert.deepEqual(leases, functional.includes(stage) ? [] : [stage]);
    // Keep one ordinary child alive until the test releases its input pipe.
    if (stage === 'android') {
      const child = spawn(process.execPath, ['-e', 'process.stdin.resume();process.stdout.write("ready");'],
        { stdio: ['pipe', 'pipe', 'ignore'] });
      t.after(() => child.stdin.end());
      const exit = once(child, 'close');
      await once(child.stdout, 'data');
      started[stage].resolve();
      await done[stage].promise;
      child.stdin.end();
      assert.deepEqual(await exit, [0, null]);
    } else {
      started[stage].resolve();
      await done[stage].promise;
    }
    return pass();
  };
  const run = runQualificationLanes(settings);
  await Promise.all([started.mac.promise, started.android.promise]);
  const running = () => retained().filter(row => row.result === 'running').map(row => row.stage);
  assert.deepEqual(running().sort(), ['android', 'mac']);
  phoneReady.resolve(true);
  await started.iphone.promise;
  assert.deepEqual(running().sort(), [...functional].sort());
  done.mac.resolve();
  done.android.resolve();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(leases, []);
  assert.deepEqual(running().sort(), [...functional].sort());
  done.iphone.resolve();
  await started.macPerformance.promise;
  assert.deepEqual(leases, ['macPerformance']);
  assert.equal(running().includes('androidTiming'), false);
  done.macPerformance.resolve();
  await started.androidTiming.promise;
  assert.deepEqual(leases, ['androidTiming']);
  done.androidTiming.resolve();
  const result = await run;
  assert.ok(stages.every(stage => result[stage].result === 'passed'));
  assert.deepEqual(leases, []);
});

test('independent stage failures and prerequisite refusals retain every verdict and timestamp', async t => {
  for (const failed of functional) {
    const { settings, retained } = setup(t);
    settings.functional[failed] = () => { throw Error('Failed ' + failed); };
    settings.timed.macPerformance = () => ({ result: 'failed', reason: 'Mac measurement failed' });
    settings.ready = stage => { if (stage === 'androidTiming' && failed === 'android') throw Error('Android fixture unavailable'); return true; };
    const result = await runQualificationLanes(settings);
    for (const stage of stages) {
      const blocked = failed === 'android' && stage === 'androidTiming';
      const expected = blocked ? 'blocked' : stage === failed || stage === 'macPerformance' ? 'failed' : 'passed';
      assert.equal(result[stage].result, expected);
      const events = retained().filter(row => row.stage === stage);
      assert.deepEqual(events.map(row => row.result), blocked ? ['blocked'] : ['running', expected]);
      assert.deepEqual(events.at(-1), { stage, ...result[stage] });
      assert.ok(Number.isFinite(Date.parse(result[stage].started)));
      assert.ok(Date.parse(result[stage].finished) >= Date.parse(result[stage].started));
      assert.equal(result[stage].started, events[0].started);
      if (blocked) assert.equal(result[stage].reason, 'Android fixture unavailable');
    }
    assert.equal(result[failed].reason, 'Failed ' + failed);
  }
});

test('timing refuses missing or unsettled reservations and waits for any work already started', async t => {
  const { settings } = setup(t);
  const work = Promise.withResolvers(), entered = Promise.withResolvers();
  const calls = [];
  settings.reserveTiming = (stage, run) => {
    calls.push(stage);
    run();
  };
  settings.timed.macPerformance = async () => {
    entered.resolve();
    await work.promise;
    throw Error('Measurement interrupted');
  };
  settings.timed.androidTiming = () => assert.fail('Timing cannot overlap unresolved work');
  let completed = false;
  const run = runQualificationLanes(settings).then(result => { completed = true; return result; });
  await entered.promise;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(completed, false);
  assert.deepEqual(calls, ['macPerformance']);
  work.resolve();
  const result = await run;
  assert.equal(result.macPerformance.result, 'failed');
  assert.match(result.macPerformance.reason, /Measurement interrupted/);
  assert.equal(result.androidTiming.result, 'blocked');
  assert.match(result.androidTiming.reason, /reservation/);
  let late;
  settings.reserveTiming = (_, callback) => { late = callback; };
  const absent = await runQualificationLanes(settings);
  assert.equal(absent.macPerformance.result, 'failed');
  assert.equal(absent.androidTiming.result, 'blocked');
  assert.throws(() => late(), /active reservation/);
});

test('a receipt write failure drains independent functional work and prevents timing', async t => {
  const { settings } = setup(t);
  const entered = Promise.withResolvers(), release = Promise.withResolvers();
  settings.functional.android = async () => { entered.resolve(); await release.promise; return pass(); };
  const save = settings.record;
  settings.record = (stage, row) => {
    if (stage === 'iphone' && row.result === 'running') throw Error('Cannot save receipt');
    save(stage, row);
  };
  settings.reserveTiming = () => assert.fail('Timing cannot start without durable functional evidence');
  let ended = false;
  const failure = runQualificationLanes(settings).finally(() => { ended = true; });
  await entered.promise;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(ended, false);
  release.resolve();
  await assert.rejects(failure, error => error instanceof AggregateError && error.errors[0].message === 'Cannot save receipt');
});

test('one functional reservation carries every lane and the audited result through release before timing', async t => {
  const { settings, retained } = setup(t);
  const env = { reservation: 'functional fixture' }, seen = [], calls = [];
  let held = false;
  settings.reserveFunctional = async run => {
    assert.equal(held, false);
    calls.push('acquire');
    held = true;
    try { await run(env); }
    finally { held = false; calls.push('release'); }
  };
  for (const stage of functional) settings.functional[stage] = async actual => {
    assert.equal(actual, env);
    assert.equal(held, true);
    await new Promise(resolve => setImmediate(resolve));
    seen.push(stage);
    return stage === 'iphone' ? { result: 'failed', reason: 'phone fixture failed' } : pass();
  };
  settings.audit = actual => {
    assert.deepEqual([...seen].sort(), [...functional].sort());
    assert.equal(actual, env);
    assert.equal(held, true);
    calls.push('audit');
    throw Error('Audit fixture failed');
  };
  settings.reserveTiming = async (stage, run) => {
    assert.equal(held, false);
    calls.push(stage);
    return run({ reservation: stage });
  };
  for (const stage of timed) settings.timed[stage] = actual => {
    assert.deepEqual(actual, { reservation: stage });
    return pass();
  };
  const result = await runQualificationLanes(settings);
  assert.deepEqual(calls, ['acquire', 'audit', 'release', ...timed]);
  assert.equal(result.iphone.reason, 'phone fixture failed');
  assert.equal(result.audit.reason, 'Audit fixture failed');
  assert.deepEqual(retained().filter(e => e.stage === 'audit').map(e => e.result), ['running', 'failed']);
  assert.ok(timed.every(stage => result[stage].result === 'passed'));

  settings.reserveFunctional = () => { throw Error('Functional host unavailable'); };
  const denied = await runQualificationLanes(settings);
  assert.equal(denied.functionalReservation.result, 'failed');
  assert.ok([...stages, 'audit'].every(stage => denied[stage].result === 'blocked'));
});

test('only classified gate proposals skip both measurements and retain both functional devices', async t => {
  const { gateTimingSkip } = await import('../proposal-timing.mjs');
  const gate = ['.githooks/commit-msg', 'scripts/gates/tests/preflight.test.mjs'];
  const proposal = {
    mode: 'qualification', base: 'a'.repeat(40), commit: 'b'.repeat(40), noReuse: false,
    scope: { iphone: true, families: null },
  };
  for (const [label, paths, overrides, skip] of [
    ['gate', gate, {}, true],
    ['Android fixture', ['tests/android/host.mjs'], {}, false],
    ['Android timing', ['tests/android/frame-budget.mjs'], {}, false],
    ['budget', ['tests/android/low-end-budget.json'], {}, false],
    ['timing budget under a gate fixture', ['scripts/gates/tests/fixtures/low-end-budget.json'], {}, false],
    ['gate fixture', ['scripts/gates/tests/fixtures/daily-observation.mjs'], {}, false],
    ['Mac probe', ['scripts/performance/paired-frame.mjs'], {}, false],
    ['timing protocol', ['scripts/gates/qualification-lanes.mjs'], {}, false],
    ['transitive Android driver import', ['.github/gate-review.mjs'], {}, false],
    ['indirect timing input', ['scripts/build-cache/device-host.mjs'], {}, false],
    ['product', ['packages/web/src/button.tsx'], {}, false],
    ['family', ['manifests/families/button.json'], {}, false],
    ['docs', ['docs/guide.md'], {}, false],
    ['mixed', [...gate, 'packages/native/src/button.tsx'], {}, false],
    ['unknown gate input', ['scripts/unknown.bin'], {}, false],
    ['empty', [], {}, false],
    ['unclassifiable', [null], {}, false],
    ['device dependency', gate, { devicePlan: { run: true, paths: [{ status: 'M', path: gate[0], classification: 'Android harness read' }] } }, false],
    ['full', gate, { noReuse: true }, false],
    ['daily', gate, { commit: proposal.base, noReuse: true }, false],
    ['release', gate, { mode: 'release' }, false],
    ['train', gate, { trainPlan: 'plan' }, false],
  ]) {
    const receipt = { ...proposal, devicePlan: { run: true, paths: paths.map(path => ({ status: 'M', path, classification: 'gate or tooling' })) }, ...overrides };
    const { settings, retained } = setup(t);
    const calls = [];
    const operation = stage => () => { calls.push(stage); return pass(); };
    settings.functional = Object.fromEntries(functional.map(stage => [stage, operation(stage)]));
    settings.audit = operation('audit');
    const ready = [];
    settings.ready = stage => { ready.push(stage); return true; };
    settings.timed = Object.fromEntries(timed.map(stage => [stage, operation(stage)]));
    settings.reserveTiming = (stage, run) => { calls.push('reserve ' + stage); return run(); };
    settings.timingSkip = gateTimingSkip(receipt);
    const lanes = await runQualificationLanes(settings);
    assert.deepEqual(ready, skip ? functional : stages, label);
    assert.deepEqual(calls, [...functional, 'audit', ...(skip ? [] : timed.flatMap(stage => ['reserve ' + stage, stage]))], label);
    for (const stage of timed) {
      const row = retained().filter(event => event.stage === stage).at(-1);
      assert.deepEqual(row, { stage, ...lanes[stage] }, label);
      assert.equal(row.result, skip ? 'skipped' : 'passed', label);
      if (skip) {
        assert.equal(row.reason, 'gate-only change');
        assert.deepEqual(row.files, gate);
      }
    }
  }
});
