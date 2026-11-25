import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function selectNativeScenarios(root, all) {
  const path = join(root, '.git', 'local-device-scope.json');
  if (!existsSync(path)) return all;
  assert.equal(process.env.UI_GATE_SNAPSHOT, '1', 'Device scope requires an isolated candidate');
  const { families } = JSON.parse(readFileSync(path));
  if (families === null) return all;
  assert.ok(Array.isArray(families) && families.every(id => typeof id === 'string' && /^[a-z0-9-]+$/.test(id)));
  return all.filter(scenario => families.includes(scenario.id.split('.')[0]));
}
