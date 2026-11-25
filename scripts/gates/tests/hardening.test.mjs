import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { acquireLock, withLock } from '../../workers/lock.mjs';

const project = fileURLToPath(new URL('../../../', import.meta.url));
const source = (file) => readFileSync(join(project, file), 'utf8');
function repo(t) {
  const root = mkdtempSync(join(tmpdir(), 'uld-local-check-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const env = { ...process.env };
  for (const key of execFileSync('git', ['rev-parse', '--local-env-vars'], { encoding: 'utf8' })
    .trim()
    .split('\n'))
    delete env[key];
  const git = (...args) => execFileSync('git', args, { cwd: root, env, encoding: 'utf8' }).trim();
  git('init', '--quiet', '--template=');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.invalid');
  return { root, git, env };
}

test('the staged checker uses the base runner on the staged candidate data', (t) => {
  const { root, git, env } = repo(t);
  const gate = join(root, 'scripts/gates');
  mkdirSync(gate, { recursive: true });
  const path = join(gate, 'local-run.mjs');
  writeFileSync(
    join(gate, 'no-weakening.mjs'),
    "import assert from 'node:assert/strict'; assert.ok(process.argv[2] && process.argv[3]);",
  );
  writeFileSync(
    join(root, 'package.json'),
    '{"name":"local-check-fixture","version":"1.0.0","dependencies":{"fixture-dep":"file:dep"}}',
  );
  mkdirSync(join(root, 'dep'));
  writeFileSync(join(root, 'dep/package.json'), '{"name":"fixture-dep","version":"1.0.0"}');
  execFileSync(
    'npm',
    ['install', '--package-lock-only', '--offline', '--ignore-scripts', '--no-audit', '--no-fund'],
    { cwd: root, env },
  );
  const input =
    "import {readFileSync} from 'node:fs';\nthrow Error('BASE-RUNNER: '+readFileSync('input.txt','utf8'));";
  writeFileSync(path, input);
  writeFileSync(join(root, 'input.txt'), 'base input');
  git('add', '.');
  git('commit', '--quiet', '-m', 'base');
  writeFileSync(path, "throw Error('CANDIDATE-RUNNER');");
  writeFileSync(join(root, 'input.txt'), 'staged input');
  git('add', '.');
  writeFileSync(join(root, 'input.txt'), 'working copy input');
  const r = spawnSync(process.execPath, [join(project, 'scripts/qualify.mjs'), '--staged'], {
    cwd: root,
    env,
    encoding: 'utf8',
  });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Error: BASE-RUNNER: staged input/);
  assert.doesNotMatch(r.stderr, /Error: CANDIDATE-RUNNER/);
});

test('qualification refreshes the integration ref before accepting a committed tree', (t) => {
  const { root, git, env } = repo(t);
  git('commit', '--allow-empty', '--quiet', '-m', 'old');
  const previous = git('rev-parse', 'HEAD');
  git('commit', '--allow-empty', '--quiet', '-m', 'new');
  const newer = git('rev-parse', 'HEAD');
  git('branch', 'feat/enterprise-ui', newer);
  git('remote', 'add', 'origin', root);
  git('update-ref', 'refs/remotes/origin/feat/enterprise-ui', previous);
  const run = spawnSync(process.execPath, [join(project, 'scripts/qualify.mjs'), previous], {
    cwd: root,
    env,
    encoding: 'utf8',
  });
  assert.notEqual(run.status, 0);
  assert.equal(git('rev-parse', 'origin/feat/enterprise-ui'), newer);
});

test('a definitely dead local holder releases a new reservation immediately', (t) => {
  const { root, env } = repo(t);
  const module = new URL('../../workers/lock.mjs', import.meta.url).href;
  const run = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      'import { acquireLock } from ' +
        JSON.stringify(module) +
        '; acquireLock(process.cwd(),"simulator","fixture"); process.kill(process.pid,"SIGKILL");',
    ],
    { cwd: root, env },
  );
  assert.equal(run.signal, 'SIGKILL');
  const release = acquireLock(root, 'simulator', 'next fixture');
  release();
  assert.equal(existsSync(join(root, '.git/uld-locks/simulator')), false);
});

test('signals release owned reservations and a live suite protects a dead holder', (t) => {
  const { root, env } = repo(t);
  const module = new URL('../../workers/lock.mjs', import.meta.url).href;
  const prelude = 'import { acquireLock, releaseLocksOnSignal } from ' + JSON.stringify(module) + ';';
  const directory = join(root, '.git/uld-locks/simulator');
  for (const signal of ['SIGINT', 'SIGTERM']) {
    const run = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        prelude +
          'releaseLocksOnSignal(); acquireLock(process.cwd(), "simulator", "fixture");' +
          'setInterval(() => {}, 1000); process.kill(process.pid, ' +
          JSON.stringify(signal) +
          ');',
      ],
      { cwd: root, env },
    );
    assert.equal(run.signal, signal);
    assert.equal(existsSync(directory), false);
  }
  const run = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', prelude + 'acquireLock(process.cwd(), "simulator", "fixture");'],
    { cwd: root, env },
  );
  assert.equal(run.status, 0);
  const { id } = JSON.parse(readFileSync(join(directory, 'owner.json')));
  writeFileSync(join(directory, 'suite-' + id + '.json'), JSON.stringify({ pid: process.pid }));
  assert.throws(() => acquireLock(root, 'simulator', 'waiter'), /live qualification process/);
});

test('a surviving qualification subprocess keeps its resource after the group leader exits', (t) => {
  const { root, env } = repo(t);
  const module = new URL('../../workers/lock.mjs', import.meta.url).href;
  const script = [
    'import { spawn } from "node:child_process";',
    'import { writeFileSync } from "node:fs";',
    'import { acquireLock } from ' + JSON.stringify(module) + ';',
    'acquireLock(process.cwd(), "simulator", "fixture");',
    'const child = spawn(process.execPath, ["-e", "setTimeout(() => {}, 30000)"], { stdio: "ignore" });',
    'writeFileSync("child.pid", String(child.pid));',
    'child.unref();',
  ].join('\n');
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: root,
    env,
    detached: true,
  });
  assert.equal(run.status, 0);
  const child = Number(readFileSync(join(root, 'child.pid'), 'utf8'));
  t.after(() => {
    try {
      process.kill(child, 'SIGTERM');
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  });
  assert.throws(() => acquireLock(root, 'simulator', 'next fixture'), /live qualification/);
});

test('hooks run staged checks independently of the integration reservation', async (t) => {
  const { runWithIntegrationReservation } = await import('../qualification-policy.mjs');
  let queued = 0,
    checked = 0;
  const lock = async (_root, _name, _holder, run) => {
    queued++;
    return run();
  };
  const run = () => {
    checked++;
  };
  await runWithIntegrationReservation('hook', 'fixture', 'tree', run, lock);
  assert.equal(queued, 0);
  assert.equal(checked, 1);
  await runWithIntegrationReservation('qualification', 'fixture', 'tree', run, lock);
  assert.equal(queued, 1);
  assert.equal(checked, 2);
  const { root } = repo(t);
  const release = acquireLock(root, 'integration', 'full qualification fixture');
  try {
    const shortWait = (cwd, resource, holder, job) =>
      withLock(cwd, resource, holder, job, { timeoutMs: 250 });
    assert.equal(
      await runWithIntegrationReservation('hook', root, 'tree', () => 'checked', shortWait),
      'checked',
    );
  } finally {
    release();
  }
});

test('a failed or blocked qualification stage makes the receipt fail', async () => {
  const { qualificationStatus } = await import('../qualification-policy.mjs');
  const row = { name: 'Fast', result: 'passed' };
  for (const result of ['failed', 'blocked', 'pending', 'web-only'])
    assert.equal(qualificationStatus([{ ...row, result }]), 'failed');
  assert.equal(qualificationStatus([row]), 'passed');
  assert.equal(qualificationStatus([row], 'interrupted'), 'failed');
  assert.equal(qualificationStatus([{ name: 'iPhone Simulator', result: 'web-only' }]), 'passed');
});

test('post-merge discrepancies block landings through verification of the actual merged tree', async (t) => {
  const { root } = repo(t),
    expected = '1'.repeat(40),
    actual = '2'.repeat(40),
    commit = '3'.repeat(40);
  const { recordMergeResult, requireResolvedMerge } = await import('../landing-policy.mjs');
  recordMergeResult(root, commit, actual, expected);
  assert.throws(() => requireResolvedMerge(root, () => undefined), /qualif/i);
  assert.throws(
    () => requireResolvedMerge(root, () => ({ commit, tree: expected, status: 'passed' })),
    /qualif/i,
  );
  requireResolvedMerge(root, () => ({ commit, tree: actual, status: 'passed' }));
  assert.equal(existsSync(join(root, 'landing-blocked.json')), false);
});

test('gate changes land on a dedicated branch without product files', async () => {
  const { requireGateIsolation } = await import('../landing-policy.mjs');
  const owned = ['scripts/', '.github/', 'package.json'];
  assert.throws(
    () => requireGateIsolation('family/button', ['scripts/gates/fast-typed.mjs'], owned),
    /gates\//,
  );
  assert.throws(
    () =>
      requireGateIsolation(
        'gates/policy',
        ['scripts/gates/fast-typed.mjs', 'packages/web/src/Button.tsx'],
        owned,
      ),
    /mix/i,
  );
  assert.throws(() => requireGateIsolation('gates/policy', ['scripts/gates/fast-typed.mjs', 'package.json'], owned), /mix/i);
  requireGateIsolation('family/button', ['packages/web/src/Button.tsx'], owned);
});

test('family manifests and package configuration can land with product code', async () => {
  const { requireGateIsolation } = await import('../landing-policy.mjs');
  const product = 'packages/web/src/button/binding.tsx';
  const configurations = ['package.json', 'package-lock.json', 'manifests/shared.json', 'tsconfig.json', 'ui-policy.json'];
  const owners = ['scripts/', 'packages/policy/', ...configurations];
  assert.doesNotThrow(() => requireGateIsolation('family/button', [product, ...configurations], owners));
  const directories = ['scripts', '.githooks', '.github', 'packages/policy', 'packages/style-policy', 'tests/android', 'tests/simulator'];
  for (const directory of directories) {
    const code = directory + '/check';
    assert.throws(() => requireGateIsolation('family/button', [code]), /gates\//);
    assert.throws(() => requireGateIsolation('gates/change', [code, product]), /mix/i);
    assert.doesNotThrow(() => requireGateIsolation('gates/change', [code]));
    assert.doesNotThrow(() => requireGateIsolation('family/button', [directory + '-examples/check', product]));
  }
});

test('the live hook has tests and the unused revision and shared dispatchers are retired', () => {
  const entry = source('packages/policy/quality/check-staged.mjs');
  assert.doesNotMatch(entry, /function checkRevision\(/);
  assert.doesNotMatch(entry, /mode === 'shared'/);
  for (const file of ['tests/contracts/commit-hook.test.mjs', 'tests/contracts/simulator-scope.test.mjs'])
    assert.match(source(file), /qualify\.mjs[\s\S]{0,90}--staged/);
});

test('landing validates the current integration base, suite roster and qualification mode', async (t) => {
  assert.match(
    source('scripts/land.mjs'),
    /export function passing\(/,
    'land must expose its actual receipt predicate to this check',
  );
  const { passing, required } = await import('../../land.mjs');
  const { root } = repo(t),
    tree = 'a'.repeat(40),
    base = 'b'.repeat(40);
  const receipt = {
    tree,
    base,
    mode: 'qualification',
    status: 'passed',
    scope: { iphone: true },
    vm: { browsers: 'fixture', sourceImageSha256: 'fixture' },
    devices: { android: [{ id: 'low-end' }, { id: 'standard' }], iphone: { passed: true } },
    suites: required.map((name) => ({ name, result: 'passed', durationMs: 1 })),
  };
  const save = (data) => writeFileSync(join(root, tree + '.json'), JSON.stringify(data));
  save(receipt);
  assert.deepEqual(passing(tree, base, root), receipt);
  assert.equal(passing(tree, 'c'.repeat(40), root), undefined);
  const attempts = join(root, 'attempts');
  mkdirSync(attempts);
  const failedId = 'c5f4cabc-94bd-4264-a56e-da7c12d3888d';
  const failed = join(attempts, failedId + '.json');
  writeFileSync(failed, JSON.stringify({ id: failedId, tree, base, mode: 'qualification', status: 'failed' }));
  assert.throws(() => passing(tree, base, root), /earlier failed qualification/i);
  rmSync(failed);

  save({ ...receipt, suites: receipt.suites.slice(1) });
  assert.throws(() => passing(tree, base, root));
  save({ ...receipt, mode: 'hook' });
  assert.throws(() => passing(tree, base, root));
});

test('publishing a later attempt preserves the first per-tree result and both attempts', async t => {
  const { root } = repo(t);
  const { publishFirstReceipt } = await import('../receipt-history.mjs');
  const directory = join(root, 'attempts');
  mkdirSync(directory);
  const tree = 'e'.repeat(40);
  for (const [id, status] of [['first', 'failed'], ['second', 'passed']]) {
    writeFileSync(join(directory, id + '.json'), JSON.stringify({ status }));
    publishFirstReceipt(root, tree, id);
  }
  assert.deepEqual(JSON.parse(readFileSync(join(root, tree + '.json'))), { status: 'failed' });
  assert.deepEqual(JSON.parse(readFileSync(join(directory, 'second.json'))), { status: 'passed' });
});

test('guest preparation reuses only matching dependencies and installed browser revisions', async (t) => {
  assert.doesNotMatch(
    source('scripts/gates/linux-vm.mjs'),
    /^\s*'npm ci --no-audit --no-fund',/m,
    'guest checkout currently performs unconditional installations',
  );
  const { prepareGuest } = await import('../linux-prepare.mjs');
  const { root } = repo(t);
  writeFileSync(join(root, 'package.json'), '{"name":"example","version":"1.0.0"}');
  writeFileSync(
    join(root, 'package-lock.json'),
    '{"name":"example","lockfileVersion":3,"packages":{"":{"name":"example"}}}',
  );
  let installs = 0,
    browsers = 0,
    version = '1.0',
    ready = false;
  const cache = mkdtempSync(join(tmpdir(), 'uld-host-cache-'));
  t.after(() => rmSync(cache, { recursive: true, force: true }));
  const operations = {
    cache,
    installDependencies: stage => {
      installs++;
      mkdirSync(join(stage, 'node_modules'), { recursive: true });
      writeFileSync(join(stage, 'node_modules/.package-lock.json'), '{}');
    },
    playwrightVersion: () => version,
    browsersPresent: () => ready,
    installBrowsers: () => {
      browsers++;
      ready = true;
    },
  };
  assert.equal(prepareGuest(root, operations).dependencies, 'installed');
  assert.equal(prepareGuest(root, operations).browsers, 'reused');
  assert.deepEqual([installs, browsers], [1, 1]);
  version = '2.0';
  assert.equal(prepareGuest(root, operations).browsers, 'installed');
  ready = false;
  assert.equal(prepareGuest(root, operations).browsers, 'installed');
  writeFileSync(
    join(root, 'package-lock.json'),
    '{"name":"example","lockfileVersion":3,"packages":{"":{"name":"example","version":"1.0.0"}}}',
  );
  assert.equal(prepareGuest(root, operations).dependencies, 'installed');
  assert.deepEqual([installs, browsers], [2, 3]);
});
