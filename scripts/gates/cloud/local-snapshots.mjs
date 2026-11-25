import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { finished } from 'node:stream/promises';
import { withRevisionSnapshot } from '../../../packages/policy/quality/staged-tree.mjs';
import { installSnapshotDependencies } from '../../../packages/policy/quality/snapshot-dependencies.mjs';

export async function collectPhysicalEvidence(root, common, proposal) {
  const directory = join(common, 'uld-delivery/cloud-local', proposal.base + '-' + proposal.merge);
  mkdirSync(join(common, 'uld-delivery/cloud-local'), { recursive: true, mode: 0o700 });
  // An existing attempt is evidence, including an interrupted attempt.
  mkdirSync(directory, { mode: 0o700 });
  const cache = join(common, 'uld-dependencies');
  return withRevisionSnapshot(root, proposal.base, (trusted, _, baseEnv) =>
    withRevisionSnapshot(root, proposal.merge, async (candidate, tree, env) => {
      assert.equal(tree, proposal.tree);
      installSnapshotDependencies(trusted, cache, baseEnv);
      installSnapshotDependencies(candidate, cache, env);
      const log = createWriteStream(join(directory, 'local.log'), { flags: 'wx', mode: 0o600 });
      const child = spawn(process.execPath, [join(trusted, 'scripts/gates/cloud/local-physical.mjs'),
        root, proposal.base, proposal.merge, tree, directory], { cwd: candidate, env: {
        ...env, ULD_ARTIFACT_COMMON: common, ULD_CLOUD_LOCAL: '1',
      }, stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout.pipe(log, { end: false });
      child.stderr.pipe(log, { end: false });
      try {
        const status = await new Promise((resolve, reject) => {
          child.once('error', reject);
          child.once('close', (code, signal) => resolve(signal ?? code));
        });
        assert.equal(status, 0, 'See ' + join(directory, 'local.log'));
        return readFileSync(join(directory, 'local.json'));
      } finally { log.end(); await finished(log); }
    }));
}
