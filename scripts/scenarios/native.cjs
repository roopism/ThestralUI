const assert = require('node:assert/strict');
const fixtures = require('../../catalog/native/scenarios/fixtures.cjs');
const { readScenarios } = require('./read.cjs');

function nativeScenarios(root, registry = fixtures, candidateFixtures) {
  let ids = Object.keys(registry);
  assert.ok(ids.length, 'No native scenario fixtures are registered');
  for (const id of ids) {
    assert.match(id, /^[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid native fixture identifier ' + id);
    assert.ok(typeof registry[id].render === 'function' && registry[id].label?.trim(), 'Invalid native fixture ' + id);
  }
  if (candidateFixtures) {
    for (const id of ids) assert.ok(Object.hasOwn(candidateFixtures, id), 'Missing incumbent native fixture ' + id);
    registry = candidateFixtures;
    ids = Object.keys(registry);
  }
  const families = [...new Set(ids.map(id => id.split('.')[0]))];
  const used = new Set();
  const scenarios = readScenarios(root, families).map(scenario => {
    const fixtureId = scenario.id.split('.')[0] + '.' + scenario.fixture;
    assert.ok(Object.hasOwn(registry, fixtureId), scenario.id + ' has no native fixture ' + fixtureId);
    for (const [index, step] of scenario.steps.entries()) {
      if (step.act === 'activate' && !['button', 'checkbox'].includes(step.target.role)) {
        throw new Error(scenario.id + ' step ' + (index + 1) + ' has unsupported native activation role ' + step.target.role);
      }
    }
    used.add(fixtureId);
    return { ...scenario, fixtureId };
  });
  for (const id of ids) assert.ok(used.has(id), 'No neutral scenario uses the registered native fixture ' + id);
  return scenarios;
}
module.exports = { nativeScenarios };
