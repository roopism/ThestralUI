import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after } from 'node:test';

export function fixtureGitEnv(home, inherited = process.env) {
  const env = Object.fromEntries(Object.entries(inherited).filter(([key]) => !key.startsWith('GIT_')));
  return { ...env, HOME: home, XDG_CONFIG_HOME: join(home, '.config'),
    GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_ATTR_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'Fixture', GIT_COMMITTER_NAME: 'Fixture',
    GIT_AUTHOR_EMAIL: 'fixture@example.invalid', GIT_COMMITTER_EMAIL: 'fixture@example.invalid' };
}

export function fixtureGit(cwd, args, input) {
  return execFileSync('git', args, { cwd, env: fixtureGitEnv(cwd), input, encoding: 'utf8',
    maxBuffer: 128 << 20, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

// Gate modules under test also launch Git. Give those calls the test worker's private home.
export function isolateFixtureProcess() {
  const previous = process.env;
  const home = mkdtempSync(join(tmpdir(), 'uld-git-home-'));
  process.env = fixtureGitEnv(home);
  after(() => {
    process.env = previous;
    rmSync(home, { recursive: true, force: true });
  });
  return home;
}
