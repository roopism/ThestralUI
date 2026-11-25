import { runtimeWorkspaces, selectArchives } from '../../scripts/package-workspaces.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { assertCoverage, enforceBudget, validateBom, verifyBaseline } from '../../scripts/verify-policy.mjs';

test('rejects new public entries without an assigned budget and stale entries', () => {
  assert.doesNotThrow(() => assertCoverage(['.', './dialog'], ['./dialog', '.']));
  assert.throws(() => assertCoverage(['.', './new'], ['.']), /coverage/i);
  assert.throws(() => assertCoverage(['.'], ['.', './stale']), /coverage/i);
});
test('a one-byte compressed regression beyond the ceiling fails', () => {
  assert.doesNotThrow(() => enforceBudget('button', 100, 100));
  assert.throws(() => enforceBudget('button', 101, 100), /button/);
});
test('requires approved licenses and provenance for every dependency', () => {
  const component = { name: 'test', version: '1.0.0', hashes: [{ alg: 'SHA-512', content: 'a'.repeat(128) }], licenses: [{ license: { id: 'MIT' } }] };
  assert.equal(validateBom([component]).length, 1);
  for (const changes of [{ hashes: [] }, { licenses: [] }, { version: undefined }, { licenses: [{ license: { id: 'AGPL-3.0-only' } }] }]) {
    assert.throws(() => validateBom([{ ...component, ...changes }]));
  }
});
test('verifies historical archives against immutable release digests', () => {
  assert.equal(verifyBaseline().length, 2);
  assert.throws(() => verifyBaseline(() => Buffer.from('corrupt')), /digest/i);
});

test('a packed consumer installs transitive local dependencies and only its required platform peers', () => {
  const define = (name, options = {}) => [name, { manifest: { name, version: '1.0.0', ...options } }];
  const web = '@ui-lazy-dev/ui-web', native = '@ui-lazy-dev/ui-native';
  const messages = '@ui-lazy-dev/messages', tokens = '@ui-lazy-dev/tokens';
  const packages = new Map([
    define(web, { dependencies: { [messages]: '1.0.0' }, peerDependencies: { [native]: '1.0.0' },
      peerDependenciesMeta: { [native]: { optional: true } } }),
    define(messages, { optionalDependencies: { [tokens]: '1.0.0' }, peerDependencies: { react: '^19.0.0' } }),
    define(tokens), define(native),
  ]);
  const needed = runtimeWorkspaces(packages, [web]);
  assert.deepEqual([...needed.keys()].sort(), [web, messages, tokens].sort());
  const archives = [...packages.values()].map(({ manifest }) => manifest);
  assert.deepEqual(selectArchives(archives, needed).map(pkg => pkg.name).sort(), [...needed.keys()].sort());
  assert.throws(() => selectArchives(archives.filter(pkg => pkg.name !== tokens), needed), /archive/);
  assert.throws(() => selectArchives([...archives, archives[0]], needed), /archive/);
  assert.throws(() => selectArchives(archives.map(pkg => ({ ...pkg, version: '0.9.0' })), needed), /version/);
  packages.delete(messages);
  assert.throws(() => runtimeWorkspaces(packages, [web]), /Missing candidate workspace/);
});
