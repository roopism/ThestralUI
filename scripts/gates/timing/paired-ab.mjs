import assert from 'node:assert/strict';
import { join } from 'node:path';

const journeysRequired = ['press', 'scroll'];
const metrics = ['p95FrameMs', 'p95InputToCommitMs', 'deadlineMissFraction'];
const isFraction = metric => metric === 'deadlineMissFraction';
const arms = pair => pair % 2 === 1 ? ['base', 'candidate'] : ['candidate', 'base'];
const average = (a, b) => a / 2 + b / 2;
const median = sorted => average(sorted[Math.floor((sorted.length - 1) / 2)], sorted[Math.floor(sorted.length / 2)]);
const ascending = (a, b) => a - b;

// Count the bootstrap distribution exactly. With at most ten planned pairs, this avoids sampling error
// from a random seed. A resample is n independent selections from the n observed paired differences.
function bootstrap95(sorted) {
  const n = sorted.length;
  const middle = Math.ceil(n / 2);
  const choose = [1n];
  for (let k = 1; k <= n; k++) choose.push(choose[k - 1] * BigInt(n - k + 1) / BigInt(k));
  const outcomes = [];
  let previous = 0n;
  for (let i = 0; i < n; i++) {
    // The lower middle observation is at most i when at least middle draws lie in indices 0..i.
    let cumulative = 0n;
    for (let k = middle; k <= n; k++)
      cumulative += choose[k] * BigInt(i + 1) ** BigInt(k) * BigInt(n - i - 1) ** BigInt(n - k);
    let equal = cumulative - previous;
    previous = cumulative;
    if (n % 2 === 0) {
      const half = BigInt(middle);
      const lowerChoices = BigInt(i + 1) ** half - BigInt(i) ** half;
      for (let j = i + 1; j < n; j++) {
        // For central indices i < j, exactly half the draws are <= i and half >= j.
        // Each half must include its boundary at least once.
        const upperChoices = BigInt(n - j) ** half - BigInt(n - j - 1) ** half;
        const count = choose[middle] * lowerChoices * upperChoices;
        outcomes.push({ value: average(sorted[i], sorted[j]), count });
        equal -= count;
      }
    }
    outcomes.push({ value: sorted[i], count: equal });
  }
  outcomes.sort((a, b) => a.value - b.value);
  const total = BigInt(n) ** BigInt(n);
  function percentile(numerator) {
    let count = 0n;
    for (const outcome of outcomes) {
      count += outcome.count;
      if (40n * count >= numerator * total) return outcome.value;
    }
    throw Error('Incomplete bootstrap distribution');
  }
  return [percentile(1n), percentile(39n)];
}

function validValue(value, metric) {
  return Number.isFinite(value) && value >= 0 && (!isFraction(metric) || value <= 1);
}

function validateInputs(journeys, limits, config) {
  assert.deepEqual([...journeys].sort(), journeysRequired, 'Paired timing requires the press and scroll journeys');
  assert.deepEqual(Object.keys(limits).sort(), journeysRequired, 'Limits must cover both timing journeys');
  assert.ok(Number.isSafeInteger(config.minPairs) && config.minPairs >= 6, 'At least six timing pairs are required');
  assert.ok(Number.isSafeInteger(config.maxExtraPairs) && config.maxExtraPairs >= 0 && config.maxExtraPairs <= 4,
    'Paired timing permits at most four additional pairs');
  assert.ok(Number.isFinite(config.relativeThreshold) && config.relativeThreshold >= 0 && config.relativeThreshold <= 0.10,
    'Invalid relative timing threshold');
  assert.ok(Number.isFinite(config.absoluteThresholdMs) && config.absoluteThresholdMs >= 0 && config.absoluteThresholdMs <= 2,
    'Invalid absolute timing threshold in milliseconds');
  for (const journey of journeysRequired) {
    assert.deepEqual(Object.keys(limits[journey]).sort(), [...metrics].sort(), 'Invalid metric limits for ' + journey);
    for (const metric of metrics) assert.ok(validValue(limits[journey][metric], metric), 'Invalid limit for ' + journey + '.' + metric);
  }
}

export function evaluatePairs({ trials = [], journeys, limits, config } = {}) {
  const evidence = { strategy: 'paired-ab', contaminatedPairs: [], candidateOnly: [], comparisons: {}, extraPairsNeeded: 0 };
  const outcome = (verdict, reason) => {
    const shared = evidence.contaminatedPairs[0]?.metrics[0];
    if (!shared) return { verdict, reason, trials, evidence };
    // Replacement pairs refine the comparison. A retained candidate over its ceiling still fails.
    const { pair, journey, metric, candidate, limit } = shared;
    const absolute = 'candidate pair ' + pair + ' ' + journey + ' ' + metric + ' ' + candidate + ' exceeds ' + limit;
    return { verdict: 'fail', reason: verdict === 'fail' ? reason : absolute, trials, evidence, pairedComparison: { verdict, reason } };
  };
  try {
    validateInputs(journeys, limits, config);
    assert.ok(Array.isArray(trials) && trials.length % 2 === 0, 'Incomplete timing pair');
    const count = trials.length / 2;
    assert.ok(count <= config.minPairs + config.maxExtraPairs, 'Too many timing pairs');
    const pairs = [];
    for (let pair = 1; pair <= count; pair++) {
      assert.ok(pair <= config.minPairs + evidence.contaminatedPairs.length, 'Extra timing pair without prior contamination');
      const records = {};
      for (const [index, arm] of arms(pair).entries()) {
        const trial = trials[2 * (pair - 1) + index];
        assert.ok(trial?.pair === pair && trial.arm === arm && !Object.hasOwn(trial, 'error'), 'Invalid ABBA trial for pair ' + pair + ' ' + arm);
        for (const journey of journeysRequired) {
          const row = trial.metrics?.[journey];
          assert.ok(Number.isSafeInteger(row?.frames) && row.frames >= 15 && Number.isSafeInteger(row.inputs) && row.inputs >= 5,
            'Missing frame or input samples at pair ' + pair + ' ' + arm + ' ' + journey);
          for (const metric of metrics) assert.ok(validValue(row[metric], metric), 'Invalid ' + metric + ' at pair ' + pair + ' ' + arm + ' ' + journey);
        }
        records[arm] = trial.metrics;
      }
      const shared = [];
      for (const journey of journeysRequired) for (const metric of metrics) {
        const base = records.base[journey][metric], candidate = records.candidate[journey][metric], limit = limits[journey][metric];
        if (candidate > limit) (base > limit ? shared : evidence.candidateOnly).push({ pair, journey, metric, base, candidate, limit });
      }
      if (shared.length) evidence.contaminatedPairs.push({ pair, metrics: shared });
      pairs.push(records);
    }
    if (count < config.minPairs) return outcome('inconclusive', 'Fewer than the required timing pairs');
    const regressions = [], uncertain = [];
    for (const journey of journeysRequired) {
      evidence.comparisons[journey] = {};
      for (const metric of metrics) {
        const baseMedian = median(pairs.map(p => p.base[journey][metric]).sort(ascending));
        const differences = pairs.map(p => p.candidate[journey][metric] - p.base[journey][metric]);
        const sorted = [...differences].sort(ascending);
        const interval = bootstrap95(sorted);
        const threshold = Math.max(config.relativeThreshold * baseMedian, isFraction(metric) ? 0 : config.absoluteThresholdMs);
        evidence.comparisons[journey][metric] = { baseMedian, differences, medianDifference: median(sorted), interval95: interval, threshold,
          unit: isFraction(metric) ? 'fraction' : 'ms' };
        if (interval[0] > threshold) regressions.push(journey + '.' + metric);
        else if (interval[1] > threshold) uncertain.push(journey + '.' + metric);
      }
    }
    const missingCleanPairs = config.minPairs - (count - evidence.contaminatedPairs.length);
    evidence.extraPairsNeeded = Math.max(0, Math.min(missingCleanPairs, config.minPairs + config.maxExtraPairs - count));
    if (evidence.candidateOnly.length) return outcome('fail', 'Candidate alone exceeded an absolute limit');
    if (regressions.length) return outcome('fail', 'Paired regression in ' + regressions.join(', '));
    if (missingCleanPairs > 0) return outcome('inconclusive', evidence.extraPairsNeeded ? 'Contamination requires an additional pair' : 'Contamination persisted through the extra-pair limit');
    if (uncertain.length) return outcome('inconclusive', 'Confidence interval crosses the threshold for ' + uncertain.join(', '));
    return outcome('pass', 'All paired confidence intervals and absolute backstops passed');
  } catch (error) {
    return outcome('inconclusive', error.message);
  }
}

export async function measure({ device, journeys, limits, base, candidate, evidenceDir, config } = {}) {
  const trials = [];
  const apps = { base, candidate };
  try {
    validateInputs(journeys, limits, config);
    assert.ok(base != null && candidate != null && typeof device?.measureTrial === 'function', 'Paired timing needs both apps and a trial collector');
    assert.ok(typeof evidenceDir === 'string' && evidenceDir.length, 'Paired timing needs an evidence directory');
    for (let pair = 1; ; pair++) {
      for (const arm of arms(pair)) {
        const reports = join(evidenceDir, 'pair-' + pair, arm);
        const trial = { pair, arm, reports };
        trials.push(trial);
        try { trial.metrics = structuredClone(await device.measureTrial({ app: apps[arm], arm, pair, reports })); }
        catch (error) { trial.error = String(error?.message ?? error); throw error; }
      }
      if (pair >= config.minPairs) {
        const result = evaluatePairs({ trials, journeys, limits, config });
        if (!result.evidence.extraPairsNeeded) return result;
      }
    }
  } catch (error) {
    return { verdict: 'inconclusive', reason: 'Paired collection could not finish: ' + String(error?.message ?? error), trials, evidence: { strategy: 'paired-ab' } };
  }
}
