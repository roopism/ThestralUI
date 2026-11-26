import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants, cpSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { measureAdmitted, observedIdentity } from '../android-host-activity.mjs';
import { androidTiming } from '../android-timing-reuse.mjs';
import { shutdownSimulators, usingSimulator, withTiming } from '../../workers/resource-guard.mjs';
import { stopVm } from '../linux-vm.mjs';
import { candidateArchives, findCocoaPods, pickPhone, preparePackedIosApp } from '../../verify-ios-simulator.mjs';
import { androidTools, withEmulator } from '../../../tests/android/emulator.mjs';
import { enforceBudget, summarizeTrials } from '../../../tests/android/frame-budget.mjs';
import { measureTimingStrategy, prepareTimingStrategy } from '../timing/android.mjs';
import { preparePackedApk } from '../../../tests/android/host.mjs';
import { environmentFacts } from './environment.mjs';
import { appIdentity } from './app-identity.mjs';

const ios = 'iPhone Simulator';
const android = 'Android standard and low-end';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const git = (root, ...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const pathFor = group => group === ios ? 'HelloWorld.app' : 'app-release.apk';
const platform = group => group === ios ? 'ios' : 'android';
const evidenceRoot = (directory, id, group) => {
  assert.ok([ios, android].includes(group));
  assert.match(id, /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);
  return join(directory, 'attempts', id + '-evidence', 'app-build', platform(group));
};

function selectedPhone() {
  const devices = JSON.parse(execFileSync('xcrun', ['simctl', 'list', 'devices', 'available', '-j']));
  return pickPhone(devices.devices, process.env.UI_SIMULATOR_ID);
}

function deviceImage(groupId, root) {
  if (groupId === ios) {
    const phone = selectedPhone();
    const facts = environmentFacts(['ios-runtime', 'xcode'], { root, groupId });
    return { ...facts, udid: phone.udid, model: phone.name, selectedRuntime: phone.runtime };
  }
  return environmentFacts(['android-system-image'], { root, groupId });
}

function identities(group, file) {
  const value = appIdentity(platform(group), file);
  assert.match(value.fileSha256, /^[a-f0-9]{64}$/);
  assert.match(value.manifestSha256, /^[a-f0-9]{64}$/);
  return group === ios ? { iphone: value } : { standard: value, 'low-end': value };
}

export async function prepareDeviceReuse(context) {
  const { groupId, root, snapshot, commit, tree, directory, attemptId } = context;
  assert.equal(git(root, 'rev-parse', '--verify', commit + '^{tree}'), tree);
  assert.equal(git(snapshot, 'rev-parse', 'HEAD^{tree}'), tree);
  git(snapshot, 'diff', '--quiet', 'HEAD', '--');
  assert.equal(git(snapshot, 'ls-files', '--others', '--exclude-standard'), '');
  const provenance = read(join(snapshot, 'release/evidence/provenance.json'));
  const lockSha256 = hash(execFileSync('git', ['show', tree + ':package-lock.json'], { cwd: root }));
  assert.equal(provenance.lockSha256, lockSha256);
  assert.ok([ios, android].includes(groupId));
  const image = deviceImage(groupId, snapshot);
  if (Object.values(image).includes('unavailable')) return null;
  const folder = evidenceRoot(directory, attemptId, groupId);
  const out = join(snapshot, 'test-results', 'reuse-apps', platform(groupId));
  const evidence = join(snapshot, 'release/evidence');
  return withTiming('activity', 'Prepare app for ' + groupId, async () => {
    mkdirSync(out, { recursive: true });
    let built;
    if (groupId === ios) {
      const { app } = await preparePackedIosApp(snapshot, candidateArchives(snapshot), selectedPhone(), findCocoaPods(), out);
      built = app;
    } else {
      const { apk } = await preparePackedApk(snapshot, evidence, androidTools(), out);
      await prepareTimingStrategy({ root: snapshot, common: dirname(directory), tools: androidTools(), reports: out });
      built = apk;
    }
    mkdirSync(dirname(folder), { recursive: true });
    mkdirSync(folder);
    const destination = join(folder, pathFor(groupId));
    cpSync(built, destination, { recursive: true, verbatimSymlinks: true, mode: constants.COPYFILE_FICLONE });
    const manifests = identities(groupId, destination);
    assert.deepEqual(manifests, identities(groupId, built));
    const metadata = { schema: 1, attemptId, groupId, commit, tree, lockSha256,
      packedArchives: provenance.packages.map(({ name, sha256 }) => ({ name, sha256 })),
      appManifests: manifests, deviceImage: image };
    const json = JSON.stringify(metadata) + '\n';
    writeFileSync(join(folder, 'build.json'), json, { flag: 'wx', mode: 0o600 });
    return { appManifests: manifests, deviceImage: image, buildEvidenceSha256: hash(json),
      prepared: { path: destination, appManifests: manifests } };
  });
}

export function verifyFreshDeviceApplication({ groupId, snapshot }, prepared) {
  const relative = groupId === ios ? 'ios-simulator/app/HelloWorld.app' : 'android-emulator/apk/app-release.apk';
  const current = identities(groupId, join(snapshot, 'test-results', relative));
  return Object.keys(current).every(key => current[key].manifestSha256 === prepared.appManifests[key]?.manifestSha256);
}

// Functional reuse never supplies a timing verdict. Every retained trial and the
// reported aggregate must pass the same budget as a complete device run.
export function verifyTimingTrials(frameBudget, limits) {
  for (const journey of ['press', 'scroll']) {
    const observed = frameBudget[journey];
    assert.deepEqual(observed, summarizeTrials(observed.trials));
    for (const [index, sample] of observed.trials.entries()) {
      assert.ok(Number.isInteger(sample.frames) && sample.frames >= 15);
      assert.ok(Number.isInteger(sample.inputs) && sample.inputs >= 5);
      enforceBudget(sample, limits[journey], journey + ' trial ' + (index + 1));
    }
    enforceBudget(observed, limits[journey], journey + ' median');
  }
}

export async function reuseAndroidTiming({ snapshot, directory, base }, prepared) {
  const budgets = read(join(snapshot, 'tests/android/low-end-budget.json'));
  const { limits } = budgets;
  assert.equal(read(join(snapshot, '.git/gate-selection.json')).budgetComparisonBase, base);
  const reports = join(snapshot, 'test-results/android-emulator/low-end');
  mkdirSync(reports, { recursive: true });
  const strategy = await prepareTimingStrategy({ root: snapshot, common: dirname(directory), tools: androidTools(), reports }, true);
  let strategyReport;
  const timing = await androidTiming({ root: snapshot, apk: prepared.path, common: dirname(directory), limits,
    strategy: strategy.config.active['android-low-end'],
    measure: identity => usingSimulator('Android low-end timing', async () => {
      await stopVm();
      shutdownSimulators();
      const { prepareAndroidProfile } = await import('../../verify-android-emulator.mjs');
      const tools = androidTools();
      const profile = read(join(snapshot, 'tests/android/profiles.json')).profiles.find(row => row.id === 'low-end');
      assert.ok(profile);
      return withEmulator(profile, tools, reports, async ({ device, serial, name }) => {
        const { interaction } = await prepareAndroidProfile({ profile, apk: prepared.path, dir: reports, serial, name, device, tools });
        assert.ok(interaction.heldPixels >= 20, 'Missing Android ripple observation');
        const common=dirname(directory);
        const observed = observedIdentity(snapshot, common, identity);
        return measureAdmitted({ reports, identity: observed, common, limits, measure: async folder => {
          const result = await measureTimingStrategy({ common, profile, device, budgets, strategy,
            apk: prepared.path, reports: folder, identity: observed });
          if (folder === reports) strategyReport = result.report;
          return result.frames;
        } });
      });
    }) });
  if (timing.result === 'timing measured') {
    timing.admission = read(join(reports, 'timing-admission.json'));
    timing.strategyReport = strategyReport;
  }
  writeFileSync(join(reports, 'timing-source.json'), JSON.stringify(timing, null, 2) + '\n');
  verifyTimingTrials(timing.frameBudget, limits);
  return timing;
}

export function readDeviceReuse({ groupId, root, tree, receipt, directory }) {
  assert.equal(receipt.tree, tree);
  assert.equal(git(root, 'rev-parse', '--verify', receipt.commit + '^{tree}'), tree);
  const folder = evidenceRoot(directory, receipt.id, groupId);
  assert.equal(realpathSync(folder), join(realpathSync(directory), 'attempts', receipt.id + '-evidence', 'app-build', platform(groupId)));
  const proof = join(folder, 'build.json');
  assert.ok(lstatSync(proof).isFile());
  const raw = readFileSync(proof);
  const row = receipt.suites.find(item => item.name === groupId);
  assert.equal(hash(raw), row?.buildEvidenceSha256);
  const saved = JSON.parse(raw);
  assert.deepEqual([saved.schema, saved.attemptId, saved.groupId, saved.tree, saved.commit], [1, receipt.id, groupId, tree, receipt.commit]);
  assert.equal(saved.lockSha256, hash(execFileSync('git', ['show', tree + ':package-lock.json'], { cwd: root })));
  const app = join(folder, pathFor(groupId));
  assert.equal(realpathSync(app), join(realpathSync(folder), pathFor(groupId)));
  const appManifests = identities(groupId, app);
  assert.deepEqual(appManifests, saved.appManifests);
  // Resolve Android's installed image against the profile from the merge tree.
  const probe = mkdtempSync(join(tmpdir(), 'uld-landing-images-'));
  try {
    mkdirSync(join(probe, 'tests/android'), { recursive: true });
    writeFileSync(join(probe, 'tests/android/profiles.json'), git(root, 'show', tree + ':tests/android/profiles.json'));
    const current = deviceImage(groupId, probe);
    assert.deepEqual(current, saved.deviceImage, 'The selected device image changed since qualification');
    return { appManifests, deviceImage: current };
  } finally { rmSync(probe, { recursive: true, force: true }); }
}
