import { releaseLocksOnSignal } from './workers/lock.mjs';
import { failUnfinishedAttempt, startAttempt } from './gates/qualification-attempt.mjs';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { withRevisionSnapshot, withStagedSnapshot } from '../packages/policy/quality/staged-tree.mjs';
import { installSnapshotDependencies } from '../packages/policy/quality/snapshot-dependencies.mjs';
import { familyInputs, familyInputsAt } from './manifests/bundle-parent.mjs';
import { verifyFirstAdoptionSources } from './manifests/reviewed-bundle-budgets.mjs';
import { createHash } from 'node:crypto';
import { requirePreflight } from './gates/preflight-receipt.mjs';

let runnerProcess;
releaseLocksOnSignal(signal => {
  if (!runnerProcess?.pid) return false;
  try { process.kill(-runnerProcess.pid, signal); }
  catch (error) { if (error.code !== 'ESRCH') throw error; }
  return true;
});
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const root = git('rev-parse', '--show-toplevel');
const common = git('rev-parse', '--path-format=absolute', '--git-common-dir');
const args = process.argv.slice(2);
if (args[0] === '--cloud-evidence') {
  assert.ok(args.length === 2 || args.length === 3, 'Expected a PR number and an optional existing qualification attempt');
  const { hostedEvidence } = await import('./gates/cloud/coordinator.mjs');
  console.log(await hostedEvidence(root, common, args[1], args[2]));
  process.exit(0);
}
const ordered = args[0] === '--train-id';
const trainId = ordered ? args.splice(0, 2)[1] : undefined;
if (ordered) assert.match(trainId ?? '', /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
const noReuse = args[0] === '--no-reuse';
if (noReuse) args.shift();
const mode = args[0] === '--staged' ? 'hook' : args[0] === '--release' ? 'release' : 'qualification';
if (mode !== 'qualification') args.shift();
assert.ok(args.length <= 1 && !args.some(arg => arg.startsWith('-')), 'Usage: npm run qualify [-- <commit>]');
const commit = git('rev-parse', '--verify', '--end-of-options', (args[0] ?? 'HEAD') + '^{commit}');
if (mode !== 'hook') git('fetch', '--no-tags', 'origin',
  '+refs/heads/feat/enterprise-ui:refs/remotes/origin/feat/enterprise-ui');
const base = mode === 'hook' ? git('rev-parse', 'HEAD') : git('rev-parse', '--verify', 'refs/remotes/origin/feat/enterprise-ui^{commit}');
if (mode !== 'hook') git('merge-base', '--is-ancestor', base, commit);
// Refuse before any attempt is recorded. A failed attempt bars landing the tree.
const candidateTree = git('rev-parse', commit + '^{tree}');
if (trainId) assert.equal(mode, 'qualification');
const preflight = trainId ? (await import('./gates/train-plan.mjs')).requireTrainPreflight(root, common, base, commit, candidateTree, trainId) :
  mode === 'hook' ? undefined : requirePreflight(root, common, base, commit, candidateTree);
if (preflight?.trainPlan) {
  assert.ok(ordered, 'Ordered qualification requires its exact train admission');
  assert.equal(preflight.trainId, trainId);
}
const directory = join(common, 'uld-receipts');
// Earlier integration runners create their own receipt. The protocol file is
// pinned after adoption so each newer runner must continue its preflight ID.
const initial = mode !== 'hook' && git('ls-tree', base, '--', 'scripts/gates/qualification-attempt.mjs')
  ? startAttempt(root, directory, base, commit, git('rev-parse', commit + '^{tree}'), mode) : undefined;
// The packed bundle stage of the trusted runner measures new size rows. Earlier judges take no flags.
const deferredMeasurement = (trusted, judge) =>
  readFileSync(join(trusted, judge), 'utf8').includes("'--defer-measurement'") ? ['--defer-measurement'] : [];
function verify(snapshot, tree, env) {
  const judge = 'scripts/gates/no-weakening.mjs';
  const incumbent = git('ls-tree', base, '--', judge);
  if (!incumbent) {
    // Identify old migration snapshots for diagnostics. They cannot qualify without a judge.
    if (base === '353f46a916acba3a17a6d87cd4e4223927df390e') {
      assert.equal(git('rev-parse', base + '^{tree}'), '0759c9fbcfbd3c26ab065e5b2ce0408919064bb1',
        'The calibrated migration base must match the tree qualified on all platforms');
    } else {
      assert.equal(base, git('rev-parse', 'f83c9d0f7^{commit}'),
        'A missing incumbent strengthen-only gate is allowed only on the recorded migration base');
    }
    throw Error('A trusted no-weakening judge is mandatory, including on historical integration bases');
  }
  assert.match(incumbent, /^100(?:644|755) blob /, 'The trusted judge must be a regular file');
  const inputs = familyInputs(snapshot);
  verifyFirstAdoptionSources(familyInputsAt(root, base, inputs), inputs, path => {
    const file = join(snapshot, path);
    return lstatSync(file).isFile() ? createHash('sha256').update(readFileSync(file)).digest('hex') : undefined;
  });
  const runner = 'scripts/gates/local-run.mjs';
  assert.ok(existsSync(join(snapshot, runner)), 'The committed candidate must contain the local qualification pipeline');
  return withRevisionSnapshot(root, base, (trusted, _baseTree, trustedEnv) => {
    installSnapshotDependencies(trusted, join(common, 'uld-dependencies'), trustedEnv);
    execFileSync(process.execPath, [judge, base, tree, root, ...deferredMeasurement(trusted, judge)], { cwd: trusted, env: trustedEnv, stdio: 'inherit' });
    const extraJudge = 'scripts/gates/review/qualification-policy.mjs';
    if (git('ls-tree', base, '--', extraJudge))
      execFileSync(process.execPath, [join(trusted, extraJudge), root, base, tree], { cwd: trusted, env: trustedEnv, stdio: 'inherit' });
    const reuseJudge = 'scripts/gates/reuse/strength.mjs';
    if (git('ls-tree', base, '--', reuseJudge))
      execFileSync(process.execPath, [join(trusted, reuseJudge), root, base, tree], { cwd: trusted, env: trustedEnv, stdio: 'inherit' });
    installSnapshotDependencies(snapshot, join(common, 'uld-dependencies'), env);
    return new Promise((resolve, reject) => {
      runnerProcess = spawn(process.execPath, [join(trusted, runner), root, base, commit, mode, ...(initial ? [initial.id] : []),
        ...(noReuse ? ['--no-reuse'] : []), ...(preflight?.trainPlan ? ['--train-plan', preflight.trainPlan, '--train-id', trainId] : []), ...(preflight?.reuseSchema === 1 ? ['--preflight-id', preflight.id] : [])], {
        cwd: snapshot, stdio: 'inherit', detached: true, env: { ...env, ULD_ARTIFACT_COMMON: common },
      });
      runnerProcess.once('error', reject);
      runnerProcess.once('exit', (code, signal) => {
        runnerProcess = undefined;
        if (code === 0) resolve();
        else reject(Error('Qualification runner exited with ' + (signal ?? code)));
      });
    });
  });
}
try {
  if (mode === 'hook') await withStagedSnapshot(root, verify);
  else await withRevisionSnapshot(root, commit, verify);
} catch (error) {
  if (initial) failUnfinishedAttempt(directory, initial, error);
  throw error;
}
