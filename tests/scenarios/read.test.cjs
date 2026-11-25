const assert = require('node:assert/strict');
const { test } = require('node:test');
const { validateDocument } = require('../../scripts/scenarios/read.cjs');

test('unknown operations, extra fields and ambiguous identifiers fail before adapter execution', () => {
  const target = { role: 'button', name: 'Save' };
  const scenario = { id: 'button.save', fixture: 'save', steps: [{ act: 'activate', target }] };
  const doc = { family: 'Button', scenarios: [scenario] };
  assert.equal(validateDocument(doc, 'button')[0].family, 'Button');
  for (const step of [{ act: 'activate', target, expect: 'visible' }, { act: 'tap', target }, { expect: 'before', target },
    { expect: 'visible', target: { ...target, testID: 'implementation-detail' } }]) {
    assert.throws(() => validateDocument({ ...doc, scenarios: [{ ...scenario, steps: [step] }] }), /button.save step 1/);
  }
  assert.throws(() => validateDocument({ ...doc, scenarios: [scenario, scenario] }), /Duplicate scenario/);
  assert.throws(() => validateDocument(doc, 'stack'), /filename differs/);
});

test('iPhone reading order uses the accessible hierarchy and detects duplicates and missing targets', async () => {
  const { inAccessibilityOrder, parseHierarchy } = await import('../simulator/scenarios.mjs');
  const target = (name) => ({ role: 'text', name });
  const element = (name) => ({ attributes: { 'resource-id': 'scenario.text.' + name, accessibilityText: name } });
  const first = target('First'), second = target('Second');
  const tree = { children: [{ children: [element('Second')] }, element('First')] };
  assert.deepEqual(inAccessibilityOrder(parseHierarchy('None: \n' + JSON.stringify(tree)), [first, second]), [1, 0]);
  assert.throws(() => inAccessibilityOrder({ children: [element('First'), element('First')] }, [first]), /Expected one/);
  assert.throws(() => inAccessibilityOrder(tree, [target('Unknown')]), /Expected one/);
});

test('the device adapter discovers a third registration and rejects missing fixtures or unsupported operations', async () => {
  const { readFileSync } = require('node:fs');
  const { resolve } = require('node:path');
  const { withAdditionalFixture } = require('./native-registry-fixture.cjs');
  const { runNativeScenarios } = await import('../simulator/scenarios.mjs');
  const { nativeScenarios } = require('../../scripts/scenarios/native.cjs');
  const root = resolve(__dirname, '../..');
  const entry = { label: 'Quote example', render: () => { throw Error('Node must never render a Metro fixture'); } };
  await withAdditionalFixture(root, entry, (checkout, registry, scenario, save) => {
    const flows = [];
    function run(_cwd, _command, args) {
      if (args.includes('hierarchy')) return JSON.stringify({ children: ['First', 'Second'].map(name =>
        ({ attributes: { 'resource-id': 'scenario.text.' + name, accessibilityText: name } })) });
      flows.push(JSON.parse(readFileSync(args.at(-1), 'utf8').split('\n---\n')[1]));
      return '';
    }
    // This synthetic driver only supplies the Button, Stack and Quote views used below.
    const exampleFixtures = Object.fromEntries(Object.entries(registry).filter(([id]) =>
      ['button', 'stack', 'quote'].includes(id.split('.')[0])));
    const ids = runNativeScenarios({ root: checkout, registry: exampleFixtures, reports: checkout, run, log() {},
      maestro: 'maestro', device: 'test-device', appId: 'test-app', env: {} });
    assert.ok(ids.includes('quote.shows-preview'));
    assert.ok(flows.flat().some(step => step.tapOn?.id === '^fixture\\.quote\\.preview$'));
    assert.ok(flows.flat().some(step => step.assertVisible?.text === '^Quote ready$'));
    assert.ok(flows.flat().some(step => step.tapOn?.text === '^Save$' && step.tapOn.enabled === true));
    save({ ...scenario, steps: [{ act: 'activate', target: { role: 'text', name: 'Quote ready' } }] });
    assert.throws(() => nativeScenarios(checkout, registry), /quote.shows-preview step 1 has unsupported native activation role text/);
    assert.throws(() => runNativeScenarios({ root: checkout, registry, run: () => assert.fail('Unexpected interaction') }),
      /quote.shows-preview step 1 has unsupported native activation role text/);
    save({ ...scenario, fixture: 'missing' });
    assert.throws(() => nativeScenarios(checkout, registry), /quote.shows-preview has no native fixture quote.missing/);
    save({ ...scenario, steps: [{ ...scenario.steps[0], expect: 'unknown' }] });
    assert.throws(() => nativeScenarios(checkout, registry), /quote.shows-preview step 1 has unknown operation/);
  });
});

test('only true checkbox targets accept neutral checked-state expectations', () => {
  const doc = (role, expect) => ({family:'Queue',scenarios:[{id:'queue.toggle',fixture:'orders',steps:[{expect,target:{role,name:'Select audit'}}]}]});
  for (const state of ['checked','unchecked','mixed']) {
    assert.equal(validateDocument(doc('checkbox',state),'queue')[0].steps[0].expect, state);
    assert.throws(() => validateDocument(doc('button',state),'queue'), /needs a checkbox/);
  }
});
