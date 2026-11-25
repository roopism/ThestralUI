import assert from 'node:assert/strict';
import { SaxesParser } from 'saxes';

export function accessibilityNodes(xml) {
  const result = [];
  const parser = new SaxesParser();
  parser.on('opentag', (tag) => {
    if (tag.name === 'node') result.push(tag.attributes);
  });
  parser.write(xml).close();
  assert.ok(result.length, 'Android accessibility hierarchy contains no nodes');
  return result;
}

export function target(nodes, id, { role, name, enabled, focused } = {}) {
  const matches = nodes.filter((node) => node['resource-id']?.replace(/^[^:]+:id\//, '') === id);
  assert.equal(matches.length, 1, 'Expected a unique accessibility node for ' + id);
  const [node] = matches;
  if (role) assert.equal(node.class, 'android.widget.' + role, id + ' role');
  if (name) assert.ok([node.text, node['content-desc']].includes(name), id + ' accessible name');
  if (enabled !== undefined) assert.equal(node.enabled, String(enabled), id + ' enabled state');
  if (focused !== undefined) assert.equal(node.focused, String(focused), id + ' input focus');
  return node;
}

export function bounds(node) {
  const match = /^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/.exec(node.bounds);
  assert.ok(match, 'Missing Android accessibility bounds');
  const [x, y, right, bottom] = match.slice(1).map(Number);
  assert.ok(right > x && bottom > y, 'Empty Android accessibility bounds');
  return {
    x,
    y,
    right,
    bottom,
    centerX: Math.floor((x + right) / 2),
    centerY: Math.floor((y + bottom) / 2),
  };
}
