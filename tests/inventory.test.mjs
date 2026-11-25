import assert from 'node:assert/strict';
import test from 'node:test';
import { auditInventory, summarize } from '../scripts/inventory.mjs';
const base = {
  id: 'slider',
  layer: 'molecule',
  web: 'supported',
  maturity: 'candidate',
  platforms: { web: 'supported', iOS: 'planned', Android: 'planned' },
  native: 'planned',
  owner: 'library',
  api: ['forms:Slider', 'forms:SliderTrack'],
  refs: ['APG'],
  story: 'story',
  test: 'test',
};
const official = ['forms:Slider', 'forms:SliderTrack'];
const run = (rows, actual = official) => auditInventory(rows, actual, () => true);
test('counts unique component families independently of slot and helper exports', () => {
  run([base]);
  assert.equal(summarize([base]).families, 1);
  assert.equal(summarize([base]).webSupported, 1);
  assert.equal(summarize([base]).webBindings, 2);
});
test('prevents silent changes to the shipped inventory and duplicate ownership of bindings', () => {
  assert.throws(() => run([base], ['forms:Slider']), /unexpected mapping/i);
  assert.throws(() => run([base], [...official, 'forms:NewThing']), /unmapped/i);
  assert.throws(() => run([base, { ...base, id: 'another' }]), /duplicate binding/i);
});
test('requires implementation, examples, tests and owner for supported families and explicit exclusion reasons', () => {
  for (const invalid of [
    { ...base, story: undefined },
    { ...base, owner: '' },
    { ...base, test: undefined },
    { ...base, web: 'excluded' },
  ]) {
    assert.throws(() => run([invalid]));
  }
  assert.throws(() => auditInventory([base], official, () => false), /missing evidence/i);
});

test('unrelated existing story or test files cannot satisfy the evidence gate', async () => {
  const { hasFamilyEvidence } = await import('../scripts/inventory.mjs');
  const row = {
    id: 'Checkbox',
    api: ['forms:Checkbox'],
    story: 'catalog/Controls.stories.tsx',
    test: 'tests/advanced.test.tsx',
  };
  assert.equal(hasFamilyEvidence(row, 'story'), true);
  assert.equal(hasFamilyEvidence(row, 'test'), true);
  assert.equal(hasFamilyEvidence({ ...row, test: 'tests/collections.test.tsx' }, 'test'), false);
  assert.equal(
    hasFamilyEvidence({ ...row, story: 'catalog/DocumentReview.stories.tsx' }, 'story'),
    false,
  );
});
test('typed bindings distinguish controlled inputs and their refs from stateless layout', async () => {
  const { publicContracts } = await import('../scripts/inventory.mjs');
  const types = publicContracts();
  const slider = types.get('forms:Slider');
  assert.ok(slider.events.includes('onChange'));
  assert.ok(slider.state.includes('defaultValue'));
  assert.equal(slider.ref, true);
  const shell = types.get('workflows:AppShell');
  assert.ok(shell.slots.includes('navigation'));
  assert.equal(shell.ref, false);
  assert.deepEqual(shell.events, []);
});

test('rejects invented platform or maturity values and contradictory status claims', () => {
  for (const patch of [
    { web: 'done' },
    { native: 'certified' },
    { maturity: 'unreviewed' },
    { platforms: { web: 'supported', iOS: 'stable', Android: 'stable' } },
  ]) {
    assert.throws(() => run([{ ...base, ...patch }]), /status|maturity|platform/i);
  }
});
