import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { stagedHookProbe } from '../../scripts/gates/tests/fixtures/staged-input.mjs';
import test from 'node:test';
import { simulatorRequired } from '../../packages/policy/quality/simulator-scope.mjs';

function repository(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'ui-simulator-scope-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith('GIT_') || key === 'GITHUB_EVENT_NAME') delete env[key];
  }
  const git = (...args) => execFileSync('git', args, { cwd, env, encoding: 'utf8' }).trim();
  git('init', '--quiet', '--template=');
  git('config', 'user.name', 'ThestralUI Bot');
  git('config', 'user.email', 'thestral-ui@users.noreply.github.com');
  function write(path, content) {
    mkdirSync(dirname(join(cwd, path)), { recursive: true });
    writeFileSync(join(cwd, path), content);
  }
  function stage(path, content = 'example') {
    write(path, content);
    git('add', '--', path);
  }
  function base() {
    stage('README.md');
    git('commit', '--quiet', '-m', 'Set up fixture');
  }
  const required = (mode = 'commit') => simulatorRequired(cwd, git('write-tree'), mode, env);
  return { cwd, env, git, stage, write, base, required };
}

test('every staged simulator input or gate change requires a run', (t) => {
  const repo = repository(t);
  repo.base();
  for (const path of [
    'packages/native/src/controls.tsx',
    'packages/tokens/tokens.json',
    'catalog/native/Gallery.tsx',
    'tests/native/scenarios.test.cjs',
    'tests/button/native.test.cjs',
    'tests/simulator/appearance.yaml',
    'docs/components/modal-dialog.scenarios.yaml',
    'scripts/selection/native-scenarios.mjs',
    'jest.native.config.cjs',
    'scripts/bootstrap-ios.mjs',
    'scripts/package-workspaces.mjs',
    'packages/messages/src/react.js',
    'packages/icons/roster.json',
    'packages/slots/src/index.js',
    'scripts/verify-ios-simulator.mjs',
    'scripts/verify-android-emulator.mjs',
    'scripts/build-cache/device-host.mjs',
    'tests/android/emulator.mjs',
    'scripts/simulator-scope.mjs',
    'scripts/scenarios/read.cjs',
    'scripts/scenarios/native.cjs',
    'tests/scenarios/native-registry-fixture.cjs',
    'tests/scenarios/read.test.cjs',
    'packages/policy/quality/simulator-scope.mjs',
    'packages/policy/quality/check-staged.mjs',
    'packages/policy/quality/staged-tree.mjs',
    '.githooks/pre-commit',
    '.github/workflows/enterprise-acceptance.yml',
    'tests/contracts/simulator-scope.test.mjs',
  ]) {
    repo.stage(path);
    assert.equal(repo.required(), true, path);
    repo.git('restore', '--staged', '--', path);
  }
});

test('web, docs and policy-only commits skip iOS even with unstaged native edits', (t) => {
  const repo = repository(t);
  repo.base();
  for (const path of [
    'docs/API.md',
    'packages/web/src/Button.tsx',
    'catalog/Actions.stories.tsx',
    'tests/scenarios/web/adapter.ts',
    'packages/policy/ownership.mjs',
    'packages/style-policy/cli.mjs',
  ])
    repo.stage(path);
  repo.write('packages/native/src/Button.tsx', 'unstaged');
  assert.equal(repo.required(), false);
  assert.equal(repo.required('ci'), true);
  assert.equal(repo.required('promote'), true);
  repo.stage('packages/native/src/Button.tsx', 'native candidate');
  repo.write('packages/native/src/Button.tsx', 'different working tree');
  assert.equal(repo.required(), true);
});

test('native deletions and either direction of a rename require the simulator', (t) => {
  const repo = repository(t);
  const native = 'packages/native/src/Row.tsx';
  const web = 'packages/web/src/Row.tsx';
  repo.stage(native);
  repo.base();
  mkdirSync(dirname(join(repo.cwd, web)), { recursive: true });
  repo.git('mv', native, web);
  assert.equal(repo.required(), true);
  repo.git('commit', '--quiet', '-m', 'Move fixture');
  repo.git('mv', web, native);
  assert.equal(repo.required(), true);
  repo.git('commit', '--quiet', '-m', 'Restore fixture');
  repo.git('rm', native);
  assert.equal(repo.required(), true);
});

test('unborn indices, unusual filenames and missing Git state are handled safely', (t) => {
  const repo = repository(t);
  repo.stage('docs/native\npackages/native/example.md');
  assert.equal(repo.required(), false);
  repo.stage('packages/native/src/editor\nlayout.tsx');
  assert.equal(repo.required(), true);
  assert.throws(() => simulatorRequired(repo.cwd, 'a'.repeat(40), 'commit', repo.env));
  assert.throws(() =>
    simulatorRequired(join(repo.cwd, 'missing'), repo.git('write-tree'), 'commit', repo.env),
  );
});

test('the active commit gate checks the staged tree and always runs shared checks', async (t) => {
  const { checkStaged } = await import('../../packages/policy/quality/check-staged.mjs');
  const repo = repository(t);
  repo.base();
  repo.stage('docs/notes.md', 'staged');
  repo.write('docs/notes.md', 'unstaged');
  const { readFileSync } = await import('node:fs');
  const decisions = [];
  const check = (snapshot, runSimulator, environment) => {
    assert.equal(readFileSync(join(snapshot, 'docs/notes.md'), 'utf8'), 'staged');
    assert.equal(execFileSync('git', ['diff', '--cached', '--name-only'], {
      cwd: snapshot, env: environment, encoding: 'utf8',
    }), '');
    decisions.push(runSimulator);
  };
  checkStaged(repo.cwd, 'commit', check, repo.env);
  checkStaged(repo.cwd, 'ci', check, repo.env);
  repo.stage('packages/native/src/Dialog.tsx');
  checkStaged(repo.cwd, 'commit', check, repo.env);
  assert.deepEqual(decisions, [false, true, true]);
  assert.throws(() => checkStaged(repo.cwd, 'commit', () => {
    throw Error('Shared web checks failed');
  }, repo.env), /Shared web checks failed/);
  const probe = stagedHookProbe(repo.cwd, repo.git, repo.env,
    fileURLToPath(new URL('../../scripts/qualify.mjs', import.meta.url)), ['--staged'], 'packages/native/src/Dialog.tsx');
  assert.notEqual(probe.status, 0);
  assert.match(probe.stderr, /Error: staged probe hook: from index/);
});
