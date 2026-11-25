import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

// Load the real coordinator with inert external boundaries. Neither gh nor a physical
// runner is ever invoked. The production control flow, disk receipt and assertions run.
const coordinatorURL = new URL('../cloud/coordinator.mjs', import.meta.url).href;
const boundaries = {
  './proposal.mjs': ['cloudProposal', 'startHostedRun'],
  './github.mjs': ['readHostedVerdict'],
  './plan.mjs': ['planAt'],
  './local-snapshots.mjs': ['collectPhysicalEvidence'],
  '../../workers/timing-reservation.mjs': ['withTimingReservation'],
  'node:child_process': ['execFileSync'],
  'node:timers/promises': ['setTimeout'],
};
const driver = Symbol.for('test.hosted-timing-barrier');
async function loadWithBoundaries(url, stubs) {
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (context.parentURL !== url || !Object.hasOwn(stubs, specifier)) return next(specifier, context);
      const code = typeof stubs[specifier] === 'string' ? stubs[specifier] : stubs[specifier].map(name =>
        'export const ' + name + ' = (...args) => globalThis[Symbol.for("test.hosted-timing-barrier")].' + name + '(...args);').join('\n');
      return { url: 'data:text/javascript,' + encodeURIComponent(code), shortCircuit: true };
    },
  });
  try { return await import(url); }
  finally { hooks.deregister(); }
}
const coordinator = await loadWithBoundaries(coordinatorURL, boundaries);
const proposal = { base: 'b'.repeat(40), merge: 'c'.repeat(40), tree: 'd'.repeat(40) };
const projects = ['chromium', 'firefox', 'webkit'];
const roster = { projects, cases: projects.map(engine=>engine+' | appearance | matches the baseline') };
const shards = [
  { id: 'build', lane: 'github-linux' }, { id: 'browser', lane: 'github-macos' },
  { id: 'visual', lane: 'local', suite: 'Mac visual comparisons' },
  { id: 'timing', lane: 'local', suite: 'Mac browser performance' },
];
const attempt = '12345678-1234-1234-1234-123456789abc';
function receipt() {
  return { id: attempt, base: proposal.base, commit: proposal.merge, tree: proposal.tree, mode: 'qualification',
    status: 'passed', suites: [
      { name: shards[2].suite, result: 'passed', durationMs: 20, coverage: { tree: proposal.tree, ...structuredClone(roster) } },
      { name: shards[3].suite, result: 'passed', durationMs: 10 },
    ] };
}

function harness(t) {
  const directory = mkdtempSync(join(tmpdir(), 'hosted-timing-barrier-'));
  const events = [];
  const runs = [];
  const completed = { id: 17, run_attempt: 1, head_sha: proposal.merge, status: 'completed', conclusion: 'success' };
  const control = {
    cloudProposal: () => proposal,
    planAt: () => shards,
    startHostedRun: () => { events.push('dispatch'); return 17; },
    setTimeout: async () => { events.push('wait'); },
    withTimingReservation: async (_, mode, label, fn) => {
      assert.equal(mode, 'activity');
      events.push('reserve');
      try { return await fn(); } finally { events.push('release'); }
    },
    readHostedVerdict: async (_, id, expected) => {
      assert.equal(id, 17);
      assert.deepEqual(expected, proposal);
      events.push('verify');
      return [{id:'build'}, {id:'browser'}];
    },
    collectPhysicalEvidence: async () => { events.push('local'); return Buffer.from(JSON.stringify(receipt())); },
    listing: () => ({ total_count: 1, workflow_runs: [completed] }),
    execFileSync(tool, args) {
      if (tool === 'git') {
        assert.deepEqual(args, ['--no-replace-objects', 'show', proposal.merge+':tests/acceptance/visual-matrix.json']);
        return JSON.stringify(roster);
      }
      assert.equal(tool, 'gh');
      const path = args.at(-1);
      if (path.endsWith('/pulls/1')) return JSON.stringify({ merge_commit_sha:proposal.merge });
      if (path.endsWith('/git/ref/heads/feat/enterprise-ui')) return JSON.stringify({ object:{sha:proposal.base} });
      if (path.endsWith('/actions/runs/17')) return JSON.stringify(runs.shift() ?? completed);
      assert.ok(path.includes('/actions/runs?per_page=100&page='));
      assert.ok(args.includes('--jq'));
      const page = Number(path.split('=').at(-1));
      events.push('inspect page '+page);
      return JSON.stringify(control.listing(page));
    },
  };
  globalThis[driver]=control;
  t.after(()=>{delete globalThis[driver];rmSync(directory,{recursive:true,force:true});});
  return { directory, events, control, completed, runs, run: prior => coordinator.hostedEvidence(directory,directory,'1',prior) };
}

test('fresh local measurements wait for every verified hosted build and browser and for other active jobs', async t => {
  const h=harness(t);
  h.runs.push({...h.completed,status:'queued',conclusion:null},{...h.completed,status:'in_progress',conclusion:null});
  const report=JSON.parse(readFileSync(await h.run(),'utf8'));
  assert.deepEqual(h.events,['reserve','dispatch','wait','wait','verify','release',
    'inspect page 1','local']);
  assert.deepEqual(report.local[0].coverage,{tree:proposal.tree,...roster});
  assert.deepEqual(report.hosted.map(row=>row.id),['build','browser']);
});

test('failed, partial, mismatched and retried hosted evidence cannot start a physical measurement', async t => {
  const h=harness(t);
  for (const run of [{...h.completed,run_attempt:2},{...h.completed,id:18},{...h.completed,head_sha:proposal.base},
    {...h.completed,conclusion:'failure'},{...h.completed,status:'unknown'}]) {
    h.runs.push(run);
    await assert.rejects(h.run());
  }
  for (const verdict of [() => {throw Error('Artifact verification failed');},() => [{id:'build'}],
    () => [{id:'build'},{id:'build'}]]) {
    h.control.readHostedVerdict=verdict;
    await assert.rejects(h.run());
  }
  assert.ok(!h.events.includes('local'));
});

test('an outstanding repository workflow or an unreadable idle listing blocks local measurements', async t => {
  const h=harness(t);
  for (const status of ['queued','in_progress','requested','waiting','pending']) {
    h.control.listing=()=>({total_count:1,workflow_runs:[{...h.completed,status}]});
    await assert.rejects(h.run(), error => error instanceof AggregateError && error.errors.length === 1 &&
      /requires every hosted workflow/.test(error.errors[0].message));
  }
  const first = Array.from({length:100}, (_, i) => ({...h.completed,id:i+1}));
  for (const response of [()=>({total_count:0}),()=>({total_count:0,workflow_runs:[]}),
    ()=>({total_count:1,workflow_runs:[{...h.completed,run_attempt:2}]}),
    ()=>({total_count:1,workflow_runs:[]}),()=>{throw Error('read denied');},
    page=>({total_count:101, workflow_runs:page === 1 ? first : []}),
    page=>({total_count:101, workflow_runs:page === 1 ? first : [first[0]]}),
    page=>({total_count:page === 1 ? 101 : 102, workflow_runs:page === 1 ? first : [h.completed]})]) {
    h.control.listing=response;
    await assert.rejects(h.run());
  }
  assert.ok(!h.events.includes('local'));
  h.control.listing=page=>({total_count:101, workflow_runs:page === 1 ? first : [{...h.completed,id:101}]});
  assert.ok(await h.run());
  assert.ok(h.events.includes('inspect page 2'));
});

test('prior local evidence needs every fresh visual case on its exact tree and does not restart devices', async t => {
  const h=harness(t);
  const attempts=join(h.directory,'uld-receipts/attempts');
  mkdirSync(attempts,{recursive:true});
  const path=join(attempts,attempt+'.json');
  for (const change of [row=>{delete row.coverage;},row=>{row.coverage.tree=proposal.merge;},
    row=>{row.coverage.cases.pop();},row=>{row.coverage.projects.pop();},row=>{row.result='reused';}]) {
    const prior=receipt();change(prior.suites[0]);
    writeFileSync(path,JSON.stringify(prior));
    await assert.rejects(h.run(attempt));
  }
  assert.deepEqual(h.events,[]);
  writeFileSync(path,JSON.stringify(receipt()));
  const report=JSON.parse(readFileSync(await h.run(attempt),'utf8'));
  assert.deepEqual(h.events,['reserve','dispatch','verify','release']);
  assert.equal(report.localAttempt,attempt);
  // An ordinary attempt is an independent evidence source. Preserve the first
  // scenario's write-once published report and use a separate host directory.
  const legacy = harness(t);
  const legacyAttempts = join(legacy.directory,'uld-receipts/attempts');
  mkdirSync(legacyAttempts,{recursive:true});
  const ordinary = receipt();
  delete ordinary.suites[0].coverage;
  writeFileSync(join(legacyAttempts,attempt+'.json'),JSON.stringify(ordinary));
  const saved = join(legacy.directory,'uld-delivery/cloud-local',proposal.base+'-'+proposal.merge);
  mkdirSync(saved,{recursive:true});
  const caseReport=receipt();
  caseReport.status='failed';
  for (const invalid of [ {...caseReport, tree: proposal.merge}, {...caseReport,suites:[]},
    {...caseReport,suites:[{...caseReport.suites[0],result:'failed'}]}]) {
    writeFileSync(join(saved,'local.json'),JSON.stringify(invalid));
    const count=legacy.events.length;
    await assert.rejects(legacy.run(attempt));
    assert.equal(legacy.events.length,count);
  }
  writeFileSync(join(saved,'local.json'),JSON.stringify(caseReport));
  const supported=JSON.parse(readFileSync(await legacy.run(attempt),'utf8'));
  assert.deepEqual(supported.local[0].coverage,caseReport.suites[0].coverage);
  assert.notEqual(supported.visualEvidenceSha256,supported.localEvidenceSha256);
  assert.equal(legacy.events.includes('local'),false);
});

test('a new run or a quick rerun of an old workflow invalidates the measured result', async t => {
  const h = harness(t);
  const old = {...h.completed,id:18,created_at:'2024-01-01T00:00:00Z'};
  for (const after of [[old,{...old,id:19}],[{...old,run_attempt:2}]]) {
    let runs=[old], measured=false;
    h.control.listing=()=>({total_count:runs.length,workflow_runs:runs});
    await assert.rejects(coordinator.whileHostedIdle(() => {
      measured=true;
      runs=after;
    }), /started or was retried during the local measurement/);
    assert.ok(measured);
  }
  const record=await coordinator.whileHostedIdle(()=>({passed:true}));
  assert.deepEqual(record,{passed:true});
});

test('all three local visual engines finish before timing and a failed visual run never admits timing', async t => {
  const scratch = mkdtempSync(join(tmpdir(), 'local-visual-before-timing-'));
  const originalCwd = process.cwd(), originalArgs = process.argv;
  const stubs = {
    'node:child_process': ['execFileSync'],
    '../../selection/local-device.mjs': ['deviceScope'],
    '../../workers/lock.mjs': ['withLock', 'releaseLocksOnSignal'],
    '../../workers/resource-guard.mjs': ['usingSimulator', 'withTiming'],
    '../typed-tools.mjs': 'export const trustedRoot="/inert-tools",buildTypedInputs=()=>{},requireTypedControls=()=>{};',
    './shard.mjs': ['runShard'],
    '../verdict.mjs': ['trustedVerdict'],
    './coordinator.mjs': ['whileHostedIdle'],
    '../../../packages/policy/quality/browser-matrix.mjs': ['cases', 'runBrowserReport', 'runBrowserShards'],
    '../../../packages/policy/quality/browser-shards.mjs': ['browserCaseOwners'],
    '../../manifests/generate.mjs': ['loadManifests'],
  };
  t.after(()=>{
    delete globalThis[driver]; process.argv=originalArgs;
    process.chdir(originalCwd); rmSync(scratch,{recursive:true,force:true});
  });
  process.chdir(scratch);
  mkdirSync('.git');
  mkdirSync('release/evidence',{recursive:true});
  writeFileSync('release/evidence/android-emulator.json',JSON.stringify({passed:true,profiles:[{id:'low-end'},{id:'standard'}]}));
  for (const fail of [true,false]) {
    const events=[];
    const directory=join(scratch,fail?'failed':'passed');
    mkdirSync(directory);
    process.argv=[process.execPath,'local-physical.mjs',scratch,proposal.base,proposal.merge,proposal.tree,directory];
    globalThis[driver]={
      execFileSync(command,args){
        if(command==='git') return args.includes('show')?JSON.stringify(roster):proposal.tree;
        if(command==='xcrun') return JSON.stringify({devices:{}});
        if(command.endsWith('utmctl')) return 'stopped';
        assert.equal(command,process.execPath);
      },
      deviceScope:()=>({iphone:true,families:null}), releaseLocksOnSignal:()=>{}, runShard:()=>{},
      withLock:(_,resource,holder,run)=>run(),
      withTiming:(mode,holder,run)=>{if(mode==='measurement')events.push('timing');else assert.equal(mode,'activity');return run();},
      usingSimulator:(holder,run)=>{events.push('timing');return run();},
      whileHostedIdle:run=>{events.push('idle check');return run();},
      trustedVerdict:name=>'/inert-tools/'+name, loadManifests:()=>({families:[]}),browserCaseOwners:()=>new Map(),
      cases:rows=>rows,
      runBrowserReport(args,env,tool){
        assert.ok(args.includes('tests/browser/motion.visual.config.ts'));
        assert.ok(args.includes('--update-snapshots=none') && args.includes('--retries=0'));
        assert.equal(tool,'/inert-tools/node_modules/@playwright/test/cli.js');
        if(args.includes('--list'))return {};
        const engine=args.at(-1);
        events.push(engine);
        if(fail && engine==='webkit')throw Error('WebKit visual failed');
        return {suites:[{name:roster.cases.find(name=>name.startsWith(engine+' | '))}]};
      },
      runBrowserShards(discovery,expected,owners,args,run){
        assert.deepEqual(expected,roster);
        for(const engine of expected.projects)run([...args,engine]);
      },
    };
    const url=new URL('../cloud/local-physical.mjs?visual='+String(fail),import.meta.url).href;
    const execution=loadWithBoundaries(url,stubs);
    if (fail) await assert.rejects(execution,/WebKit visual failed/);
    else await execution;
    const local=JSON.parse(readFileSync(join(directory,'local.json'),'utf8'));
    assert.deepEqual(events,fail?projects:[...projects,'timing','idle check','timing','idle check']);
    assert.equal(local.status,fail?'failed':'passed');
    assert.equal(local.suites[0].name,'Mac visual comparisons');
    assert.equal(local.suites[0].result,fail?'failed':'passed');
    if(!fail)assert.deepEqual(local.suites[0].coverage,{tree:proposal.tree,...roster});
  }
});
