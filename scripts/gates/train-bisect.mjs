import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkMember, checkPrefixSuite } from './train-checks.mjs';

const git = (root, ...args) => execFileSync('git', ['--no-replace-objects', ...args], { cwd: root, encoding:'utf8' }).trim();
const digest = parts => createHash('sha256').update(JSON.stringify(parts)).digest('hex');

// A claim is made before launching a diagnostic. A crash or an interrupted
// observer leaves it pending for inspection, never eligible for a blind retry.
async function observe(folder, key, run) {
  const dir = join(folder, digest(key));
  const path = join(dir, 'result.json');
  try { mkdirSync(dir, { mode:0o700 }); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    if (!existsSync(path)) throw Error('Unfinished prefix diagnostic at ' + dir);
    const prior = JSON.parse(readFileSync(path));
    assert.deepEqual(prior.key, key);
    assert.ok(['passed','failed'].includes(prior.status));
    return { ...prior, reused:true };
  }
  const start = new Date();
  writeFileSync(join(dir, 'request.json'), JSON.stringify({ key, started:start.toISOString() })+'\n',{flag:'wx'});
  let status, reason;
  try { await run(dir); status = 'passed'; } catch(error) { status = 'failed'; reason = error.message; }
  const result = { key, status, reason, evidenceDirectory: digest(key), durationMs:Date.now()-start.getTime() };
  writeFileSync(path, JSON.stringify(result)+'\n', {flag:'wx', mode:0o600});
  return result;
}

export async function diagnosePrefixes({train, receipt, folder, check, testSuite}) {
  assert.equal(receipt.status, 'failed');
  assert.equal(receipt.tree, train.finalTree);
  assert.equal(receipt.id, train.qualificationId);
  const failed = receipt.suites.filter(s => s.result === 'failed').map(s => s.name);
  const journal = [];
  const report = { train:train.id, qualification:receipt.id, finalTree:train.finalTree, failed, journal, suspects:[] };
  mkdirSync(folder, {recursive:true, mode:0o700});
  if (!failed.length) report.reason = receipt.error ?? 'The qualification failed before a suite produced a failed verdict';
  // Prefixes monotonically add changes, but failures need not be monotonic.
  // Identify a passing/failing boundary; attribute it to the transition only.
  const { members } = train;
  for (const [index, member] of members.entries()) {
    const key = [train.base, member.parent, member.tree, 'cheap'];
    const prior = train.cheapChecks?.find(check => check.number === member.number &&
      check.tree === member.tree && check.result?.tree === member.tree && check.status === 'passed');
    const record = prior ? { key, status:'passed', source:'train preflight', reused:true } :
      await observe(folder,key,()=>check(member));
    journal.push({ prefix:index+1, ...record });
    if (record.status==='failed') {
      report.suspects.push({ number:member.number, reason:'Cheap prefix checks failed', tree:member.tree });
      return report;
    }
  }
  for (const suite of failed) {
    let lo=0, hi=members.length;
    // The actual failure is already evidence for the final tree. A group
    // failure on unchanged integration must be distinguished from the first PR.
    const baseline=await testAt({parent:train.base,commit:train.base,tree:train.baseTree},0);
    if(baseline.status==='failed') {
      report.suspects.push({suite, reason:'The same suite failed on the unchanged base', tree:train.baseTree});
      continue;
    }
    while(hi-lo>1) {
      const mid=Math.floor((lo+hi)/2), row=await testAt(members[mid-1],mid);
      if(row.status==='failed') hi=mid;
      else lo=mid;
    }
    report.suspects.push({number:members[hi-1].number, suite, tree:members[hi-1].tree, passingPrefix:lo, failingPrefix:hi});
    async function testAt(member,index) {
      let row;
      if(member.tree===train.finalTree) row={status:'failed', sourceAttempt:receipt.id, reused:true};
      else row=await observe(folder,[train.base,member.tree,suite],evidenceDir => testSuite(member, suite, evidenceDir));
      journal.push({prefix:index,suite,...row}); return row;
    }
  }
  return report;
}

export async function diagnoseTrainFailure(train, receipt) {
  const root=git(process.cwd(),'rev-parse','--show-toplevel');
  const common=git(root,'rev-parse','--path-format=absolute','--git-common-dir');
  const original=JSON.parse(readFileSync(join(common,'uld-receipts','attempts',receipt.id+'.json')));
  assert.deepEqual(original,receipt);
  const baseTree=git(root,'rev-parse',train.base+'^{tree}');
  const directory=join(common,'uld-delivery','train-diagnostics');
  const run = {root,base:train.base};
  const result=await diagnosePrefixes({train:{...train,baseTree},receipt,folder:directory,
    check:member=>checkMember({...run,member}), testSuite:(member,suite,evidenceDir)=>checkPrefixSuite({...run,member,evidenceDir},suite)});
  const reportFile = join(directory, 'train-' + train.id + '-' + receipt.id + '.json');
  try { writeFileSync(reportFile, JSON.stringify(result, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const previous = JSON.parse(readFileSync(reportFile));
    assert.deepEqual([previous.train, previous.qualification, previous.finalTree], [train.id, receipt.id, train.finalTree]);
    return previous;
  }
  return result;
}
