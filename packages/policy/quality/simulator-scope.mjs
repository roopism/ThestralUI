import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

// Include the rule and every entry point that decides whether the native journeys execute.
const gateFiles = new Set([
  '.githooks/pre-commit',
  '.github/workflows/enterprise-acceptance.yml',
  'packages/policy/quality/check-staged.mjs',
  'packages/policy/quality/staged-tree.mjs',
  'packages/policy/quality/simulator-scope.mjs',
  'scripts/simulator-scope.mjs',
  'scripts/package-workspaces.mjs',
  'jest.native.config.cjs',
  'scripts/scenarios/read.cjs',
  'scripts/scenarios/native.cjs',
  'scripts/selection/native-scenarios.mjs',
  'tests/scenarios/native-registry-fixture.cjs',
  'tests/scenarios/read.test.cjs',
  'tests/contracts/commit-hook.test.mjs',
  'tests/contracts/simulator-scope.test.mjs',
  'tests/contracts/simulator.test.mjs',
  'scripts/build-cache/device-host.mjs',
  'tests/packaging/device-host.test.mjs',
]);
const nativeRoots = ['packages/native', 'packages/tokens', 'packages/messages', 'packages/icons', 'packages/slots', 'catalog/native', 'tests/native', 'tests/simulator', 'tests/android'];

function affectsSimulator(path) {
  return (
    gateFiles.has(path) ||
    /^docs\/components\/[^/]+\.scenarios\.yaml$/.test(path) ||
    /^tests\/[^/]+\/native\.test\.[cm]?[jt]sx?$/.test(path) ||
    /^scripts\/[^/]*(?:ios|android)[^/]*$/.test(path) ||
    nativeRoots.some((root) => path === root || path.startsWith(root + '/'))
  );
}

export function simulatorForPaths(paths, mode = 'commit', env = process.env) {
  assert.ok(['commit', 'ci', 'promote'].includes(mode), 'Unknown simulator gate mode');
  return mode !== 'commit' || ['pull_request', 'pull_request_target'].includes(env.GITHUB_EVENT_NAME) ||
    paths.some(affectsSimulator);
}

export function simulatorRequired(root, tree, mode = 'commit', env = process.env) {
  assert.ok(['commit', 'ci', 'promote'].includes(mode), 'Unknown simulator gate mode');
  const git = (...args) => execFileSync('git', args, { cwd: root, env, encoding: 'utf8' });
  const verifyIndex = () =>
    assert.equal(
      git('write-tree').trim(),
      tree,
      'Simulator scope does not match the staged candidate',
    );
  verifyIndex();
  if (mode !== 'commit' || ['pull_request', 'pull_request_target'].includes(env.GITHUB_EVENT_NAME))
    return true;

  // Git compares the index with HEAD, or with the empty tree on the first commit.
  // Disabling rename detection exposes the removed and added paths independently.
  const paths = git(
    'diff',
    '--cached',
    '--name-only',
    '--no-ext-diff',
    '--no-renames',
    '--ignore-submodules=none',
    '-z',
    '--',
  ).split('\0');
  verifyIndex();
  return simulatorForPaths(paths, mode, env);
}
