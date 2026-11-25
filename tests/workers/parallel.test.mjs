import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { acquireLock, recoverStaleLock, withIntegrationGate, withLock } from '../../scripts/workers/lock.mjs';
import { servicePorts, workerPorts } from '../../scripts/workers/ports.mjs';
import { installWorkerDependencies, workerWorktree } from '../../scripts/workers/worktree.mjs';

function repo(t) {
  const root = mkdtempSync(join(tmpdir(), 'worker-fixture-'));
  t.after(() => rmSync(root, { force: true, recursive: true }));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  git('init', '--quiet', '--template=', '--initial-branch=feat/enterprise-ui');
  git('-c', 'user.name=ThestralUI Bot', '-c', 'user.email=thestral-ui@users.noreply.github.com',
    'commit', '--allow-empty', '-qm', 'test(worker): initialize fixture');
  return { root, git };
}

test('each worker and MAIN gets a disjoint block for its servers', () => {
  const ports = new Set();
  for (const holder of ['MAIN', 'W1', 'W2', 'W3']) {
    const base = workerPorts(holder);
    for (const port of Object.values(servicePorts(base))) {
      assert.ok(port >= base && port < base + 100);
      assert.ok(!ports.has(port));
      ports.add(port);
    }
  }
  assert.equal(ports.size, 12);
  const authors = { C1: 6406, C2: 6506, C3: 6606, C4: 6706, C5: 6806, C6: 6906, C7: 7006 };
  for (const [holder, base] of Object.entries(authors)) {
    assert.equal(workerPorts(holder), base);
    for (const port of Object.values(servicePorts(base))) {
      assert.ok(port >= base && port < base + 100 && !ports.has(port));
      ports.add(port);
    }
  }
  assert.equal(ports.size, 33);
  assert.throws(() => servicePorts('4619'), /assigned/);
  assert.throws(() => workerPorts('toString'), /Expected/);
});

test('new branches start on the integration revision and reuse leaves worker edits intact', t => {
  const { root, git } = repo(t);
  const fresh = workerWorktree(root, 'W1', 'my-task');
  assert.equal(fresh.branch, 'family/my-task');
  assert.deepEqual(workerWorktree(fresh.worktree, 'W1', 'my-task'), fresh);

  git('-C', fresh.worktree, 'branch', '-m', 'feat/my-task');
  const worker = workerWorktree(root, 'W1', 'my-task');
  assert.equal(worker.branch, 'feat/my-task');
  assert.equal(worker.port, 6106);
  assert.equal(git('rev-parse', worker.branch), git('rev-parse', 'HEAD'));
  const note = join(worker.worktree, 'draft.md');
  writeFileSync(note, 'unfinished');
  assert.deepEqual(workerWorktree(worker.worktree, 'W1', 'my-task'), worker);
  assert.equal(readFileSync(note, 'utf8'), 'unfinished');

  const wip = join(root, '.worktrees', 'other-task');
  git('worktree', 'add', '-qb', 'wip/other-task', wip, 'HEAD');
  assert.equal(workerWorktree(root, 'W2', 'other-task').branch, 'wip/other-task');
  for (const holder of ['MAIN', 'C1', 'C7'])
    assert.throws(() => workerWorktree(root, holder, 'extra-worker'), /Usage/);
  assert.throws(() => workerWorktree(root, 'W1', '../escape'), /Usage/);
  mkdirSync(join(root, '.worktrees', 'existing-dir'));
  assert.throws(() => workerWorktree(root, 'W3', 'existing-dir'), /independent/);
});

for (const resource of ['integration', 'simulator']) {
  test(resource + ' is exclusive across linked worktrees and releases on errors', async t => {
    const { root, git } = repo(t);
    const { worktree } = workerWorktree(root, 'W3', 'native-tests');
    const release = acquireLock(root, resource, 'MAIN');
    const lockPath = git('rev-parse', '--path-format=absolute', '--git-common-dir') + '/uld-locks/' + resource;
    const record = JSON.parse(readFileSync(join(lockPath, 'owner.json'), 'utf8'));
    assert.equal(record.holder, 'MAIN');
    assert.equal(record.pid, process.pid);
    assert.ok(Number.isFinite(Date.parse(record.started)));
    assert.throws(() => acquireLock(worktree, resource, 'W3'), /lock held by MAIN/);
    release();
    await assert.rejects(withLock(worktree, resource, 'W3', async () => { throw Error('fixture failure'); }), /fixture failure/);
    assert.equal(await withLock(root, resource, 'MAIN', () => 'ok'), 'ok');
    mkdirSync(lockPath);
    assert.throws(() => acquireLock(worktree, resource, 'W3'), /lock held/);
  });
}

test('a batch can run a child gate under its reservation without admitting other suites', async t => {
  const { root } = repo(t);
  const module = new URL('../../scripts/workers/lock.mjs', import.meta.url).href;
  const child = [
    'import { withIntegrationGate } from ' + JSON.stringify(module),
    "await withIntegrationGate(process.cwd(), 'child gate', () => process.stdout.write('qualified'))",
  ].join('\n');
  await withLock(root, 'integration', 'MAIN', async lease => {
    assert.equal(execFileSync(process.execPath, ['--input-type=module', '-e', child], {
      cwd: root, encoding: 'utf8', env: { ...process.env, ULD_INTEGRATION_LEASE: lease },
    }), 'qualified');
    await assert.rejects(withIntegrationGate(root, 'foreign reservation', () => {}, 'wrong'), /Invalid/);
    await withIntegrationGate(root, 'first', async () => {
      await assert.rejects(withIntegrationGate(root, 'second', () => {}, lease), /Another suite/);
      assert.throws(() => acquireLock(root, 'integration', 'outsider'), /lock held/);
    }, lease);
  });
});

test('stale recovery only clears a dead local owner after 30 minutes', t => {
  const { root, git } = repo(t);
  const release = acquireLock(root, 'simulator', 'W2');
  const file = join(git('rev-parse', '--path-format=absolute', '--git-common-dir'), 'uld-locks/simulator/owner.json');
  const record = JSON.parse(readFileSync(file, 'utf8'));
  const exitedPid = spawnSync(process.execPath, ['-e', '']).pid;
  function update(overrides) { writeFileSync(file, JSON.stringify({ ...record, ...overrides })); }
  const old = new Date(Date.now() - 31 * 60_000).toISOString();
  update({ pid: exitedPid });
  assert.throws(() => recoverStaleLock(root, 'simulator'), /cannot be confirmed/);
  update({ started: old });
  assert.throws(() => recoverStaleLock(root, 'simulator'), /live process/);
  update({ pid: exitedPid, host: 'remote.test', started: old });
  assert.throws(() => recoverStaleLock(root, 'simulator'), /cannot be confirmed/);
  update({ pid: exitedPid, started: old });
  assert.equal(recoverStaleLock(root, 'simulator').id, record.id);
  const next = acquireLock(root, 'simulator', 'W3');
  assert.throws(release, /another holder/);
  next();
});

function racer(root, body) {
  const module = new URL('../../scripts/workers/lock.mjs', import.meta.url).href;
  const source = 'import { acquireLock, recoverStaleLock } from ' + JSON.stringify(module) + ';\n' +
    'process.send("ready"); process.once("message", () => {' + body + '});';
  const child = spawn(process.execPath, ['--input-type=module', '-e', source], {
    cwd: root, stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
  });
  const ready = new Promise((resolve, reject) => {
    child.once('message', resolve);
    child.once('error', reject);
  });
  const result = new Promise((resolve, reject) => {
    child.once('exit', (code, signal) => signal ? reject(Error(signal)) : resolve(code));
    child.once('error', reject);
  });
  return { child, ready, result };
}

test('contending processes cannot own or reclaim the same generation twice', async t => {
  const { root, git } = repo(t);
  const { worktree } = workerWorktree(root, 'W2', 'process-race');
  function children(action) {
    return [root, worktree, root, worktree].map(cwd => racer(cwd, action));
  }
  async function run(contenders, holdUntilAllTried = false) {
    await Promise.all(contenders.map(contender => contender.ready));
    const attempts = holdUntilAllTried && Promise.all(contenders.map(({ child }) =>
      new Promise(resolve => child.once('message', resolve))));
    for (const contender of contenders) contender.child.send('go');
    if (holdUntilAllTried) {
      await attempts;
      for (const { child } of contenders) child.send('finish');
    }
    return Promise.all(contenders.map(contender => contender.result));
  }
  // All four contend while the winner lives. Its later exit leaves a dead reservation.
  const acquired = await run(children(`
    try { acquireLock(process.cwd(), 'simulator', 'racer'); process.exitCode = 0; }
    catch (error) { process.exitCode = error.message.includes('held by') ? 2 : 1; }
    process.send('attempted');
    process.once('message', () => process.disconnect());
  `), true);
  assert.deepEqual(acquired.sort(), [0, 2, 2, 2]);
  const file = join(git('rev-parse', '--path-format=absolute', '--git-common-dir'), 'uld-locks/simulator/owner.json');
  const owner = JSON.parse(readFileSync(file, 'utf8'));
  owner.started = new Date(Date.now() - 31 * 60_000).toISOString();
  writeFileSync(file, JSON.stringify(owner));
  const reclaimed = await run(children(`
    try { recoverStaleLock(process.cwd(), 'simulator'); process.exitCode = 0; }
    catch (error) { process.exitCode = ['EEXIST','ENOENT'].includes(error.code) ? 2 : 1; }
    process.disconnect();
  `));
  assert.deepEqual(reclaimed.sort(), [0, 2, 2, 2]);
  acquireLock(root, 'simulator', 'new-owner')();
});

test('workers reuse only successful installs of their own current lockfile', t => {
  const { root } = repo(t);
  const first = workerWorktree(root, 'W1', 'first');
  const second = workerWorktree(root, 'W2', 'second');
  let installs = 0;
  for (const worker of [first, second]) writeFileSync(join(worker.worktree, 'package-lock.json'), '{}');
  const install = cwd => {
    installs++;
    mkdirSync(join(cwd, 'node_modules'), { recursive: true });
    writeFileSync(join(cwd, 'node_modules/.package-lock.json'), '{}');
  };
  installWorkerDependencies(first, cwd => {
    assert.throws(() => installWorkerDependencies(first, install), /already running/);
    installWorkerDependencies(second, install);
    install(cwd);
  });
  installWorkerDependencies(first, install);
  assert.equal(installs, 2);
  writeFileSync(join(first.worktree, 'package-lock.json'), '{"changed":true}');
  assert.throws(() => installWorkerDependencies(first, () => { throw Error('registry unavailable'); }), /registry unavailable/);
  installWorkerDependencies(first, install);
  assert.equal(installs, 3);
  rmSync(join(first.worktree, 'node_modules'), { recursive: true });
  installWorkerDependencies(first, install);
  assert.equal(installs, 4);
});
