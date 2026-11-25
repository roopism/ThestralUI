import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compareDeclarations } from '../../scripts/check-api.mjs';

test('accepts additive exports and rejects a removed export or a newly required prop', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ui-api-'));
  const baseline = join(dir, 'baseline.d.ts');
  const next = join(dir, 'next.d.ts');
  try {
    writeFileSync(baseline, 'export declare function Button(props: { label: string }): void;');
    for (const [api, compatible] of [
      ['export declare function Button(props: { label: string; busy?: boolean }): void; export declare const Link: string;', true],
      ['export declare const Link: string;', false],
      ['export declare function Button(props: { label: string; busy: boolean }): void;', false],
    ]) {
      writeFileSync(next, api);
      assert.equal(compareDeclarations(baseline, next).length === 0, compatible);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
