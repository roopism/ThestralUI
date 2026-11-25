import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

test('the package-manager bin symlink executes the gate and cannot pass an invalid profile', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ui-style-bin-'));
  try {
    const bin = join(dir, 'ui-style-policy');
    symlinkSync(fileURLToPath(new URL('../cli.mjs', import.meta.url)), bin);
    const result = spawnSync(process.execPath, [bin, '--profile', 'unknown'], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Use --profile/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
