import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stagedHookProbe } from '../../scripts/gates/tests/fixtures/staged-input.mjs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkStaged } from '../../packages/policy/quality/check-staged.mjs';
import { withStagedSnapshot } from '../../packages/policy/quality/staged-tree.mjs';

function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'ui-hook-test-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const env = { ...process.env };
  delete env.GITHUB_EVENT_NAME;
  for (const key of Object.keys(env)) {
    if (key.startsWith('UI_GATE_') || key === 'UI_SIMULATOR_ID' || key === 'MAESTRO_BIN')
      delete env[key];
  }
  for (const key of execFileSync('git', ['rev-parse', '--local-env-vars'], { encoding: 'utf8' })
    .trim()
    .split('\n'))
    delete env[key];
  const git = (...args) => execFileSync('git', args, { cwd, env, encoding: 'utf8' }).trim();
  git('init', '--quiet', '--template=');
  git('config', 'user.name', 'ThestralUI Bot');
  git('config', 'user.email', 'thestral-ui@users.noreply.github.com');
  return { cwd, env, git };
}
test('an unborn or partially staged repository tests only its index with a working Git context', (t) => {
  const { cwd, git, env } = fixture(t);
  writeFileSync(join(cwd, 'subject'), 'staged contents');
  git('add', 'subject');
  writeFileSync(join(cwd, 'subject'), 'unstaged contents');
  writeFileSync(join(cwd, 'local-only'), 'private');
  const tree = git('write-tree');
  withStagedSnapshot(
    cwd,
    (snapshot, snapshotTree, environment) => {
      assert.equal(snapshotTree, tree);
      assert.equal(readFileSync(join(snapshot, 'subject'), 'utf8'), 'staged contents');
      assert.throws(() => readFileSync(join(snapshot, 'local-only')));
      assert.equal(
        execFileSync('git', ['write-tree'], {
          cwd: snapshot,
          env: environment,
          encoding: 'utf8',
        }).trim(),
        tree,
      );
      assert.equal(
        execFileSync('git', ['rev-parse', 'HEAD^{tree}'], {
          cwd: snapshot,
          env: environment,
          encoding: 'utf8',
        }).trim(),
        tree,
      );
    },
    env,
  );
  assert.equal(git('write-tree'), tree);
});
test('Git uses the staged bootstrap and blocks a commit when its lockfile is missing', (t) => {
  const { cwd, env, git } = fixture(t);
  mkdirSync(join(cwd, 'hooks'));
  const hook = join(cwd, 'hooks/pre-commit');
  cpSync(fileURLToPath(new URL('../../.githooks/pre-commit', import.meta.url)), hook);
  const quality = join(cwd, 'packages/policy/quality');
  mkdirSync(quality, { recursive: true });
  cpSync(fileURLToPath(new URL('../../packages/policy/quality', import.meta.url)), quality, {
    recursive: true,
  });
  symlinkSync(
    fileURLToPath(new URL('../../node_modules', import.meta.url)),
    join(cwd, 'node_modules'),
    'dir',
  );
  chmodSync(hook, 0o755);
  git('config', 'core.hooksPath', 'hooks');
  writeFileSync(
    join(cwd, 'package.json'),
    JSON.stringify({
      name: 'ui-lazy-dev',
      scripts: { 'gate:local': 'true', 'gate:packed': 'true' },
    }),
  );
  writeFileSync(join(cwd, '.nvmrc'), process.versions.node + '\n');
  git('add', 'package.json', '.nvmrc', 'packages/policy/quality');
  // An unfinished working-copy edit must have no influence on hook selection.
  writeFileSync(join(quality, 'check-staged.mjs'), 'throw Error("unfinished working copy");\n');
  const attempt = spawnSync('git', ['commit', '-m', 'test(policy): exercise mandatory gate'], {
    cwd,
    env,
    encoding: 'utf8',
  });
  assert.notEqual(attempt.status, 0);
  assert.match(
    attempt.stdout + attempt.stderr,
    /staged .*acceptance|staged .*lockfile|staged gate/i,
  );
  assert.notEqual(spawnSync('git', ['rev-parse', '--verify', 'HEAD'], { cwd, env }).status, 0);
});
test('uses the original staged diff for simulator selection before creating the validation snapshot', (t) => {
  const { cwd, env, git } = fixture(t);
  writeFileSync(join(cwd, 'README.md'), 'Initial documentation');
  git('add', '--', 'README.md');
  git('commit', '--quiet', '-m', 'Create fixture');

  const choose = (_snapshot, required) => required;
  const commit = () => checkStaged(cwd, 'commit', choose, env);
  writeFileSync(join(cwd, 'README.md'), 'Updated documentation');
  git('add', '--', 'README.md');
  assert.equal(commit(), false);
  assert.equal(checkStaged(cwd, 'ci', choose, env), true);

  const folder = join(cwd, 'packages/native');
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, 'Button.tsx'), 'Staged native component');
  git('add', '--', 'packages/native/Button.tsx');
  assert.equal(commit(), true);
  const probe = stagedHookProbe(cwd, git, env,
    fileURLToPath(new URL('../../scripts/qualify.mjs', import.meta.url)), ['--staged'], 'README.md');
  assert.notEqual(probe.status, 0);
  assert.match(probe.stderr, /Error: staged probe hook: from index/);
});
