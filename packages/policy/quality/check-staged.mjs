import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { familyInputs, familyInputsAt, comparisonBase } from '../../../scripts/manifests/bundle-parent.mjs';
import { verifyFirstAdoptionSources } from '../../../scripts/manifests/reviewed-bundle-budgets.mjs';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { simulatorRequired } from './simulator-scope.mjs';
import { withStagedSnapshot } from './staged-tree.mjs';
import { installSnapshotDependencies } from './snapshot-dependencies.mjs';

const entry = 'packages/policy/quality/check-staged.mjs';
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));

// Only the private candidate process publishes completed suites to its caller.
const passedSuites = import.meta.main && process.argv[2] === 'candidate' ? [] : null;


function run(command, args, cwd = process.cwd(), env = process.env) {
  console.log('$ ' + [command, ...args].join(' '));
  execFileSync(command, args, { cwd, env, stdio: 'inherit' });
  if (passedSuites) {
    if (command === 'npm' && args[0] === 'install') passedSuites.push('npm install packed consumer');
    else if (command === process.execPath && args[0] === 'scripts/verify-artifacts.mjs' && args[1] === '--built-snapshot')
      passedSuites.push('node scripts/verify-artifacts.mjs');
    else passedSuites.push([command === process.execPath ? 'node' : command, ...args].join(' '));
  }
}

function testSnapshot(snapshot, nativeRequired, env, { root, mode, tree, gitEnv }) {
  assert.ok(existsSync(join(snapshot, 'package-lock.json')), 'Staged gate requires package-lock.json');
  assert.equal(json(join(snapshot, 'package.json')).name, 'ui-lazy-dev', 'Expected staged library');
  const currentFamilies = familyInputs(snapshot);
  const budgetBase = comparisonBase(root, mode === 'commit' ? 'staged' : 'release', env);
  verifyFirstAdoptionSources(familyInputsAt(root, budgetBase, currentFamilies), currentFamilies, path => {
    const file = join(snapshot, path);
    return lstatSync(file).isFile() ? createHash('sha256').update(readFileSync(file)).digest('hex') : undefined;
  });
  const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'],
    { cwd: root, env: gitEnv, encoding: 'utf8' }).trim();
  installSnapshotDependencies(snapshot, join(common, 'uld-dependencies'), env);
  // Packed archives and the iPhone app are reused when their inputs are unchanged.
  env = { ...env, ULD_ARTIFACT_COMMON: common };
  const selection = mode === 'commit'
    ? JSON.parse(execFileSync(process.execPath, [join(snapshot, 'scripts/selection/select.mjs')], {
        cwd: root, env: gitEnv, encoding: 'utf8',
      }))
    : { tier: 2, tree, simulator: true, reasons: ['Full suite for ' + mode] };
  if (selection.tree) assert.equal(selection.tree, tree, 'Index changed after taking the snapshot');
  // A commit runs the device checks only when it touches mobile code. Full runs always do.
  if (nativeRequired || mode !== 'commit') selection.simulator = true;
  selection.exactOutputs = mode !== 'commit';
  selection.budgetComparisonBase = budgetBase;
  console.log(JSON.stringify(selection, null, 2));
  writeFileSync(join(snapshot, '.git', 'gate-selection.json'), JSON.stringify(selection));
  run(process.execPath, [entry, 'candidate', root], snapshot, env);
}

export async function checkNewBudgets(root, trusted, measurements) {
  const path = 'tests/packaging/bundle-baseline.json';
  const incumbent = file => JSON.parse(execFileSync('git', ['show', trusted + ':' + file], { cwd: root }));
  const registry = 'packages/policy/quality/api-depth/families.json';
  const { checkInitialBudgets, checkPublicBudgets } = await import('../../../scripts/manifests/product-registrations.mjs');
  const limits = json(path);
  checkPublicBudgets(incumbent(registry), json(registry), limits);
  checkInitialBudgets(incumbent(path), limits, measurements);
}

async function qualifyCandidate(root) {
  const { withIntegrationGate, withLock } = await import('../../../scripts/workers/lock.mjs');
  const selection = json('.git/gate-selection.json');
  const holder = 'gate in ' + root;
  async function checks() {
    if (selection.exactOutputs) run(process.execPath, ['scripts/manifests/generate.mjs', '--check']);
    if (selection.changed?.some(path => path.startsWith('manifests/'))) {
      const { materializeCommitOutputs } = await import('../../../scripts/manifests/generate.mjs');
      // A restored registration belongs to the old judge. Regenerate it from
      // the combined family inputs with that judge's generator. Only the exact
      // candidate key may certify the checked-in output.
      const restored = new Set(selection.restored ?? []);
      materializeCommitOutputs(process.cwd(), selection.changed.filter(path => !restored.has(path)));
    }
    const checkSimulator = selection.simulator
      ? () => withLock(root, 'simulator', holder, () =>
        run(process.execPath, ['scripts/verify-ios-simulator.mjs']))
      : undefined;
    if (!checkSimulator) console.log('iPhone Simulator skipped by the staged path rule.');
    if (selection.tier === 2 || selection.productLanding) {
      await sharedChecks({
        checkSimulator,
        checkBudgets: async () => {
          if (selection.trustedTree)
            await checkNewBudgets(root, selection.trustedTree, json('release/evidence/bundles.json'));
          const { verifyPackedCeiling } = await import('./size-ceiling.mjs');
          verifyPackedCeiling(process.cwd());
          passedSuites?.push('packed default bundle ceiling');
        },
      });
    } else {
      const { checkFamilies } = await import('./check-families.mjs');
      await checkFamilies(selection);
      passedSuites?.push('affected family suites');
      if (checkSimulator) await checkSimulator();
    }
  }
  if (selection.tier === 2) await withIntegrationGate(root, holder, checks);
  else await checks();
}

export function checkStaged(root, mode, check = testSnapshot, env = process.env) {
  const tree = execFileSync('git', ['write-tree'], { cwd: root, env, encoding: 'utf8' }).trim();
  const required = simulatorRequired(root, tree, mode, env);
  return withStagedSnapshot(root, (cwd, actual, childEnv) => {
    assert.equal(actual, tree, 'Index changed after selecting the simulator scope');
    return check(cwd, required, childEnv, { root, mode, tree, gitEnv: env });
  }, env);
}

export function pushedRevisions(input) {
  const commits = new Set();
  for (const line of input.trim().split('\n').filter(Boolean)) {
    const fields = line.trim().split(/\s+/);
    assert.equal(fields.length, 4, 'Expected a local ref, local object, remote ref and remote object');
    const [, local, , remote] = fields;
    const objectId = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
    assert.match(local, objectId, 'Invalid local push object ID');
    assert.match(remote, objectId, 'Invalid remote push object ID');
    if (!/^0+$/.test(local)) commits.add(local);
  }
  return [...commits];
}

export async function packedDepth() {
  const { verifyPackedDepth } = await import('./api-depth/run-depth.mjs');
  const { auditComponentSpecs } = await import('./specs/validate.mjs');
  const { packedRegistrations } = await import('./api-depth/packed-registrations.mjs');
  const inputs = packedRegistrations(process.cwd());
  const consumer = resolve('release/depth-consumer');
  mkdirSync(consumer, { recursive: true });
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ name: 'packed-depth-consumer', private: true }));
  const archives = json('release/evidence/provenance.json').packages;
  for (const name of ['@ui-lazy-dev/tokens', '@ui-lazy-dev/ui-web', '@ui-lazy-dev/ui-native'])
    assert.ok(archives.some(pkg => pkg.name === name), 'Missing packed ' + name);
  // The consumer installs the three tarballs. Its locked test tools and peers resolve
  // from the enclosing snapshot's node_modules, installed by npm ci.
  run('npm', ['install', '--prefer-offline', '--legacy-peer-deps', '--workspaces=false', '--ignore-scripts',
    '--no-audit', '--no-fund', ...archives.map(pkg => resolve('release/evidence', pkg.filename))], consumer);
  for (const { name } of archives) {
    const path = join(consumer, 'node_modules', name);
    assert.equal(realpathSync(path), join(realpathSync(consumer), 'node_modules', name), 'Linked package ' + name);
  }
  const specs = auditComponentSpecs({ consumer, families: inputs.published });
  console.log('Packed component specs:', specs.total, 'families', specs.stats, 'violations:', specs.failureCount);
  if (specs.failureCount) {
    for (const { family, code, message } of specs.issues) console.error(`${family} [${code}] ${message}`);
    throw new Error(`Component spec validation failed for ${specs.failingFamilies} families`);
  }
  console.log('Packed family checks:', await verifyPackedDepth(consumer, inputs));
  return consumer;
}

// Only enter this stage after the shared build and packed dependencies succeed.
export async function runIndependentSuites(suites) {
  const failures = [];
  for (const [label, check] of suites) {
    const start = Date.now();
    try {
      await check();
      console.log('Completed', label, 'in', Date.now() - start, 'ms');
    } catch (cause) {
      console.error('Failed', label, 'after', Date.now() - start, 'ms:', cause.message);
      failures.push(new Error(label, { cause }));
    }
  }
  if (failures.length)
    throw new AggregateError(failures, 'Failed required suites: ' + failures.map(error => error.message).join(', '));
}

async function sharedChecks({ checkBudgets, checkSimulator } = {}) {
  const { browserMatrix, scenarioMatrix } = await import('./browser-matrix.mjs');
  const node = (...args) => run(process.execPath, args);
  const npm = (script) => run('npm', ['run', script]);
  node('packages/policy/cli.mjs', 'check', '--config', 'ui-policy.json');
  node('packages/style-policy/cli.mjs', '--profile', 'library', '--root', '.', '--prove');
  node('packages/policy/quality/integrity.mjs');
  npm('build');
  npm('typecheck');
  npm('check:api');
  node('packages/tokens/build.mjs', '--check');
  node('scripts/unit-matrix.mjs');
  node('scripts/inventory.mjs');
  node('scripts/manifests/generate.mjs', '--check');
  node('scripts/verify-artifacts.mjs', '--built-snapshot');
  node('scripts/verify-version.mjs');
  node('scripts/verify-inventory.mjs');
  const { verifyPassed } = await import('./api-depth/evidence.mjs');
  const manifest = json('tests/acceptance/browser-matrix.json');
  const suites = [
    ['packed family contracts', packedDepth],
    ['minimum-version consumer', () => node('scripts/verify-consumers.mjs', 'release/evidence', 'min')],
    ['maximum-version consumer', () => node('scripts/verify-consumers.mjs', 'release/evidence', 'max')],
    ...(checkBudgets ? [['packed bundle limits', checkBudgets]] : []),
    ['portable web scenarios', () => { scenarioMatrix(); passedSuites?.push('complete web scenario matrix'); }],
    ['browser behavior', () => {
      browserMatrix('tests/acceptance/browser-matrix.json');
      verifyPassed('browser', manifest.cases, manifest.projects);
      passedSuites?.push('complete browser matrix and family behavior');
    }],
    ['visual checks', () => {
      browserMatrix('tests/acceptance/visual-matrix.json', 'tests/browser/motion.visual.config.ts');
      passedSuites?.push('complete visual matrix');
    }],
    ['scoped styles', () => node('tests/browser/quality-style-scope.mjs')],
    ['browser performance', () => node('tests/browser/quality-perf.mjs')],
    ['native package consumer', () => node('scripts/verify-native-consumer.mjs', 'release/evidence')],
  ];
  if (checkSimulator) suites.push(['iPhone Simulator', checkSimulator]);
  await runIndependentSuites(suites);
}

if (import.meta.main) {
  const mode = process.argv[2] || 'commit';
  if (mode === 'candidate') {
    await qualifyCandidate(process.argv[3]);
    assert.ok(passedSuites.length, 'The selected candidate completed no suites');
  }
  // A commit checks the staged change. A full run checks the committed tree, devices included.
  else if (mode === 'commit') run(process.execPath, ['scripts/qualify.mjs', '--staged']);
  else if (mode === 'full') run(process.execPath, ['scripts/qualify.mjs', '--release']);
  else throw Error('Unknown check mode ' + mode);
}
