// Run one trusted suite against an immutable prefix. This diagnostic never
// publishes a qualification receipt or a reusable group result.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTypedInputs, requireTypedControls } from './typed-tools.mjs';
import { runShard } from './cloud/shard.mjs';
import { browserMatrix } from '../../packages/policy/quality/browser-matrix.mjs';
import { verifyCandidatePassed } from '../../packages/policy/quality/api-depth/evidence.mjs';
import { runMacPerformance } from './mac-performance.mjs';
import { linuxBrowsers, stopVm } from './linux-vm.mjs';
import { proposalDevices, proposalScope } from '../selection/proposal-devices.mjs';
import { withLock } from '../workers/lock.mjs';
import { withTiming, usingSimulator, shutdownSimulators } from '../workers/resource-guard.mjs';

const [root, base, commit, suite] = process.argv.slice(2);
const control = file => fileURLToPath(new URL('../../' + file, import.meta.url));
const node = (...args) => execFileSync(process.execPath, args, { stdio: 'inherit' });
const read = file => JSON.parse(readFileSync(file));
const tree = execFileSync('git', ['rev-parse', commit + '^{tree}'], { cwd: root, encoding: 'utf8' }).trim();
assert.equal(execFileSync('git', ['rev-parse','HEAD^{tree}'], { encoding:'utf8' }).trim(), tree);
const devicePlan = proposalDevices(root, base, tree);
const scope = proposalScope(root, base, tree, devicePlan);
writeFileSync('.git/local-device-scope.json', JSON.stringify(scope));
const buildCatalog = () => runShard({suite:'Catalog build'}, base, commit);
const buildPackages = () => {
  requireTypedControls(process.cwd(), base, commit);
  buildTypedInputs();
  node(control('scripts/verify-artifacts.mjs'), '--built-snapshot');
};
const web = ['Mac browser behavior','Mac visual comparisons'];
async function executeSuite() {
  if (web.includes(suite)) {
    await withTiming('activity', suite, async () => {
      await buildCatalog();
      if (suite === 'Mac visual comparisons') {
        browserMatrix('tests/acceptance/visual-matrix.json', 'tests/browser/motion.visual.config.ts');
      } else {
        const path = 'tests/acceptance/browser-matrix.json';
        browserMatrix(path);
        const { cases, projects } = read(path);
        verifyCandidatePassed('browser', cases, projects);
      }
    });
  } else if (suite === 'Linux browser behavior') {
    await withTiming('activity', suite, () => linuxBrowsers(root, commit, () => {}));
  } else if (suite === 'Mac browser performance') {
    await withTiming('activity', 'Build timing catalog', buildCatalog);
    await usingSimulator(suite, async () => {
      await stopVm();
      shutdownSimulators();
      runMacPerformance(root, base, commit);
    });
  } else if (['Android standard and low-end','iPhone Simulator'].includes(suite)) {
    const iphone = suite === 'iPhone Simulator';
    if (iphone && !scope.iphone) {
      console.log(suite, devicePlan.reason);
    } else {
      await withTiming('activity', 'Prepare device packages', buildPackages);
      await stopVm();
      await withLock(root, 'simulator', 'Train diagnostic ' + tree, () => {
        node(control(iphone ? 'scripts/verify-ios-simulator.mjs' : 'scripts/verify-android-emulator.mjs'), 'release/evidence');
        const report = read(join('release/evidence', iphone ? 'ios-simulator.json' : 'android-emulator.json'));
        assert.equal(report.passed, true);
        if (!iphone) assert.deepEqual(report.profiles.map(p => p.id).sort(), ['low-end','standard']);
      });
    }
  } else {
    await withTiming('activity', suite, () => runShard({suite}, base, commit));
  }
}

const usesDevice = ['Linux browser behavior', 'Mac browser performance', 'Android standard and low-end', 'iPhone Simulator'].includes(suite);
if (suite === 'Android standard and low-end' && !devicePlan.run) console.log(suite, devicePlan.reason);
else if (usesDevice) await withLock(root, 'integration', 'Train diagnostic ' + suite, executeSuite);
else await executeSuite();
