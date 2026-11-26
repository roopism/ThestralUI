import assert from 'node:assert/strict';
import ts from 'typescript';
import { registeredNativeSlugs, fixtureRegistry } from './native-tier-two.mjs';
import { treeFiles } from './staged-tree.mjs';
import scenarioReader from '../scenarios/read.cjs';
import { checkFlow } from '../verify-ios-simulator.mjs';
import { requireCompletedProfiles } from '../../tests/android/qualification.mjs';
import { timingForIdenticalApk } from '../gates/android-timing-reuse.mjs';
import { execFileSync } from 'node:child_process';
import { posix } from 'node:path';
import { readFileSync } from 'node:fs';

export const git = (root, ...args) => execFileSync('git', ['--no-replace-objects', ...args], {
  cwd: root, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024,
}).trimEnd();
const maps = 'refs/uld-archive/device-maps/';
const failures = 'refs/uld-archive/device-scope-failures/';
const seals = 'refs/uld-archive/reuse-receipts/';
const sourceLock = 'tests/simulator/host/package-lock.json';
const local = file => typeof file === 'string' && file.length > 0 && !file.startsWith('/') &&
  posix.normalize(file) === file && !file.split('/').some(part => ['.', '..', ''].includes(part)) && !/[\x00-\x1f\\]/.test(file);

function origin(file, platform, workspaces, hostLock) {
  assert.ok(local(file), 'Unmapped Metro source ' + file);
  if (file === '__prelude__') return sourceLock;
  if (file.startsWith('node_modules/')) {
    const name = /^node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(file)?.[1];
    const dir = workspaces.get(name);
    if (dir) return dir + '/';
    assert.ok(name && Object.keys(hostLock).some(pkg => pkg.startsWith('node_modules/') && file.startsWith(pkg + '/')), 'Unpinned Metro dependency ' + file);
    return sourceLock;
  }
  if (file === 'index.js') return platform === 'iphone' ? 'scripts/build-cache/device-host.mjs' : 'tests/android/index.js';
  if (platform === 'iphone') {
    if (file === 'App.tsx') return 'catalog/native/Gallery.tsx';
    if (file === 'ScenarioGallery.tsx' || file.startsWith('scenarios/')) return 'catalog/native/' + file;
  }
  if (platform === 'android') {
    if (file === 'FrameFixture.js') return 'tests/android/' + file;
    if (file.startsWith('catalog/')) return file;
  }
  throw Error('Unmapped Metro source ' + file);
}

export function observation(platform, bundle, reads, workspaces, hostLock, tracked = []) {
  assert.ok(['iphone', 'android'].includes(platform));
  assert.ok(Array.isArray(bundle) && bundle.includes('index.js') && bundle.some(file => file.startsWith('node_modules/')));
  const origins = bundle.map(file => [file, origin(file, platform, workspaces, hostLock)]);
  const files = new Set(), directories = new Set(), listings = new Set(), opaque = new Set();
  for (const line of reads.trimEnd().split('\n')) {
    const [kind, file] = JSON.parse(line);
    if (kind === 'opaque') { opaque.add('Unresolved filesystem glob at ' + file); continue; }
    assert.ok(['file','tree','listing'].includes(kind) && (local(file) || file === ''), 'Unclassified device read ' + line);
    if (file === 'node_modules' || file.startsWith('node_modules/')) {
      const name = /^node_modules\/((?:@[^/]+\/)?[^/]+)(?:\/|$)/.exec(file)?.[1];
      if (workspaces.has(name)) directories.add(workspaces.get(name));
      files.add('package-lock.json');
      continue;
    }
    if (/^(?:\.git|dist|release|test-results)(?:\/|$)/.test(file)) continue;
    if (kind === 'listing') listings.add(file);
    else if (kind === 'tree') directories.add(file);
    else if (file) {
      files.add(file);
      if (tracked.some(name => name.startsWith(file + '/'))) listings.add(file);
    }
  }
  assert.ok(files.has('catalog/native/scenarios/fixtures.cjs'), 'Missing device scenario reader trace');
  return { bundle: origins, opaque: [...opaque].sort(), files: [...files].sort(), directories: [...directories].sort(), listings: [...listings].sort().map(path => {
    const prefix = path ? path + '/' : '';
    const children = tracked.filter(name => name.startsWith(prefix)).map(name => name.slice(prefix.length));
    return { path, directories: [...new Set(children.filter(name => name.includes('/')).map(name => name.split('/')[0]))].sort() };
  }) };
}

export function collectObservation(platform, reports, reads, root) {
  const packages = new Map();
  for (const file of git(root, 'ls-files', '-z', '--', 'packages/*/package.json').split('\0').filter(Boolean)) {
    if (/^packages\/[^/]+\/package\.json$/.test(file)) packages.set(JSON.parse(readFileSync(posix.join(root, file))).name, posix.dirname(file));
  }
  return observation(platform, JSON.parse(readFileSync(posix.join(reports, 'bundle/metro-inputs.json'))),
    readFileSync(reads, 'utf8'), packages, JSON.parse(readFileSync(posix.join(root, sourceLock))).packages,
    git(root, 'ls-files', '-z').split('\0').filter(Boolean));
}

function changedListing(listing, path, status) {
  const prefix = listing.path ? listing.path + '/' : '';
  if (!path.startsWith(prefix)) return false;
  const rest = path.slice(prefix.length);
  return status !== 'M' && (!rest.includes('/') || status !== 'A' || !listing.directories.includes(rest.split('/')[0]));
}

export function observedReason(platforms, path, status) {
  for (const [platform, record] of Object.entries(platforms)) {
    if (record.opaque.length) return platform + ': ' + record.opaque.join(', ');
    if (record.bundle.some(([, input]) => input.endsWith('/') ? path.startsWith(input) : input === path))
      return platform + ' Metro bundle';
    // A file probe may have missed a directory which has since gained its first tracked child.
    const probed = record.files.some(file => path === file || (path.startsWith(file + '/') &&
      !record.listings.some(listing => listing.path === file)));
    if (probed || record.directories.some(dir => !dir || path === dir || path.startsWith(dir + '/')) ||
        record.listings.some(dir => changedListing(dir, path, status)))
      return platform + ' harness read';
  }
}

function refs(root, prefix) {
  return git(root, 'for-each-ref', '--format=%(refname) %(objectname)', prefix).split('\n').filter(Boolean).map(line => line.split(' '));
}

// The iPhone driver declares its journeys as literal flow, appearance and text-size triples.
function iphoneProfiles(source) {
  const ast = ts.createSourceFile('verify-ios-simulator.mjs', source, ts.ScriptTarget.Latest, false, ts.ScriptKind.JS);
  const declarations = ast.statements.filter(ts.isVariableStatement).flatMap(s => [...s.declarationList.declarations])
    .filter(d => ts.isIdentifier(d.name) && d.name.text === 'profiles');
  assert.equal(declarations.length, 1, 'Missing iPhone journey configuration');
  const list = declarations[0].initializer;
  assert.ok(!ast.parseDiagnostics.length && list && ts.isArrayLiteralExpression(list) && list.elements.length,
    'Unrecognized iPhone journey configuration');
  return list.elements.map(row => {
    assert.ok(ts.isArrayLiteralExpression(row) && row.elements.length === 3 && row.elements.every(ts.isStringLiteral),
      'Unrecognized iPhone journey profile');
    return row.elements.map(item => item.text);
  });
}

function requireDailyRosters(root, receipt, limits) {
  const driver = 'scripts/verify-ios-simulator.mjs', flowPath = /^tests\/simulator\/[^/]+\.yaml$/;
  const files = treeFiles(root, receipt.tree, path => path === driver || path === fixtureRegistry ||
    flowPath.test(path) || /^docs\/components\/[^/]+\.scenarios\.yaml$/.test(path));
  const fixtures = new Set(), used = new Set();
  const families = registeredNativeSlugs(files.get(fixtureRegistry), (_slug, _descriptor, id) => {
    assert.ok(!fixtures.has(id), 'Duplicate registered native fixture ' + id);
    fixtures.add(id);
  });
  const ids = [...families].flatMap(slug => {
    const doc = JSON.parse(files.get('docs/components/' + slug + '.scenarios.yaml'));
    return scenarioReader.validateDocument(doc, slug).map(scenario => {
      used.add(slug + '.' + scenario.fixture);
      return scenario.id;
    });
  }).sort();
  assert.deepEqual(used, fixtures, 'Daily scenarios must cover exactly the registered native fixtures');
  const { iphone } = receipt.devices, profiles = iphoneProfiles(files.get(driver));
  const flows = [...files.keys()].filter(path => flowPath.test(path)).map(path => posix.basename(path)).sort();
  assert.deepEqual([...iphone.scenarioIds].sort(), ids, 'iPhone scenario roster differs from the daily tree');
  assert.deepEqual(iphone.profiles, profiles, 'iPhone profile roster differs from the daily tree');
  const expected = profiles.map(([flow, appearance]) => {
    assert.ok(flows.includes(flow + '.yaml'), 'Missing iPhone journey file ' + flow);
    return flow + '-' + appearance + '.xml';
  });
  assert.equal(new Set(expected).size, expected.length, 'Duplicate iPhone journey output');
  const { iphoneJourneys, androidReport } = receipt.deviceInputs;
  assert.deepEqual(Object.keys(iphoneJourneys).sort(), expected.sort(), 'iPhone journey results differ from the daily tree');
  assert.equal(iphone.testsPassed, expected.reduce((count, name) => count + checkFlow(iphoneJourneys[name]), 0),
    'iPhone journey count differs from its individual results');
  assert.equal(androidReport?.passed, true, 'Missing completed Android daily report');
  assert.equal(androidReport.failed, 0);
  assert.equal(androidReport.skipped, 0);
  requireCompletedProfiles(androidReport.profiles, flows, ids, limits);
  assert.deepEqual(androidReport.profiles.map(({ id, hardware }) => ({ id, hardware })), receipt.devices.android);
  assert.deepEqual(androidReport.profiles.find(p => p.id === 'low-end').frameBudget, receipt.androidTiming.frameBudget);
}

export function requireDailyObservation(root, receipt) {
  assert.equal(receipt.mode, 'qualification');
  assert.equal(receipt.status, 'passed');
  assert.equal(receipt.noReuse, true);
  assert.equal(receipt.base, receipt.commit);
  assert.ok(Date.parse(receipt.finished) >= Date.parse(receipt.started), 'Incomplete daily qualification timestamps');
  assert.equal(git(root, 'rev-parse', receipt.commit + '^{tree}'), receipt.tree);
  const integration = git(root, 'rev-list', '--first-parent', 'refs/remotes/origin/feat/enterprise-ui');
  assert.ok(integration.split('\n').includes(receipt.commit), 'Observation must come from an integration commit');
  assert.equal(receipt.devicePlan?.full, true);
  assert.equal(receipt.devicePlan.run, true);
  assert.deepEqual(receipt.scope, { iphone: true, families: null });
  assert.deepEqual(Object.keys(receipt.deviceInputs.platforms).sort(), ['android','iphone']);
  const groups = JSON.parse(git(root, 'show', receipt.tree + ':tests/acceptance/suite-inputs.json')).groups;
  assert.deepEqual(receipt.suites.map(row => row.name).sort(), Object.keys(groups).sort(), 'Incomplete daily suite roster');
  assert.equal(receipt.gateTests?.name, 'Trusted gate tests');
  for (const row of [...receipt.suites, receipt.gateTests]) {
    assert.equal(row.result, 'passed', row.name);
    assert.equal(row.reusedFrom, null, row.name);
    assert.ok(Number.isFinite(row.durationMs) && row.durationMs >= 0, row.name);
  }
  for (const name of ['iPhone Simulator','Android standard and low-end']) {
    assert.ok(receipt.suites.find(row => row.name === name)?.durationMs > 0, 'Missing fresh driver result for ' + name);
  }
  const { iphone, android } = receipt.devices;
  assert.equal(iphone?.passed, true);
  assert.equal(iphone.deviceType, 'iPhone Simulator');
  assert.ok(iphone.runtime && iphone.model && Number.isInteger(iphone.testsPassed) && iphone.testsPassed > 0);
  assert.equal(iphone.failed, 0);
  assert.equal(iphone.skipped, 0);
  assert.deepEqual(android.map(profile => profile.id).sort(), ['low-end','standard']);
  assert.ok(android.every(profile => profile.hardware?.fingerprint));
  assert.equal(receipt.androidHostActivityPolicy, 1);
  assert.equal(receipt.androidTiming?.result, 'timing measured');
  const limits = JSON.parse(git(root, 'show', receipt.tree + ':tests/android/low-end-budget.json')).limits;
  assert.ok(timingForIdenticalApk(receipt, receipt.tree, receipt.androidTiming.apkSha256, limits),
    'Missing passing Android timing bound to this receipt, app and tree');
  requireDailyRosters(root, receipt, limits);
}

export function retainedObservations(root, key) {
  const records = [];
  for (const [ref, oid] of refs(root, maps + key + '/')) {
    const receipt = JSON.parse(git(root, 'cat-file', 'blob', oid));
    assert.equal(ref, maps + key + '/' + receipt.id);
    assert.equal(oid, git(root, 'rev-parse', seals + receipt.id));
    assert.equal(receipt.deviceInputs.key, key);
    requireDailyObservation(root, receipt);
    assert.equal(receipt.status, 'passed');
    assert.equal(receipt.noReuse, true);
    assert.deepEqual(receipt.scope, { iphone: true, families: null });
    assert.deepEqual(Object.keys(receipt.deviceInputs.platforms).sort(), ['android','iphone']);
    records.push({ id: receipt.id, tree: receipt.tree, commit: receipt.commit, finished: receipt.finished,
      platforms: receipt.deviceInputs.platforms });
  }
  return records;
}

export function registerObservation(root, receipt) {
  const { key } = receipt.deviceInputs;
  assert.match(key, /^[a-f0-9]{64}$/);
  const oid = git(root, 'rev-parse', seals + receipt.id);
  assert.deepEqual(JSON.parse(git(root, 'cat-file', 'blob', oid)), receipt);
  assert.equal(receipt.mode, 'qualification');
  assert.equal(receipt.base, receipt.commit);
  assert.equal(receipt.androidTiming.result, 'timing measured');
  requireDailyObservation(root, receipt);
  git(root, 'update-ref', maps + key + '/' + receipt.id, oid, '0'.repeat(40));
}

export function alwaysDevice(root, onFailure) {
  const paths = new Set();
  for (const [ref, oid] of refs(root, failures)) {
    const row = JSON.parse(git(root, 'cat-file', 'blob', oid));
    assert.equal(ref, failures + row.daily + '/' + row.proposal);
    assert.ok(row.paths.length && row.paths.every(local));
    for (const path of row.paths) paths.add(path);
    onFailure?.(row);
  }
  return paths;
}

export function scopeFailures(root) {
  const suspended = new Set();
  let missingProof = false;
  const paths = alwaysDevice(root, row => {
    // Existing failure records already identify the immutable proposal receipt.
    const proof = refs(root, seals + row.proposal).find(([name]) => name === seals + row.proposal);
    if (!proof) { missingProof = true; return; }
    const proposal = JSON.parse(git(root, 'cat-file', 'blob', proof[1]));
    assert.equal(proposal.id, row.proposal);
    assert.equal(proposal.tree, row.tree);
    assert.equal(proposal.devicePlan.run, false);
    for (const id of proposal.devicePlan.evidence) suspended.add(id);
  });
  return { paths, suspended, missingProof };
}

// Only first-parent integration commits can attribute a daily failure. A full
// observation on a side branch or one captured later cannot clear this interval.
function untestedChanges(root, daily) {
  const changes = new Set();
  if (!daily.commit) return changes;
  assert.equal(daily.tree, git(root, 'rev-parse', daily.commit + '^{tree}'));
  const keys = new Set(refs(root, maps).map(([ref]) => ref.slice(maps.length).split('/')[0]));
  const passed = new Set();
  for (const key of keys) {
    let checkpoints;
    try { checkpoints = retainedObservations(root, key); }
    catch (error) {
      // An invalid checkpoint cannot shorten the attribution interval.
      console.error('Ignoring unusable daily checkpoints for ' + key + ': ' + error.message);
      continue;
    }
    for (const seen of checkpoints) {
      if (Date.parse(seen.finished) <= Date.parse(daily.started)) passed.add(seen.commit);
    }
  }
  for (const line of git(root, 'log', '--first-parent', '--format=%H %T %P', daily.commit).split('\n')) {
    const [commit, tree, firstParent] = line.split(' ');
    if (passed.has(commit)) break;
    changes.add(firstParent + '/' + tree);
  }
  return changes;
}

function failureRecord(root, row) {
  const body = JSON.stringify(row) + '\n';
  const oid = execFileSync('git', ['hash-object','-w','--stdin'], { cwd: root, input: body, encoding: 'utf8' }).trim();
  const ref = failures + row.daily + '/' + row.proposal;
  return { oid, ref, existing: refs(root, ref) };
}

function recordIntervening(root, daily, proposals) {
  const affected = untestedChanges(root, daily);
  for (const proposal of proposals) {
    if (proposal.tree === daily.tree || proposal.devicePlan?.run !== false ||
        !affected.has(proposal.base + '/' + proposal.tree)) continue;
    const paths = proposal.devicePlan.paths.map(row => row.path);
    assert.ok(paths.length && paths.every(local));
    const { oid, ref, existing } = failureRecord(root, { daily: daily.id, proposal: proposal.id,
      tree: proposal.tree, paths, dailyTree: daily.tree, reason: 'Intervening proposal skipped devices before the daily failure' });
    if (existing.length) assert.deepEqual(existing, [[ref, oid]]);
    else git(root, 'update-ref', ref, oid, '0'.repeat(40));
  }
}

export function recordScopeFailure(root, daily, proposals) {
  if (daily.status !== 'failed') return;
  recordIntervening(root, daily, proposals);
  for (const proposal of proposals) {
    if (proposal.tree !== daily.tree || proposal.devicePlan?.run !== false) continue;
    const paths = proposal.devicePlan.paths.map(row => row.path);
    assert.ok(paths.length && paths.every(local));
    const { oid, ref, existing } = failureRecord(root, { daily: daily.id, proposal: proposal.id, tree: daily.tree, paths,
      reason: 'Daily full qualification failed on the tree which skipped devices' });
    if (existing.length) assert.deepEqual(existing, [[ref, oid]]);
    else git(root, 'update-ref', ref, oid, '0'.repeat(40));
  }
}
