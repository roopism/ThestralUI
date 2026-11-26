import assert from 'node:assert/strict';
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
    if (record.files.includes(path) || record.directories.some(dir => !dir || path === dir || path.startsWith(dir + '/')) ||
        record.listings.some(dir => changedListing(dir, path, status)))
      return platform + ' harness read';
  }
}

function refs(root, prefix) {
  return git(root, 'for-each-ref', '--format=%(refname) %(objectname)', prefix).split('\n').filter(Boolean).map(line => line.split(' '));
}

export function retainedObservations(root, key) {
  const records = [];
  for (const [ref, oid] of refs(root, maps + key + '/')) {
    const receipt = JSON.parse(git(root, 'cat-file', 'blob', oid));
    assert.equal(ref, maps + key + '/' + receipt.id);
    assert.equal(oid, git(root, 'rev-parse', seals + receipt.id));
    assert.equal(receipt.deviceInputs.key, key);
    assert.equal(receipt.status, 'passed');
    assert.equal(receipt.noReuse, true);
    assert.deepEqual(receipt.scope, { iphone: true, families: null });
    assert.deepEqual(Object.keys(receipt.deviceInputs.platforms).sort(), ['android','iphone']);
    records.push({ id: receipt.id, tree: receipt.tree, platforms: receipt.deviceInputs.platforms });
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
  git(root, 'update-ref', maps + key + '/' + receipt.id, oid, '0'.repeat(40));
}

export function alwaysDevice(root) {
  const paths = new Set();
  for (const [ref, oid] of refs(root, failures)) {
    const row = JSON.parse(git(root, 'cat-file', 'blob', oid));
    assert.equal(ref, failures + row.daily + '/' + row.proposal);
    assert.ok(row.paths.length && row.paths.every(local));
    for (const path of row.paths) paths.add(path);
  }
  return paths;
}

export function recordScopeFailure(root, daily, proposals) {
  if (daily.status !== 'failed') return;
  for (const proposal of proposals) {
    if (proposal.tree !== daily.tree || proposal.devicePlan?.run !== false) continue;
    const paths = proposal.devicePlan.paths.map(row => row.path);
    assert.ok(paths.length && paths.every(local));
    const body = JSON.stringify({ daily: daily.id, proposal: proposal.id, tree: daily.tree, paths,
      reason: 'Daily full qualification failed on the tree which skipped devices' }) + '\n';
    const oid = execFileSync('git', ['hash-object','-w','--stdin'], { cwd: root, input: body, encoding: 'utf8' }).trim();
    const ref = failures + daily.id + '/' + proposal.id;
    const existing = refs(root, ref);
    if (existing.length) assert.deepEqual(existing, [[ref, oid]]);
    else git(root, 'update-ref', ref, oid, '0'.repeat(40));
  }
}
