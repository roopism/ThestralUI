import { gitInputs } from './reuse/fingerprint.mjs';
import { decideRow, executeChoice, rowIdentity, saveFreshEvidence, sealReceipt, useRecord } from './reuse/runner.mjs';
import { projectStoredPasses, publishRecord, sha256 } from './reuse/store.mjs';
import { assertAuditResult, selectAudit } from './reuse/audit.mjs';
import { withBrowserServers } from './reuse/browser-run.mjs';
import { prepareDeviceReuse, reuseAndroidTiming, verifyFreshDeviceApplication } from './reuse/device-run.mjs';
import { macCommand } from './reuse/sandbox-mac.mjs';
import { reusePolicyIssues } from './reuse/strength.mjs';
import { trustedVerdict } from './verdict.mjs';
import { shutdownSimulators, usingSimulator, withTiming } from '../workers/resource-guard.mjs';
import { publishFirstReceipt, relatedHistory } from './receipt-history.mjs';
import { readAttempt } from './qualification-attempt.mjs';
import { reviewPolicy } from './review/qualification-policy.mjs';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createWriteStream, copyFileSync, existsSync, globSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { qualificationStatus, runWithIntegrationReservation } from './qualification-policy.mjs';
import { randomBytes, randomUUID } from 'node:crypto';
import { releaseLocksOnSignal, withLock } from '../workers/lock.mjs';
import { deviceScope } from '../selection/local-device.mjs';
import { browserMatrix, scenarioMatrix } from '../../packages/policy/quality/browser-matrix.mjs';
import { verifyCandidatePassed } from '../../packages/policy/quality/api-depth/evidence.mjs';
import { packedDepth, checkNewBudgets } from '../../packages/policy/quality/check-staged.mjs';
import { verifyPackedCeiling } from '../../packages/policy/quality/size-ceiling.mjs';
import { requireTypedControls } from './typed-tools.mjs';
import { fast, typed, browserRosters } from './fast-typed.mjs';
import { linuxBrowsers, stopVm } from './linux-vm.mjs';

releaseLocksOnSignal();
const read = file => JSON.parse(readFileSync(file, 'utf8'));
const run = (bin, ...args) => execFileSync(bin, args, { stdio: 'inherit' });
const node = (...args) => run(process.execPath, ...args);
const root = process.argv[2], base = process.argv[3], commit = process.argv[4], mode = process.argv[5];
const tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim();
const common = process.env.ULD_ARTIFACT_COMMON;
const directory = join(common, 'uld-receipts');
const initial = mode === 'hook' ? { id: randomUUID(), started: new Date().toISOString() }
  : readAttempt(directory, process.argv[6], base, commit, tree, mode);
const id = initial.id;
const noReuse = mode !== 'qualification' || process.argv.includes('--no-reuse');
const single = process.argv.indexOf('--reuse-operation');
const snapshot = process.cwd();
const context = {root, snapshot, directory, base, commit, tree, mode, noReuse, attemptId:id};
if (noReuse) process.env.ULD_FRESH_ANDROID_TIMING = '1';
else delete process.env.ULD_FRESH_ANDROID_TIMING;
const scope = deviceScope(root, base, tree, mode === 'release' || process.argv.includes('--no-reuse'));
writeFileSync('.git/gate-selection.json', JSON.stringify({ budgetComparisonBase: base }));
context.scope = scope;
const receipt = { ...initial, schema: 1, tree, base, commit, id, mode, scope,
  reuseSchema: 1, noReuse, auditSeed: noReuse ? null : randomBytes(32).toString('hex'), retries: null,
  status: 'running', vm: null, devices: {}, suites: [] };
const steps = new Map();
function step(name, operation, dependencies = []) {
  const entry = { name, result: 'pending', durationMs: 0, fingerprint: null, reusedFrom: null,
    reuseReason: null, auditRerun: false, retries: 0 };
  steps.set(name, { operation, entry, dependencies });
  receipt.suites.push(entry);
}
function save(final = false) {
  if (mode === 'hook' || single !== -1) return;
  mkdirSync(join(directory, 'attempts'), { recursive: true });
  const body = JSON.stringify(receipt, null, 2) + '\n';
  const attempt = join(directory, 'attempts', id + '.json');
  const tmp = attempt + '.tmp';
  writeFileSync(tmp, body, { mode: 0o600 });
  renameSync(tmp, attempt);
  if (final) publishFirstReceipt(directory, tree, id);
}
function runDevice(script, reports, platform) {
  try { node(script); } finally {
    const root = join('test-results', reports);
    const versions = globSync(['device.json', '*/device.json'], { cwd: root }).map(file => read(join(root, file)));
    receipt.devices[platform] = platform === 'iphone' ? versions[0] ?? null : versions;
    const patterns = ['device.json', '*/device.json', 'maestro-session-*/ready.json', '*/maestro-session-*/ready.json',
      '{maestro-session-*,*/maestro-session-*}/*/{request.json,reply.json,suite.json,junit.xml,nodes.xml}',
      '*/timing-source.json', '*/frame-trial-*/*.txt', '*/frame-measurements.json', '*/motion-target.json', '*/ripple.json'];
    for (const file of globSync(patterns, { cwd: root })) {
      const target = join(directory, 'attempts', id + '-evidence', platform, file);
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(join(root, file), target);
    }
    const timing = join(root, 'low-end/timing-source.json');
    if (platform === 'android' && existsSync(timing)) receipt.androidTiming = read(timing);
  }
}
const eligible = new Map();
let inputs;
const alwaysFresh = ['No weakening','Fast','Mac browser performance'];
const deviceNames = ['iPhone Simulator','Android standard and low-end'];
const browserGroups = ['Portable web scenarios','Mac browser behavior','Mac visual comparisons'];

const verifiedProfiles = new Set();
function verifySandbox(exclude) {
  const key = JSON.stringify([...exclude].sort());
  if (!exclude.length || verifiedProfiles.has(key)) return;
  const names = inputs.candidate.map(row=>row.path);
  const sample = pattern => names.find(path=>pattern==='docs/**' ? path.startsWith('docs/') : !path.includes('/') && path.endsWith('.md'));
  const paths = exclude.map(sample).filter(Boolean).map(path=>join(snapshot,path));
  for (const path of paths) readFileSync(path);
  const check = "const fs=require('node:fs');for(const path of process.argv.slice(1)){" +
    "try{fs.readFileSync(path)}catch(e){if(e.code==='EPERM'&&e.path===path)continue;throw e}throw Error('Expected excluded input: '+path)}";
  const wrapped = macCommand({root:snapshot,exclude,command:process.execPath,args:['-e',check,...paths]});
  execFileSync(wrapped.command,wrapped.args,{stdio:['ignore','pipe','pipe']});
  verifiedProfiles.add(key);
}

async function runChild(name, exclusions, extraEnv, audit) {
  const args = [fileURLToPath(import.meta.url),root,base,commit,mode,id,...(noReuse ? ['--no-reuse'] : []),'--reuse-operation',name];
  const command = macCommand({root:snapshot,exclude:exclusions,command:process.execPath,args});
  const prefix = join(directory,'attempts',id+'-evidence','reuse');
  const logfile = join(prefix,sha256(name)+(audit ? '.audit' : '')+'.log');
  let stream, logError;
  try {
    mkdirSync(prefix,{recursive:true});
    stream = createWriteStream(logfile,{flags:'wx',mode:0o600});
    stream.on('error', error => { logError=error; });
  } catch (error) { logError=error; }
  const env = {...process.env};
  for (const key of Object.keys(env)) if (key.startsWith('PW_TEST_CONNECT_')) delete env[key];
  const child = spawn(command.command,command.args,{env:Object.assign(env,extraEnv),stdio:['ignore','pipe','pipe']});
  // Wait for the worker even if the optional evidence sink fails. A build must
  // never outlive its reservation and overlap the next timing measurement.
  if (stream) {
    child.stdout.pipe(stream,{end:false});
    child.stderr.pipe(stream,{end:false});
  }
  child.stdout.pipe(process.stdout,{end:false});
  child.stderr.pipe(process.stderr,{end:false});
  let spawnError;
  child.once('error',error=>{spawnError=error;});
  const [code,signal] = await new Promise(resolve=>child.once('close',(...values)=>resolve(values)));
  if (stream && !logError)
    await new Promise(resolve=>{stream.once('error',resolve);stream.end(resolve);});
  if (spawnError) throw spawnError;
  if (code!==0) throw Error(name+' exited '+(signal??code));
  return logError ? null : sha256(readFileSync(logfile));
}

async function runGroup(name, entry, operation, audit) {
  if (mode==='hook' || alwaysFresh.includes(name)) {
    entry.reuseReason = 'always fresh';
    return operation(entry);
  }
  const device = deviceNames.includes(name);
  if (name==='iPhone Simulator' && !scope.iphone) return operation(entry);
  const details = {...context,groupId:name};
  let app, identity;
  try {
    inputs ??= gitInputs(root,tree,base);
    if (device) app = audit?.app ?? await prepareDeviceReuse(details);
    if (app) entry.buildEvidenceSha256 = app.buildEvidenceSha256;
    identity = rowIdentity(context,name,app,inputs);
    if (name !== 'Linux browser behavior') verifySandbox(identity.config.exclude);
  } catch (error) { identity=null; entry.reuseReason = String(error.message); }
  entry.fingerprint = identity?.fingerprint ?? null;
  let decision = decideRow(context,name,identity);
  if (receipt.retries !== 0) decision={reuse:false,reason:'attempt history requires fresh verification'};
  entry.reuseReason ??= decision.reason;
  await executeChoice(entry,decision,audit,async () => {
      const source = useRecord(context,entry,decision.record);
      if (name==='Linux browser behavior') receipt.vm = source.vm;
      if (name==='iPhone Simulator') receipt.devices.iphone = source.devices.iphone;
      if (name==='Android standard and low-end') {
        receipt.devices.android = source.devices.android;
      }
      eligible.set(name,{record:decision.record,app});
  },async () => {
  const started = performance.now();
  let logSha256 = null;
  const exclude = identity?.config.exclude ?? [];
  if (device || name==='Linux browser behavior') {
    await operation(entry,exclude);
  } else {
    const perform = overrides => runChild(name,exclude,overrides,Boolean(audit));
    logSha256 = exclude.length && browserGroups.includes(name) ? await withBrowserServers(snapshot,perform) : await perform({});
  }
  if (entry.result==='pending') entry.result='passed';
  if (entry.result!=='passed' || !identity || mode!=='qualification' || receipt.retries!==0) return;
  if (!device && name!=='Linux browser behavior' && !logSha256) return;
  try {
    if (device && (!app || !await verifyFreshDeviceApplication(details,app.prepared))) return;
    saveFreshEvidence(context,entry,logSha256,Math.round(performance.now()-started));
  } catch (error) { entry.reuseReason='Evidence unavailable: '+error.message; }
  });
}

async function execute(name,audit) {
  const { operation, entry, dependencies } = steps.get(name);
  if (dependencies.some(key => !['passed','reused'].includes(steps.get(key).entry.result))) {
    entry.result = 'blocked';
    entry.reason = 'Prerequisite failed';
    save();
    return;
  }
  const start = performance.now();
  try {
    const perform = () => runGroup(name,entry,operation,audit);
    if (['No weakening', 'Fast', 'iPhone Simulator', 'Android standard and low-end', 'Mac browser performance'].includes(name)) await perform();
    else await withTiming('activity', name, perform);
    if (entry.result === 'pending') entry.result = 'passed';
  }
  catch (error) { entry.result = 'failed'; entry.reason = String(error.message).slice(0, 2000); console.error(name, entry.reason); }
  finally { entry.durationMs += Math.round(performance.now() - start); save(); }
}

async function finishAndroidTiming() {
  const name = 'Android standard and low-end';
  const row = steps.get(name)?.entry;
  if (row?.result !== 'reused') return;
  const started = performance.now();
  try {
    await stopVm();
    receipt.androidTiming = await reuseAndroidTiming({...context,groupId:name},eligible.get(name).app.prepared);
    assert.ok(receipt.androidTiming?.frameBudget,'Missing independent Android timing result');
  } catch (error) {
    row.result = 'failed';
    row.reason = String(error.message);
    throw error;
  } finally {
    const folder = join(snapshot,'test-results/android-emulator');
    for (const path of globSync(['low-end/device.json','low-end/timing-source.json','low-end/frame-trial-*/*.txt','low-end/frame-measurements.json'],
        {cwd:folder})) {
      const dest=join(directory,'attempts',id+'-evidence','android',path);
      mkdirSync(dirname(dest),{recursive:true});
      copyFileSync(join(folder,path),dest);
    }
    row.durationMs += Math.round(performance.now()-started);
    save();
  }
}

async function auditReuse() {
  if (!eligible.size) return;
  const name = selectAudit([...eligible.keys()],receipt.auditSeed);
  const selected = steps.get(name).entry;
  const original = eligible.get(name);
  Object.assign(selected,{result:'pending',reusedFrom:null,auditRerun:true,auditedFrom:original.record.sourceAttempt});
  delete selected.reuseRecord;
  await execute(name,original);
  assertAuditResult(directory,name,selected.result,{attempt:id,fingerprint:selected.fingerprint,sourceAttempt:original.record.sourceAttempt});
}

const trustedGate = file => fileURLToPath(new URL(file, import.meta.url));
step('No weakening', () => {
  requireTypedControls(root, base, tree);
  assert.deepEqual(reviewPolicy(root, base, tree), []);
  assert.deepEqual(reusePolicyIssues(root,base,tree),[]);
  node(trustedGate('no-weakening.mjs'), base, tree, root);
  node(trustedGate('canaries.mjs'), tree);
  node(trustedGate('device-scope-canaries.mjs'), tree);
  node(trustedGate('maestro-canary.mjs'), '--offline');
  const tests = globSync('*.test.mjs', { cwd: trustedGate('tests/') }).sort();
  assert.ok(tests.includes('hardening.test.mjs'));
  node('--test', ...tests.map(file => trustedGate('tests/' + file)));
});
step('Fast', fast);
step('Typed and unit rosters', typed, ['Fast', 'No weakening']);
if (mode !== 'hook') {
  step('Browser and visual rosters', browserRosters, ['Typed and unit rosters']);
  const preflight = ['Typed and unit rosters', 'Browser and visual rosters'];
  step('Catalog build', () => run('node_modules/.bin/storybook', 'build', '-o', 'dist/catalog', '--disable-telemetry'), preflight);
  step('Packed component specifications', packedDepth, preflight);
  for (const range of ['min', 'max']) step('Packed consumers ' + range, () =>
    node(trustedVerdict('verify-consumers.mjs'), 'release/evidence', range), preflight);
  step('Packed bundle limits', async () => {
    await checkNewBudgets(root, base, read('release/evidence/bundles.json'));
    verifyPackedCeiling(process.cwd());
  }, ['Packed consumers max']);
  step('Portable web scenarios', () => scenarioMatrix(), ['Catalog build']);
  step('Mac browser behavior', () => {
    const path = 'tests/acceptance/browser-matrix.json';
    browserMatrix(path);
    const { cases, projects } = read(path);
    verifyCandidatePassed('browser', cases, projects);
  }, ['Catalog build']);
  step('Mac visual comparisons', () => browserMatrix('tests/acceptance/visual-matrix.json', 'tests/browser/motion.visual.config.ts'), ['Catalog build']);
  step('Scoped styles', () => node('tests/browser/quality-style-scope.mjs'), ['Catalog build']);
  step('Mac browser performance', () => usingSimulator('Mac browser performance', async () => {
    await stopVm();
    shutdownSimulators();
    node('tests/browser/quality-perf.mjs');
  }), ['Catalog build']);
  step('Native package consumer', () => node(trustedVerdict('verify-native-consumer.mjs'), 'release/evidence'), preflight);
  step('Linux browser behavior', async (_entry,exclude) => { receipt.vm = await linuxBrowsers(root, commit, metadata => { receipt.vm = metadata; save(); },{exclude}); }, preflight);
  step('iPhone Simulator', async entry => {
    if (!scope.iphone) { entry.result = 'web-only'; entry.reason = 'Every input was verified web-only'; return; }
    await stopVm();
    await withLock(root, 'simulator', 'iPhone ' + tree, () => {
      runDevice(trustedVerdict('verify-ios-simulator.mjs'), 'ios-simulator', 'iphone');
      receipt.devices.iphone = read('release/evidence/ios-simulator.json');
      assert.equal(receipt.devices.iphone.passed, true);
    });
  }, preflight);
  step('Android standard and low-end', async () => {
    await stopVm();
    await withLock(root, 'simulator', 'Android ' + tree, () => {
      runDevice(trustedVerdict('verify-android-emulator.mjs'), 'android-emulator', 'android');
      const android = read('release/evidence/android-emulator.json');
      assert.equal(android.passed, true);
      receipt.devices.android = android.profiles.map(({ id, hardware }) => ({ id, hardware }));
    });
  }, preflight);
}
if (single !== -1) {
  const name = process.argv[single+1];
  assert.ok(steps.has(name) && !alwaysFresh.includes(name) && !deviceNames.includes(name) && name!=='Linux browser behavior');
  const {entry,operation} = steps.get(name);
  await operation(entry);
  process.exit(0);
}
if (mode!=='hook') {
  try {
    const firstPath=join(directory,tree+'.json');
    const prior=relatedHistory(directory,tree,existsSync(firstPath)?read(firstPath):undefined,root,receipt);
    receipt.retries = new Set(prior.filter(old=>old.id!==id && (old.status!=='passed' ||
      qualificationStatus(projectStoredPasses(directory,old).suites,old.error)!=='passed')).map(old=>old.id)).size;
  } catch { receipt.retries=null; }
}
save();
try {
  await execute('No weakening');
  await execute('Fast');
  if (receipt.suites.slice(0, 2).every(row => row.result === 'passed')) {
    await runWithIntegrationReservation(mode, root, tree, async () => {
      if (mode !== 'hook') await stopVm();
      writeFileSync('.git/local-device-scope.json', JSON.stringify(scope));
      for (const name of [...steps.keys()].slice(2)) await execute(name);
      try { await auditReuse(); } finally { await finishAndroidTiming(); }
    });
  }
} catch (error) { receipt.error = String(error.message); }
finally {
  for (const row of receipt.suites) if (row.result === 'pending') { row.result = 'blocked'; row.reason = receipt.error ?? 'Preflight failed'; }
  try { receipt.status = qualificationStatus(projectStoredPasses(directory,receipt).suites, receipt.error); }
  catch (error) { receipt.status='failed'; receipt.error=error.message; }
  receipt.finished = new Date().toISOString();
  if (mode!=='hook' && receipt.status==='passed') {
    try { sealReceipt(root,receipt); }
    catch (error) { receipt.status='failed'; receipt.error='Unable to preserve the final verdict: '+error.message; }
  }
  save(true);
  if (receipt.status==='passed' && mode==='qualification' && receipt.retries===0)
    for (const row of receipt.suites.filter(row=>row.result==='passed' && row.evidenceSha256))
      publishRecord({...context,groupId:row.name,fingerprint:row.fingerprint});
  const reused=receipt.suites.filter(row=>row.result==='reused');
  console.log('Fresh',receipt.suites.filter(row=>row.result==='passed').length,'reused',reused.length,
    'saved seconds',Math.round(reused.reduce((sum,row)=>sum+Math.max(0,row.sourceDurationMs-row.durationMs),0)/1000));
  console.table(receipt.suites.map(({ name, result, durationMs }) => ({ name, result, durationMs })));
  if (receipt.status !== 'passed') process.exitCode = 1;
}
