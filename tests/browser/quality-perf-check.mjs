import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { budgetFailures } from './quality-perf-policy.mjs';
test('runtime budgets reject regressions, missing measurements and invalid budgets', () => {
  const limits = { latency: { baseline: 20, allowance: 5 } };
  assert.deepEqual(budgetFailures({ latency: 25 }, limits), []);
  assert.ok(budgetFailures({ latency: 26 }, limits).length);
  assert.ok(budgetFailures({}, limits).length);
  assert.ok(budgetFailures({ latency: NaN }, limits).length);
  assert.ok(budgetFailures({ latency: 0 }, { latency: { baseline: -1, allowance: 5 } }).length);
});

test('independent native checks run after a failed browser measurement and the gate retains every failure', async () => {
  const { runIndependentSuites } = await import('../../packages/policy/quality/check-staged.mjs');
  const observed = [];
  const slow = new Error('frame p95 above limit'), rejected = new Error('simulator assertion failed');
  const suites = [
    ['browser performance', () => { observed.push('performance'); throw slow; }],
    ['native package consumer', () => { observed.push('package'); }],
    ['iPhone Simulator', async () => { observed.push('device'); throw rejected; }],
  ];
  await assert.rejects(runIndependentSuites(suites), error => {
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors.map(failure => failure.cause), [slow, rejected]);
    return true;
  });
  assert.deepEqual(observed, ['performance', 'package', 'device']);
});

test('timed diagnostic children release themselves and never signal a closed process group', async t => {
  const { runBounded } = await import('../../scripts/performance/paired-frame.mjs');
  const original = process.kill.bind(process);
  const signals = [];
  t.mock.method(process, 'kill', (group, signal) => {
    signals.push(signal);
    return original(group, signal);
  });
  await runBounded(process.execPath, ['-e', ''], {}, 10_000);
  assert.deepEqual(signals, []);
  await assert.rejects(runBounded(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {}, 150), /deadline/);
  assert.deepEqual(signals, ['SIGTERM']);
  signals.length = 0;
  const directory = mkdtempSync(join(tmpdir(), 'paired-process-ready-'));
  const marker = join(directory, 'ready'), received = join(directory, 'term');
  const watchdogMs = 15_000;
  const schedule = globalThis.setTimeout;
  let expire;
  // Advance only this arm's test deadline after the child installs its handler.
  // The independent wall-clock watchdog and the production TERM-to-KILL grace stay live.
  const clock = t.mock.method(globalThis, 'setTimeout', (callback, delay, ...args) => {
    const timer = schedule(callback, delay, ...args);
    if (delay === watchdogMs) expire = () => { clearTimeout(timer); callback(...args); };
    return timer;
  });
  const script = [
    "const fs = require('node:fs');",
    "process.on('SIGTERM', () => fs.writeFileSync(process.argv[2], 'received'));",
    "fs.writeFileSync(process.argv[1] + '.tmp', 'ready'); fs.renameSync(process.argv[1] + '.tmp', process.argv[1]);",
    "setInterval(() => {}, 1000);",
  ].join(' ');
  const stopped = assert.rejects(runBounded(process.execPath,
    ['-e', script, marker, received], {}, watchdogMs), /deadline/);
  try {
    const until = performance.now() + watchdogMs / 2;
    while (!existsSync(marker) && performance.now() < until) await sleep(20);
    assert.equal(readFileSync(marker, 'utf8'), 'ready', 'The child must install its TERM handler.');
    expire();
    await stopped;
    assert.equal(readFileSync(received, 'utf8'), 'received');
    assert.deepEqual(signals, ['SIGTERM', 'SIGKILL']);
  } finally {
    clock.mock.restore();
    if (!signals.length) expire?.();
    try { await stopped; } finally { rmSync(directory, {recursive:true, force:true}); }
  }
});
