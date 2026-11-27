import { recordScopeFailure } from '../../selection/device-observations.mjs';
import { requirePreflight } from '../preflight-receipt.mjs';
import { reuseRows } from './preflight.mjs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { disableGroup, disabledGroups } from './audit.mjs';

const attemptFile = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\.json$/;
const hash = /^[a-f0-9]{64}$/;
const readJson = file => JSON.parse(readFileSync(file, 'utf8'));

function attempts(directory) {
  const folder = join(directory, 'attempts');
  if (!existsSync(folder)) return [];
  return readdirSync(folder).filter(name => attemptFile.test(name)).map(name => {
    const file = join(folder, name);
    assert.ok(lstatSync(file).isFile(), 'Invalid attempt file ' + name);
    const row = readJson(file);
    assert.equal(row.id + '.json', name);
    return row;
  });
}

// Use the retained runner verdicts to discover claims. A missing or changed working JSON
// receipt cannot hide a prior reuse from the daily comparison.
export function sealedClaims(root, started) {
  const cutoff=Date.parse(started);
  assert.ok(Number.isFinite(cutoff),'Invalid daily qualification start time');
  const prefix='refs/uld-archive/reuse-receipts/';
  const git=(...args)=>execFileSync('git',['--no-replace-objects',...args],{cwd:root,encoding:'utf8',maxBuffer:64*1024*1024});
  const refs=git('for-each-ref','--format=%(refname)%09%(objecttype)%09%(objectname)',prefix).trim();
  if (!refs) return [];
  const claims=[];
  for (const line of refs.split('\n')) {
    const [ref,type,object]=line.split('\t');
    assert.ok(ref.startsWith(prefix) && type==='blob' && /^[a-f0-9]{40}$/.test(object),'Invalid receipt seal '+ref);
    const receipt=JSON.parse(git('cat-file','blob',object));
    assert.match(receipt.id,/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
    assert.equal(ref,prefix+receipt.id);
    assert.equal(receipt.reuseSchema,1);
    assert.equal(receipt.status,'passed');
    assert.ok(Number.isFinite(Date.parse(receipt.finished)));
    if (receipt.mode==='qualification' && Date.parse(receipt.finished)<=cutoff && (receipt.devicePlan?.run === false || reuseRows(receipt).some(row=>row.result==='reused')))
      claims.push(receipt);
  }
  return claims;
}

// Compare all eligible historical claims, including those for different trees with the same fingerprint.
// A blocked or otherwise unverified stage conservatively disables a matching earlier reuse claim.
export function compareFullRun(directory, fresh, history, disable = disableGroup) {
  fresh = {...fresh,suites:reuseRows(fresh)};
  history = history.map(attempt => ({...attempt,suites:reuseRows(attempt)}));
  assert.equal(fresh.noReuse, true);
  if (fresh.devicePlan) {
    assert.equal(fresh.devicePlan.run, true, 'Daily qualification requires both devices');
    assert.equal(fresh.devicePlan.full, true);
    assert.deepEqual(fresh.scope, { iphone: true, families: null });
  }
  assert.ok(fresh.suites.every(row => row.result !== 'web-only'), 'Daily qualification cannot skip a device');
  assert.equal(fresh.mode, 'qualification');
  assert.ok(['passed', 'failed'].includes(fresh.status) && Array.isArray(fresh.suites));
  assert.ok(fresh.suites.every(row => row.result !== 'reused' && !row.reusedFrom),
    'Manual full qualification contains a reused suite');
  if (fresh.scope?.iphone) assert.ok(fresh.suites.every(row => row.result !== 'web-only'));
  const claims = new Map();
  for (const attempt of history) {
    if (attempt.id === fresh.id || attempt.status !== 'passed' || attempt.mode !== 'qualification') continue;
    for (const row of attempt.suites) {
      if (row.result !== 'reused') continue;
      assert.ok(typeof row.name === 'string' && hash.test(row.fingerprint) && row.reusedFrom,
        'Malformed reuse claim in ' + attempt.id);
      const key = row.name + '/' + row.fingerprint;
      if (!claims.has(key)) claims.set(key, []);
      claims.get(key).push(attempt.id);
    }
  }
  const comparisons = [];
  for (const row of fresh.suites) {
    const matched = claims.get(row.name + '/' + row.fingerprint);
    if (!matched) continue;
    const comparison = { groupId: row.name, fingerprint: row.fingerprint, claims: matched.sort(),
      observed: row.result, agrees: row.result === 'passed' };
    comparisons.push(comparison);
    if (!comparison.agrees) {
      const reason = 'Manual full run ' + fresh.id + ' returned ' + row.result + ' for ' + row.fingerprint +
        ', claimed as passed in ' + matched.join(', ') + '.';
      disable(directory, row.name, reason);
    }
  }
  return comparisons;
}

function checkDailyReport(root,directory,commit,tree,fresh,path,requireOriginalReceipt) {
  if (!path || !existsSync(path)) return;
  requireOriginalReceipt(root,fresh,commit);
  assert.deepEqual(fresh.scope,{iphone:true,families:null});
  const groups=Object.keys(readJson(join(root,'tests/acceptance/suite-inputs.json')).groups);
  assert.deepEqual(fresh.suites.map(row=>row.name).sort(),groups.sort());
  if (fresh.status==='passed') assert.equal(fresh.androidTiming?.result,'timing measured');
  const earlier = sealedClaims(root, fresh.started);
  recordScopeFailure(root, fresh, earlier);
  const comparisons=compareFullRun(directory,fresh,earlier,(dir,group,reason)=>{
    if (!disabledGroups(dir).includes(group)) disableGroup(dir,group,reason);
  });
  const expected={commit,tree,attempt:fresh.id,status:fresh.status,comparisons,finished:fresh.finished,
    durationMs:Date.parse(fresh.finished)-Date.parse(fresh.started)};
  assert.deepEqual(readJson(path),expected,'Stored daily report differs from sealed receipt history');
}

export function claimDailyRun(root, common, commit, tree, path, started) {
  requirePreflight(root, common, commit, commit, tree);
  const body = JSON.stringify({ id: randomUUID(), commit, tree, started: started.toISOString() }) + '\n';
  writeFileSync(path, body, { flag: 'wx', mode: 0o600 });
  return body;
}

export async function manualFullRun(root = process.cwd()) {
  const { requireOriginalReceipt } = await import('./runner.mjs');
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  git('fetch', '--no-tags', 'origin', '+refs/heads/feat/enterprise-ui:refs/remotes/origin/feat/enterprise-ui');
  const commit = git('rev-parse', 'refs/remotes/origin/feat/enterprise-ui^{commit}');
  assert.equal(git('rev-parse', 'HEAD'), commit, 'Run the daily check from the current integration checkout');
  assert.equal(git('status', '--porcelain=v1', '--untracked-files=all'), '', 'Daily checkout must be clean');
  const tree = git('rev-parse', commit + '^{tree}');
  const common = git('rev-parse', '--path-format=absolute', '--git-common-dir');
  const directory = join(common, 'uld-receipts');
  const before = attempts(directory), oldIds = new Set(before.map(attempt => attempt.id));
  const today = new Date().toDateString();
  const previous = before.find(row => row.mode === 'qualification' && row.noReuse &&
    row.base === commit && row.commit === commit && new Date(row.started).toDateString() === today);
  const existingReport = previous && join(directory,'reuse-shadow',previous.id + '.json');
  checkDailyReport(root,directory,commit,tree,previous,existingReport,requireOriginalReceipt);
  if (existingReport && existsSync(existingReport)) {
    const report = readJson(existingReport);
    assert.equal(report.attempt,previous.id);
    assert.equal(report.commit,commit);
    assert.equal(report.tree,tree);
    assert.equal(report.status,'passed','Earlier manual full qualification failed');
    assert.ok(report.comparisons.every(row=>row.agrees),'Earlier manual qualification found a disagreement');
    console.log('The manual full run for this integration commit is already recorded in ' + existingReport);
    return report;
  }
  const folder = join(directory,'reuse-shadow');
  const requests = join(folder,'requests');
  mkdirSync(requests,{recursive:true,mode:0o700});
  let ticket;
  let ticketBody;
  let startingRefs;
  const attemptRefs = () => git('for-each-ref', '--points-at', commit, '--format=%(refname)', 'refs/uld-archive/qualification-attempts/');
  if (!previous) {
    startingRefs = attemptRefs();
    const started=new Date();
    const day=[started.getFullYear(),started.getMonth()+1,started.getDate()].join('-');
    ticket=join(requests,day+'-'+commit+'.json');
    try { ticketBody = claimDailyRun(root, common, commit, tree, ticket, started); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      throw Error('A daily full run already started for this commit. Inspect its retained attempts in '+directory);
    }
  }
  // Qualification owns the normal simulator, timing and integration reservations.
  const run = previous ? null : spawnSync('npm', ['run', 'qualify', '--', '--no-reuse', commit], { cwd: root, stdio: 'inherit' });
  const after = attempts(directory);
  const failedBeforeStart = run && !run.signal && (run.error
    ? ['ENOENT', 'EACCES'].includes(run.error.code) : Number.isInteger(run.status) && run.status !== 0);
  if (failedBeforeStart && startingRefs === attemptRefs() &&
      !after.some(row => !oldIds.has(row.id) && row.commit === commit && row.mode === 'qualification')) {
    assert.equal(readFileSync(ticket, 'utf8'), ticketBody, 'Daily request changed');
    unlinkSync(ticket);
    if (run.error) throw run.error;
    throw Error('Qualification exited before starting the daily attempt');
  }
  const matches = previous ? [previous] : after.filter(row => !oldIds.has(row.id) && row.base === commit && row.commit === commit &&
    row.tree === tree && row.mode === 'qualification' && row.noReuse);
  assert.equal(matches.length, 1, 'Could not identify the exact full qualification attempt');
  const fresh = matches[0];
  assert.deepEqual(fresh.scope,{iphone:true,families:null},'Daily qualification must include the full device roster');
  const groups=Object.keys(readJson(join(root,'tests/acceptance/suite-inputs.json')).groups);
  assert.deepEqual(fresh.suites.map(row=>row.name).sort(),groups.sort());
  if (fresh.status === 'passed') assert.equal(fresh.androidTiming?.result,'timing measured','Daily Android timing must run fresh');
  if (fresh.status==='passed') requireOriginalReceipt(root,fresh,commit);
  const earlier=sealedClaims(root,fresh.started);
  recordScopeFailure(root, fresh, earlier);
  const comparisons=compareFullRun(directory,fresh,earlier);
  const report={commit,tree,attempt:fresh.id,status:fresh.status,comparisons,finished:fresh.finished,
    durationMs:Date.parse(fresh.finished)-Date.parse(fresh.started)};
  writeFileSync(join(folder,fresh.id+'.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify(report, null, 2));
  if (run?.error) throw run.error;
  if (run) assert.equal(run.status, 0, 'Daily full qualification failed');
  assert.equal(fresh.status, 'passed');
  assert.ok(comparisons.every(row => row.agrees), 'Fresh and reused qualifications disagree');
  return report;
}

if (import.meta.main) await manualFullRun();
