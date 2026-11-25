import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkFlow, pickPhone } from '../../scripts/verify-ios-simulator.mjs';
test('accepts one executed simulator flow and rejects a skipped, failed or absent flow', () => {
  const result = (child = '', status = '') =>
    '<testsuites><testsuite tests="1"><testcase name="Gallery" ' +
    status +
    '>' +
    child +
    '</testcase></testsuite></testsuites>';
  assert.equal(checkFlow(result()), 1);
  for (const report of [
    '<testsuites/>',
    result('<skipped/>'),
    result('<failure/>'),
    result('<error/>'),
    result('', 'status="skipped"'),
  ])
    assert.throws(() => checkFlow(report));
});
test('selects an available iPhone and rejects an unavailable or non-phone target', () => {
  const devices = {
    'com.apple.CoreSimulator.SimRuntime.iOS-26-3': [
      { name: 'iPhone 17', udid: 'phone', isAvailable: true, state: 'Shutdown' },
      { name: 'iPad', udid: 'tablet', isAvailable: true, state: 'Booted' },
    ],
  };
  assert.equal(pickPhone(devices).udid, 'phone');
  assert.throws(() => pickPhone(devices, 'tablet'));
});

test('a symlinked simulator runner fails closed when its candidate is missing', (t) => {
  const cwd = mkdtempSync(join(tmpdir(), 'ui-simulator-entry-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const command = join(cwd, 'check-ios.mjs');
  symlinkSync(
    fileURLToPath(new URL('../../scripts/verify-ios-simulator.mjs', import.meta.url)),
    command,
  );
  const result = spawnSync(process.execPath, [command], { cwd, encoding: 'utf8' });
  assert.notEqual(result.status, 0, 'Invoking the executable must actually qualify the candidate');
  assert.match(result.stderr, /provenance\.json|requires macOS/);
});
