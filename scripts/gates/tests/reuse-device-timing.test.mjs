import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { summarizeTrials } from '../../../tests/android/frame-budget.mjs';
import { verifyTimingTrials } from '../reuse/device-run.mjs';

const { limits } = JSON.parse(readFileSync(new URL('../../../tests/android/low-end-budget.json', import.meta.url)));
function observation(journey, latency = limits[journey].p95InputToCommitMs) {
  return { frames: 50, inputs: 8, p95FrameMs: limits[journey].p95FrameMs,
    deadlineMissFraction: limits[journey].deadlineMissFraction, p95InputToCommitMs: latency };
}

test('reused Android functional scenarios still reject one slow timing trial with a passing median', () => {
  const trials = name => Array.from({ length: 3 }, () => observation(name));
  const seen = { press: summarizeTrials(trials('press')), scroll: summarizeTrials(trials('scroll')) };
  verifyTimingTrials(seen, limits);
  const scroll = trials('scroll');
  scroll[1] = observation('scroll', limits.scroll.p95InputToCommitMs + 1);
  const exceeded = summarizeTrials(scroll);
  assert.equal(exceeded.p95InputToCommitMs, seen.scroll.p95InputToCommitMs);
  assert.throws(() => verifyTimingTrials({ ...seen, scroll: exceeded }, limits), /scroll trial 2/);
});
