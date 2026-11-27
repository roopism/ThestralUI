import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { passing, required } from '../../land.mjs';
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
  f.save(f.record(f.original), true);
  assert.equal(f.check(f.samePatch, f.updated), undefined);
});

test('landing verifies recorded identity fields against the preserved Git objects', t => {
  const f = fixture(t);
  f.save({ ...f.record(f.original), head: f.updated.commit, patchId: '0'.repeat(40) }, true);
  assert.throws(() => f.check(f.original, f.base), /inconsistent receipt/i);
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
