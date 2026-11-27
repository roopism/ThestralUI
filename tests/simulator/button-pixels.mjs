import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveValue } from '../../packages/tokens/resolve-value.mjs';

export function assertDarkButtonPixels({ pixels, fill, label }) {
  assert.ok(Number.isSafeInteger(pixels) && pixels > 0, 'Empty dark Button region');
  assert.ok(Number.isSafeInteger(fill) && fill > pixels / 2 && fill <= pixels, 'Dark Button fill is missing');
  assert.ok(Number.isSafeInteger(label) && label > 0 && label <= pixels - fill, 'Dark Button label color is missing');
}

export function verifyDarkButton(rect, measure) {
  const source = JSON.parse(readFileSync(new URL('../../packages/tokens/tokens.json', import.meta.url)));
  const lookup = path => path.split('.').reduce((node, key) => node?.[key], source);
  const fill = resolveValue(lookup, 'dark.accent', 'color');
  const label = resolveValue(lookup, 'dark.onAccent', 'color');
  assert.notEqual(fill, label);
  const counts = measure(rect, fill, label);
  assertDarkButtonPixels(counts);
  return { rect, fill, label, counts };
}

export function iosReviewBounds(tree) {
  const matches = [];
  const visit = node => {
    if (node.attributes?.['resource-id'] === 'workspace-review') matches.push(node.attributes);
    for (const child of node.children ?? []) visit(child);
  };
  visit(tree);
  assert.equal(matches.length, 1, 'Expected one workspace review Button');
  assert.equal(matches[0].accessibilityText, 'Review changes');
  const match = /^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/.exec(matches[0].bounds);
  assert.ok(match, 'Invalid iOS review Button bounds');
  const [x, y, right, bottom] = match.slice(1).map(Number);
  return { x, y, right, bottom };
}
