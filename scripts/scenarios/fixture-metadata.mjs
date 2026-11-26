import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { fixtureRegistry, registeredNativeSlugs } from '../selection/native-tier-two.mjs';
import nativeReader from './native.cjs';

// Read the candidate's fixture descriptors without loading its renderers into the verifier.
export function readCandidateScenarios(root) {
  const records = Object.create(null);
  registeredNativeSlugs(readFileSync(join(root, fixtureRegistry), 'utf8'), (_slug, descriptor, id) => {
    assert.match(id, /^[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(!Object.hasOwn(records, id), 'Duplicate native fixture ' + id);
    const fields = new Map();
    for (const property of descriptor.properties) {
      assert.ok(ts.isPropertyAssignment(property) &&
        (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)), 'Unclassified native fixture ' + id);
      assert.ok(!fields.has(property.name.text), 'Duplicate native fixture field in ' + id);
      fields.set(property.name.text, property.initializer);
    }
    const label = fields.get('label'), render = fields.get('render');
    assert.ok(label && ts.isStringLiteralLike(label) && label.text.trim() &&
      render && (ts.isArrowFunction(render) || ts.isFunctionExpression(render)), 'Invalid native fixture ' + id);
    records[id] = label.text;
  });
  return nativeReader.deviceScenarios(root, undefined, records);
}
