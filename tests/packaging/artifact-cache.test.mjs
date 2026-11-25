import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { packedInputs, readArtifact, storeArtifact } from '../../scripts/build-cache/artifact-cache.mjs';

test('artifact reuse checks the expected bytes after missing, corrupt or linked cache entries', t => {
  const common = mkdtempSync(join(tmpdir(), 'uld-object-'));
  t.after(() => rmSync(common, { recursive: true, force: true }));
  const bytes = Buffer.from('verified packed output');
  const hash = storeArtifact(common, bytes);
  assert.deepEqual(readArtifact(common, hash), bytes);
  assert.equal(readArtifact(common, '0'.repeat(64)), null);
  const path = join(common, 'uld-cache/objects', hash.slice(0, 2), hash.slice(2));
  chmodSync(path, 0o644);
  writeFileSync(path, 'different bytes');
  assert.equal(readArtifact(common, hash), null);
  rmSync(path);
  const other = join(common, 'unverified');
  writeFileSync(other, bytes);
  symlinkSync(other, path);
  assert.equal(readArtifact(common, hash), null);
  assert.equal(storeArtifact(common, bytes), hash);
  assert.deepEqual(readArtifact(common, hash), bytes);
});

test('packed inputs include generated files, executable modes and tool inputs', t => {
  const pkg = mkdtempSync(join(tmpdir(), 'uld-pack-key-'));
  t.after(() => rmSync(pkg, { recursive: true, force: true }));
  mkdirSync(join(pkg, 'dist'));
  const output = join(pkg, 'dist/cli.js');
  writeFileSync(output, 'first', { mode: 0o644 });
  const baseline = packedInputs(pkg, {}, ['tree', 'tool']);
  assert.equal(packedInputs(pkg, {}, ['tree', 'tool']), baseline);
  assert.notEqual(packedInputs(pkg, {}, ['tree', 'another tool']), baseline);
  chmodSync(output, 0o755);
  assert.notEqual(packedInputs(pkg, {}, ['tree', 'tool']), baseline);
  chmodSync(output, 0o644);
  writeFileSync(output, 'other');
  assert.notEqual(packedInputs(pkg, {}, ['tree', 'tool']), baseline);
  assert.equal(packedInputs(pkg, { bundledDependencies: true }, []), null);
  symlinkSync(output, join(pkg, 'alias'));
  assert.equal(packedInputs(pkg, {}, []), null);
});
