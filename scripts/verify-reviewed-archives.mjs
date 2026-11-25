import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { measureBundles } from './verify-bundles.mjs';
import { familyInputs, previousBundleFamilies } from './manifests/bundle-parent.mjs';
import {
  adoptedBundleLimits,
  checkPackedBudgetAdoption,
  incumbentEntries,
} from './manifests/reviewed-bundle-budgets.mjs';

// The ordinary branch-push command has no external consumer. Measure the four incumbent
// aliases from its actual tarballs, including intermediate releases and maintenance changes.
// A first adoption additionally requires its reviewed exact measurement.
export async function verifyReviewedArchives(root, archives) {
  const current = familyInputs(root),
    previous = previousBundleFamilies(root);
  const newEntries = adoptedBundleLimits(previous, current);
  const fixture = mkdtempSync(join(tmpdir(), 'uld-first-packed-budget-'));
  try {
    for (const name of ['@ui-lazy-dev/ui-web', '@ui-lazy-dev/tokens']) {
      assert.ok(archives.has(name), 'Missing packed budget input: ' + name);
      const dest = join(fixture, 'node_modules', name);
      mkdirSync(dest, { recursive: true });
      execFileSync('tar', ['-xzf', archives.get(name), '--strip-components', '1', '-C', dest]);
      assert.equal(JSON.parse(readFileSync(join(dest, 'package.json'), 'utf8')).name, name);
    }
    const web = JSON.parse(
      readFileSync(join(fixture, 'node_modules/@ui-lazy-dev/ui-web/package.json'), 'utf8'),
    );
    const dependencies = { ...web.dependencies, ...web.peerDependencies };
    for (const name of Object.keys(dependencies).filter((name) => !archives.has(name))) {
      const dest = join(fixture, 'node_modules', name);
      mkdirSync(dirname(dest), { recursive: true });
      symlinkSync(join(root, 'node_modules', name), dest, 'dir');
    }
    const measurements = await measureBundles(fixture, { selectedEntries: incumbentEntries });
    checkPackedBudgetAdoption(previous, current, measurements);
    if (newEntries.length) console.log('Verified the first packed budget for ' + newEntries.join(', '));
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}
