import assert from 'node:assert/strict';
import test from 'node:test';
import { inAccessibilityOrder } from '../../../tests/simulator/scenarios.mjs';
import nativeRoles from '../../scenarios/native-roles.cjs';

test('Android reading order accepts a named slider with its value and requires a unique fixture ID', () => {
  const slider = { role: 'slider', name: 'Volume' }, label = { role: 'text', name: 'Settings' };
  const android = { 'resource-id': 'app:id/scenario.slider.Volume', 'content-desc': 'Volume, 50%', class: 'android.widget.SeekBar' };
  const text = { 'resource-id': 'app:id/scenario.text.Settings', text: 'Settings' };
  const tree = (...nodes) => ({ children: nodes.map(attributes => ({ attributes })) });
  assert.equal(nativeRoles.verifyNativeRole([text, android], 'android', slider).role, 'slider');
  assert.deepEqual(inAccessibilityOrder(tree(text, android), [slider, label], 'android'), [1, 0]);
  assert.deepEqual(inAccessibilityOrder(tree(android, text), [slider, label], 'android'), [0, 1]);
  assert.throws(() => inAccessibilityOrder(tree(android, { ...android, 'content-desc': 'Muted' }), [slider], 'android'));
  assert.throws(() => inAccessibilityOrder(tree({ ...android, 'content-desc': 'Music volume, 50%' }), [slider], 'android'));
  assert.throws(() => inAccessibilityOrder(tree({ ...text, text: 'Settings, 50%' }), [label], 'android'));
  assert.throws(() => inAccessibilityOrder(tree({ 'resource-id': 'scenario.slider.undefined' }),
    [{ role: 'slider', name: 'undefined' }], 'android'));
});
