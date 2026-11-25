import assert from 'node:assert/strict';

const engines = ['chromium', 'firefox', 'webkit'];

// Reconcile engine reports before accepting a whole-suite verdict.
export function browserCoverage(suite, reports, roster, scenarioIds = []) {
  assert.deepEqual([...roster.projects].sort(), engines);
  assert.deepEqual(reports.map(report => report.shard.engine).sort(), engines, 'Missing or duplicate browser engine');
  const allCases = [];
  for (const report of reports) {
    const { shard, coverage } = report;
    assert.equal(shard.suite, suite);
    const expected = roster.cases.filter(name => name.startsWith(shard.engine + ' | '));
    assert.ok(expected.length, 'No registered browser cases for ' + shard.engine);
    assert.deepEqual(coverage.cases, expected, 'Shard must attest every registered case for ' + shard.engine);
    allCases.push(...coverage.cases);
    if (suite === 'Linux browser behavior') {
      assert.ok(scenarioIds.length, 'Linux requires the portable scenarios');
      assert.ok(coverage.scenarios.every(name => name.startsWith(shard.engine + ' | ')));
      const scenarios = coverage.scenarios.filter(name => name.split(' | ')[1] === 'scenarios.spec.ts');
      assert.deepEqual(scenarios, scenarioIds.map(id => shard.engine + ' | scenarios.spec.ts | ' + id).sort(),
        'Missing, duplicate or unregistered portable scenario');
    }
  }
  allCases.sort();
  assert.deepEqual(allCases, roster.cases, 'Merged reports differ from the whole browser roster');
  return allCases;
}
