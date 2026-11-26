import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { git } from '../../../selection/device-observations.mjs';
import { deviceInputs } from '../../../selection/device-inputs.mjs';
import { admission } from '../../android-host-activity.mjs';
import { summarizeTrials } from '../../../../tests/android/frame-budget.mjs';

const created = new Set();

// Register a new, empty directory before either test creates its fixture repository.
export function createObservationTestDirectory(t, prefix, subdir = '') {
  assert.match(prefix, /^uld-[a-z-]+-$/);
  assert.ok(subdir === '' || subdir === 'repo');
  const directory = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  const root = join(directory, subdir);
  created.add(root);
  t.after(() => created.delete(root));
  return directory;
}

const iphoneProfiles = [['workspace', 'light', 'large'], ['appearance', 'light', 'large'],
  ['appearance', 'dark', 'accessibility-extra-large']];
const scenarios = ['button.save-once', 'stack.child-order'];

export function dailyObservationFixtureFiles() {
  const files = {
    'scripts/verify-ios-simulator.mjs': 'const profiles = ' + JSON.stringify(iphoneProfiles) + ';',
    'tests/simulator/workspace.yaml': 'appId: fixture.app\n---\n- launchApp\n',
    'tests/simulator/appearance.yaml': 'appId: fixture.app\n---\n- launchApp\n',
    'catalog/native/scenarios/fixtures.cjs': "module.exports = {'button.save-once':{label:'Save',render:()=>null},'stack.child-order':{label:'Order',render:()=>null}};",
  };
  for (const id of scenarios) {
    const [family, fixture] = id.split('.');
    files['docs/components/' + family + '.scenarios.yaml'] = JSON.stringify({ family, scenarios: [
      { id, fixture, steps: [{ expect: 'visible', target: { role: 'button', name: 'Save' } }] },
    ] });
  }
  return files;
}

export function dailyObservationFixture(root, revision, platforms, finished = '2026-11-25T12:00:00Z') {
  assert.ok(created.has(realpathSync(root)), 'A repository created by this test is required');
  assert.equal(realpathSync(git(root, 'rev-parse', '--absolute-git-dir')), join(realpathSync(root), '.git'));
  assert.equal(git(root, 'remote'), '');
  assert.equal(git(root, 'show', '-s', '--format=%ae', revision), 'fixture@example.invalid');
  const tree = git(root, 'rev-parse', revision + '^{tree}');
  const map = deviceInputs(root, tree);
  const required = Object.keys(JSON.parse(git(root, 'show', tree + ':tests/acceptance/suite-inputs.json')).groups);
  const id = randomUUID(), apkSha256 = 'a'.repeat(64), entryManifestSha256 = 'b'.repeat(64);
  // Only the six numeric samples from a recorded passing low-end run are retained here.
  const frameBudget = {
    press: summarizeTrials([
      { frames: 72, inputs: 55, p95FrameMs: 17.119052, p95InputToCommitMs: 34.190646, deadlineMissFraction: 0 },
      { frames: 79, inputs: 58, p95FrameMs: 17.159218, p95InputToCommitMs: 33.092493, deadlineMissFraction: 0 },
      { frames: 73, inputs: 61, p95FrameMs: 17.445872, p95InputToCommitMs: 29.737172, deadlineMissFraction: 0 },
    ]),
    scroll: summarizeTrials([
      { frames: 120, inputs: 268, p95FrameMs: 17.460344, p95InputToCommitMs: 21.032026, deadlineMissFraction: 0.016666666666666666 },
      { frames: 120, inputs: 270, p95FrameMs: 17.20946, p95InputToCommitMs: 20.846912, deadlineMissFraction: 0 },
      { frames: 120, inputs: 270, p95FrameMs: 17.139495, p95InputToCommitMs: 20.726717, deadlineMissFraction: 0 },
    ]),
  };
  const start = { atMs: 1000, load1: 1, cpus: 4, loadPerCpu: 0.25, hidIdleNs: '120000000000' };
  const recorded = { schema: 1, kind: 'primary', policy: admission, start, wait: [start],
    samples: [{ ...start, atMs: 2000 }], verdict: 'passed', numericVerdict: 'passed',
    identity: { tree, attempt: id, apkSha256, entryManifestSha256 },
    frameSha256: createHash('sha256').update(JSON.stringify(frameBudget)).digest('hex') };
  const row = name => ({ name, result: 'passed', durationMs: 1000, reusedFrom: null });
  const androidProfiles = ['standard','low-end'].map(id => ({ id, hardware: { fingerprint: 'fixture' },
    passed: ['workspace-light','appearance-light','appearance-dark'], scenarioIds: [...scenarios],
    interaction: { heldPixels: 24 }, ...(id === 'low-end' ? { frameBudget } : {}) }));
  const junit = '<testsuite tests="1" failures="0"><testcase status="passed"/></testsuite>';
  const iphoneJourneys = Object.fromEntries(iphoneProfiles.map(([flow, theme]) => [flow + '-' + theme + '.xml', junit]));
  return { id, base: revision, commit: revision, tree, reuseSchema: 1, finished,
    started: new Date(Date.parse(finished) - 60000).toISOString(),
    suites: required.map(row), gateTests: row('Trusted gate tests'), androidHostActivityPolicy: 1,
    devicePlan: { full: true, run: true }, devices: { iphone: { passed: true, deviceType: 'iPhone Simulator',
      model: 'fixture', runtime: 'fixture', profiles: iphoneProfiles, scenarioIds: [...scenarios], testsPassed: 3, failed: 0, skipped: 0 },
      android: ['standard','low-end'].map(id => ({ id, hardware: { fingerprint: 'fixture' } })) },
    mode: 'qualification', status: 'passed', noReuse: true, scope: { iphone: true, families: null },
    deviceInputs: { key: map.key, platforms, iphoneJourneys, androidReport: { passed: true, failed: 0, skipped: 0, profiles: androidProfiles } }, androidTiming: { result: 'timing measured', apkSha256,
      entryManifestSha256, frameBudget, admission: recorded } };
}
