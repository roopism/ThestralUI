import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ui = '@ui-lazy-dev/ui-web/dist/';
const tokens = '@ui-lazy-dev/tokens/dist/';
// Positive byte contributions only. A new default dependency or stylesheet is reviewable here.
// Empty barrels and type-only modules do not transfer bytes and need no registration.
export const defaultInputs = {
  'app.js': [
    ui + '_shared/jsx-runtime.js', ui + 'adaptive-grid/binding.js', ui + 'button/binding.js',
    ui + 'labeled-field/binding.js', ui + 'mode-provider/binding.js',
  ],
  'app.css': [ui + 'styles.css', tokens + 'styles.css', tokens + 'modes.css', tokens + 'brands/enterprise.css'],
};
const peers = /^(?:react|react-dom|scheduler)(?:\/|$)/;
const byName = rows => rows.map(row => row.name).sort();
const names = kind => kind === 'application' ? ['app.css', 'app.js'] : ['app.js'];

// Package assembly inlines numbered family CSS chunks into dist/styles.css before bundling.
// Pin the release's five real owners so opt-in CSS cannot disappear inside that aggregate.
export function verifyDefaultStyleOwners(root) {
  const directory = join(root, 'packages/web/src');
  const owners = globSync('**/*.css', { cwd: directory }).filter(path =>
    /^\/\* @uld-css-chunk styles(?:\.\d+)? \*\/$/m.test(readFileSync(join(directory, path), 'utf8')));
  assert.deepEqual(owners.sort(), ['_shared/styles/styles.css', 'adaptive-grid/styles.css', 'button/styles.css',
    'labeled-field/styles.css', 'modal-dialog/styles.css'], 'Missing default style owner or optional family CSS entered the root stylesheet');
}

function validateBuild(rows, kind, full) {
  assert.deepEqual(byName(rows), names(kind), 'Missing, duplicate, or unexpected packed asset');
  for (const asset of rows) {
    assert.ok(Number.isSafeInteger(asset.gzip) && asset.gzip > 0, 'Missing compressed asset bytes');
    assert.ok(Number.isSafeInteger(asset.raw) && asset.raw > 0 && /^[a-f0-9]{64}$/.test(asset.sha256), 'Missing packed asset digest or raw bytes');
    assert.ok(Array.isArray(asset.inputs) && asset.inputs.length && asset.inputs.length === new Set(asset.inputs).size, 'Invalid asset inputs');
    if (full && asset.name === 'app.js') {
      for (const peer of ['react', 'react-dom']) {
        assert.ok(asset.inputs.some(input => input.startsWith(peer + '/')), 'Full cold build omitted ' + peer);
      }
    }
    const libraryInputs = asset.inputs.filter(input => input !== 'consumer.tsx' && !(full && peers.test(input)));
    assert.deepEqual(libraryInputs.sort(), kind === 'application' ? [...defaultInputs[asset.name]].sort() : [],
      'Missing default dependency or optional dependency leaked into ' + asset.name);
    // The JSX entry must contribute to the actual executed JS, and never to the stylesheet.
    assert.equal(asset.inputs.includes('consumer.tsx'), asset.name === 'app.js', 'Missing or misplaced consumer entry point');
  }
  return rows.reduce((total, asset) => total + asset.gzip, 0);
}

export function verifyDefaultTransfer(report, ceiling) {
  assert.deepEqual(Object.keys(report).sort(), ['application', 'emptyHost']);
  const totals = {};
  for (const kind of ['emptyHost', 'application']) {
    const { externalPeers, full, network } = report[kind];
    totals[kind] = validateBuild(externalPeers, kind, false);
    validateBuild(full, kind, true);
    assert.deepEqual(byName(network), names(kind), 'Incomplete or duplicate actual transfers');
    for (const asset of full) {
      const transferred = network.find(row => row.name === asset.name);
      assert.equal(transferred.encoded, asset.gzip, 'Incomplete cold browser transfer');
      assert.equal(transferred.decoded, asset.raw, 'Incomplete cold browser decode');
      assert.equal(transferred.served, 1, 'Browser asset served more or less than once');
    }
  }
  assert.ok(totals.application <= ceiling, 'Packed default application ceiling exceeded: ' + totals.application + ' > ' + ceiling);
  return { total: totals.application, ceiling, headroom: ceiling - totals.application };
}
