import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fixtureGit } from './fixtures/hermetic-git.mjs';

test('fixture commits ignore inherited Git identity, repository, index and configuration', t => {
  const temp = mkdtempSync(join(tmpdir(), 'uld-hermetic-git-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const other = join(temp, 'other'), fixture = join(temp, 'fixture');
  for (const dir of [other, fixture]) {
    mkdirSync(dir);
    fixtureGit(dir, ['init', '--quiet', '--template=']);
  }
  fixtureGit(other, ['commit', '--quiet', '--allow-empty', '-m', 'original']);
  const marker = join(other, 'marker'), index = join(other, '.git/index');
  writeFileSync(marker, 'staged');
  fixtureGit(other, ['add', 'marker']);
  writeFileSync(marker, 'unstaged');
  const otherState = () => [
    fixtureGit(other, ['show-ref', '--head']),
    fixtureGit(other, ['cat-file', '--batch-all-objects', '--batch-check']),
    readFileSync(index), readFileSync(marker),
  ];
  const before = otherState();
  const config = join(temp, 'gitconfig');
  writeFileSync(config, '[user]\n\tname = Other\n\temail = config@example.invalid\n');
  const previous = process.env;
  try {
    process.env = { ...previous, GIT_DIR: join(other, '.git'), GIT_INDEX_FILE: index, GIT_CONFIG_GLOBAL: config,
      GIT_AUTHOR_NAME: 'Hook author', GIT_AUTHOR_EMAIL: 'author@example.invalid',
      GIT_COMMITTER_NAME: 'Hook committer', GIT_COMMITTER_EMAIL: 'committer@example.invalid',
      GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'fixture.caller', GIT_CONFIG_VALUE_0: 'inherited' };
    writeFileSync(join(fixture, 'sample'), 'fixture contents');
    fixtureGit(fixture, ['add', 'sample']);
    fixtureGit(fixture, ['commit', '--quiet', '-m', 'fixture']);
    assert.doesNotMatch(fixtureGit(fixture, ['config', '--list']), /config@example\.invalid|fixture\.caller/);
  } finally {
    process.env = previous;
  }
  assert.equal(fixtureGit(fixture, ['show', '-s', '--format=%an <%ae>%n%cn <%ce>']),
    'Fixture <fixture@example.invalid>\nFixture <fixture@example.invalid>');
  assert.equal(fixtureGit(fixture, ['show', 'HEAD:sample']), 'fixture contents');
  assert.deepEqual(otherState(), before);
});
