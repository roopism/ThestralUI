import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { Script } from 'node:vm';
import { fixtureGit, isolateFixtureProcess } from './fixtures/hermetic-git.mjs';

isolateFixtureProcess();

const shard = new URL('../cloud/shard.mjs', import.meta.url);
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'thestral-hosted-control-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => fixtureGit(root, args);
  git('init', '--quiet', '--template=');
  function add(path, bytes) {
    mkdirSync(join(root, dirname(path)), { recursive: true });
    writeFileSync(join(root, path), bytes);
    git('add', '--', path);
  }
  return { root, git, add };
}
test('hosted No weakening compares the proposal lifetime with the trusted reuse policy', t => {
  const { root, git, add } = fixture(t);
  const path = 'scripts/gates/reuse/guardrails.json';
  const limits = JSON.parse(readFileSync(new URL('../reuse/guardrails.json', import.meta.url)));
  add('.github/CODEOWNERS', readFileSync(new URL('../../../.github/CODEOWNERS', import.meta.url)));
  add(path, JSON.stringify(limits));
  const base = git('write-tree');
  add(path, JSON.stringify({ ...limits, ttlHours: limits.ttlHours + 1 }));
  const program = `const { runShard } = await import(process.argv[1]);
    await runShard({ suite: 'No weakening' }, process.argv[2], process.argv[3]);`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', program, shard.href, base, git('write-tree')],
    { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /extended record lifetime/);
});

test('hosted Linux places its sandbox fixture outside system grants and macOS can collect canonical coverage', t => {
  const setup = readFileSync(new URL('../cloud/hosted-setup.sh', import.meta.url), 'utf8');
  const allocation = setup.match(/^(case "\$RUNNER_OS" in[\s\S]*?)^chmod 755 "\$root"$/m);
  assert.ok(allocation, 'Expected the worker setup before its children are created');
  // Exercise the actual evidence reader without starting a privileged shard or publishing a receipt.
  const runner = readFileSync(new URL('../cloud/hosted-runner.mjs', import.meta.url), 'utf8');
  const read = runner.match(/assert\.equal\(outcome\.status,[^\n]+\n([\s\S]*?)^  result\.result = 'passed';/m);
  assert.ok(read, 'Expected coverage validation between successful process exit and the passed verdict');
  const collector = new Script(read[1], { filename: 'hosted-runner.mjs' });
  const collect = coverageFile => {
    const result = {};
    collector.runInNewContext({ assert, realpathSync, resolve, lstatSync, readFileSync, coverageFile, result, JSON });
    return result.coverage;
  };
  for (const os of ['Linux', 'macOS']) {
    const dir = execFileSync('bash', ['-eu', '-c', allocation[1] + '\nprintf "%s" "$root"'],
      { env: { ...process.env, RUNNER_OS: os }, encoding: 'utf8' });
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    assert.equal(dir, realpathSync(dir));
    assert.equal(dirname(dir), realpathSync(os === 'Linux' ? '/var/tmp' : '/tmp'));
    const home = join(dir, 'home');
    mkdirSync(home, { mode: 0o700 });
    if (os === 'Linux') {
      const fixture = mkdtempSync(join(home, 'uld-reuse-check-'));
      for (const grant of ['/usr', '/etc', '/dev', '/proc', '/sys', '/tmp', '/opt', '/run']) {
        if (existsSync(grant)) assert.ok(!fixture.startsWith(realpathSync(grant) + '/'));
      }
    }
    const report = join(home, 'shard-coverage.json');
    writeFileSync(report, '{"cases":["one"]}');
    assert.deepEqual(collect(report), { cases: ['one'] });
    if (os === 'macOS' && realpathSync('/tmp') !== '/tmp') {
      assert.throws(() => collect(report.replace(dirname(dir) + '/', '/tmp/')), { code: 'ERR_ASSERTION' });
    }
    writeFileSync(report, ' '.repeat(65536) + '{}');
    assert.throws(() => collect(report), { code: 'ERR_ASSERTION' });
  }
});

test('the Mac visual suite stays local and missing visual evidence blocks a combined verdict', async () => {
  const { qualificationShards } = await import('../cloud/lanes.mjs');
  const { combineEvidence } = await import('../cloud/coordinator.mjs');
  const lanes = JSON.parse(readFileSync(new URL('../cloud/lanes.json', import.meta.url)));
  const inputs = JSON.parse(readFileSync(new URL('../../../tests/acceptance/suite-inputs.json', import.meta.url)));
  const shards = qualificationShards(lanes, Object.keys(inputs.groups));
  const visual = 'Mac visual comparisons';
  assert.deepEqual(shards.filter(shard => shard.suite === visual), [
    { id: 'mac-visual-comparisons-local-1-of-1', suite: visual, lane: 'local', shard: 1, shards: 1 },
  ]);
  const proposed = structuredClone(lanes);
  proposed.suites[visual] = { lane: 'github-macos', shards: 3, splitBy: 'engine' };
  assert.throws(() => qualificationShards(proposed, Object.keys(inputs.groups)));
  const expected = { base: 'a'.repeat(40), merge: 'b'.repeat(40), tree: 'c'.repeat(40) };
  const hosted = shards.filter(shard => shard.lane !== 'local').map(({ id }) => ({ id }));
  const suites = shards.filter(shard => shard.lane === 'local' && shard.suite !== visual)
    .map(shard => ({ name: shard.suite, result: 'passed', durationMs: 1 }));
  const local = { id: 'local-fixture', base: expected.base, commit: expected.merge, tree: expected.tree,
    mode: 'qualification', status: 'passed', suites };
  assert.throws(() => combineEvidence(expected, shards, hosted, local), /Missing or duplicate local suite Mac visual comparisons/);
});

test('hosted reservations resolve inside the isolated candidate repository', t => {
  const {root} = fixture(t);
  const home = join(root,'home'), candidate = join(root,'candidate'), trusted = join(root,'base');
  mkdirSync(join(home,'cache'), {recursive:true});
  mkdirSync(trusted);
  fixtureGit(root, ['init', '--quiet', '--template=', candidate]);
  const runner = readFileSync(new URL('../cloud/hosted-runner.mjs', import.meta.url),'utf8');
  const expression = runner.match(/^const env = (\{[\s\S]*?\});$/m)[1];
  const env = new Script('(' + expression + ')').runInNewContext({home,candidate,trusted,join,realpathSync,process});
  const common = fixtureGit(env.ULD_ARTIFACT_COMMON, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  assert.equal(common,join(realpathSync(candidate),'.git'));
});
