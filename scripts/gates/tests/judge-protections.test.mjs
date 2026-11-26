import assert from 'node:assert/strict';
import test from 'node:test';
import { compareWithBase } from './fixtures/protected-inputs.mjs';
import { fixtureGit } from './fixtures/hermetic-git.mjs';

const gateFiles = ['scripts/gates/no-weakening.mjs', 'scripts/selection/staged-tree.mjs'];
const pinRegistry = 'scripts/gates/immutable-paths.json';
const pins = { [pinRegistry]: JSON.stringify(gateFiles) };
const ledger = 'docs/ui-lazy-dev-state.md';
const before = '// original fixture\n', after = '// reviewed fixture\n';
const blobId = text => fixtureGit(process.env.HOME, ['hash-object', '--stdin'], text);

test('gate diagnostics retain their rejection obligations', t => {
  const compare = compareWithBase(t, 'scripts/gates/sample.mjs', "issues.push('incomplete'); problem('name', 'missing');");
  assert.ok(compare("problem('name', 'missing');").some(issue => issue.includes('removed rule')));
  assert.ok(compare("issues.push('incomplete');").some(issue => issue.includes('removed rule')));
});

test('pinned gate changes require the same exact trusted and local owner record', t => {
  for (const path of gateFiles) {
    const record = 'Owner authorizes gate file ' + path + ' from ' + blobId(before) + ' to ' + blobId(after);
    const entry = '## Owner decisions\n\n- ' + record + '\n';
    const proposed = compareWithBase(t, path, before, pins, record);
    assert.ok(proposed(after, { [ledger]: entry }).length > 0, 'Candidate decisions cannot authorize a change');
    assert.ok(compareWithBase(t, path, before, { ...pins, [ledger]: entry })(after).length > 0, 'Local decision required');
    const duplicate = compareWithBase(t, path, before, { ...pins, [ledger]: entry }, record + '\n' + record);
    assert.ok(duplicate(after).length > 0, 'Ambiguous local records cannot authorize a change');
    const approved = compareWithBase(t, path, before, { ...pins, [ledger]: entry }, record);
    assert.deepEqual(approved(after), []);
    assert.ok(approved('// another fixture').length > 0, 'Only the recorded blob pair may change');
  }
  const changeList = compareWithBase(t, pinRegistry, JSON.stringify(gateFiles));
  assert.ok(changeList('[]').length > 0, 'Adopted pin list is immutable');
});

test('protected assertions keep their control flow', t => {
  const compare = compareWithBase(t, 'tests/controls/shape.mjs', 'function sample() { assert.ok(value); }');
  for (const body of ['return; assert.ok(value);', 'if (false) assert.ok(value);', 'active ? assert.ok(value) : idle;']) {
    assert.ok(compare('function sample() { ' + body + ' }').some(issue => issue.includes('removed assert')), body);
  }
  const nested = body => 'function sample(rows) { for (const row of rows) { ' + body +
    ' } assert.ok(rows); }';
  const afterLoop = compareWithBase(t, 'tests/controls/loop.mjs', nested('if (!row) continue;'));
  assert.deepEqual(afterLoop(nested('if (!row) continue; assert.ok(row);')), []);
  const insideLoop = compareWithBase(t, 'tests/controls/loop.mjs', nested('assert.ok(row);'));
  assert.ok(insideLoop(nested('if (!row) continue; assert.ok(row);')).some(issue => issue.includes('removed assert')));
  const labeled = body => 'function sample(rows) { group: { for (const row of rows) { ' + body +
    ' } assert.ok(rows); } }';
  const insideLabel = compareWithBase(t, 'tests/controls/loop.mjs', labeled(''));
  assert.ok(insideLabel(labeled('if (!row) break group;')).some(issue => issue.includes('removed assert')));
});

test('native fixture IDs may only grow', t => {
  const fixture = entries => 'module.exports = ' + JSON.stringify(Object.fromEntries(entries.map(id => [id, {}]))) + ';';
  const ids = ['sample.small', 'sample.combined'];
  const registry = compareWithBase(t, 'catalog/native/scenarios/fixtures.cjs', fixture(ids));
  assert.deepEqual(registry(fixture([...ids, 'sample.extra'])), []);
  assert.ok(registry(fixture([ids[0]])).some(issue => issue.includes('sample.combined')));
});
