import assert from 'node:assert/strict';

const lanes = new Set(['github-linux', 'github-macos', 'local']);
const engines = ['chromium', 'firefox', 'webkit'];
const localOnly = new Set(['Mac browser performance', 'Android standard and low-end']);

export function qualificationShards(roster, suiteNames) {
  assert.equal(roster.schema, 1, 'Unknown cloud lane roster');
  assert.deepEqual(Object.keys(roster.suites).sort(), [...suiteNames].sort(), 'The lane roster must cover every qualification suite');
  const jobs = [];
  for (const suite of suiteNames) {
    assert.match(suite, /^[A-Za-z0-9]+(?:[ -][A-Za-z0-9]+)*$/, 'Suite names must form a safe shard identifier');
    const { lane, alsoRunOn = [], shards, splitBy } = roster.suites[suite];
    assert.ok(Array.isArray(alsoRunOn));
    const platforms = [lane, ...alsoRunOn];
    assert.ok(platforms.every(name => lanes.has(name)) && new Set(platforms).size === platforms.length, 'Unknown or duplicate lane for ' + suite);
    assert.ok(Number.isSafeInteger(shards) && shards > 0, 'Invalid shard count for ' + suite);
    if (shards === 1) assert.equal(splitBy, undefined);
    else if (splitBy === 'engine') assert.equal(shards, engines.length);
    else assert.ok(splitBy === 'family' && suite === 'iPhone Simulator', 'Unsupported partition for ' + suite);
    if (localOnly.has(suite)) {
      assert.deepEqual(platforms, ['local']);
      assert.equal(shards, 1);
    }
    for (const platform of platforms) {
      for (let index = 0; index < shards; index++) {
        const id = [suite.toLowerCase().replaceAll(' ', '-'), platform, index + 1, 'of', shards].join('-');
        jobs.push({ id, suite, lane: platform, shard: index + 1, shards, ...(splitBy ? { splitBy } : {}),
          ...(splitBy === 'engine' ? { engine: engines[index] } : {}) });
      }
    }
  }
  assert.equal(new Set(jobs.map(job => job.id)).size, jobs.length);
  return jobs;
}

export function preserveLaneCoverage(base, proposal, suiteNames) {
  const required = qualificationShards(base, suiteNames);
  const latest = qualificationShards(proposal, suiteNames);
  for (const old of required) {
    const compatible = latest.filter(job => job.suite === old.suite && job.lane === old.lane && job.splitBy === old.splitBy);
    assert.ok(compatible.length >= old.shards && (!old.engine || compatible.some(job => job.engine === old.engine)),
      'Lost required ' + old.lane + ' coverage for ' + old.suite);
  }
}
