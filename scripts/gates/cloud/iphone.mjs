import assert from 'node:assert/strict';

export function iphonePartition(scenarios, shard, shards) {
  assert.ok(Number.isSafeInteger(shards) && shards > 0 && Number.isInteger(shard) && shard > 0 && shard <= shards);
  const ids = scenarios.map(row => row.id);
  assert.ok(ids.length && new Set(ids).size === ids.length);
  const all = [...new Set(ids.map(id => id.split('.')[0]))].sort();
  const families = all.filter((_, index) => index % shards === shard - 1);
  return { families, scenarioIds: ids.filter(id => families.includes(id.split('.')[0])).sort() };
}
export function requireIphoneEvidence(report, scope) {
  assert.equal(report.passed, true);
  assert.equal(report.failed, 0);
  assert.equal(report.skipped, 0);
  assert.ok(report.testsPassed > 0);
  assert.equal(report.xcode, 'Xcode 26.3\nBuild version 17C529');
  assert.match(report.runtime, /(?:^|[.-])iOS[- ]26[.-]2$/);
  assert.match(report.maestro, /(?:^|\n)2\.4\.0$/);
  assert.deepEqual([...report.scenarioIds].sort(), scope.scenarioIds);
  return { ...scope, passed: true, failed: 0, skipped: 0, xcode: report.xcode, runtime: report.runtime, maestro: report.maestro, testsPassed: report.testsPassed };
}

export function selectHostedIphone(simctl) {
  const runtime = 'com.apple.CoreSimulator.SimRuntime.iOS-26-2';
  const available = () => JSON.parse(simctl('list', 'devices', 'available', '--json')).devices[runtime] ?? [];
  const existing = available().find(row => row.name === 'iPhone 17' && row.isAvailable);
  if (existing) return existing.udid;
  const runtimes = JSON.parse(simctl('list', 'runtimes', '--json')).runtimes;
  assert.ok(runtimes.some(row => row.identifier === runtime && row.isAvailable), 'The pinned iOS 26.2 runtime is missing');
  const id = simctl('create', 'iPhone 17', 'com.apple.CoreSimulator.SimDeviceType.iPhone-17', runtime).trim();
  assert.ok(available().some(row => row.udid === id && row.name === 'iPhone 17' && row.isAvailable),
    'Pinned device could not be created for the isolated hosted user');
  return id;
}
