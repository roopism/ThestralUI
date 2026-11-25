import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const git = (cwd, args, env) =>
  execFileSync('git', args, { cwd, env, encoding: 'utf8' }).trim();

// A new repository can have a staged tree before it has a HEAD. Supply a temporary
// HEAD only inside the disposable repository so tools can use ordinary Git commands.
export function withStagedSnapshot(root, check, sourceEnv = process.env) {
  const tree = git(root, ['write-tree'], sourceEnv);
  const result = withTreeSnapshot(root, tree, check, sourceEnv);
  const verifyIndex = value => {
    assert.equal(git(root, ['write-tree'], sourceEnv), tree, 'Index changed during acceptance');
    return value;
  };
  return result instanceof Promise ? result.then(verifyIndex) : verifyIndex(result);
}

export function withRevisionSnapshot(root, revision, check, sourceEnv = process.env) {
  const tree = git(root, ['rev-parse', '--verify', '--end-of-options', revision + '^{tree}'], sourceEnv);
  return withTreeSnapshot(root, tree, check, sourceEnv);
}

function withTreeSnapshot(root, tree, check, sourceEnv) {
  const env = { ...sourceEnv, UI_GATE_SNAPSHOT: '1', CI: '1' };
  const objectDir = git(
    root,
    ['rev-parse', '--path-format=absolute', '--git-path', 'objects'],
    sourceEnv,
  );
  for (const key of git(root, ['rev-parse', '--local-env-vars'], sourceEnv).split('\n'))
    delete env[key];
  for (const key of [
    'UI_GATE_TRUST',
    'UI_GATE_EVIDENCE',
    'UI_GATE_ROSTER_JSON',
    'GITHUB_TOKEN',
    'GH_TOKEN',
    'NODE_OPTIONS',
    'ULD_SCENARIOS',
  ])
    delete env[key];
  const cwd = mkdtempSync(join(tmpdir(), 'ui-index-'));
  const cleanup = () => rmSync(cwd, { recursive: true, force: true });
  let pending = false;
  try {
    git(cwd, ['init', '--quiet', '--template='], env);
    const info = join(cwd, '.git', 'objects', 'info');
    mkdirSync(info, { recursive: true });
    writeFileSync(join(info, 'alternates'), objectDir + '\n');
    const head = git(
      cwd,
      [
        '-c',
        'user.name=ThestralUI Bot',
        '-c',
        'user.email=thestral-ui@users.noreply.github.com',
        'commit-tree',
        tree,
        '-m',
        'Local acceptance snapshot',
      ],
      env,
    );
    git(cwd, ['update-ref', 'HEAD', head], env);
    git(cwd, ['read-tree', '--reset', '-u', tree], env);
    assert.equal(git(cwd, ['write-tree'], env), tree, 'Snapshot differs from staged tree');
    const result = check(cwd, tree, env);
    if (result instanceof Promise) {
      pending = true;
      return result.finally(cleanup);
    }
    return result;
  } finally {
    if (!pending) cleanup();
  }
}
