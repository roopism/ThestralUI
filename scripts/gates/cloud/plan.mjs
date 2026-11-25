import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { qualificationShards, preserveLaneCoverage } from './lanes.mjs';

const readGit = (root, ...args) => execFileSync('git', ['--no-replace-objects', ...args], { cwd: root, encoding: 'utf8' }).trim();
function rosterAt(root, revision, path) {
  const [mode, type] = readGit(root, 'ls-tree', revision, '--', path).split(' ');
  assert.equal(mode, '100644', 'Missing or non-regular roster ' + path);
  assert.equal(type, 'blob');
  return JSON.parse(readGit(root, 'show', revision + ':' + path));
}

// Both the local coordinator and the hosted jobs derive their shard list from Git objects.
export function planAt(root, base, merge) {
  for (const revision of [base, merge]) {
    assert.match(revision, /^[a-f0-9]{40}$/);
    assert.equal(readGit(root, 'rev-parse', revision + '^{commit}'), revision);
  }
  if (base !== merge) {
    const parents = readGit(root, 'show', '-s', '--format=%P', merge).split(' ');
    assert.ok(parents.length === 2 && parents[0] === base, 'Expected the exact PR merge on this base');
  }
  const suitesAt = revision => {
    const inputs = rosterAt(root, revision, 'tests/acceptance/suite-inputs.json');
    assert.equal(inputs.contractVersion, 1);
    return Object.keys(inputs.groups).sort();
  };
  const previous = suitesAt(base);
  const current = suitesAt(merge);
  const before = rosterAt(root, base, 'scripts/gates/cloud/lanes.json');
  const after = rosterAt(root, merge, 'scripts/gates/cloud/lanes.json');
  for (const name of previous) assert.ok(current.includes(name), 'Removed required suite ' + name);
  const shards = qualificationShards(after, current);
  const existing = Object.fromEntries(previous.map(name => [name, after.suites[name]]));
  preserveLaneCoverage(before, { schema: after.schema, suites: existing }, previous);
  return shards;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [root, base, merge] = process.argv.slice(2);
  const jobs = planAt(root, base, merge);
  const include = jobs.filter(job => job.lane !== 'local').map(({ id, suite, lane }) =>
    ({ id, suite, os: lane === 'github-linux' ? 'ubuntu-24.04-arm' : 'macos-26' }));
  appendFileSync(process.env.GITHUB_OUTPUT, 'matrix=' + JSON.stringify({ include }) + '\n');
  for (const [key, lane] of [['linux', 'github-linux'], ['macos', 'github-macos']]) {
    const include = jobs.filter(shard => shard.lane === lane).map(shard => ({ id: shard.id }));
    assert.ok(include.length, 'Empty hosted lane ' + lane);
    appendFileSync(process.env.GITHUB_OUTPUT, key + '=' + JSON.stringify({ include }) + '\n');
  }
}
