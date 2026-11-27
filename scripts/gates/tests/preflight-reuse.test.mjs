import { prepareMemberPreflight } from '../train-preflight.mjs';
import assert from 'node:assert/strict';
import { execFile, execFileSync, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { preflightChecks, preflightRunner, requirePreflight, writePreflightReceipt } from '../preflight-receipt.mjs';
import { gateGroup, observePreflightStage, typedGroup } from '../reuse/preflight.mjs';
import { decideRow, executeChoice, rowIdentity, sealReceipt, useRecord } from '../reuse/runner.mjs';
import { projectStoredPasses, verifiedSource } from '../reuse/store.mjs';
import { selectAudit } from '../reuse/audit.mjs';
import { compareFullRun } from '../reuse/full-run.mjs';
import { fixtureGit, isolateFixtureProcess } from './fixtures/hermetic-git.mjs';
import { phases, runPreflight } from '../../verify-preflight.mjs';

isolateFixtureProcess();

async function fixture(t, files = {}) {
  const root = mkdtempSync(join(tmpdir(), 'uld-preflight-reuse-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  function write(path, value) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), value);
  }
  const git = (...args) => fixtureGit(root, args);
  git('init', '--quiet', '--template=');
  write('.gitignore', 'dist/\nrelease/\n');
  write('scripts/verify-preflight.mjs', '// trusted producer\n');
  write('scripts/gates/reuse/preflight.mjs', '// adopted receipt format\n');
  write('package-lock.json', '{}');
  write('tests/acceptance/suite-inputs.json', JSON.stringify({ contractVersion: 1, groups: {
    [typedGroup]: { mode: 'tree', reusable: true, exclude: [], envFacts: ['node','lockfile'], extraInputs: ['uld-cache/input'] },
  } }));
  write('.git/uld-cache/input', 'initial');
  for (const [path, content] of Object.entries(files)) write(path, content);
  git('add', '.');
  git('commit', '--quiet', '-m', 'fixture');
  const base = git('rev-parse', 'HEAD'), tree = git('rev-parse', 'HEAD^{tree}');
  const common = join(root, '.git'), directory = join(common, 'uld-receipts'), id = randomUUID(), prior = randomUUID();
  write('.git/uld-receipts/attempts/' + prior + '.json', JSON.stringify({ id: prior, started: new Date().toISOString(),
    suites: [typedGroup, 'No weakening'].map(name => ({ name, result: 'passed' })) }));
  const ctx = { root, base, commit: base, tree, snapshot: root, trusted: root, common, directory,
    mode: 'qualification', preflightId: id, attemptId: randomUUID(), reuseStages: [] };
  const calls = [];
  await observePreflightStage(ctx, gateGroup, () => { calls.push(gateGroup); });
  await observePreflightStage(ctx, typedGroup, () => {
    calls.push(typedGroup);
    for (const path of ['packages/tokens/dist', 'packages/web/dist', 'packages/native/dist', 'release/evidence'])
      write(path + '/output', path);
  });
  assert.deepEqual(calls, [gateGroup, typedGroup]);
  assert.deepEqual(ctx.reuseStages.map(row => row.name), calls);
  const receipt = { schema: 1, reuseSchema: 1, kind: 'preflight', id, base, tree, commit: base,
    runner: preflightRunner(root, base, base), checks: preflightChecks.map(name => ({ name, result: 'passed' })),
    finished: new Date().toISOString(), status: 'passed', reuseStages: ctx.reuseStages };
  sealReceipt(root, receipt);
  const path = writePreflightReceipt(common, receipt);
  const choose = (name, context = ctx) => decideRow(context, name, rowIdentity(context, name));
  return { ctx, write, git, choose, path, receipt };
}

test('matching preflight fingerprints reuse both stage verdicts and restore Typed outputs', async t => {
  const { ctx, choose } = await fixture(t);
  assert.equal(requirePreflight(ctx.root, ctx.common, ctx.base, ctx.commit, ctx.tree).id, ctx.preflightId);
  const snapshot = mkdtempSync(join(tmpdir(), 'uld-preflight-consumer-'));
  t.after(() => rmSync(snapshot, { recursive: true, force: true }));
  mkdirSync(join(snapshot, '.git'), { recursive: true });
  const rows = [];
  for (const name of [gateGroup, typedGroup]) {
    const decision = choose(name);
    const row = { name, fingerprint: decision.record.fingerprint };
    await executeChoice(row, decision, false, () => useRecord({ ...ctx, snapshot }, row, decision.record),
      () => assert.fail('Unexpected fresh execution of ' + name));
    assert.equal(row.result, 'reused');
    assert.equal(row.reusedFrom, ctx.preflightId);
    rows.push(row);
  }
  assert.equal(readFileSync(join(snapshot, 'release/evidence/output'), 'utf8'), 'release/evidence');
  const consumer = { ...ctx, reuseSchema: 1, noReuse: false, suites: [rows[1]], gateTests: rows[0] };
  const projected = projectStoredPasses(ctx.directory, consumer);
  assert.deepEqual([projected.gateTests.result, projected.suites[0].result], ['passed', 'passed']);
  assert.throws(() => projectStoredPasses(ctx.directory, { ...consumer, tree: '0'.repeat(40) }));
});

test('changed tree, trusted runner, external input or environment forces fresh checks', async t => {
  const { ctx, write, git, choose } = await fixture(t);
  function fresh(context) {
    for (const name of [gateGroup, typedGroup]) assert.equal(choose(name, context).reuse, false);
  }
  write('extra.txt', 'different candidate');
  git('add', 'extra.txt');
  fresh({ ...ctx, tree: git('write-tree') });
  write('scripts/verify-preflight.mjs', '// changed runner\n');
  git('add', 'scripts');
  fresh({ ...ctx, base: git('commit-tree', git('write-tree'), '-m', 'different trusted base') });
  git('restore', '--source=HEAD', '--staged', '--worktree', '.');
  for (const name of [gateGroup, typedGroup]) assert.equal(choose(name).reuse, true);
  const original = rowIdentity(ctx, typedGroup).fingerprint;
  write('.git/uld-cache/input', 'different external input');
  assert.notEqual(rowIdentity(ctx, typedGroup).fingerprint, original);
  fresh(ctx);
  write('.git/uld-cache/input', 'initial');
  assert.equal(rowIdentity(ctx, typedGroup).fingerprint, original);
  write('package-lock.json', 'changed lockfile fact');
  assert.notEqual(rowIdentity(ctx, typedGroup).fingerprint, original);
  fresh(ctx);
});

test('tampering with either preflight receipt or a Typed artifact refuses its verdict', async t => {
  const { ctx, choose, path, receipt } = await fixture(t);
  const admit = () => requirePreflight(ctx.root, ctx.common, ctx.base, ctx.commit, ctx.tree);
  writeFileSync(path, JSON.stringify({ ...receipt, branch: 'other' }));
  assert.throws(admit, /sealed verdict/);
  writeFileSync(path, JSON.stringify({ ...receipt, reuseSchema: undefined, reuseStages: undefined }));
  assert.throws(admit, /sealed verdict/);
  writePreflightReceipt(ctx.common, receipt);
  const { sha } = receipt.reuseStages.find(row => row.name === typedGroup).outputs[0];
  rmSync(join(ctx.common, 'uld-cache/objects', sha.slice(0,2), sha.slice(2)));
  assert.equal(choose(typedGroup).reuse, false);
  writeFileSync(join(dirname(path), 'attempts', receipt.id + '.json'), '{}');
  assert.throws(admit, /sealed verdict/);
  assert.equal(choose(gateGroup).reuse, false);
});

test('preflight reuse participates in the random audit and daily fresh comparison', async t => {
  const { ctx, choose } = await fixture(t);
  const names = [typedGroup, gateGroup], audit = selectAudit(names, '12'.repeat(32));
  const fresh = [], reused = [];
  for (const name of names) {
    const decision = choose(name);
    await executeChoice({}, decision, name === audit, () => reused.push(name), () => fresh.push(name));
    assert.equal(choose(name, { ...ctx, noReuse: true }).reuse, false);
    assert.equal(choose(name, { ...ctx, mode: 'release' }).reuse, false);
  }
  assert.deepEqual(fresh, [audit]);
  assert.equal(reused.length, 1);
  const row = { name: gateGroup, result: 'reused', fingerprint: choose(gateGroup).record.fingerprint, reusedFrom: ctx.preflightId };
  const history = [{ id: 'prior', mode: 'qualification', status: 'passed', suites: [], gateTests: row }];
  const daily = { mode: 'qualification', status: 'failed', noReuse: true, suites: [],
    gateTests: { ...row, result: 'failed', reusedFrom: null } };
  const disabled = [];
  compareFullRun(ctx.directory, daily, history, (_directory, name) => disabled.push(name));
  assert.deepEqual(disabled, [gateGroup]);
});

test('batch admission retains its exact sealed preflight when a parallel preflight replaces the pointer', async t => {
  const { bindTrainPreflight, requireTrainPreflight } = await import('../train-plan.mjs');
  const { ctx, git } = await fixture(t);
  assert.equal(git('cat-file', '-t', 'HEAD:package-lock.json'), 'blob');
  const trainId = randomUUID(), trainPlan = git('rev-parse', 'HEAD:package-lock.json');
  git('update-ref', 'refs/uld-archive/train-plans/' + trainId, trainPlan);
  const original = requirePreflight(ctx.root, ctx.common, ctx.base, ctx.commit, ctx.tree);
  const exact = { ...original, id: randomUUID(), trainId, trainPlan };
  sealReceipt(ctx.root, exact);
  writePreflightReceipt(ctx.common, exact);
  bindTrainPreflight(ctx.root, exact);
  const competing = { ...original, id: randomUUID() };
  sealReceipt(ctx.root, competing);
  writePreflightReceipt(ctx.common, competing);
  assert.equal(requirePreflight(ctx.root, ctx.common, ctx.base, ctx.commit, ctx.tree).id, competing.id);
  const admit = () => requireTrainPreflight(ctx.root, ctx.common, ctx.base, ctx.commit, ctx.tree, trainId);
  assert.deepEqual(admit(), exact);
  assert.throws(() => requireTrainPreflight(ctx.root, ctx.common, ctx.base, ctx.commit, ctx.tree, randomUUID()));
  writeFileSync(join(ctx.common, 'uld-receipts', 'preflight', 'attempts', exact.id + '.json'), JSON.stringify(competing));
  assert.throws(admit);
});

test('stacked member preflight binds the predecessor and restores sealed Typed outputs', async t => {
  const { ctx, git, receipt } = await fixture(t);
  const parent = git('commit-tree', ctx.tree, '-p', ctx.base, '-m', 'Predecessor');
  const commit = git('commit-tree', ctx.tree, '-p', parent, '-m', 'Member');
  const member = { number: 2, head: commit, branch: 'gates/member', commit, parent, tree: ctx.tree };
  const request = { ...ctx, commit, member, batch: randomUUID() };
  const clearOutputs = () => {
    for (const path of ['packages/tokens/dist', 'packages/web/dist', 'packages/native/dist', 'release/evidence'])
      rmSync(join(ctx.root, path), { recursive: true, force: true });
  };
  const calls = [];
  const check = (candidate, controls = () => calls.push('controls')) =>
    prepareMemberPreflight(candidate, () => calls.push('hook'), controls);
  const { preflightId } = check(request);
  assert.deepEqual(calls.splice(0), ['hook']);
  clearOutputs();
  check({ ...request, batch: randomUUID() });
  check({ ...request, member: { ...member, parent: ctx.base } });
  assert.deepEqual(calls.splice(0), ['hook', 'hook']);
  assert.deepEqual(check(request), { reusedPreflight: preflightId });
  assert.deepEqual(calls.splice(0), ['controls']);
  const admitted = requirePreflight(ctx.root, ctx.common, ctx.base, ctx.commit, ctx.tree);
  assert.equal(admitted.id, receipt.id);
  assert.notEqual(preflightId, admitted.id);
  const qualification = { ...ctx, preflightId: admitted.id };
  for (const name of [typedGroup, gateGroup]) {
    const decision = decideRow(qualification, name, rowIdentity(qualification, name));
    assert.ok(decision.reuse);
    assert.equal(decision.record.sourceAttempt, receipt.id);
  }
  assert.equal(readFileSync(join(ctx.root, 'packages/web/dist/output'), 'utf8'), 'packages/web/dist');
  clearOutputs();
  assert.throws(() => check(request, () => { throw Error('planted failure'); }), /planted failure/);
  clearOutputs();
  check(request);
  assert.deepEqual(calls, ['hook']);
});

test('preflight retries force the affected stage fresh on the same inputs', async t => {
  const { ctx, choose, receipt } = await fixture(t);
  function failed(check, phase, tree = ctx.tree, timeOffset = -1000, metadata = {}) {
    writePreflightReceipt(ctx.common, {
      schema: 1, kind: 'preflight', id: randomUUID(), status: 'failed', base: ctx.base, commit: ctx.commit, tree, ...metadata,
      finished: new Date(Date.parse(receipt.finished) + timeOffset).toISOString(),
      checks: preflightChecks.map(name => ({ name, result: name === check ? 'failed' : 'blocked',
        phases: name === check ? [{ name: phase, result: 'failed' }] : [] })),
    });
  }
  failed('Fast and Typed', 'Typed', '1'.repeat(40));
  failed('Fast and Typed', 'Fast');
  failed('Fast and Typed', 'Typed', ctx.tree, -1000, { commit: '2'.repeat(40) });
  const observations = [];
  await assert.rejects(observePreflightStage({ ...ctx, reuseStages: observations }, typedGroup,
    async () => { throw Error('Known fixture failure'); }), /Known fixture failure/);
  assert.deepEqual(observations, [{ name: typedGroup, result: 'failed', fingerprint: choose(typedGroup).record.fingerprint }]);
  failed('Fast and Typed', 'Typed', ctx.tree, -1000, { reuseStages: [{ ...observations[0], fingerprint: 'a'.repeat(64) }] });
  assert.equal(choose(typedGroup).reuse, true);
  failed('Fast and Typed', 'Typed');
  assert.equal(choose(typedGroup).reuse, false);
  assert.equal(choose(typedGroup).record.retries, 1);
  const firstGate = choose(gateGroup);
  assert.equal(firstGate.reuse, true);
  failed('Commit hook on the exact tree', 'canaries and gate tests', ctx.tree, 1000);
  assert.equal(verifiedSource(ctx.directory, firstGate.record, ctx).record.retries, 0);
  assert.equal(choose(gateGroup).reuse, false);
});

test('a failed offline canary preserves the sealed gate pass until the gate tests fail', async t => {
  const { ctx, choose, receipt } = await fixture(t, {
    'scripts/gates/canaries.mjs': '',
    'scripts/gates/device-scope-canaries.mjs': '',
    'scripts/gates/maestro-canary.mjs': "if (process.env.FAIL_CANARY === '1') throw Error('offline canary failed');",
    'scripts/gates/tests/hardening.test.mjs': "import { writeFileSync } from 'node:fs';\n" +
      "writeFileSync('release/gate-started', 'yes'); throw Error('gate suite failed');",
  });
  const checkName = 'Commit hook on the exact tree';
  const controls = phases.filter(phase => phase.snapshot && phase.check === checkName && phase.name !== 'first budget adoption');
  const pass = choose(gateGroup).record;
  async function fail(canary) {
    const attempt = { ...ctx, env: { ...process.env, FAIL_CANARY: canary }, reuseStages: canary === '1' ? [] : undefined };
    // The fixture launches its own node --test process, as preflight does outside a test worker.
    delete attempt.env.NODE_TEST_CONTEXT;
    const checks = await runPreflight(attempt, run => run({}), controls);
    const check = checks.find(check => check.name === checkName);
    assert.equal(check.result, 'failed');
    const path = writePreflightReceipt(ctx.common, {
      ...receipt, id: randomUUID(), status: 'failed', checks, reuseStages: attempt.reuseStages ?? [],
    });
    return JSON.parse(readFileSync(path)).checks.find(check => check.name === checkName).phases.at(-1);
  }
  assert.match((await fail('1')).reason, /offline canary failed/);
  assert.equal(existsSync(join(ctx.root, 'release/gate-started')), false);
  assert.equal(choose(gateGroup).reuse, true);
  assert.equal(verifiedSource(ctx.directory, pass, ctx).record.retries, 0);
  assert.match((await fail('0')).reason, /gate suite failed/);
  assert.equal(existsSync(join(ctx.root, 'release/gate-started')), true);
  assert.equal(choose(gateGroup).record.retries, 1);
  assert.equal(choose(gateGroup).reuse, false);
  assert.throws(() => verifiedSource(ctx.directory, pass, ctx));
});

test('the daily ticket survives only a real or unresolved start', async t => {
  const { ctx, path, git } = await fixture(t);
  git('branch', 'feat/enterprise-ui', ctx.commit);
  git('remote', 'add', 'origin', '.');
  const bin = join(ctx.common, 'only-git');
  mkdirSync(bin);
  symlinkSync(execFileSync('which', ['git'], { encoding: 'utf8' }).trim(), join(bin, 'git'));
  const url = new URL('../reuse/full-run.mjs', import.meta.url).href;
  const command = ['--input-type=module', '-e', 'import {manualFullRun} from ' + JSON.stringify(url) + '; await manualFullRun()'];
  const daily = () => spawnSync(process.execPath, command, { cwd: ctx.root, encoding: 'utf8', env: { ...process.env, PATH: bin } });
  const folder = join(ctx.directory, 'reuse-shadow', 'requests');
  const requests = () => existsSync(folder) ? readdirSync(folder) : [];
  const passing = readFileSync(path);
  unlinkSync(path);
  const missing = daily();
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /no passing preflight receipt/);
  assert.deepEqual(requests(), []);
  writeFileSync(path, passing);
  const unavailable = daily();
  assert.notEqual(unavailable.status, 0);
  assert.match(unavailable.stderr, /ENOENT/);
  assert.deepEqual(requests(), []);
  mkdirSync(folder, { recursive: true });
  const today = new Date();
  const day = [today.getFullYear(), today.getMonth() + 1, today.getDate()].join('-');
  const held = join(folder, day + '-' + ctx.commit + '.json');
  writeFileSync(held, 'existing request');
  assert.match(daily().stderr, /already started/);
  assert.equal(readFileSync(held, 'utf8'), 'existing request');
  const shared = join(folder, 'competing-request');
  const claim = ['--input-type=module', '-e',
    'import {claimDailyRun} from ' + JSON.stringify(url) + '; claimDailyRun(...process.argv.slice(1),new Date())',
    ctx.root, ctx.common, ctx.commit, ctx.tree, shared];
  const compete = () => promisify(execFile)(process.execPath, claim, { cwd: ctx.root });
  const outcomes = await Promise.allSettled([compete(), compete()]);
  assert.equal(outcomes.filter(entry => entry.status === 'fulfilled').length, 1);
  assert.match(outcomes.find(entry => entry.status === 'rejected').reason.stderr, /EEXIST/);
  const winner = JSON.parse(readFileSync(shared));
  assert.deepEqual([winner.commit, winner.tree], [ctx.commit, ctx.tree]);
  assert.equal(Number.isFinite(Date.parse(winner.started)), true);
});
