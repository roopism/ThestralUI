import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkCheapMember, checkPrefixSuite, requirePrefixDevice } from './train-checks.mjs';
import { deviceSuites } from './device-verdict.mjs';

const git = (root, ...args) => execFileSync('git', ['--no-replace-objects', ...args], { cwd: root, encoding:'utf8' }).trim();
const digest = parts => createHash('sha256').update(JSON.stringify(parts)).digest('hex');

// A claim is made before launching a diagnostic. A crash or an interrupted
// observer leaves it pending for inspection, never eligible for a blind retry.
async function observe(folder, key, run, verify) {
  const dir = join(folder, digest(key));
  const path = join(dir, 'result.json');
  try { mkdirSync(dir, { mode:0o700 }); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    if (!existsSync(path)) throw Error('Unfinished prefix diagnostic at ' + dir);
    const prior = JSON.parse(readFileSync(path));
    assert.deepEqual(prior.key, key);
    assert.ok(['passed','failed'].includes(prior.status));
    if (verify && prior.status === 'passed') verify(prior.evidence);
    return { ...prior, reused:true };
  }
  const start = new Date();
  writeFileSync(join(dir, 'request.json'), JSON.stringify({ key, started:start.toISOString() })+'\n',{flag:'wx'});
  let status, reason, evidence;
  try {
    evidence = await run(dir);
    status = 'passed';
  } catch(error) {
    if (error.code === 'train/no-device-evidence') throw error;
    status = 'failed'; reason = error.message;
  }
  if (status === 'passed' && verify) verify(evidence);
  const result = { key, status, reason, ...(evidence ? { evidence } : {}), evidenceDirectory: digest(key), durationMs:Date.now()-start.getTime() };
  writeFileSync(path, JSON.stringify(result)+'\n', {flag:'wx', mode:0o600});
  return result;
}

// An unsealed driver or preparation error cannot establish a physical failure boundary.
// Historical failures also lack a sealed failed report, so replay them as inconclusive.
async function observePhysical(folder, key, run, verify, requestedOnly = false) {
  let inconclusive = false;
  const row = await observe(folder, key, async dir => {
    try {
      const proof = await run(dir);
      if (!proof) throw Object.assign(new Error('Missing full device evidence'), {code:'train/inconclusive-device'});
      return proof;
    } catch (error) {
      inconclusive = requestedOnly || error.code === 'train/inconclusive-device';
      throw error;
    }
  }, verify);
  if (row.status === 'failed' && (row.reused || inconclusive)) return {...row, status:'inconclusive'};
  return row;
}

export async function diagnosePrefixes({train, receipt, folder, check, testSuite, fullDevices = false, freshDevices = fullDevices, verifyDevice}) {
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
  const controls = new Map();
  const baseMember = {parent:train.base, commit:train.base, tree:train.baseTree};
  if (freshDevices) {
    // The final failure is already recorded. Evaluate each proper prefix and
    // the unchanged base independently, including both physical device suites.
    for (const [index, member] of [baseMember, ...members.slice(0,-1)].entries()) {
      for (const suite of deviceSuites) {
        const key = ['full-train-device-v1',receipt.id,train.base,member.commit,member.tree,suite];
        const row = await observePhysical(folder,key,dir => testSuite(member,suite,dir),
          evidence => verifyDevice(member,suite,evidence));
        controls.set(member.commit + ':' + suite,row);
        journal.push({prefix:index,suite,...row});
      }
    }
  }
  suites: for (const suite of failed) {
    let lo=0, hi=members.length;
    // The actual failure is already evidence for the final tree. A group
    // failure on unchanged integration must be distinguished from the first PR.
    const baseline=await testAt(baseMember,0);
    if (baseline.status === 'inconclusive') continue;
    if(baseline.status==='failed') {
      report.suspects.push({suite, reason:'The same suite failed on the unchanged base', tree:train.baseTree});
      continue;
    }
    while(hi-lo>1) {
      const mid=Math.floor((lo+hi)/2), row=await testAt(members[mid-1],mid);
      if (row.status === 'inconclusive') continue suites;
      if(row.status==='failed') hi=mid;
      else lo=mid;
    }
    report.suspects.push({number:members[hi-1].number, suite, tree:members[hi-1].tree, passingPrefix:lo, failingPrefix:hi});
    async function testAt(member,index) {
      const control=controls.get(member.commit + ':' + suite);
      if (control) return control;
      let row;
      if(member.tree===train.finalTree) row={status:'failed', sourceAttempt:receipt.id, reused:true};
      else if (deviceSuites.includes(suite)) {
        const key = ['requested-train-device-v2', receipt.id, train.base, member.commit, member.tree, suite];
        row = await observePhysical(folder, key, dir => testSuite(member,suite,dir),
          proof => verifyDevice(member,suite,proof), true);
      } else row=await observe(folder,[train.base,member.tree,suite],evidenceDir => testSuite(member, suite, evidenceDir));
      journal.push({prefix:index,suite,...row}); return row;
    }
  }
  return report;
}

async function checkDiagnosticSuite(request, suite) {
  try {
    return await checkPrefixSuite(request, suite);
  } catch (cause) {
    if (!deviceSuites.includes(suite)) throw cause;
    // A setup, transport or verifier error is not a sealed device assertion.
    // Retain its output without using it to identify a failing train member.
    throw Object.assign(new Error(cause.message, {cause}), {code:'train/inconclusive-device'});
  }
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
    freshDevices:true, verifyDevice:(member,suite,evidence)=>requirePrefixDevice(root,train.base,member,suite,evidence),
    check:member=>checkCheapMember({...run,member}), testSuite:(member,suite,evidenceDir)=>checkDiagnosticSuite({...run,member,evidenceDir},suite)});
  const reportFile = join(directory, 'train-' + train.id + '-' + receipt.id + '-full-devices.json');
  try { writeFileSync(reportFile, JSON.stringify(result, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const previous = JSON.parse(readFileSync(reportFile));
    assert.deepEqual([previous.train, previous.qualification, previous.finalTree], [train.id, receipt.id, train.finalTree]);
    // The retained report records the first diagnosis. Return the observations just verified.
    return result;
  }
  return result;
}
