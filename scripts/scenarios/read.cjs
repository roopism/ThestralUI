const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');

function exactKeys(value, keys, context) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), context + ' must be an object');
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), context + ' has missing or unknown fields');
}
function identifier(value, context) {
  assert.ok(typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value), context + ' needs a lowercase slug');
}
function validateDocument(doc, expectedSlug) {
  exactKeys(doc, ['family', 'scenarios'], 'Scenario document');
  assert.ok(typeof doc.family === 'string' && doc.family.trim(), 'Missing family');
  const slug = doc.family.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  if (expectedSlug) assert.equal(slug, expectedSlug, 'Scenario filename differs from its family');
  assert.ok(Array.isArray(doc.scenarios) && doc.scenarios.length, doc.family + ' needs scenarios');
  const ids = new Set();
  return doc.scenarios.map((scenario) => {
    const keyboardFocus = Object.hasOwn(scenario, 'webKeyboardFocus');
    exactKeys(scenario, keyboardFocus ? ['id', 'fixture', 'steps', 'webKeyboardFocus'] : ['id', 'fixture', 'steps'], doc.family);
    if (keyboardFocus) {
      const target = scenario.webKeyboardFocus;
      exactKeys(target, ['role', 'name'], scenario.id + ' web keyboard focus');
      assert.ok(target.role === 'button' && typeof target.name === 'string' && target.name.trim(),
        scenario.id + ' needs a named keyboard-focus button');
    }
    const id = scenario.id;
    assert.ok(typeof id === 'string' && id.startsWith(slug + '.'), doc.family + ' needs a family-qualified id');
    identifier(id.slice(slug.length + 1), id);
    assert.ok(!ids.has(id), 'Duplicate scenario ' + id);
    ids.add(id);
    identifier(scenario.fixture, id + ' fixture');
    assert.ok(Array.isArray(scenario.steps) && scenario.steps.length, id + ' needs steps');
    for (const [index, step] of scenario.steps.entries()) {
      const context = id + ' step ' + (index + 1);
      const action = step?.act;
      const expectation = step?.expect;
      assert.ok(action === 'activate' || ['visible', 'before', 'busy', 'checked', 'unchecked', 'mixed'].includes(expectation), context + ' has unknown operation');
      const keys = [action ? 'act' : 'expect', 'target'];
      if (expectation === 'before') keys.push('other');
      if (expectation === 'busy') assert.equal(step.target?.role, 'button', context + ' needs a button');
      if (['checked', 'unchecked', 'mixed'].includes(expectation))
        assert.equal(step.target?.role, 'checkbox', context + ' needs a checkbox');
      exactKeys(step, keys, context);
      for (const key of keys.filter((k) => k === 'target' || k === 'other')) {
        const target = step[key];
        exactKeys(target, ['role', 'name'], context + ' ' + key);
        assert.ok(typeof target.role === 'string' && target.role.trim() && typeof target.name === 'string' && target.name.trim(),
          context + ' requires a role and an exact name');
      }
    }
    return { family: doc.family, ...scenario };
  });
}

function readScenarios(root, families) {
  const directory = join(root, 'docs/components');
  const suffix = '.scenarios.yaml';
  const slugs = families ?? readdirSync(directory).filter((file) => file.endsWith(suffix)).sort().map((file) => file.slice(0, -suffix.length));
  assert.equal(new Set(slugs).size, slugs.length, 'Duplicate scenario family');
  return slugs.flatMap((slug) => {
    identifier(slug, 'Scenario family');
    const path = join(directory, slug + suffix);
    try {
      return validateDocument(JSON.parse(readFileSync(path, 'utf8')), slug);
    } catch (error) {
      throw new Error(path + ': ' + error.message, { cause: error });
    }
  });
}
module.exports = { readScenarios, validateDocument };
