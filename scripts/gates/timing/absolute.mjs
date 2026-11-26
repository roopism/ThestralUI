import { enforceBudget, summarizeTrials } from '../../../tests/android/frame-budget.mjs';
import { isDeepStrictEqual } from 'node:util';

export function replay(frameBudget, journeys, limits) {
  const trials = journeys.flatMap(journey => (frameBudget?.[journey]?.trials ?? [])
    .map((metrics, index) => ({ journey, index, metrics })));
  try {
    for (const journey of journeys) {
      const recorded = frameBudget[journey];
      const summary = summarizeTrials(recorded.trials);
      for (const [index, trial] of recorded.trials.entries()) {
        if (!(trial.frames >= 15 && trial.inputs >= 5)) throw Error('Missing low-end frame or input samples for ' + journey);
        enforceBudget(trial, limits[journey], journey + ' trial ' + (index + 1));
      }
      enforceBudget(recorded, limits[journey], journey + ' median');
      if (!isDeepStrictEqual(recorded, summary)) throw Error('Inconsistent absolute summary for ' + journey);
    }
    return { verdict: 'pass', reason: 'Every absolute trial and median passed', trials, evidence: { frameBudget } };
  } catch (error) {
    return { verdict: 'fail', reason: error.message, trials, evidence: { frameBudget } };
  }
}

export async function measure({ device, journeys, limits, evidenceDir }) {
  return replay(await device.measureAbsolute(evidenceDir), journeys, limits);
}
