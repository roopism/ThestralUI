import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { closeSync, cpSync, existsSync, globSync, lstatSync, mkdirSync, openSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withTiming } from '../workers/resource-guard.mjs';
import { withRevisionSnapshot } from '../../packages/policy/quality/staged-tree.mjs';
import { installSnapshotDependencies } from '../../packages/policy/quality/snapshot-dependencies.mjs';

const trusted = fileURLToPath(new URL('../../', import.meta.url));
const git = (root, ...args) => execFileSync('git', ['--no-replace-objects', ...args], {
  cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
}).trimEnd();

// Unknown and shared inputs get Mac behavior; documentation and Android-only
// probe files have no web renderer.
export function needsMacBehavior(paths) {
  return !paths.length || paths.some(path => !/^(?:docs\/[^\n]+\.md|[^/]+\.md|tests\/android\/.+)$/.test(path));
}

export function withTrainSnapshot({ root, base, member }, run) {
  for (const id of [base, member.parent, member.commit, member.tree]) assert.match(id, /^[a-f0-9]{40}$/);
  assert.equal(git(trusted, 'rev-parse', 'HEAD^{tree}'), git(root, 'rev-parse', base + '^{tree}'),
    'Train checks must execute from the trusted integration snapshot');
  assert.equal(git(root, 'rev-parse', member.commit + '^{tree}'), member.tree);
  const common = git(root, 'rev-parse', '--path-format=absolute', '--git-common-dir');
  return withRevisionSnapshot(root, member.commit, async (snapshot, tree, env) => {
    assert.equal(tree, member.tree);
    await withTiming('activity', 'Prepare train snapshot', () => installSnapshotDependencies(snapshot, join(common, 'uld-dependencies'), env));
    const node = (args, options = {}) => execFileSync(process.execPath, args, { cwd: snapshot,
      env: { ...env, ULD_ARTIFACT_COMMON: common }, stdio: 'inherit', ...options });
    return run({ snapshot, node, env });
  });
}

const offlineCanaries = new Set(['scripts/gates/canaries.mjs', 'scripts/gates/device-scope-canaries.mjs', 'scripts/gates/maestro-canary.mjs']);

export function runMemberChecks(paths, gateTests, operations) {
  operations.preflight();
  const changedCanaries = paths.filter(path => offlineCanaries.has(path));
  for (const file of changedCanaries) operations.canary(file);
  const changedGateTests = paths.filter(path => gateTests.has(path));
  if (changedGateTests.length) operations.tests(changedGateTests);
  const mac = needsMacBehavior(paths);
  if (mac) operations.browser();
  return { fast: 'passed', typedAndUnit: 'passed', changedGateTests, changedCanaries, macBehavior: mac ? 'passed' : 'no-web-inputs' };
}

export function checkMember(request) {
  const { root, member } = request;
  const paths = git(root, 'diff', '--no-renames', '--name-only', '-z', member.parent, member.tree).split('\0').filter(Boolean);
  return withTrainSnapshot(request, ({ snapshot, node, env }) => withTiming('activity', 'Train member checks', () => {
    const gateTests = new Set(globSync('scripts/gates/tests/*.test.mjs', { cwd: snapshot }));
    const checks = runMemberChecks(paths, gateTests, {
      preflight: () => node([join(trusted, 'scripts/gates/local-run.mjs'), root, member.parent, member.commit, 'hook']),
      canary: file => node([file, file.endsWith('maestro-canary.mjs') ? '--offline' : member.tree],
        { env: { ...env, ULD_ARTIFACT_COMMON: join(snapshot, '.git') } }),
      tests: cases => node(['--test', '--test-concurrency=1', ...cases],
        { env: { ...env, ULD_ARTIFACT_COMMON: join(snapshot, '.git') } }),
      browser: () => node([fileURLToPath(new URL('train-suite.mjs', import.meta.url)), root, member.parent, member.commit, 'Mac browser behavior']),
    });
    return { tree: member.tree, ...checks };
  }));
}

export function checkPrefixSuite(request, suite) {
  return withTrainSnapshot(request, ({ node, snapshot }) => {
    const target = join(snapshot, '.git');
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, 'gate-selection.json'), JSON.stringify({ budgetComparisonBase: request.base }));
    const log = openSync(join(request.evidenceDir, 'suite.log'), 'wx', 0o600);
    try {
      node([fileURLToPath(new URL('train-suite.mjs', import.meta.url)), request.root, request.base, request.member.commit, suite],
        { stdio: ['ignore', log, log] });
    } finally {
      closeSync(log);
      for (const path of ['release/evidence', 'test-results']) {
        const source = join(snapshot, path);
        if (path.startsWith('release/') && existsSync(join(snapshot, 'release')))
          assert.ok(lstatSync(join(snapshot, 'release')).isDirectory(), 'Unexpected release evidence directory');
        if (existsSync(source)) cpSync(source, join(request.evidenceDir, path), {
          recursive: true, errorOnExist: true, force: false, filter: file => !lstatSync(file).isSymbolicLink(),
        });
      }
    }
  });
}
