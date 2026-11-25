import assert from 'node:assert/strict';
import test from 'node:test';
import { checkSource } from '../../../packages/policy/quality/integrity.mjs';

// These are source strings for the TypeScript parser. None is evaluated or loaded.
const inspect = statement => checkSource('packages/web/src/sample.ts', `function sample(resource: never) { ${statement} }`);

test('renderer integrity rejects reflective global property reads', () => {
  assert.match(inspect('Reflect.get(globalThis, resource);').join('\n'), /reflective global/i);
  assert.match(inspect("Reflect['get'](window, resource);").join('\n'), /reflective global/i);
  assert.deepEqual(inspect("Reflect.get({ label: 'Title' }, 'label');"), []);
});

test('renderer integrity rejects dynamic constructors reached through prototypes', () => {
  assert.match(inspect('constructor(resource)();').join('\n'), /dynamic code/i);
  assert.match(inspect("const captured = Object.getPrototypeOf(resource)['constructor'];").join('\n'), /dynamic code/i);
  assert.match(inspect("const captured = Reflect.get(Object.getPrototypeOf(resource), 'constructor');").join('\n'), /dynamic code/i);
  assert.match(inspect('const {constructor: captured} = Object.getPrototypeOf(resource);').join('\n'), /dynamic code/i);
  assert.deepEqual(inspect('class Label { constructor(readonly text: string) {} }'), []);
});

test('renderer integrity rejects imperative image source assignments', () => {
  assert.match(inspect('new Image().src = resource;').join('\n'), /image source/i);
  assert.match(inspect("const thumbnail = new window.Image(); const copy = thumbnail; copy['src'] = resource;").join('\n'), /image source/i);
  assert.deepEqual(inspect("const record = { src: '' }; record.src = resource;"), []);
  assert.deepEqual(inspect('const image = new Image(); return image.width;'), []);
  assert.deepEqual(inspect("const image = new Image(); function render(image: {src: string}) { image.src = ''; }"), []);
});
