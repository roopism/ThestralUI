import assert from 'node:assert/strict';
import { enforceBudget, summarizeTrials } from './frame-budget.mjs';

export function requireBothProfiles(profiles) {
  assert.deepEqual(
    profiles.map((profile) => profile.id).sort(),
    ['low-end', 'standard'],
    'Android qualification requires exactly one standard and one low-end profile',
  );
}

export function androidJourneys(flows) {
  return flows
    .map(
      (file) => file.slice(0, -5) + '-' + (file === 'typography-largest.yaml' ? 'dark' : 'light'),
    )
    .concat('appearance-dark')
    .sort();
}

export function requireCompletedProfiles(profiles, flows, neutralIds, limits, selectedIds = neutralIds) {
  requireBothProfiles(profiles);
  const expectedFlows = androidJourneys(flows);
  for (const id of ['workspace-light', 'appearance-light', 'appearance-dark'])
    assert.ok(expectedFlows.includes(id), 'Missing required Android journey ' + id);
  for (const id of ['button.save-once', 'stack.child-order'])
    assert.ok(neutralIds.includes(id), 'Missing required native scenario ' + id);
  assert.ok(selectedIds.every(id => neutralIds.includes(id)), 'Unregistered native scenario selected');
  for (const profile of profiles) {
    assert.deepEqual(
      [...profile.passed].sort(),
      expectedFlows,
      profile.id + ' did not pass every Android journey',
    );
    if (selectedIds === neutralIds || selectedIds.length === neutralIds.length) {
      assert.deepEqual(
        [...profile.scenarioIds].sort(),
        [...neutralIds].sort(),
        profile.id + ' missed a registered scenario',
      );
    } else {
      assert.deepEqual([...profile.scenarioIds].sort(), [...selectedIds].sort(),
        profile.id + ' missed a selected native scenario');
    }
    assert.ok(profile.interaction.heldPixels >= 20, 'Missing Android ripple observation');
    if (profile.id === 'low-end')
      for (const journey of ['press', 'scroll']) {
        const result = profile.frameBudget?.[journey];
        assert.ok(
          result &&
            result.trials?.length === 3 &&
            result.trials.every((trial) => trial.frames >= 15 && trial.inputs >= 5) &&
            result.frames === result.trials.reduce((total, trial) => total + trial.frames, 0) &&
            result.inputs === result.trials.reduce((total, trial) => total + trial.inputs, 0),
          'Missing low-end frame or input samples for ' + journey,
        );
        const measured = summarizeTrials(result.trials);
        for (const [index, trial] of result.trials.entries())
          enforceBudget(trial, limits[journey], journey + ' trial ' + (index + 1));
        enforceBudget(result, limits[journey], journey + ' median');
        for (const key of ['p95FrameMs', 'p95InputToCommitMs', 'deadlineMissFraction'])
          assert.equal(result[key], measured[key], journey + ' does not report the measured median for ' + key);
      }
  }
}
