import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { budgetCheckpoints, bundleStage } from './reviewed-bundle-budgets.mjs';

const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const oid = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const git = (cwd, args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const familyPaths = budgetCheckpoints.map(({ slug }) => 'manifests/families/' + slug + '.json');

export function familyInputs(root) {
  const families = familyPaths
    .filter((path) => existsSync(join(root, path)))
    .map((path) => read(join(root, path)));
  const manifest = join(root, 'packages/web/package.json');
  if (existsSync(manifest)) bundleStage(families, read(manifest).exports ?? {});
  return families;
}

function commit(root, revision, canFetch) {
  assert.ok(oid.test(revision) && !/^0+$/.test(revision), 'Missing trusted Git budget comparison commit');
  try {
    return git(root, ['rev-parse', '--verify', revision + '^{commit}']);
  } catch (error) {
    if (!canFetch)
      throw Error('Trusted Git budget comparison commit is unavailable: ' + revision, { cause: error });
  }
  // Release checkouts are shallow. Read exactly the event's object from their existing origin.
  // Leave tracking refs and FETCH_HEAD untouched. Local runs never contact a remote.
  try {
    git(root, ['fetch', '--quiet', '--no-tags', '--no-write-fetch-head', '--depth=1', 'origin', revision]);
    return git(root, ['rev-parse', '--verify', revision + '^{commit}']);
  } catch (error) {
    throw Error('Failed to read trusted Git budget comparison commit: ' + revision, { cause: error });
  }
}

function parents(root, head) {
  // A shallow commit still identifies its genuine parents in the object itself.
  return [...git(root, ['cat-file', '-p', head]).matchAll(/^parent ([a-f0-9]+)$/gm)].map((match) => match[1]);
}

function historicalParent(root, head, canFetch) {
  const [parent] = parents(root, head);
  if (parent) return commit(root, parent, canFetch);
  assert.equal(bundleStage(familyInputsAt(root, head)), 0, 'First budget adoption has no trusted Git parent');
  return head;
}

function commonBase(root, head, trusted) {
  const accepted = commit(root, trusted, true);
  if (head === accepted || parents(root, head).includes(accepted)) return accepted;
  if (parents(root, accepted).includes(head)) return head;
  // A shallow merge-base can omit the most recent fork. Read these two exact histories only
  // when the commit objects do not themselves establish the relationship.
  if (git(root, ['rev-parse', '--is-shallow-repository']) === 'true') {
    try {
      git(root, [
        'fetch',
        '--quiet',
        '--no-tags',
        '--no-write-fetch-head',
        '--unshallow',
        'origin',
        accepted,
        head,
      ]);
    } catch (error) {
      throw Error('Trusted Git history for this budget comparison is unavailable', { cause: error });
    }
  }
  try {
    return git(root, ['merge-base', accepted, head]);
  } catch (error) {
    throw Error('No common trusted Git ancestor for this budget comparison', { cause: error });
  }
}

function integrationBase(root, head) {
  let output;
  try {
    output = git(root, ['ls-remote', '--exit-code', 'origin', 'refs/heads/feat/enterprise-ui']);
  } catch (error) {
    throw Error('Trusted integration head is unavailable for new branch or tag', { cause: error });
  }
  const match = /^([a-f0-9]+)\s+refs\/heads\/feat\/enterprise-ui$/u.exec(output);
  assert.ok(match, 'Trusted integration head is unavailable for new branch or tag');
  return commonBase(root, head, match[1]);
}

export function comparisonBase(root, mode = 'release', env = process.env) {
  if (mode === 'staged') {
    const lookup = spawnSync('git', ['rev-parse', '--verify', '--quiet', 'HEAD^{commit}'], {
      cwd: root,
      encoding: 'utf8',
    });
    if (lookup.status === 0) return lookup.stdout.trim();
    // Git permits a genuine first staged commit on an unborn local branch.
    const ref = git(root, ['symbolic-ref', '--quiet', 'HEAD']);
    const missing = spawnSync('git', ['show-ref', '--verify', '--quiet', ref], { cwd: root });
    assert.equal(missing.status, 1, 'Expected an unborn branch or a genuine staged Git parent');
    return null;
  }
  const head = git(root, ['rev-parse', '--verify', 'HEAD^{commit}']);
  const hosted = env.GITHUB_ACTIONS === 'true';
  if (!hosted) return historicalParent(root, head, false);
  const event = read(env.GITHUB_EVENT_PATH);
  assert.equal(
    commit(root, env.GITHUB_SHA, false),
    head,
    'Budget check is not running on the GitHub event commit',
  );
  if (env.GITHUB_EVENT_NAME === 'pull_request') {
    const { base, head: proposed } = event.pull_request;
    const mergeParents = parents(root, head);
    assert.ok(
      proposed.sha === head || (mergeParents[0] === base.sha && mergeParents.includes(proposed.sha)),
      'GitHub pull request base does not match the checked-out revision',
    );
    return commonBase(root, head, base.sha);
  }
  if (env.GITHUB_EVENT_NAME === 'push') {
    assert.equal(commit(root, event.after, false), head, 'Push does not match the checked-out revision');
    assert.ok(
      typeof event.ref === 'string' && /^refs\/(heads|tags)\//.test(event.ref),
      'Missing GitHub push ref',
    );
    git(root, ['check-ref-format', event.ref]);
    assert.ok(typeof event.before === 'string' && oid.test(event.before), 'Invalid GitHub previous revision');
    if (!/^0+$/.test(event.before)) {
      const previous = commit(root, event.before, true);
      if (event.ref.startsWith('refs/heads/')) return previous;
    } else if (!parents(root, head).length) {
      return historicalParent(root, head, false);
    }
    assert.notEqual(
      event.ref,
      'refs/heads/feat/enterprise-ui',
      'New integration ref has no trusted previous tip',
    );
    return integrationBase(root, head);
  }
  assert.equal(env.GITHUB_EVENT_NAME, 'workflow_dispatch', 'Missing trusted GitHub budget comparison event');
  return historicalParent(root, head, true);
}

export function previousBundleFamilies(root, env = process.env) {
  const selection = join(root, '.git/gate-selection.json');
  // A local gate snapshot is a parentless private commit with an alternate object store.
  // The hook records the genuine parent from the original repository before starting the child.
  if (env.UI_GATE_SNAPSHOT === '1' && existsSync(selection)) {
    const base = read(selection).budgetComparisonBase;
    return familyInputsAt(
      root,
      base === null ? null : commit(root, base, false),
      base === null ? familyInputs(root) : [],
    );
  }
  return familyInputsAt(root, comparisonBase(root, 'release', env));
}

export function familyInputsAt(root, base, current = []) {
  if (base === null) {
    assert.equal(bundleStage(current), 0, 'First budget adoption has no trusted Git parent');
    return [];
  }
  // The accepted repository predates the family registry. Missing old files grant no allowance.
  const listed = git(root, ['ls-tree', '--name-only', '-z', base, '--', ...familyPaths]);
  return listed
    .split('\0')
    .filter(Boolean)
    .map((path) => JSON.parse(git(root, ['show', base + ':' + path])));
}
