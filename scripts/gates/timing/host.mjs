import { execFileSync } from 'node:child_process';
import { vmState } from '../linux-vm.mjs';
import { currentMeasurement } from '../../workers/timing-reservation.mjs';
import { profileImagePackage } from '../../../tests/android/emulator.mjs';

const run = (bin, args) => execFileSync(bin, args, { encoding: 'utf8' }).trim();

export function hostMismatch(reference, facts) {
  for (const key of ['systemImage', 'fingerprint', 'hostGpu']) {
    if (!reference?.[key] || reference[key] !== facts?.[key]) return 'Wrong timing host: ' + key;
  }
  if (!facts.reservation) return 'Missing exclusive timing reservation';
  if (facts.vm !== 'stopped') return 'The Linux VM is active';
  if (facts.bootedSimulators?.length !== 0) return 'An iPhone simulator is active';
  if (facts.otherJobs?.length !== 0) return 'A browser or build is active';
  return null;
}

export function hostFacts(root, profile, device) {
  const displays = JSON.parse(run('/usr/sbin/system_profiler', ['SPDisplaysDataType', '-json']));
  const booted = JSON.parse(run('xcrun', ['simctl', 'list', 'devices', 'booted', '-j']));
  const jobs = run('ps', ['-A', '-o', 'pid=,comm=,args=']).split('\n');
  const executables = /\/Contents\/MacOS\/(?:Google Chrome|Firefox|Safari)(?:\s|$)|\/ms-playwright\/[^ ]+\/(?:[^ ]*\/)*(?:chrome|firefox|headless_shell|MiniBrowser)(?:\s|$)|\/(?:clang\+\+|clang|swift-frontend|xcodebuild|ninja|esbuild|hermesc)(?:\s|$)|\/node_modules\/(?:typescript\/bin\/tsc|storybook\/bin\/index\.cjs build|@playwright\/test\/cli\.js test)\b|\borg\.gradle\.wrapper\.GradleWrapperMain\b/;
  return { systemImage: profileImagePackage(profile), fingerprint: device('shell', 'getprop', 'ro.build.fingerprint'),
    hostGpu: displays.SPDisplaysDataType?.map(entry => entry.sppci_model).join(', '),
    vm: vmState(), bootedSimulators: Object.values(booted.devices).flat().map(row => row.udid),
    reservation: currentMeasurement(root), otherJobs: jobs.filter(line => executables.test(line)).map(line => line.trim().split(/\s+/)[0]) };
}
