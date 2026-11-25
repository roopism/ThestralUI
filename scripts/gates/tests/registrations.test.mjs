import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { renderDepthRegistry } from '../../manifests/depth-registry.mjs';
import { requireGateIsolation } from '../landing-policy.mjs';
import { depthRegistry, derivedRegistrations } from '../registrations.mjs';
import { gateIsolation } from '../../verify-preflight.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const breadcrumb = 'manifests/families/breadcrumb.json';

// Candidate trees share the project's object store through a private index.
function trees(t) {
  const dir = mkdtempSync(join(tmpdir(), 'uld-registrations-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const env = { ...process.env, GIT_INDEX_FILE: join(dir, 'index') };
  const git = args => execFileSync('git', args, { cwd: root, env, encoding: 'utf8', maxBuffer: 128 << 20 }).trim();
  const base = git(['rev-parse', '--verify', 'HEAD^{tree}']);
  const hashAlgorithm = git(['rev-parse', '--show-object-format']);
  const blobInput = join(dir, 'blob-input');
  const read = path => git(['show', base + ':' + path]);
  const names = git(['ls-tree', '--name-only', base + ':manifests/families']).split('\n');
  const originals = new Map(names.map(name => ['manifests/families/' + name, read('manifests/families/' + name)]));
  const manifests = () => [...originals.values()].map(body => JSON.parse(body))
    .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
  const shared = JSON.parse(read('manifests/shared.json'));
  // edit receives the parsed manifests by id and returns extra raw file contents.
  function candidate(edit = () => ({})) {
    const rows = manifests();
    const byId = new Map(rows.map(row => [row.id, row]));
    const raw = edit(byId) ?? {};
    git(['read-tree', base]);
    const write = (path, content) => {
      const bytes = Buffer.from(content, 'utf8');
      writeFileSync(blobInput, bytes);
      const blob = git(['hash-object', '-w', '--no-filters', '--', blobInput]);
      const expected = createHash(hashAlgorithm).update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
      assert.equal(blob, expected, 'Git must store the exact fixture bytes for ' + path);
      git(['update-index', '--add', '--cacheinfo', '100644,' + blob + ',' + path]);
    };
    for (const row of rows) {
      const path = 'manifests/families/' + row.id.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-') + '.json';
      const content = JSON.stringify(row, null, 2) + '\n';
      if (content !== JSON.stringify(JSON.parse(originals.get(path)), null, 2) + '\n') write(path, content);
    }
    write(depthRegistry, raw[depthRegistry] ?? renderDepthRegistry(rows, shared));
    for (const [path, content] of Object.entries(raw)) if (path !== depthRegistry) write(path, content);
    const tree = git(['write-tree']);
    const paths = git(['diff-tree', '-r', '--name-only', '--no-renames', base, tree]).split('\n').filter(Boolean);
    return { tree, paths };
  }
  return { base, candidate };
}

const addBreadcrumbBindings = families => {
  const row = families.get('Breadcrumb');
  row.inventory.api.push('breadcrumb:Breadcrumbs', 'breadcrumb:useBreadcrumbs');
  row.depth.consumerTypes = {
    'breadcrumb:Breadcrumbs': {
      accept: [{ label: 'Reading location', items: [{ id: 'chapter', label: 'Chapter one' }] }],
      reject: [{ label: 'Reading location', items: ['chapter'] }],
    },
  };
};

test('a family registers its own API-depth row in one product pull request', async (t) => {
  const { base, candidate } = trees(t);
  const { tree, paths } = candidate(addBreadcrumbBindings);
  assert.deepEqual(paths.sort(), [breadcrumb, depthRegistry].sort());
  const derived = derivedRegistrations(root, base, tree, 'family/breadcrumb');
  assert.deepEqual([...derived], [depthRegistry]);
  const ctx = { root, trusted: root, base, tree, branch: 'family/breadcrumb' };
  assert.deepEqual(await gateIsolation(ctx), []);
  const wrongOwner = await gateIsolation({ ...ctx, branch: 'family/avatar' });
  assert.ok(wrongOwner.some(issue => issue.includes('is owned by family/breadcrumb')));
  assert.doesNotThrow(() => requireGateIsolation('family/breadcrumb', [...paths, 'packages/web/src/breadcrumb/trail.tsx'], undefined, derived));
  // Gate code still cannot accompany the registration.
  assert.throws(() => requireGateIsolation('family/breadcrumb', [...paths, 'scripts/gates/verdict.mjs'], undefined, derived), /gates\//);
  // Without the verified result the registry remains a gate path.
  assert.throws(() => requireGateIsolation('family/breadcrumb', paths), /gates\//);
  assert.throws(() => requireGateIsolation('family/breadcrumb', paths, undefined, new Set(['scripts/gates/verdict.mjs'])), /gates\//);
  // The gate branch route is unchanged.
  assert.doesNotThrow(() => requireGateIsolation('gates/depth', [depthRegistry]));
  assert.deepEqual([...derivedRegistrations(root, base, tree, 'gates/depth')], []);
  assert.deepEqual([...derivedRegistrations(root, base, tree, 'docs/depth')], []);
});

test('a family cannot change, remove or weaken another registration', (t) => {
  const { base, candidate } = trees(t);
  const other = candidate(addBreadcrumbBindings);
  assert.throws(() => derivedRegistrations(root, base, other.tree, 'family/badge'), /Breadcrumb is owned by family\/breadcrumb, not family\/badge/);
  const removed = candidate(families => { delete families.get('Breadcrumb').depth; });
  assert.throws(() => derivedRegistrations(root, base, removed.tree, 'family/breadcrumb'), /removed or reordered/);
  const weakened = candidate(families => { families.get('Breadcrumb').depth.expectation = 'Links'; });
  assert.throws(() => derivedRegistrations(root, base, weakened.tree, 'family/breadcrumb'), /product-registration: .*Breadcrumb\.expectation/);
  const evidence = candidate(families => { families.get('Breadcrumb').depth.evidence = {}; });
  assert.throws(() => derivedRegistrations(root, base, evidence.tree, 'family/breadcrumb'), /product-registration: .*Breadcrumb\.evidence\.browser/);
  const exportRemoved = candidate(families => { families.get('Breadcrumb').inventory.api.pop(); });
  assert.throws(() => derivedRegistrations(root, base, exportRemoved.tree, 'family/breadcrumb'), /product-registration: .*Breadcrumb\.exports/);
});

test('malformed or hand-edited registrations are rejected', (t) => {
  const { base, candidate } = trees(t);
  const unknown = candidate(families => { families.get('Breadcrumb').depth.waiver = true; });
  assert.throws(() => derivedRegistrations(root, base, unknown.tree, 'family/breadcrumb'), /product-registration: manifests\/families\/breadcrumb\.json/);
  const outside = candidate(families => {
    families.get('Breadcrumb').depth.representative = 'navigation:Missing';
    const registry = JSON.parse(execFileSync('git', ['show', 'HEAD:' + depthRegistry], { cwd: root, encoding: 'utf8' }));
    registry.families.find(row => row.id === 'Breadcrumb').representative = 'navigation:Missing';
    return { [depthRegistry]: JSON.stringify(registry, null, 2) + '\n' };
  });
  assert.throws(() => derivedRegistrations(root, base, outside.tree, 'family/breadcrumb'), /Representative is outside its family/);
  const hand = candidate(families => {
    addBreadcrumbBindings(families);
    const rows = [...families.values()].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
    const registry = JSON.parse(renderDepthRegistry(rows, { depthRevision: '2026-11-20.3' }));
    registry.families.find(row => row.id === 'Breadcrumb').oracle += ' Also any.';
    return { [depthRegistry]: JSON.stringify(registry, null, 2) + '\n' };
  });
  assert.throws(() => derivedRegistrations(root, base, hand.tree, 'family/breadcrumb'), /differs from the registry generated/);
  const revision = candidate(families => {
    addBreadcrumbBindings(families);
    const rows = [...families.values()].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
    return { [depthRegistry]: renderDepthRegistry(rows, { depthRevision: '2026-11-20.4' }) };
  });
  assert.throws(() => derivedRegistrations(root, base, revision.tree, 'family/breadcrumb'), /differs from the registry generated/);
  const incomplete = candidate(families => {
    const row = families.get('Meter');
    row.inventory.api.push('primitives:Meter');
    row.depth = { representative: 'primitives:Meter', expectation: 'Value and range', oracle: 'Announce the value.' };
  });
  assert.throws(() => derivedRegistrations(root, base, incomplete.tree, 'family/meter'), /Meter lacks evidence/);
  const complete = candidate(families => {
    const row = families.get('Meter');
    row.inventory.api.push('primitives:Meter');
    row.depth = { representative: 'primitives:Meter', expectation: 'Value and range', oracle: 'Announce the value.',
      evidence: { unit: 'tests/meter/meter.test.tsx | announces the value' } };
  });
  assert.deepEqual([...derivedRegistrations(root, base, complete.tree, 'family/meter')], [depthRegistry]);
});
