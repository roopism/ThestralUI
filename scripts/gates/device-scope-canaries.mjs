import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nativeScenarios } from '../scenarios/native.cjs';
import { deviceScope } from '../selection/local-device.mjs';

const root = process.cwd(), scratch = mkdtempSync(join(tmpdir(), 'uld-scope-controls-'));
const env = { ...process.env, GIT_INDEX_FILE: join(scratch, 'index') };
const git = (args, input) => execFileSync('git', args, { env, input, encoding: 'utf8' }).trim();
const base = git(['rev-parse', '--verify', (process.argv[2] ?? 'HEAD') + '^{tree}']);
function probe(path, existing = true) {
  git(['read-tree', base]);
  const body = existing ? git(['show', base + ':' + path]) : '';
  const blob = git(['hash-object', '-w', '--stdin'], body + '\n// Scope control\n');
  git(['update-index', '--add', '--cacheinfo', '100644,' + blob + ',' + path]);
  const tree = git(['write-tree']);
  const scope = deviceScope(root, base, tree);
  console.log(path, JSON.stringify(scope));
  assert.deepEqual(deviceScope(root, base, tree, true), { iphone: true, families: null });
  return scope;
}
try {
  const native = probe('packages/native/src/button/binding.tsx');
  assert.equal(native.iphone, true);
  assert.ok(native.families.includes('button'));
  const fixtures = nativeScenarios(root).filter(row => native.families.includes(row.id.split('.')[0])).map(row => row.fixtureId);
  assert.ok(fixtures.includes('modal-dialog.minimal'), 'Button changes must exercise the minimal Dialog');
  assert.ok(fixtures.includes('modal-dialog.workspace'), 'Button changes must exercise the workspace Dialog');
  assert.deepEqual(probe('unclassified/device-input', false), { iphone: true, families: null });
  assert.deepEqual(probe('packages/web/src/unregistered.new', false), { iphone: true, families: null });
  assert.deepEqual(probe('packages/native/src/index.tsx'), { iphone: true, families: null });
  assert.equal(probe('packages/web/src/keyboard-shortcut-label/shortcut-label.tsx').iphone, false);
} finally { rmSync(scratch, { recursive: true, force: true }); }
