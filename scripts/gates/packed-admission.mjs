import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installSnapshotDependencies } from '../../packages/policy/quality/snapshot-dependencies.mjs';
import { withRevisionSnapshot } from '../../packages/policy/quality/staged-tree.mjs';
import { packageWorkspaces } from '../package-workspaces.mjs';
import { buildPackedImport } from '../verify-bundles.mjs';
import { packedEntrySize } from './family-styles.mjs';
import { withTimingReservation } from '../workers/timing-reservation.mjs';
import { installLockedConsumer } from './packed-install.mjs';
import { requireTypedControls, trustedRoot } from './typed-tools.mjs';

export async function measureAdmission(root, parent, tree, rows) {
  const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: root, encoding: 'utf8' }).trim();
  const resources = process.env.ULD_ARTIFACT_COMMON || common;
  return withTimingReservation(resources, 'activity', 'Measure packed family imports', childEnv => {
    requireTypedControls(root, parent, tree);
    return withRevisionSnapshot(root, tree, async (snapshot, _tree, env) => {
      installSnapshotDependencies(snapshot, join(common, 'uld-dependencies'), env);
      execFileSync(process.execPath, [join(trustedRoot, 'scripts/gates/typed-tools.mjs')], { cwd: snapshot, env, stdio: 'inherit' });
      const scratch = mkdtempSync(join(tmpdir(), 'uld-admission-'));
      try {
        const archives = join(scratch, 'candidate'), app = join(scratch, 'app');
        mkdirSync(archives);
        mkdirSync(app);
        const lock = JSON.parse(readFileSync(join(snapshot, 'tests/packaging/locks/web-max.json'), 'utf8'));
        const { name, version, dependencies } = lock.packages[''];
        const packages = packageWorkspaces(snapshot);
        const specs = { ...dependencies };
        for (const pkg of Object.keys(specs).filter(pkg => pkg.startsWith('@ui-lazy-dev/'))) {
          const { directory } = packages.get(pkg);
          const [archive] = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', archives],
            { cwd: directory, encoding: 'utf8', env }));
          specs[pkg] = 'file:../candidate/' + archive.filename;
        }
        writeFileSync(join(app, 'package.json'), JSON.stringify({ name, version, private: true, dependencies: specs }));
        installLockedConsumer(app, 'web-max', snapshot);
        const measurements = [];
        for (const { label, pkg, entry, symbol } of rows) {
          assert.ok(specs[pkg]?.startsWith('file:../candidate/'), 'Missing packed workspace for ' + pkg);
          const name = label.split('#')[0];
          const result = await buildPackedImport(app, name, entry, symbol);
          assert.equal(result.outputFiles.length, 1, 'Additional assets require a budget: ' + name);
          measurements.push(packedEntrySize(label, result.outputFiles[0]));
        }
        return measurements;
      } finally {
        rmSync(scratch, { recursive: true, force: true });
      }
    }, childEnv);
  }, { activityOnly: true });
}

if (import.meta.main) {
  const [root, parent, tree, rows] = process.argv.slice(2);
  const measurements = await measureAdmission(root, parent, tree, JSON.parse(rows));
  writeFileSync(3, JSON.stringify(measurements));
}
