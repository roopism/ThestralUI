import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('the offline Maestro control rejects a parser that accepts the broken fixture', t => {
  const dir = mkdtempSync(join(tmpdir(), 'uld-parser-control-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const fake = join(dir, 'accept-all');
  writeFileSync(fake, '#!/bin/sh\nexit 0\n', { mode: 0o700 });
  const check = spawnSync(process.execPath, ['scripts/gates/maestro-canary.mjs', '--offline'], {
    cwd: new URL('../../../', import.meta.url), encoding: 'utf8',
    env: { ...process.env, MAESTRO_BIN: fake },
  });
  assert.equal(check.status, 1, check.stdout + check.stderr);
  assert.match(check.stderr, /Maestro parser accepted the invalid command/);
});
