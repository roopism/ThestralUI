import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { evaluatePairs, measure } from '../timing/paired-ab.mjs';

const read = name => JSON.parse(readFileSync(new URL('../../../tests/android/' + name, import.meta.url)));
const config = read('timing-strategy.json');
const { limits, reference } = read('low-end-budget.json');
const journeys = ['press', 'scroll'];
const inputs = { config, limits, journeys, base: { name: 'original' }, candidate: { name: 'proposal' }, evidenceDir: '/fixture' };
const evaluate = trials => evaluatePairs({ ...inputs, trials });

function trace(pair) {
  // Both clean references come from the calibrated emulator. Replay a common time-varying disturbance.
  const row = structuredClone(reference.trials[1 + pair % 2]);
  for (const journey of journeys) {
    const noise = (pair % 3 - 1) / 2;
    row[journey].p95FrameMs += noise;
    row[journey].p95InputToCommitMs += noise;
  }
  return row;
}
function run(change = () => {}) {
  return measure({ ...inputs, device: { async measureTrial(request) {
    const { app, arm, pair, reports } = request;
    assert.equal(app, inputs[arm]);
    assert.equal(reports, '/fixture/pair-' + pair + '/' + arm);
    const row = trace(pair);
    await change(row, request);
    return row;
  } } });
}

test('paired timing replays shared noise in ABBA order and retains both arms', async () => {
  const result = await run();
  assert.equal(result.verdict, 'pass');
  assert.deepEqual(result.trials.map(t => t.arm), Array(3).fill(['base', 'candidate', 'candidate', 'base']).flat());
  assert.deepEqual(result.trials.map(t => t.pair), [1,1,2,2,3,3,4,4,5,5,6,6]);
  for (const row of result.trials) assert.deepEqual(row.metrics, trace(row.pair));
  for (const journey of journeys) for (const metric of Object.keys(limits[journey])) {
    assert.deepEqual(result.evidence.comparisons[journey][metric].interval95, [0, 0]);
  }
  assert.deepEqual(evaluate(result.trials), result);
});

test('paired timing fails a 20 ms frame delay and consistent regressions below the absolute limit', async () => {
  for (const delay of [20, 3]) {
    const result = await run((row, { arm, pair }) => {
      row.scroll.p95FrameMs = 17 + (pair % 3) / 4 + (arm === 'candidate' ? delay : 0);
    });
    assert.equal(result.verdict, 'fail');
    assert.equal(result.trials.length, 12);
    assert.equal(result.evidence.candidateOnly.length, delay === 20 ? 6 : 0);
    assert.equal(result.evidence.comparisons.scroll.p95FrameMs.threshold, 2);
    assert.deepEqual(result.evidence.comparisons.scroll.p95FrameMs.interval95, [delay, delay]);
  }
  const fraction = await run((row, { arm }) => { if (arm === 'candidate') row.press.deadlineMissFraction = 1 / row.press.frames; });
  assert.equal(fraction.verdict, 'fail');
  assert.deepEqual(fraction.evidence.candidateOnly, []);
  assert.equal(fraction.evidence.comparisons.press.deadlineMissFraction.threshold, 0);
  assert.equal(fraction.evidence.comparisons.press.deadlineMissFraction.unit, 'fraction');
});

test('paired timing adds one pair per shared overrun and retains persistent contamination', async () => {
  const contaminate = row => {
    row.press.p95FrameMs = reference.trials[0].press.p95FrameMs;
    row.scroll.p95InputToCommitMs = limits.scroll.p95InputToCommitMs + 1;
  };
  const recovered = await run((row, { pair, arm }) => {
    if (pair === 1) { contaminate(row); if (arm === 'candidate') row.press.p95FrameMs += 1; }
  });
  assert.equal(recovered.verdict, 'pass');
  assert.equal(recovered.trials.length, 14);
  assert.deepEqual(recovered.evidence.contaminatedPairs.map(row => row.pair), [1]);
  assert.equal(recovered.evidence.contaminatedPairs[0].metrics.length, 2);
  assert.deepEqual(recovered.evidence.comparisons.press.p95FrameMs.differences, [1, 0, 0, 0, 0, 0, 0]);
  const noisy = await run(contaminate);
  assert.equal(noisy.verdict, 'inconclusive');
  assert.equal(noisy.trials.length, 20);
  assert.equal(noisy.evidence.contaminatedPairs.length, 10);
  assert.match(noisy.reason, /persisted/);
});

test('paired timing matches absolute overruns by journey and metric', async () => {
  const result = await run((row, { pair, arm }) => {
    if (pair !== 1) return;
    if (arm === 'base') row.scroll.p95FrameMs = limits.scroll.p95FrameMs + 1;
    else row.press.p95FrameMs = limits.press.p95FrameMs + 1;
  });
  assert.equal(result.verdict, 'fail');
  assert.equal(result.trials.length, 12);
  assert.equal(result.evidence.contaminatedPairs.length, 0);
  assert.deepEqual(result.evidence.candidateOnly.map(({ pair, journey, metric }) => [pair, journey, metric]), [[1, 'press', 'p95FrameMs']]);
});

test('paired timing reproduces an exhaustive 95 percent bootstrap interval and retains uncertainty', async () => {
  const differences = [-1.5, -0.5, 0.5, 2.25, 2.75, 3];
  const result = await run((row, { pair, arm }) => { if (arm === 'candidate') row.scroll.p95FrameMs += differences[pair - 1]; });
  // Independent oracle for all 6^6 equally probable resamples, including repeated observations.
  const medians = [];
  function enumerate(sample) {
    if (sample.length < 6) { for (const d of differences) enumerate([...sample, d]); return; }
    sample.sort((a, b) => a - b);
    medians.push((sample[2] + sample[3]) / 2);
  }
  enumerate([]);
  medians.sort((a, b) => a - b);
  const expected = [0.025, 0.975].map(q => medians[Math.ceil(medians.length * q) - 1]);
  assert.deepEqual(result.evidence.comparisons.scroll.p95FrameMs.interval95, expected);
  assert.equal(result.verdict, 'inconclusive');
  assert.equal(result.trials.length, 12);

  const seven = [-1.5, -0.5, 0.5, 1.5, 2.25, 2.75, 3];
  const odd = await run((row, { pair, arm }) => {
    if (pair === 1) row.press.p95FrameMs = limits.press.p95FrameMs + 1;
    row.scroll.p95FrameMs = 17 + (arm === 'candidate' ? seven[pair - 1] : 0);
  });
  assert.deepEqual(odd.evidence.comparisons.scroll.p95FrameMs.interval95, [-0.5, 2.75]);
  assert.equal(odd.verdict, 'inconclusive');
});

test('paired timing rejects missing observations, invalid limits and unauthorized extra samples', async () => {
  const { trials } = await run();
  for (const corrupt of [
    t => t.pop(), t => t.splice(0, 2), t => t.reverse(), t => { t[1].pair++; },
    t => { delete t[0].metrics.scroll; }, t => { delete t[0].metrics.press.p95FrameMs; },
    t => { t[0].metrics.press.inputs = 4; }, t => { t[0].metrics.press.frames = 14; },
    t => { t[0].metrics.press.p95FrameMs = NaN; }, t => { t[0].metrics.press.p95InputToCommitMs = Infinity; },
    t => { t[0].metrics.scroll.deadlineMissFraction = 2; }, t => { t[0].metrics.press.p95FrameMs = -1; },
    t => t.push(...t.slice(0, 2).map(row => ({ ...row, pair: 7 }))),
  ]) {
    const malformed = structuredClone(trials);
    corrupt(malformed);
    const result = evaluate(malformed);
    assert.equal(result.verdict, 'inconclusive');
    assert.equal(result.trials, malformed);
  }
  assert.equal(evaluatePairs({ ...inputs, trials, journeys: ['press'] }).verdict, 'inconclusive');
  assert.equal(evaluatePairs({ ...inputs, trials, limits: { ...limits, press: {} } }).verdict, 'inconclusive');
  assert.equal(evaluatePairs({ ...inputs, trials, config: { ...config, minPairs: 5 } }).verdict, 'inconclusive');
  assert.equal(evaluatePairs({ ...inputs, trials, config: { ...config, maxExtraPairs: 5 } }).verdict, 'inconclusive');
});

test('paired timing keeps partial evidence on collection errors and finishes six pairs after bad data', async () => {
  const stopped = await run((row, { pair, arm }) => { if (pair === 2 && arm === 'base') throw Error('lost frame report'); });
  assert.equal(stopped.verdict, 'inconclusive');
  assert.match(stopped.reason, /lost frame report/);
  assert.equal(stopped.trials.length, 4);
  assert.equal(stopped.trials.at(-1).reports, '/fixture/pair-2/base');
  assert.equal(stopped.trials.at(-1).error, 'lost frame report');
  assert.deepEqual(stopped.trials[2].metrics, trace(2));
  const malformed = await run((row, { pair }) => { if (pair === 1) delete row.press.inputs; });
  assert.equal(malformed.verdict, 'inconclusive');
  assert.equal(malformed.trials.length, 12);
});
