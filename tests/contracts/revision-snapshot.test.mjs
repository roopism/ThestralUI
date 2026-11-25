import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { pushedRevisions } from '../../packages/policy/quality/check-staged.mjs';
import { withRevisionSnapshot } from '../../packages/policy/quality/staged-tree.mjs';

test('integration and pre-push qualify the requested revision even when the working index differs', t => {
  const cwd = mkdtempSync(join(tmpdir(), 'ui-ref-snapshot-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const env = { ...process.env, ULD_SCENARIOS: 'button' };
  for (const key of Object.keys(env)) if (key.startsWith('GIT_')) delete env[key];
  const git = (...args) => execFileSync('git', args, { cwd, env, encoding: 'utf8' }).trim();
  git('init', '--quiet', '--template=');
  git('config', 'user.name', 'ThestralUI Bot');
  git('config', 'user.email', 'thestral-ui@users.noreply.github.com');
  for (const version of ['first', 'second']) {
    writeFileSync(join(cwd, 'value'), version);
    git('add', 'value');
    git('commit', '-qm', version);
  }
  writeFileSync(join(cwd, 'value'), 'staged');
  git('add', 'value');
  writeFileSync(join(cwd, 'value'), 'unstaged');
  for (const [ref, version] of [['HEAD~1', 'first'], ['HEAD', 'second']]) {
    withRevisionSnapshot(cwd, ref, (snapshot, tree, childEnv) => {
      assert.equal(childEnv.ULD_SCENARIOS, undefined, 'An inherited filter must not remove full-suite scenarios');
      assert.equal(tree, git('rev-parse', ref + '^{tree}'));
      assert.equal(readFileSync(join(snapshot, 'value'), 'utf8'), version);
    }, env);
  }
});

test('pre-push qualifies distinct outgoing objects and ignores deleted refs', () => {
  const first = '1'.repeat(40);
  const second = '2'.repeat(40);
  const zero = '0'.repeat(40);
  const lines = [
    `refs/heads/main ${first} refs/heads/main ${second}`,
    `refs/tags/rc ${first} refs/tags/rc ${zero}`,
    `refs/heads/other ${second} refs/heads/other ${zero}`,
    `(delete) ${zero} refs/heads/old ${first}`,
  ];
  assert.deepEqual(pushedRevisions(lines.join('\n') + '\n'), [first, second]);
  assert.deepEqual(pushedRevisions(''), []);
  assert.throws(() => pushedRevisions('invalid'), /Expected a local ref/);
  assert.throws(() => pushedRevisions('branch HEAD remote ' + zero), /Invalid local/);
});
