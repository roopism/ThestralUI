import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, createReadStream, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planAt } from './plan.mjs';
import { typedControlDigest } from '../typed-tools.mjs';

// All metadata is written by the workflow user. The shard runs as the existing
// unprivileged OS user with a private home and no Actions control files.
const [trusted, candidate, home, base, merge, id, output] = process.argv.slice(2);
assert.equal(realpathSync(trusted), realpathSync(fileURLToPath(new URL('../../../', import.meta.url))));
const git = (...args) => execFileSync('git', ['-C', trusted, ...args], { encoding: 'utf8' }).trim();
assert.equal(git('rev-parse', 'HEAD'), base);
const shard = planAt(trusted, base, merge).find(row => row.id === id);
assert.ok(shard && shard.lane !== 'local');
const workflow = git('rev-parse', base + ':.github/workflows/qualify.yml');
assert.equal(workflow, git('rev-parse', merge + ':.github/workflows/qualify.yml'));
mkdirSync(output, { mode: 0o700 });
const evidence = join(output, 'evidence.log'), fd = openSync(evidence, 'wx', 0o600);
const coverageFile = join(home, 'shard-coverage.json');
const env = { HOME: home, TMPDIR: join(home, 'tmp'), CI: '1', UI_GATE_SNAPSHOT: '1', ULD_READONLY_TOOLCHAIN: '1', PATH: process.env.PATH,
  PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH, LANG: 'en_US.UTF-8', ULD_ARTIFACT_COMMON: join(home, 'cache'), ULD_DEVICE_HOSTS: join(home, 'device-hosts'),
  GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_COUNT: '1',
  GIT_CONFIG_KEY_0: 'safe.directory', GIT_CONFIG_VALUE_0: realpathSync(trusted) };
for (const name of ['JAVA_HOME', 'MAESTRO_BIN', 'DEVELOPER_DIR', 'GEM_HOME', 'GEM_PATH']) {
  if (process.env[name]) env[name] = process.env[name];
}
const command = [process.execPath, join(trusted, 'scripts/gates/cloud/shard.mjs'), base, merge, id, coverageFile];
const start = performance.now();
let outcome;
try {
  outcome = spawnSync('sudo', ['-n', '-u', 'nobody', '/usr/bin/env', '-i',
    ...Object.entries(env).map(([k, v]) => k + '=' + v), ...command], { cwd: candidate, stdio: ['ignore', fd, fd] });
} finally { closeSync(fd); }
const hash = createHash('sha256');
for await (const chunk of createReadStream(evidence)) hash.update(chunk);
const result = { shard, base, merge, tree: git('rev-parse', merge + '^{tree}'), workflow, runId: Number(process.env.GITHUB_RUN_ID),
  controlDigest: typedControlDigest(trusted, base), durationMs: Math.round(performance.now() - start),
  result: 'failed', retries: 0, evidenceSha256: hash.digest('hex') };
try {
  assert.equal(outcome.status, 0, 'Hosted shard failed. See evidence.log');
  assert.equal(realpathSync(coverageFile), resolve(coverageFile));
  const stat = lstatSync(coverageFile);
  assert.ok(stat.isFile() && stat.size <= 65536 && stat.nlink === 1);
  result.coverage = JSON.parse(readFileSync(coverageFile));
  result.result = 'passed';
} finally { writeFileSync(join(output, 'result.json'), JSON.stringify(result) + '\n', { flag: 'wx' }); }
