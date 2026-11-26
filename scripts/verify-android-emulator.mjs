import { inCommandGroup } from './workers/isolated-command.mjs';
import { usingSimulator, shutdownSimulators, usingFunctionalDevice } from './workers/resource-guard.mjs';
import { stopVm } from './gates/linux-vm.mjs';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { measureAdmitted, observedIdentity } from './gates/android-host-activity.mjs';
import { androidTiming, apkIdentity } from './gates/android-timing-reuse.mjs';
import { checkFlow } from './verify-ios-simulator.mjs';
import { selectNativeScenarios } from './selection/native-scenarios.mjs';
import { withMaestroSession } from '../tests/simulator/maestro-session.mjs';
import { androidWindow } from '../tests/simulator/window-ready.mjs';
import { runNativeScenarios } from '../tests/simulator/scenarios.mjs';
import { androidTools, config, requireManagedEmulator, withEmulator } from '../tests/android/emulator.mjs';
import { androidMaestro } from '../tests/android/maestro.mjs';
import { appId, preparePackedApk } from '../tests/android/host.mjs';
import { accessibilityNodes, bounds, target } from '../tests/android/tree.mjs';
import { androidTree, verifyAndroidInteraction } from '../tests/android/interaction.mjs';
import { measureFrameBudget } from '../tests/android/frame-budget.mjs';
import { requireBothProfiles, requireCompletedProfiles } from '../tests/android/qualification.mjs';
import { joinAndroidTiming, readAndroidFunctional, recordAndroidFunctional, requireTimingDevice, runAndroidProfilePhase } from '../tests/android/split-qualification.mjs';
import { readCandidateScenarios } from './scenarios/fixture-metadata.mjs';

const root = process.cwd();
const evidence = resolve(process.argv[2] || 'release/evidence');
const report = join(evidence, 'android-emulator.json');
const reports = join(root, 'test-results/android-emulator');
const tools = androidTools();
function verifyHardware(device, profile) {
  const size = device('shell', 'wm', 'size');
  const density = device('shell', 'wm', 'density');
  assert.equal(size, 'Physical size: ' + profile.width + 'x' + profile.height);
  assert.equal(density, 'Physical density: ' + profile.density);
  assert.equal(
    device('shell', 'cat', '/sys/devices/system/cpu/possible'),
    '0-' + (profile.cores - 1),
  );
  const memKiB = Number(
    device('shell', 'cat', '/proc/meminfo').match(/^MemTotal:\s+(\d+) kB/m)?.[1],
  );
  assert.ok(memKiB / 1024 > profile.ramMiB * 0.85 && memKiB / 1024 <= profile.ramMiB);
  const appHeap = device('shell', 'getprop', 'dalvik.vm.heapgrowthlimit');
  if (profile.id === 'low-end')
    assert.ok(/^\d+m$/.test(appHeap) && parseInt(appHeap, 10) <= 192, 'Expected a small app heap');
  return {
    size,
    density,
    cores: profile.cores,
    memKiB,
    appHeap,
    fingerprint: device('shell', 'getprop', 'ro.build.fingerprint'),
    release: device('shell', 'getprop', 'ro.build.version.release'),
    sdk: device('shell', 'getprop', 'ro.build.version.sdk'),
  };
}

export async function prepareAndroidProfile({ profile, apk, dir, serial, name, device, tools }) {
  requireManagedEmulator(profile, name, serial);
  const hardware = verifyHardware(device, profile);
  writeFileSync(join(dir, 'device.json'), JSON.stringify({ id: profile.id, name, hardware, serial }));
  device('install', '-r', apk);
  device('shell', 'settings', 'put', 'secure', 'show_ime_with_hard_keyboard', '1');
  device('shell', 'cmd', 'uimode', 'night', 'no');
  device('shell', 'settings', 'put', 'system', 'font_scale', '1.0');
  // This runs before Maestro opens Android's accessibility connection.
  const interaction = await verifyAndroidInteraction({ device, serial, tools, reports: dir, profile });
  return { hardware, interaction };
}

function startQualification() {
  mkdirSync(evidence, { recursive: true });
  rmSync(report, { force: true });
  requireBothProfiles(config.profiles);
  const flows = readdirSync(join(root, 'tests/simulator'))
    .filter((file) => file.endsWith('.yaml'))
    .sort();
  const roster = readCandidateScenarios(root);
  const neutralIds = selectNativeScenarios(root, roster).map(scenario => scenario.id);
  const budgets = JSON.parse(readFileSync(join(root, 'tests/android/low-end-budget.json'), 'utf8'));
  return { flows, roster, neutralIds, budgets };
}

async function measureLowEnd(apk, device, dir, budgets, emulator) {
  const timing = await androidTiming({ apk, root, common: emulator || process.env.ULD_FRESH_ANDROID_TIMING === '1' ? undefined : process.env.ULD_ARTIFACT_COMMON, limits: budgets.limits,
    measure: async (identity) => {
      await stopVm();
      shutdownSimulators();
      const common=process.env.ULD_ARTIFACT_COMMON;
      const observed = observedIdentity(root, common, identity);
      if (emulator) observed.emulator = emulator;
      return measureAdmitted({reports:dir,identity:observed,common,limits:budgets.limits,
        measure:reports=>measureFrameBudget({device,tree:()=>androidTree(device).nodes,reports})});
    } });
  if(timing.result==='timing measured') timing.admission=JSON.parse(readFileSync(join(dir,'timing-admission.json'),'utf8'));
  return timing;
}

function recordTiming(dir, timing) {
  writeFileSync(join(dir, 'timing-source.json'), JSON.stringify(timing, null, 2) + '\n');
  console.log(timing.result, timing.apkSha256, timing.sourceReceipt ?? '');
}

function publishReport(profiles, host, archives) {
  writeFileSync(
    report,
    JSON.stringify(
      {
        passed: true,
        failed: 0,
        skipped: 0,
        profiles,
        host,
        archives: archives.map(({ name, sha256 }) => ({ name, sha256 })),
      },
      null,
      2,
    ) + '\n',
  );
}

async function qualifyTiming() {
  const { flows, roster, neutralIds, budgets } = startQualification();
  const common = process.env.ULD_ARTIFACT_COMMON;
  const apk = join(reports, 'apk/app-release.apk');
  const part = readAndroidFunctional(common, observedIdentity(root, common, apkIdentity(apk)));
  const profile = config.profiles.find(row => row.id === 'low-end');
  const dir = join(reports, profile.id), boot = join(dir, 'timing-boot');
  const { profiles, host, archives } = part;
  let timingFailure;
  await withEmulator(profile, tools, boot, async ({ serial, name, device }) => {
    const { hardware } = await prepareAndroidProfile({profile, apk, dir:boot, serial, name, device, tools});
    assert.deepEqual(hardware, profiles.find(row => row.id === 'low-end').hardware,
      'Low-end hardware changed between Android phases');
    const emulator = {id:profile.id, name, serial, fingerprint:hardware.fingerprint};
    let frameBudget;
    try {
      const timing = await measureLowEnd(apk, device, dir, budgets, emulator);
      joinAndroidTiming(common, part, hardware, emulator, timing);
      recordTiming(dir, timing);
    } catch (error) {
      const measured=join(dir,'frame-measurements.json'), observed=join(dir,'timing-admission.json');
      if (!existsSync(measured) || !existsSync(observed)) throw error;
      const admission=JSON.parse(readFileSync(observed,'utf8'));
      if (admission.kind!=='primary' || admission.verdict!=='failed') throw error;
      timingFailure=error;
      frameBudget=JSON.parse(readFileSync(measured,'utf8'));
      requireTimingDevice(part, hardware, emulator, admission.identity);
      profiles.find(row => row.id === 'low-end').frameBudget = frameBudget;
      writeFileSync(join(dir,'timing-source.json'),JSON.stringify({result:'timing failed',...admission.identity,
        frameBudget,admission},null,2)+'\n');
    }
  });
  try {
    requireCompletedProfiles(profiles, flows, roster.map(scenario => scenario.id), budgets.limits, neutralIds);
  } catch (error) {
    if (error.code === 'android/frame-budget') {
      writeFileSync(join(reports, 'final-budget-failure.json'), JSON.stringify({
        error: error.message, profiles, flows, roster: roster.map(scenario => scenario.id), selected: neutralIds,
      }) + '\n');
    }
    throw error;
  }
  if (timingFailure) throw timingFailure;
  publishReport(profiles, host, archives);
}

async function qualify(phase) {
  const { flows, roster, neutralIds, budgets } = startQualification();
  const functional = phase === '--functional';
  const common = process.env.ULD_ARTIFACT_COMMON;
  const { executable: maestro, env: driverEnv } = await androidMaestro(tools.env);
  const { apk, archives, host } = await preparePackedApk(root, evidence, tools, reports);
  const splitIdentity = () => observedIdentity(root, common, apkIdentity(apk));
  const identity = functional ? splitIdentity() : null;
  const profiles = [];
  let timingFailure;
  for (const profile of config.profiles) {
    const dir = join(reports, profile.id);
    await withEmulator(profile, tools, dir, async ({ serial, name, device }) => {
      const { hardware, interaction } = await prepareAndroidProfile({ profile, apk, dir, serial, name, device, tools });
      const env = { ...driverEnv, ANDROID_SERIAL: serial };
      let frameBudget, measure;
      if (profile.id === 'low-end') {
        measure = async () => {
          try {
            const timing = await measureLowEnd(apk, device, dir, budgets);
            frameBudget = timing.frameBudget;
            recordTiming(dir, timing);
          } catch (error) {
            const measured=join(dir,'frame-measurements.json'), observed=join(dir,'timing-admission.json');
            if (!existsSync(measured) || !existsSync(observed)) throw error;
            const admission=JSON.parse(readFileSync(observed,'utf8'));
            if (admission.kind!=='primary' || admission.verdict!=='failed') throw error;
            // Complete the functional scenarios against this app and retain the original failed trials.
            timingFailure=error;
            frameBudget=JSON.parse(readFileSync(measured,'utf8'));
            writeFileSync(join(dir,'timing-source.json'),JSON.stringify({result:'timing failed',...admission.identity,
              frameBudget,admission},null,2)+'\n');
          }
        };
      }
      await runAndroidProfilePhase(phase, measure);
      const reset = () => androidWindow(device, appId);
      reset();
      withMaestroSession({ device: serial, platform: 'android', maestro, env, reports: dir }, (run, { androidXML }) => {
        const readAndroidTree = () => accessibilityNodes(androidXML());
        const passed = [];
        for (const appearance of ['light', 'dark']) {
          device('shell', 'cmd', 'uimode', 'night', appearance === 'light' ? 'no' : 'yes');
          device(
            'shell',
            'settings',
            'put',
            'system',
            'font_scale',
            appearance === 'light' ? '1.0' : '2.0',
          );
          for (const file of flows.filter((file) =>
            appearance === 'light'
              ? file !== 'typography-largest.yaml'
              : ['appearance.yaml', 'typography-largest.yaml'].includes(file),
          )) {
            const flow = file.slice(0, -5);
            const filePath = existsSync(join(root, 'tests/android', file))
              ? join(root, 'tests/android', file)
              : join(root, 'tests/simulator', file);
            const id = flow + '-' + appearance;
            reset();
            const xml = join(dir, id + '.xml');
            rmSync(xml, { force: true });
            run(
              root,
              maestro,
              [
                '--device',
                serial,
                'test',
                '--format',
                'JUNIT',
                '--output',
                xml,
                '--test-output-dir',
                dir,
                '--debug-output',
                join(dir, id),
                '-e',
                'APP_ID=' + appId,
                '-e',
                'APPEARANCE=' + (appearance === 'light' ? 'Light' : 'Dark'),
                '-e',
                'TEXT_SCALE=' + (appearance === 'light' ? 'Standard' : 'Enlarged'),
                filePath,
              ],
              { env, stdio: 'inherit' },
            );
            checkFlow(readFileSync(xml, 'utf8'));
            if (flow === 'native-motion-engine') {
              const item = target(
                readAndroidTree(),
                'scenario.button.Play Shared element preview',
                { role: 'Button', name: 'Play Shared element preview' },
              );
              const { x, y, right, bottom } = bounds(item);
              const densityScale = profile.density / 160;
              const token = JSON.parse(
                readFileSync(join(root, 'packages/tokens/domains/density.json'), 'utf8'),
              ).density.coarseTarget.$value.value;
              assert.ok(
                (right - x) / densityScale >= token && (bottom - y) / densityScale >= token,
                'Gesture target is smaller than ' + token + ' dp',
              );
              writeFileSync(
                join(dir, 'motion-target.json'),
                JSON.stringify({
                  widthDp: (right - x) / densityScale,
                  heightDp: (bottom - y) / densityScale,
                  minimumDp: token,
                }) + '\n',
              );
            }
            passed.push(id);
          }
        }
        device('shell', 'cmd', 'uimode', 'night', 'no');
        device('shell', 'settings', 'put', 'system', 'font_scale', '1.0');
        const scenarioIds = runNativeScenarios({
          root,
          appId,
          maestro,
          device: serial,
          platform: 'android',
          readAndroidTree,
          reset,
          env,
          run,
          reports: dir,
        });
        profiles.push({
          id: profile.id,
          name,
          serial,
          hardware,
          passed,
          scenarioIds,
          interaction,
          frameBudget,
        });
      });
    });
  }
  const publish = () => {
    try {
      requireCompletedProfiles(profiles, flows, roster.map(scenario => scenario.id), budgets.limits, neutralIds);
    } catch (error) {
      if (error.code === 'android/frame-budget') {
        writeFileSync(join(reports, 'final-budget-failure.json'), JSON.stringify({
          error: error.message, profiles, flows, roster: roster.map(scenario => scenario.id), selected: neutralIds,
        }) + '\n');
      }
      throw error;
    }
    if (timingFailure) throw timingFailure;
    publishReport(profiles, host, archives);
  };
  if (functional) {
    assert.deepEqual(splitIdentity(), identity, 'Android APK changed while functional scenarios ran');
    recordAndroidFunctional(common, identity, profiles, host, archives, flows, neutralIds);
  } else publish();
}
if (import.meta.main) {
  const phase = process.argv[3];
  assert.ok(!process.argv[2]?.startsWith('--') && [undefined, '--functional', '--timing'].includes(phase) && process.argv.length <= 4,
    'Expected [evidence directory] [--functional|--timing]');
  await inCommandGroup(() => phase === '--functional'
    ? usingFunctionalDevice('android', 'Android functional scenarios', () => qualify(phase))
    : usingSimulator('Android emulator', phase === '--timing' ? qualifyTiming : () => qualify(phase)), true);
}
