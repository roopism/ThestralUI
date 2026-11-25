import { gateGroup, preflightSource, reuseRows } from './preflight.mjs';
import assert from 'node:assert/strict';
import { readArtifact } from '../../build-cache/artifact-cache.mjs';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const sha256 = data => createHash('sha256').update(data).digest('hex');
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const digest = /^[0-9a-f]{64}$/;
const oid = /^[a-f0-9]{40}$/;
export const receiptGroups = ['No weakening', 'Fast', 'Typed and unit rosters', 'Browser and visual rosters', 'Catalog build',
  'Packed component specifications', 'Packed consumers min', 'Packed consumers max', 'Packed bundle limits',
  'Portable web scenarios', 'Mac browser behavior', 'Mac visual comparisons', 'Scoped styles', 'Mac browser performance',
  'Native package consumer', 'Linux browser behavior', 'iPhone Simulator', 'Android standard and low-end'];
const requiredFields = ['createdAt','evidencePath','evidenceSha256','fingerprint','groupId','result','retries','schema',
  'sourceAttempt','sourceReceiptSha256','tree'];
const git = (root,...args) => execFileSync('git',['--no-replace-objects',...args],{cwd:root,encoding:'utf8'}).trim();
const json = data => JSON.parse(data.toString('utf8'));

export function readBytes(directory, relative) {
  assert.ok(relative.split('/').every(part => part && part !== '.' && part !== '..'));
  const folder = realpathSync(directory);
  const path = join(folder,relative);
  assert.equal(realpathSync(path),path);
  assert.ok(lstatSync(path).isFile());
  return readFileSync(path);
}
export function evidencePath(attemptId, groupId) {
  assert.match(attemptId,uuid);
  return 'attempts/' + attemptId + '-evidence/reuse/' + sha256(groupId) + '.json';
}

function validate(directory, record, groupId, fingerprint) {
  assert.deepEqual(Object.keys(record).sort(),requiredFields);
  assert.equal(record.schema,1);
  assert.equal(record.groupId,groupId);
  assert.equal(record.fingerprint,fingerprint);
  assert.match(fingerprint,digest);
  assert.match(record.tree,oid);
  assert.match(record.sourceAttempt,uuid);
  assert.equal(record.result,'passed');
  assert.equal(record.retries,0);
  assert.match(record.sourceReceiptSha256,digest);
  assert.match(record.evidenceSha256,digest);
  assert.equal(record.evidencePath,evidencePath(record.sourceAttempt,groupId));
  const receiptBytes = readBytes(directory,'attempts/' + record.sourceAttempt + '.json');
  assert.equal(sha256(receiptBytes),record.sourceReceiptSha256);
  const anchor = git(directory,'rev-parse','--verify','refs/uld-archive/reuse-receipts/'+record.sourceAttempt+'^{blob}');
  assert.match(anchor,oid);
  const retained = execFileSync('git',['--no-replace-objects','cat-file','blob',anchor],{cwd:directory,maxBuffer:64*1024*1024});
  assert.ok(retained.equals(receiptBytes),'Source receipt differs from its original qualification');
  const source = json(receiptBytes);
  assert.deepEqual([source.id,source.tree,source.status,source.mode,source.finished],
    [record.sourceAttempt,record.tree,'passed','qualification',record.createdAt]);
  assert.ok(Number.isFinite(Date.parse(record.createdAt)));
  assert.equal(source.schema,1);
  assert.equal(source.reuseSchema,1);
  assert.equal(source.retries,0);
  assert.match(source.commit,oid);
  assert.equal(git(directory,'rev-parse','--verify','refs/uld-archive/qualification-attempts/'+source.id),source.commit);
  assert.equal(git(directory,'rev-parse',source.commit+'^{tree}'),source.tree);
  assert.deepEqual(source.suites.map(row => row.name),receiptGroups);
  const rows = source.suites.filter(row => row.name === groupId);
  assert.equal(rows.length,1);
  const [row] = rows;
  assert.deepEqual([row.result,row.fingerprint,row.retries,row.evidenceSha256],['passed',fingerprint,0,record.evidenceSha256]);
  assert.ok(row.reusedFrom === null && Number.isFinite(row.durationMs) && row.durationMs >= 0);
  assert.ok(source.suites.every(stage=>stage.retries===0 && (stage.result==='passed' || stage.result==='reused' ||
    stage.name==='iPhone Simulator' && stage.result==='web-only' && !source.scope.iphone)));
  const data = readBytes(directory,record.evidencePath);
  assert.equal(sha256(data),record.evidenceSha256);
  const evidence = json(data);
  assert.deepEqual([evidence.schema,evidence.attempt,evidence.groupId,evidence.tree,evidence.fingerprint],
    [1,source.id,groupId,source.tree,fingerprint]);
  if (evidence.logSha256 !== null) {
    assert.match(evidence.logSha256,digest);
    const log = record.evidencePath.slice(0,-5) + (row.auditRerun ? '.audit.log' : '.log');
    assert.equal(sha256(readBytes(directory,log)),evidence.logSha256);
  }
  for (const output of evidence.outputs) {
    assert.match(output.sha,digest);
    assert.ok(readArtifact(dirname(directory),output.sha),'Producer evidence is missing or corrupt');
  }
  return { source, row, evidence };
}

export function readRecord(directory,groupId,fingerprint) {
  try {
    assert.match(fingerprint,digest);
    const record = json(readBytes(directory,'reuse/'+fingerprint+'.json'));
    validate(directory,record,groupId,fingerprint);
    return record;
  } catch { return null; }
}

export function verifiedSource(directory,record,context) {
  if (record.sourceKind === 'preflight') {
    const pass = preflightSource(directory,context,record.sourceAttempt,record.groupId,record.fingerprint);
    assert.deepEqual(record,pass.record);
    return pass;
  }
  return validate(directory,record,record.groupId,record.fingerprint);
}

// Keep the record originally used by each row even after the latest lookup expires or moves.
export function projectStoredPasses(directory,receipt) {
  const nested = receipt.gateTests && reuseRows(receipt).some(row => row.result === 'reused');
  if (nested) receipt = {...receipt,suites:reuseRows(receipt)};
  if (!receipt.suites?.some(row => row.result === 'reused')) return receipt;
  assert.equal(receipt.reuseSchema,1);
  assert.equal(receipt.mode,'qualification');
  assert.equal(receipt.noReuse,false);
  const suites = receipt.suites.map(row => {
    if (row.result !== 'reused') return row;
    const record = row.reuseRecord;
    assert.equal(record.groupId,row.name);
    assert.equal(record.fingerprint,row.fingerprint);
    verifiedSource(directory,record,receipt);
    assert.equal(row.reusedFrom,record.sourceAttempt);
    assert.notEqual(receipt.id,record.sourceAttempt);
    return {...row,result:'passed'};
  });
  if (nested) return {...receipt,gateTests:suites.pop(),suites};
  return {...receipt,suites};
}

export function freshHistory(directory,groupId,except) {
  try {
    const history = [];
    for (const file of readdirSync(join(directory,'attempts'))) {
      if (!file.endsWith('.json') || !uuid.test(file.slice(0,-5)) || file === except+'.json') continue;
      const attempt = json(readBytes(directory,'attempts/'+file));
      assert.equal(file,attempt.id+'.json');
      // Older runners executed the gate tests as part of every fresh No weakening row.
      const row = groupId === gateGroup ? attempt.gateTests ?? attempt.suites.find(row => row.name === 'No weakening')
        : attempt.suites.find(row => row.name === groupId);
      if (!row || row.result === 'reused' || row.result === 'web-only' || row.result === 'blocked' || row.result === 'pending') continue;
      const started = Date.parse(attempt.started);
      assert.ok(Number.isFinite(started));
      history.push({started,id:attempt.id,result:row.result==='passed' && (row.retries ?? 0)===0 ? 'passed' : 'failed'});
    }
    return history.sort((a,b)=>b.started-a.started || a.id.localeCompare(b.id)).map(item=>item.result);
  } catch { return null; }
}

export function publishRecord({mode,directory,root,snapshot,commit,tree,attemptId,groupId,fingerprint}) {
  try {
    assert.equal(mode,'qualification');
    assert.match(commit,oid);
    assert.match(tree,oid);
    assert.match(attemptId,uuid);
    assert.equal(git(root,'rev-parse',commit+'^{tree}'),tree);
    assert.equal(git(snapshot,'rev-parse','HEAD^{tree}'),tree);
    assert.equal(git(snapshot,'status','--porcelain','--untracked-files=all'),'');
    const bytes = readBytes(directory,'attempts/'+attemptId+'.json');
    const receipt = json(bytes);
    assert.deepEqual([receipt.id,receipt.tree,receipt.commit],[attemptId,tree,commit]);
    const rel = evidencePath(attemptId,groupId);
    const record = {schema:1,fingerprint,groupId,result:'passed',tree,retries:0,sourceAttempt:attemptId,
      sourceReceiptSha256:sha256(bytes),evidencePath:rel,evidenceSha256:sha256(readBytes(directory,rel)),createdAt:receipt.finished};
    validate(directory,record,groupId,fingerprint);
    const target = join(directory,'reuse',fingerprint+'.json');
    mkdirSync(dirname(target),{recursive:true,mode:0o700});
    assert.equal(realpathSync(dirname(target)),join(realpathSync(directory),'reuse'));
    const temp = target+'.'+randomUUID()+'.tmp';
    writeFileSync(temp,JSON.stringify(record)+'\n',{mode:0o600,flag:'wx'});
    renameSync(temp,target);
    return record;
  } catch { return null; }
}
