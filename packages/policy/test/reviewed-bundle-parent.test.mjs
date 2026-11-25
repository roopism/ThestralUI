import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { comparisonBase, familyInputsAt } from '../../../scripts/manifests/bundle-parent.mjs';

test('local staged and complete checks use the genuine Git start, and shallow release events resolve only their trusted base', (t) => {
  const temp = mkdtempSync(join(tmpdir(), 'uld-budget-parent-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const repo = join(temp, 'author'),
    remote = join(temp, 'remote.git'),
    shallow = join(temp, 'shallow');
  mkdirSync(repo);
  const git = (cwd, ...args) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git(temp, 'init', '--bare', '--quiet', remote);
  git(repo, 'init', '--quiet', '--template=', '-b', 'feat/enterprise-ui');
  assert.equal(comparisonBase(repo, 'staged', {}), null);
  assert.deepEqual(familyInputsAt(repo, null, []), []);
  git(repo, 'config', 'user.name', 'Budget fixture');
  git(repo, 'config', 'user.email', 'fixture@example.invalid');
  const commit = (message) => {
    writeFileSync(join(repo, 'content'), message);
    git(repo, 'add', 'content');
    git(repo, 'commit', '-qm', message);
    return git(repo, 'rev-parse', 'HEAD');
  };
  const base = commit('Accepted enterprise');
  git(repo, 'remote', 'add', 'origin', pathToFileURL(remote).href);
  git(repo, 'push', '--quiet', 'origin', 'HEAD');
  git(repo, 'switch', '--quiet', '-c', 'feat/families');
  const middle = commit('Local staged parent'),
    head = commit('Product candidate');
  git(repo, 'push', '--quiet', 'origin', 'HEAD');
  assert.equal(comparisonBase(repo, 'staged', {}), head);
  assert.equal(comparisonBase(repo, 'release', {}), middle);
  git(
    temp,
    'clone',
    '--quiet',
    '--depth=1',
    '--branch',
    'feat/families',
    pathToFileURL(remote).href,
    shallow,
  );
  assert.throws(
    () => comparisonBase(shallow, 'release', {}),
    /Trusted Git budget comparison commit is unavailable/,
  );
  const eventFile = join(temp, 'event.json');
  const hosted = (eventName, event) => {
    writeFileSync(eventFile, JSON.stringify(event));
    return comparisonBase(shallow, 'release', {
      GITHUB_ACTIONS: 'true',
      GITHUB_SHA: head,
      GITHUB_EVENT_NAME: eventName,
      GITHUB_EVENT_PATH: eventFile,
    });
  };
  const pr = { pull_request: { base: { sha: base }, head: { sha: head } } };
  assert.equal(hosted('pull_request', pr), base);
  assert.equal(hosted('push', { before: middle, after: head, ref: 'refs/heads/feat/families' }), middle);
  for (const ref of ['refs/heads/feat/families', 'refs/tags/v1.0.0'])
    assert.equal(hosted('push', { before: '0'.repeat(40), after: head, ref }), base);
  assert.equal(hosted('workflow_dispatch', {}), middle);
  assert.throws(
    () => hosted('pull_request', { pull_request: { base: { sha: 'f'.repeat(40) }, head: { sha: head } } }),
    /Failed to read trusted Git budget comparison/,
  );
  assert.throws(
    () => hosted('push', { before: base, after: middle, ref: 'refs/heads/feat/families' }),
    /Push does not match/,
  );
  assert.throws(
    () => hosted('push', { before: '0'.repeat(40), after: head, ref: 'refs/heads/feat/enterprise-ui' }),
    /no trusted previous tip/,
  );
  // The original repository already had real releases before the family manifests existed.
  assert.deepEqual(familyInputsAt(shallow, base), []);
  git(repo, 'checkout', '--quiet', base);
  assert.equal(comparisonBase(repo, 'release', {}), base);

  // A new tag at an accepted ancestor is maintenance. Compare against that actual commit,
  // including when the runner starts with no history and enterprise has since advanced.
  git(remote, 'update-ref', 'refs/heads/feat/enterprise-ui', head);
  git(remote, 'update-ref', 'refs/tags/accepted-before-registry', base);
  const release = join(temp, 'release');
  git(
    temp,
    'clone',
    '--quiet',
    '--depth=1',
    '--branch',
    'accepted-before-registry',
    pathToFileURL(remote).href,
    release,
  );
  writeFileSync(
    eventFile,
    JSON.stringify({ before: '0'.repeat(40), after: base, ref: 'refs/tags/accepted-before-registry' }),
  );
  assert.equal(
    comparisonBase(release, 'release', {
      GITHUB_ACTIONS: 'true',
      GITHUB_SHA: base,
      GITHUB_EVENT_NAME: 'push',
      GITHUB_EVENT_PATH: eventFile,
    }),
    base,
  );
  assert.equal(git(release, 'rev-parse', 'HEAD'), base);
  assert.throws(
    () => hosted('push', { before: base, after: head, ref: 'not-a-ref' }),
    /Missing GitHub push ref/,
  );
  assert.equal(git(shallow, 'rev-parse', 'HEAD'), head);
});
