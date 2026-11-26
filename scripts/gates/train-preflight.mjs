import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { typedGroup, cleanPreflightInputs } from './reuse/preflight.mjs';
import { captureOutputs, restoreOutputs } from './reuse/outputs.mjs';
import { requireOriginalReceipt, rowIdentity, sealReceipt } from './reuse/runner.mjs';
import { disabledGroups } from './reuse/audit.mjs';
import { freshHistory } from './reuse/store.mjs';
import { reuseDecision } from './reuse/policy.mjs';
import { gitInputs } from './reuse/fingerprint.mjs';

const git = (root, ...args) => execFileSync('git', ['--no-replace-objects', ...args],
  { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();

export function requireBatchId(id) {
  assert.match(id, /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/, 'Expected a batch UUID');
  return id;
}

function memberKey({ base, batch, member }) {
  requireBatchId(batch);
  for (const id of [base, member.parent, member.tree, member.commit, member.head]) assert.match(id, /^[a-f0-9]{40}$/);
  assert.ok(Number.isSafeInteger(member.number) && member.number > 0);
  return { base, batch, parent: member.parent, tree: member.tree, commit: member.commit,
    head: member.head, branch: member.branch, number: member.number };
}

const directoryRef = key => 'refs/uld-archive/member-preflights/' + [key.batch, key.number, key.base, key.parent, key.commit, ''].join('/');

const identity = ctx => {
  try {
    if (!cleanPreflightInputs(ctx)) return;
    const row = rowIdentity(ctx, typedGroup);
    if (!row.pipelineChanged && row.config.reusable &&
        (ctx.member.parent === ctx.base || !gitInputs(ctx.root, ctx.member.parent, ctx.base).pipelineChanged))
      return row.fingerprint;
  } catch {}
};

// Seal the result of the existing exact-prefix hook. Retain failed and incomplete attempts.
export function prepareMemberPreflight(ctx, run, controls) {
  const key = memberKey(ctx), id = randomUUID();
  const receipt = { schema: 1, reuseSchema: 1, kind: 'member-preflight', id, key, started: new Date().toISOString(), status: 'failed' };
  const prefix = directoryRef(key);
  git(ctx.root, 'update-ref', prefix + 'started/' + id, key.commit, '0'.repeat(40));
  const before = identity(ctx);
  try {
    const source = controls && before && preparedMember(ctx, before, id);
    if (source) {
      controls();
      if (identity(ctx) === before && preparedMember(ctx, before, id)?.id === source.id) {
        try {
          restoreOutputs(ctx.directory, ctx.snapshot, typedGroup, source.outputs);
          receipt.status = 'reused';
          receipt.sourceAttempt = source.id;
          return { reusedPreflight: source.id };
        } catch {}
      }
    }
    run();
    if (before && identity(ctx) === before) {
      try {
        receipt.outputs = captureOutputs(ctx.directory, ctx.snapshot, typedGroup);
        receipt.fingerprint = before;
      } catch (error) { receipt.reuseReason = error.message; }
    }
    receipt.status = 'passed';
  } catch (error) {
    receipt.error = error.message;
    throw error;
  } finally {
    receipt.finished = new Date().toISOString();
    sealReceipt(ctx.root, receipt);
    git(ctx.root, 'update-ref', prefix + 'finished/' + id, 'refs/uld-archive/member-preflight-receipts/' + id, '0'.repeat(40));
  }
  return { preflightId: id };
}

function preparedMember(ctx, fingerprint, currentAttempt) {
  try {
    const key = memberKey(ctx), prefix = directoryRef(key);
    const rows = git(ctx.root, 'for-each-ref', '--format=%(refname) %(objectname)', prefix);
    if (!rows || disabledGroups(ctx.directory).includes(typedGroup)) return;
    const history = freshHistory(ctx.directory, typedGroup);
    const refs = new Map(rows.split('\n').map(line => line.split(' ')));
    refs.delete(prefix + 'started/' + currentAttempt);
    const finished = [...refs].filter(([ref]) => ref.startsWith(prefix + 'finished/'));
    if (refs.size !== finished.length * 2) return;
    const passes = [];
    for (const [ref, blob] of finished) {
      const source = JSON.parse(git(ctx.root, 'cat-file', 'blob', blob));
      assert.equal(ref, prefix + 'finished/' + requireBatchId(source.id));
      assert.equal(refs.get(prefix + 'started/' + source.id), key.commit);
      assert.ok(isDeepStrictEqual(source.key, key));
      assert.equal(source.schema, 1);
      assert.equal(source.kind, 'member-preflight');
      requireOriginalReceipt(ctx.root, source, key.base);
      if (source.status === 'reused') continue;
      if (source.status !== 'passed') return;
      const record = { groupId: typedGroup, result: 'passed', retries: 0, createdAt: source.finished };
      if (source.fingerprint === fingerprint && reuseDecision({ mode: 'qualification', groupId: typedGroup,
        reusable: true, record, freshHistory: history }).reuse) passes.push(source);
    }
    return passes.at(-1);
  } catch { return undefined; }
}
