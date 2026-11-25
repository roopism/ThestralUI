import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { inspectArchive } from '../../packages/policy/quality/integrity.mjs';

test('scans generated package members for private fixture data before release', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'ui-fixture-privacy-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const files = join(root, 'package');
  mkdirSync(files);
  const archive = join(root, 'candidate.tgz');
  const inspect = () => {
    execFileSync('tar', ['-czf', archive, 'package'], { cwd: root });
    return inspectArchive(archive);
  };
  writeFileSync(join(files, 'sample.txt'), 'Sample Project');
  assert.deepEqual(inspect(), []);
  writeFileSync(join(files, 'sample.txt'), 'ghp_' + 'A'.repeat(40));
  assert.match(inspect().join('\n'), /sample\.txt.*suspected credential/);
  writeFileSync(join(files, '.env'), '');
  assert.match(inspect().join('\n'), /\.env.*private configuration/);
});
