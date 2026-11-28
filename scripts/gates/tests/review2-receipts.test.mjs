import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { passing, required } from '../../land.mjs';
import { exactTrainQualification } from '../../train.mjs';
import { failUnfinishedAttempt, startAttempt } from '../qualification-attempt.mjs';
import { latestAttempt } from '../receipt-history.mjs';
import { sealReceipt } from '../reuse/runner.mjs';
import { fixtureGit, isolateFixtureProcess } from './fixtures/hermetic-git.mjs';

isolateFixtureProcess();

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'uld-receipt-history-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const directory = join(root, '.git', 'uld-receipts');
  const git = (args, input) => fixtureGit(root, args, input);
  git(['init', '--quiet', '--template=']);
  mkdirSync(join(directory, 'attempts'), { recursive: true });
  function revision(files, parents, title) {
    const records = Object.entries(files).map(([name, value]) => {
      const blob = git(['hash-object', '-w', '--stdin'], value);
      return '100644 blob ' + blob + '\t' + name + '\n';
    });
    const tree = git(['mktree'], records.join(''));
    const commit = git(['commit-tree', tree, ...parents.flatMap(parent => ['-p', parent.commit]), '-m', title]);
    return { tree, commit };
  }
  const base = revision({ title: 'before\n' }, [], 'base');
  const head = revision({ title: 'after\n' }, [base], 'proposal');
  const original = revision({ title: 'after\n' }, [base, head], 'original merge');
  const updated = revision({ title: 'before\n', notes: 'unrelated\n' }, [base], 'base advanced');
  const rebased = revision({ title: 'after\n', notes: 'unrelated\n' }, [updated], 'rebased proposal');
  const files = { title: 'after\n', notes: 'unrelated\n' };
  const sameHead = revision({ ...files, title: 'resolved after base update\n' }, [updated, head], 'same head with a different merge resolution');
  const samePatch = revision(files, [updated, rebased], 'rebased head, same patch');
  const changed = revision({ ...files, title: 'different change\n' }, [updated], 'different proposal');
  const record = (target, branchBase = base) => ({
    ...target, base: branchBase.commit, id: randomUUID(), mode: 'qualification', status: 'passed',
    scope: { iphone: false }, vm: { browsers: 'fixture', sourceImageSha256: 'fixture' },
    devices: { android: [{ id: 'low-end' }, { id: 'standard' }] },
    suites: required.map(name => ({ name, result: name === 'iPhone Simulator' ? 'web-only' : 'passed', durationMs: 1 })),
  });
  const save = (row, first = false) => writeFileSync(join(directory,
    first ? row.tree + '.json' : join('attempts', row.id + '.json')), JSON.stringify(row));
  const check = (target, branchBase) => passing(target.tree, branchBase.commit, directory, { root, commit: target.commit });
  return { root, directory, base, original, updated, sameHead, samePatch, changed, record, save, check };
}

test('a later complete pass supersedes earlier unfinished or failed suites', t => {
  const f = fixture(t);
  const passed = { ...f.record(f.original), started: '2026-01-02T00:00:00Z', finished: '2026-01-02T00:01:00Z' };
  f.save(passed, true);
  assert.equal(f.check(f.original, f.base).id, passed.id);
  rmSync(join(f.directory, passed.tree + '.json'));
  for (const status of ['running', 'interrupted', 'blocked', 'failed', 'passed']) {
    for (const result of ['running', 'interrupted', 'blocked', 'failed', 'pending', 'passed']) {
      if (status === 'passed' && result === 'passed') continue;
      const earlier = { ...f.record(f.original), started: '2026-01-01T00:00:00Z', status, suites: [{ name: 'Fast', result }] };
      f.save(earlier);
      f.save(passed);
      f.save(passed, true);
      assert.equal(f.check(f.original, f.base).id, passed.id);
      assert.deepEqual(JSON.parse(readFileSync(join(f.directory, 'attempts', earlier.id + '.json'))), earlier);
      rmSync(join(f.directory, 'attempts', earlier.id + '.json'));
    }
  }
});

test('related head and patch failures do not supersede an exact passing receipt', t => {
  const f = fixture(t);
  const failure = { ...f.record(f.original), status: 'running', suites: [{ name: 'Fast', result: 'failed' }] };
  f.save(failure);
  for (const target of [f.sameHead, f.samePatch]) {
    const pass = f.record(target, f.updated);
    f.save(pass, true);
    assert.deepEqual(f.check(target, f.updated), pass);
  }
  const unrelated = f.record(f.changed, f.updated);
  f.save(unrelated, true);
  assert.deepEqual(f.check(f.changed, f.updated), unrelated);
});

test('landing reads failed per-tree receipts and rejects a related attempt before any pass is published', t => {
  const f = fixture(t);
  f.save({ ...f.record(f.original), status: 'blocked' }, true);
  assert.equal(f.check(f.samePatch, f.updated), undefined);
});

test('a passing receipt for a related patch never substitutes for an exact tree and base', t => {
  const f = fixture(t);
  const pass = { ...f.record(f.original), finished: '2026-01-02T00:00:00Z' };
  f.save(pass, true);
  f.save(pass);
  assert.equal(f.check(f.samePatch, f.updated), undefined);
  const otherCommit = fixtureGit(f.root, ['commit-tree', pass.tree, '-p', pass.base, '-p', pass.commit, '-m', 'another merge']);
  f.save({ ...pass, id: randomUUID(), commit: otherCommit, status: 'failed', finished: '2026-01-03T00:00:00Z' });
  assert.equal(f.check({ tree: pass.tree, commit: otherCommit }, f.base), undefined);
  assert.deepEqual(f.check(f.original, f.base), pass);
  const train = { finalTree: pass.tree, finalCommit: pass.commit, base: pass.base };
  assert.deepEqual(exactTrainQualification(f.root, f.directory, train, passing), pass);
});

test('landing verifies recorded identity fields against the preserved Git objects', t => {
  const f = fixture(t);
  f.save({ ...f.record(f.original), head: f.updated.commit, patchId: '0'.repeat(40) }, true);
  assert.throws(() => f.check(f.original, f.base), /inconsistent receipt/i);
});

test('solo and train wait for every live exact attempt and verify the subsequent retry', async t => {
  const f = fixture(t);
  const live = startAttempt(f.root, f.directory, f.base.commit, f.original.commit, f.original.tree, 'qualification');
  const train = { finalTree: live.tree, finalCommit: live.commit, base: live.base };
  const trainReceipt = () => exactTrainQualification(f.root, f.directory, train, passing);
  const sealPass = () => {
    const now = new Date().toISOString();
    const pass = { ...f.record(f.original), reuseSchema: 1, started: now, finished: now };
    sealReceipt(f.root, pass);
    f.save(pass);
    f.save(pass, true);
    return pass;
  };
  const pass = sealPass();
  assert.equal(f.check(f.original, f.base), undefined);
  assert.throws(trainReceipt, /unfinished qualification/);

  const folder = join(f.root, 'scripts/gates');
  mkdirSync(folder, { recursive: true });
  const script = join(folder, 'local-run.mjs');
  writeFileSync(script, "process.send('ready'); setInterval(() => {}, 60000);");
  const runner = spawn(process.execPath, [script, f.root, live.base, live.commit, live.mode, live.id],
    { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  t.after(() => runner.kill());
  await once(runner, 'message');
  // The launcher has exited and its PID now refers to a different process generation.
  const abandoned = { ...live, owner: { ...live.owner, birth: 'Thu Jan  1 00:00:00 1970' } };
  f.save(abandoned);
  assert.equal(f.check(f.original, f.base), undefined);
  assert.throws(trainReceipt, /unfinished qualification/);
  const exited = once(runner, 'exit');
  runner.kill();
  await exited;
  assert.equal(f.check(f.original, f.base).id, pass.id);
  assert.equal(trainReceipt().id, pass.id);

  failUnfinishedAttempt(f.directory, live, Error('Overlapping attempt failed'));
  assert.equal(latestAttempt([abandoned, pass], f.directory).status, 'failed');
  assert.equal(f.check(f.original, f.base), undefined);
  assert.equal(trainReceipt().status, 'failed');
  const retry = sealPass();
  assert.equal(trainReceipt().id, retry.id);
  const changed = { ...retry, vm: { ...retry.vm, browsers: 'edited' } };
  f.save(changed);
  f.save(changed, true);
  assert.throws(() => f.check(f.original, f.base), /changed after its verdict/);
  assert.throws(trainReceipt, /changed after its verdict/);
});

test('an unsigned decision cannot clear a failed qualification', t => {
  const f = fixture(t);
  const failed = { ...f.record(f.original), status: 'failed' };
  const decisions = join(f.directory, '..', 'uld-delivery', 'owner-decisions', 'failed-attempts');
  mkdirSync(decisions, { recursive: true });
  const decision = `Owner permits landing tree ${failed.tree} after failed qualification ${failed.id}.`;
  writeFileSync(join(decisions, failed.id + '.json'), JSON.stringify({ tree: failed.tree, attempt: failed.id, decision }));
  f.save(failed, true);
  assert.equal(f.check(f.original, f.base), undefined);
});
