// Cheap checks that must pass on the exact commit before a qualification run starts.
// Usage: node scripts/verify-preflight.mjs [<commit>] --branch <proposal branch> [--base <integration commit>]
import { withPreflightActivity } from './workers/resource-guard.mjs';
import { gateGroup, observePreflightStage, typedGroup } from './gates/reuse/preflight.mjs';
import { sealReceipt } from './gates/reuse/runner.mjs';
import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, globSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { withRevisionSnapshot } from '../packages/policy/quality/staged-tree.mjs';
import { installSnapshotDependencies } from '../packages/policy/quality/snapshot-dependencies.mjs';
import { preflightChecks, preflightRunner, writePreflightReceipt } from './gates/preflight-receipt.mjs';

const integration = 'feat/enterprise-ui';
const proposalBranch = /^(?:family|gates|docs)\/[a-z0-9][a-z0-9-]*$/;
const git = (root, ...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 128 << 20 }).trim();
const fromTrusted = (ctx, path) => import(pathToFileURL(join(ctx.trusted, path)).href);
const short = id => id.slice(0, 12);

// Stream a command and keep the end of its output for the receipt.
function run(ctx, command, args, cwd = ctx.snapshot) {
  const label = [command, ...args].join(' ');
  console.log('$ ' + label);
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: ctx.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let tail = '';
    const keep = (stream, chunk) => { stream.write(chunk); tail = (tail + chunk).slice(-8000); };
    child.stdout.on('data', chunk => keep(process.stdout, chunk));
    child.stderr.on('data', chunk => keep(process.stderr, chunk));
    child.once('error', reject);
    child.once('close', (code, signal) => code === 0 ? resolve()
      : reject(Error(label.slice(0, 300) + ' failed (' + (signal ?? code) + '): ' + tail.trim().slice(-4000))));
  });
}
const node = (ctx, args, cwd) => run(ctx, process.execPath, args, cwd);

// Commits a hook would have checked, oldest first. Merge commits never ran a hook.
export function proposalCommits(root, base, commit) {
  const list = git(root, 'rev-list', '--reverse', '--no-merges', base + '..' + commit);
  return list ? list.split('\n') : [];
}

// 1. A gates/ branch touches only gate paths, and every other branch touches none.
export async function gateIsolation(ctx) {
  const { stagedDiff } = await fromTrusted(ctx, 'scripts/selection/staged-tree.mjs');
  const { requireGateIsolation } = await fromTrusted(ctx, 'scripts/gates/landing-policy.mjs');
  const paths = stagedDiff(ctx.root, { parent: ctx.base, tree: ctx.tree }).changes.map(change => change.path);
  const issues = [];
  if (!proposalBranch.test(ctx.branch)) issues.push('Branch ' + ctx.branch + ' is not a family/, gates/ or docs/ proposal branch');
  try {
    const registrationGate = 'scripts/gates/registrations.mjs';
    const derived = existsSync(join(ctx.trusted, registrationGate))
      ? (await fromTrusted(ctx, registrationGate)).derivedRegistrations(ctx.root, ctx.base, ctx.tree, ctx.branch)
      : new Set();
    requireGateIsolation(ctx.branch, paths, undefined, derived);
  } catch (error) { issues.push(error.message); }
  // The landing policy owns the definition of a gate path: alone on a product branch, it is refused.
  const gatePath = path => { try { requireGateIsolation('docs/preflight-probe', [path]); return false; } catch { return true; } };
  if (ctx.branch.startsWith('gates/')) {
    const command = ctx.branch === 'gates/train-command' && paths.length === 1 && paths[0] === 'package.json' &&
      existsSync(join(ctx.trusted, '.github/gate-review.mjs')) &&
      (await fromTrusted(ctx, '.github/gate-review.mjs')).trainEntryAdoption?.(ctx.root, ctx.base, ctx.tree);
    const product = paths.filter(path => !gatePath(path) && !command);
    if (product.length && !paths.some(gatePath)) issues.push('A gates/ branch must touch only gate paths: ' + product.join(', '));
  }
  return issues;
}

// A train retains a separate branch review for every solo and stacked proposal.
async function memberReviews(ctx, review) {
  if (!ctx.train) return review(ctx);
  const issues = [];
  for (const m of ctx.train.members) {
    const check = (base, commit, tree) => review({ ...ctx, train: undefined, branch: m.branch, base, commit, tree });
    issues.push(...await check(ctx.base, m.soloCommit, m.soloTree));
    if (m.parent !== ctx.base) issues.push(...await check(m.parent, m.commit, m.tree));
  }
  return issues;
}

// 2. Strengthen-only judgment against the integration base.
export async function integrationNoWeakening(ctx) {
  const { noWeakening } = await fromTrusted(ctx, 'scripts/gates/no-weakening.mjs');
  return noWeakening(ctx.root, ctx.base, ctx.tree, ctx.root);
}

// 3. The qualification-policy review against the integration base.
export async function policyReview(ctx) {
  const path = 'scripts/gates/review/qualification-policy.mjs';
  if (!existsSync(join(ctx.trusted, path))) return [];
  const { reviewPolicy } = await fromTrusted(ctx, path);
  return reviewPolicy(ctx.root, ctx.base, ctx.tree);
}

// 8a. The integration's commit-message hook: Conventional subject and the R1 banned word.
export async function commitMessages(ctx) {
  const hook = join(ctx.trusted, '.githooks/pre-commit');
  const scratch = mkdtempSync(join(tmpdir(), 'uld-preflight-message-'));
  const issues = [];
  try {
    for (const commit of proposalCommits(ctx.root, ctx.base, ctx.commit)) {
      const file = join(scratch, commit);
      writeFileSync(file, execFileSync('git', ['log', '-1', '--format=%B', commit], { cwd: ctx.root }));
      const result = spawnSync('sh', [hook, 'message', file], { cwd: ctx.trusted, encoding: 'utf8' });
      if (result.status !== 0) issues.push(short(commit) + ' ' + (result.stderr || result.stdout).trim());
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  return issues;
}

// 8b. The integration's code-owner rules. Product branches also take its path review.
export async function codeOwners(ctx) {
  const path = '.github/gate-review.mjs';
  if (!existsSync(join(ctx.trusted, path))) return [];
  const { gatePaths, checkRevision } = await fromTrusted(ctx, path);
  const issues = [];
  try { gatePaths(git(ctx.root, 'show', ctx.commit + ':.github/CODEOWNERS')); }
  catch (error) { issues.push('.github/CODEOWNERS: ' + error.message); }
  // The hosted review accepts gate proposals only from its own branch. Local gates/
  // branches are routed by gate isolation instead.
  if (!ctx.branch.startsWith('gates/')) {
    try { checkRevision(ctx.root, ctx.base, ctx.commit, { headBranch: ctx.branch, headRepository: 'local', repository: 'local' }); }
    catch (error) { issues.push(error.message); }
  }
  return issues;
}

// 6a. What the commit hook judges for each commit against its own parent.
export async function commitHooks(ctx) {
  const { noWeakening } = await fromTrusted(ctx, 'scripts/gates/no-weakening.mjs');
  const review = join(ctx.trusted, 'scripts/gates/review/qualification-policy.mjs');
  const { reviewPolicy } = existsSync(review) ? await import(pathToFileURL(review).href) : { reviewPolicy: () => [] };
  const baseTree = git(ctx.root, 'rev-parse', ctx.base + '^{tree}');
  const issues = [];
  for (const commit of proposalCommits(ctx.root, ctx.base, ctx.commit)) {
    const label = short(commit) + ' ';
    if (!git(ctx.root, 'ls-tree', commit, '--', 'package-lock.json')) issues.push(label + 'Staged gate requires package-lock.json');
    const parent = git(ctx.root, 'rev-parse', commit + '^');
    const tree = git(ctx.root, 'rev-parse', commit + '^{tree}');
    // The integration-base judgments already cover a single commit on the base.
    if (git(ctx.root, 'rev-parse', parent + '^{tree}') === baseTree && tree === ctx.tree) continue;
    for (const issue of [...noWeakening(ctx.root, parent, commit, ctx.root), ...reviewPolicy(ctx.root, parent, commit)])
      issues.push(label + issue);
  }
  return issues;
}

// Test files each runner discovers. The exact case lists are compared by the Typed stage.
const runnerFiles = {
  vitest: path => /^tests\/.+\.test\.tsx$/.test(path),
  native: path => /^tests\/native\/.+\.test\.cjs$|^tests\/[^/]+\/native\.test\.cjs$/.test(path),
  browser: path => /^tests\/[^/]+\/[^/]+\.spec\.ts$/.test(path),
  visual: path => /^tests\/[^/]+\/[^/]+\.visual\.ts$/.test(path),
};
const globPattern = glob => RegExp('^' + glob.split('*').map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*') + '$');

// 5a. Every gate test is registered, every runner's test file is in its matrix, and
// nothing registered is missing from the committed tree.
export function rosterFiles(ctx) {
  const files = new Set(git(ctx.root, 'ls-tree', '-r', '--name-only', '-z', ctx.commit).split('\0').filter(Boolean));
  const read = path => JSON.parse(git(ctx.root, 'show', ctx.commit + ':' + path));
  const issues = [];
  const registered = (kind, entries, file) => {
    const listed = new Set();
    for (const entry of entries) {
      const path = file(entry);
      listed.add(path);
      if (!files.has(path)) issues.push(kind + ' lists ' + path + ', which is not in the committed tree');
    }
    return listed;
  };
  const roster = read('scripts/gates/test-roster.json');
  const repeated = roster.filter((entry, index) => roster.indexOf(entry) !== index);
  if (repeated.length) issues.push('scripts/gates/test-roster.json repeats ' + repeated.join(', '));
  const gateTests = registered('scripts/gates/test-roster.json', roster, entry => entry.split(' | ')[0]);
  for (const path of files) {
    if (!path.startsWith('scripts/gates/tests/') || !path.endsWith('.test.mjs')) continue;
    if (path.slice('scripts/gates/tests/'.length).includes('/')) issues.push(path + ' is outside the gate test roster directory');
    else if (!gateTests.has(path)) issues.push(path + ' is not registered in scripts/gates/test-roster.json');
  }
  const unit = read('tests/acceptance/unit-matrix.json');
  const listed = {};
  for (const kind of ['vitest', 'native', 'node'])
    listed[kind] = registered('tests/acceptance/unit-matrix.json ' + kind, unit[kind], entry => entry.split(' | ')[0]);
  for (const kind of ['browser', 'visual'])
    listed[kind] = registered('tests/acceptance/' + kind + '-matrix.json', read('tests/acceptance/' + kind + '-matrix.json').cases,
      entry => 'tests/' + entry.split(' | ')[1]);
  // The node globs are read from the unit verdict that runs them.
  const verdict = git(ctx.root, 'show', ctx.commit + ':scripts/unit-matrix.mjs');
  const globs = /nodeCases\(\[([\s\S]*?)\]\)/.exec(verdict)?.[1].match(/'[^']+'/g)?.map(text => globPattern(text.slice(1, -1)));
  if (!globs?.length) issues.push('scripts/unit-matrix.mjs no longer names its node test files');
  const owners = { ...runnerFiles, node: path => globs?.some(pattern => pattern.test(path)) };
  for (const path of files) {
    for (const [kind, discovered] of Object.entries(owners))
      if (discovered(path) && !listed[kind].has(path)) issues.push(path + ' has no ' + kind + ' matrix entry');
  }
  return issues;
}

// 6b. The verdict the qualification command applies before the runner.
export async function firstAdoption(ctx) {
  const { familyInputs, familyInputsAt } = await fromTrusted(ctx, 'scripts/manifests/bundle-parent.mjs');
  const { verifyFirstAdoptionSources } = await fromTrusted(ctx, 'scripts/manifests/reviewed-bundle-budgets.mjs');
  const inputs = familyInputs(ctx.snapshot);
  verifyFirstAdoptionSources(familyInputsAt(ctx.root, ctx.base, inputs), inputs, path => {
    const file = join(ctx.snapshot, path);
    return lstatSync(file).isFile() ? createHash('sha256').update(readFileSync(file)).digest('hex') : undefined;
  });
  return [];
}

// 6c. The remainder of the hook's No weakening stage, using the integration's controls.
export async function hookControls(ctx) {
  const gate = file => join(ctx.trusted, 'scripts/gates', file);
  await node(ctx, [gate('canaries.mjs'), ctx.tree]);
  await node(ctx, [gate('device-scope-canaries.mjs'), ctx.tree]);
  await node(ctx, [gate('maestro-canary.mjs'), '--offline']);
  const tests = globSync('*.test.mjs', { cwd: gate('tests') }).sort();
  assert.ok(tests.includes('hardening.test.mjs'), 'The trusted gate tests are missing');
  await observePreflightStage(ctx, gateGroup,
    () => node(ctx, ['--test', '--test-concurrency=2', ...tests.map(file => gate('tests/' + file))]));
  return [];
}

// 7, 5b. The integration's stage functions on the candidate snapshot.
export async function stage(ctx, name) {
  const module = pathToFileURL(join(ctx.trusted, 'scripts/gates/fast-typed.mjs')).href;
  await node(ctx, ['--input-type=module', '-e', 'const stages = await import(' + JSON.stringify(module) + '); await stages.' + name + '();']);
  return [];
}

// 4b. The generated API tables against the packed declarations, as the packed stage reads them.
export async function apiTables(ctx) {
  const evidence = join(ctx.snapshot, 'release/evidence');
  const archives = JSON.parse(readFileSync(join(evidence, 'provenance.json'), 'utf8')).packages;
  for (const name of ['@ui-lazy-dev/tokens', '@ui-lazy-dev/ui-web', '@ui-lazy-dev/ui-native'])
    assert.ok(archives.some(pkg => pkg.name === name), 'Missing packed ' + name);
  const consumer = join(ctx.snapshot, 'release/preflight-consumer');
  mkdirSync(consumer, { recursive: true });
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ name: 'preflight-table-consumer', private: true }));
  await run(ctx, 'npm', ['install', '--prefer-offline', '--legacy-peer-deps', '--workspaces=false', '--ignore-scripts',
    '--no-audit', '--no-fund', ...archives.map(pkg => resolve(evidence, pkg.filename))], consumer);
  for (const { name } of archives)
    assert.equal(realpathSync(join(consumer, 'node_modules', name)), join(realpathSync(consumer), 'node_modules', name), 'Linked package ' + name);
  await node(ctx, ['packages/policy/quality/specs/tables.mjs', '--check', consumer]);
  return [];
}

// The runner's selection record, read by the trusted package verdicts.
export function prepareSnapshot(snapshot, base) {
  writeFileSync(join(snapshot, '.git/gate-selection.json'), JSON.stringify({ budgetComparisonBase: base }));
}

// Committed-tree checks run first and all report. Snapshot checks then stop at the first failure.
export const phases = [
  ['Gate isolation', 'branch paths', ctx => memberReviews(ctx, gateIsolation)],
  ['No weakening', 'integration base', integrationNoWeakening],
  ['Qualification policy review', 'integration base', policyReview],
  ['Banned words and owners', 'commit messages', commitMessages],
  ['Banned words and owners', 'code owners', ctx => memberReviews(ctx, codeOwners)],
  ['Commit hook on the exact tree', 'each commit against its parent', commitHooks],
  ['Roster completeness', 'registered files', rosterFiles],
  ['Generated files', 'manifests', async ctx => (await node(ctx, ['scripts/manifests/generate.mjs', '--check']), []), true],
  ['Commit hook on the exact tree', 'first budget adoption', firstAdoption, true],
  ['Fast and Typed', 'Fast', ctx => stage(ctx, 'fast'), true],
  // Sequential, as in the runner: the timing-reservation gate tests are not reliable beside a build.
  ['Commit hook on the exact tree', 'canaries and gate tests', hookControls, true],
  ['Fast and Typed', 'Typed', ctx => observePreflightStage(ctx, typedGroup, () => stage(ctx, 'typed')), true],
  ['Roster completeness', 'browser and visual rosters', ctx => stage(ctx, 'browserRosters'), true],
  ['Generated files', 'token outputs', async ctx => (await node(ctx, ['packages/tokens/build.mjs', '--check']), []), true],
  ['Generated files', 'API and spec tables', apiTables, true],
].map(([check, name, operation, snapshot = false]) => ({ check, name, operation, snapshot }));

async function runPhase(ctx, phase, checks) {
  const row = checks.find(check => check.name === phase.check);
  const start = performance.now();
  const entry = { name: phase.name, result: 'passed' };
  try {
    const issues = await phase.operation(ctx);
    if (issues.length) {
      entry.result = 'failed';
      entry.issues = issues.slice(0, 200);
      for (const issue of issues) console.error(phase.check + ' (' + phase.name + '): ' + issue);
    }
  } catch (error) {
    entry.result = 'failed';
    entry.reason = String(error.message).slice(-4500);
    console.error(phase.check + ' (' + phase.name + '): ' + entry.reason);
  }
  entry.durationMs = Math.round(performance.now() - start);
  row.durationMs += entry.durationMs;
  row.phases.push(entry);
  if (entry.result !== 'passed') row.result = 'failed';
  return entry.result === 'passed';
}

export async function runPreflight(ctx, snapshotted, selected = phases) {
  const checks = preflightChecks.map(name => ({ name, result: 'pending', durationMs: 0, phases: [] }));
  let passed = true;
  for (const phase of selected.filter(phase => !phase.snapshot)) passed = await runPhase(ctx, phase, checks) && passed;
  const later = selected.filter(phase => phase.snapshot);
  if (passed && later.length) {
    await snapshotted(async snapshot => {
      Object.assign(ctx, snapshot);
      for (const phase of later) if (!(passed = await runPhase(ctx, phase, checks))) break;
    });
  }
  for (const check of checks) {
    const pending = selected.some(phase => phase.check === check.name && !check.phases.some(entry => entry.name === phase.name));
    if (check.result === 'pending') check.result = pending ? 'blocked' : check.phases.length ? 'passed' : 'not run';
  }
  return checks;
}

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    branch: { type: 'string' }, base: { type: 'string' }, 'train-plan': { type: 'string' }, 'train-id': { type: 'string' },
  } });
  assert.equal(Boolean(values['train-id']), Boolean(values['train-plan']), 'Expected both train ID and plan');
  assert.ok(positionals.length <= 1, 'Usage: node scripts/verify-preflight.mjs [<commit>] --branch <branch> [--base <commit>]');
  const root = git(process.cwd(), 'rev-parse', '--show-toplevel');
  const common = git(root, 'rev-parse', '--path-format=absolute', '--git-common-dir');
  if (!values.base) git(root, 'fetch', '--no-tags', 'origin', '+refs/heads/' + integration + ':refs/remotes/origin/' + integration);
  const base = git(root, 'rev-parse', '--verify', '--end-of-options', (values.base ?? 'refs/remotes/origin/' + integration) + '^{commit}');
  const commit = git(root, 'rev-parse', '--verify', '--end-of-options', (positionals[0] ?? 'HEAD') + '^{commit}');
  const tree = git(root, 'rev-parse', commit + '^{tree}');
  git(root, 'merge-base', '--is-ancestor', base, commit);
  const branch = values.branch ?? git(root, 'branch', '--show-current');
  assert.ok(branch, 'Name the proposal branch with --branch');
  const runner = preflightRunner(root, base, commit);
  assert.ok(runner, 'Commit ' + commit + ' does not contain ' + 'scripts/verify-preflight.mjs');
  const own = fileURLToPath(import.meta.url);
  const ownBlob = git(root, 'hash-object', '--', own);
  const cache = join(common, 'uld-dependencies');
  const env = process.env;
  const withTrusted = check => {
    const reused = env.ULD_PREFLIGHT_TRUSTED;
    if (reused && existsSync(join(reused, 'scripts/verify-preflight.mjs')) &&
        own === realpathSync(join(reused, 'scripts/verify-preflight.mjs')) &&
        git(reused, 'rev-parse', 'HEAD^{tree}') === git(root, 'rev-parse', base + '^{tree}') &&
        git(reused, 'status', '--porcelain', '--untracked-files=all') === '')
      return check(reused);
    return withRevisionSnapshot(root, base, (trusted, _tree, trustedEnv) => {
      installSnapshotDependencies(trusted, cache, trustedEnv);
      return check(trusted);
    });
  };
  const candidate = check => withRevisionSnapshot(root, commit, (snapshot, actual, childEnv) => {
    assert.equal(actual, tree);
    installSnapshotDependencies(snapshot, cache, childEnv);
    prepareSnapshot(snapshot, base);
    return check({ snapshot, env: { ...childEnv, ULD_ARTIFACT_COMMON: common } });
  });
  return withTrusted(async trusted => {
    if (ownBlob !== runner.blob || runner.source === 'integration' && own !== realpathSync(join(trusted, 'scripts/verify-preflight.mjs'))) {
      // Only the exact integration copy, or before adoption the candidate's committed copy, may judge.
      const judge = runner.source === 'integration' ? async check => check({ snapshot: trusted }) : candidate;
      return judge(async ({ snapshot }) => {
        const result = spawnSync(process.execPath, [join(snapshot, 'scripts/verify-preflight.mjs'), commit,
          '--branch', branch, '--base', base, ...(values['train-plan'] ? ['--train-plan', values['train-plan'], '--train-id', values['train-id']] : [])], { cwd: root, stdio: 'inherit', env: { ...env, ULD_PREFLIGHT_TRUSTED: trusted } });
        process.exitCode = result.status ?? 1;
      });
    }
    const receipt = { schema: 1, kind: 'preflight', id: randomUUID(), tree, commit, base, branch,
      runner: { ...runner, path: 'scripts/verify-preflight.mjs' }, started: new Date().toISOString(), status: 'running' };
    const ctx = { root, common, base, commit, tree, branch, trusted, env: { ...env, ULD_ARTIFACT_COMMON: common } };
    if (values['train-plan']) {
      assert.equal(runner.source, 'integration');
      const { checkedPlan, requirePlanRef } = await fromTrusted(ctx, 'scripts/gates/train-plan.mjs');
      receipt.trainId = values['train-id'];
      requirePlanRef(root, receipt.trainId, values['train-plan']);
      ctx.train = await checkedPlan(root, values['train-plan'], base, commit, tree);
      receipt.trainPlan = values['train-plan'];
    }
    if (runner.source === 'integration') {
      receipt.reuseSchema = 1;
      ctx.reuseStages = receipt.reuseStages = [];
      ctx.directory = join(common, 'uld-receipts');
    }
    const start = performance.now();
    receipt.checks = await runPreflight(ctx, candidate);
    receipt.durationMs = Math.round(performance.now() - start);
    receipt.status = receipt.checks.every(check => check.result === 'passed') ? 'passed' : 'failed';
    receipt.finished = new Date().toISOString();
    if (receipt.status === 'passed' && receipt.reuseSchema === 1) sealReceipt(root, receipt);
    const path = writePreflightReceipt(common, receipt);
    if (receipt.trainId && receipt.status === 'passed') {
      const { bindTrainPreflight } = await fromTrusted(ctx, 'scripts/gates/train-plan.mjs');
      bindTrainPreflight(root, receipt);
    }
    console.table(receipt.checks.map(({ name, result, durationMs }) => ({ name, result, durationMs })));
    console.log('Preflight', receipt.status, 'for tree', tree, 'in', (receipt.durationMs / 1000).toFixed(1), 's:', path);
    if (receipt.status !== 'passed') process.exitCode = 1;
  });
}

if (import.meta.main) await withPreflightActivity('Member preflight', main);
