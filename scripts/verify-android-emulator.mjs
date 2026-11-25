import { inCommandGroup } from './workers/isolated-command.mjs';
import { usingSimulator, shutdownSimulators } from './workers/resource-guard.mjs';
import { stopVm } from './gates/linux-vm.mjs';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { androidTiming } from './gates/android-timing-reuse.mjs';
import { checkFlow } from './verify-ios-simulator.mjs';
import { selectNativeScenarios } from './selection/native-scenarios.mjs';
import { withMaestroSession } from '../tests/simulator/maestro-session.mjs';
import { androidWindow } from '../tests/simulator/window-ready.mjs';
import { runNativeScenarios } from '../tests/simulator/scenarios.mjs';
import { androidTools, config, withEmulator } from '../tests/android/emulator.mjs';
import { androidMaestro } from '../tests/android/maestro.mjs';
import { appId, preparePackedApk } from '../tests/android/host.mjs';
import { accessibilityNodes, bounds, target } from '../tests/android/tree.mjs';
import { androidTree, verifyAndroidInteraction } from '../tests/android/interaction.mjs';
import { measureFrameBudget } from '../tests/android/frame-budget.mjs';
import { requireBothProfiles, requireCompletedProfiles } from '../tests/android/qualification.mjs';
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

async function qualify() {
  mkdirSync(evidence, { recursive: true });
  rmSync(report, { force: true });
  requireBothProfiles(config.profiles);
  const flows = readdirSync(join(root, 'tests/simulator'))
    .filter((file) => file.endsWith('.yaml'))
    .sort();
  const roster = readCandidateScenarios(root);
  const neutralIds = selectNativeScenarios(root, roster).map(scenario => scenario.id);
  const budgets = JSON.parse(readFileSync(join(root, 'tests/android/low-end-budget.json'), 'utf8'));
  {
    const { executable: maestro, env: driverEnv } = await androidMaestro(tools.env);
    const { apk, archives, host } = await preparePackedApk(root, evidence, tools, reports);
    const profiles = [];
    for (const profile of config.profiles) {
      const dir = join(reports, profile.id);
      await withEmulator(profile, tools, dir, async ({ serial, name, device }) => {
        const hardware = verifyHardware(device, profile);
        writeFileSync(join(dir, 'device.json'), JSON.stringify({ id: profile.id, name, hardware }));
        device('install', '-r', apk);
        device('shell', 'settings', 'put', 'secure', 'show_ime_with_hard_keyboard', '1');
        const env = {
          ...driverEnv,
          ANDROID_SERIAL: serial,
        };
        // Measure before the automation instrumentation starts and owns Android's accessibility connection.
        device('shell', 'cmd', 'uimode', 'night', 'no');
        device('shell', 'settings', 'put', 'system', 'font_scale', '1.0');
        const interaction = await verifyAndroidInteraction({
          device,
          serial,
          tools,
          reports: dir,
          profile,
        });
        let frameBudget;
        if (profile.id === 'low-end') {
          const timing = await androidTiming({ apk, root, common: process.env.ULD_ARTIFACT_COMMON, limits: budgets.limits,
            measure: async () => {
              await stopVm();
              shutdownSimulators();
              return measureFrameBudget({ device, tree: () => androidTree(device).nodes, reports: dir });
            } });
          frameBudget = timing.frameBudget;
          writeFileSync(join(dir, 'timing-source.json'), JSON.stringify(timing, null, 2) + '\n');
          console.log(timing.result, timing.apkSha256, timing.sourceReceipt ?? '');
        }
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
            hardware,
            passed,
            scenarioIds,
            interaction,
            frameBudget,
          });
        });
      });
    }
    requireCompletedProfiles(profiles, flows, roster.map(scenario => scenario.id), budgets.limits, neutralIds);
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
}
await inCommandGroup(() => usingSimulator('Android emulator', qualify), true);
