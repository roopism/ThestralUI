import assert from 'node:assert/strict';
import { verdictInputRoot } from './verdict.mjs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const scoped = (name) => name.startsWith('@ui-lazy-dev/');
const fields = ['dependencies', 'optionalDependencies', 'peerDependencies', 'peerDependenciesMeta'];
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));

export function verifyPrivateResolutions(packages, archives) {
  const required = new Set(['@ui-lazy-dev/tokens', ...Object.keys(archives)]);
  for (const [path, entry] of Object.entries(packages)) {
    const name = path.split('node_modules/').at(-1);
    if (scoped(name) || scoped(entry.name ?? '')) {
      assert.ok(
        archives[name]?.startsWith('file:') && entry.resolved === archives[name] && !entry.link,
        'Project packages must resolve to their exact local archive: ' + path,
      );
      required.add(name);
    }
    for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies', 'devDependencies']) {
      for (const [dep, specifier] of Object.entries(entry[field] ?? {})) {
        if (scoped(dep)) required.add(dep);
        assert.ok(
          !specifier.startsWith('npm:@ui-lazy-dev/'),
          'Use the registered local archive directly: ' + dep,
        );
      }
    }
  }
  for (const name of required) {
    assert.ok(
      archives[name]?.startsWith('file:') && packages['node_modules/' + name]?.resolved === archives[name],
      'Missing local archive for ' + name,
    );
  }
}

export function installLockedConsumer(cwd, variant, inputRoot = verdictInputRoot) {
  const manifest = read(join(cwd, 'package.json'));
  const lock = read(join(inputRoot, 'tests/packaging/locks', variant + '.json'));
  assert.equal(lock.lockfileVersion, 3);
  assert.equal(lock.name, manifest.name);
  for (const field of ['dependencies', 'devDependencies'])
    assert.deepEqual(
      manifest[field] ?? {},
      lock.packages[''][field] ?? {},
      'Update the consumer lock for ' + variant,
    );
  const archives = Object.fromEntries(Object.entries(manifest.dependencies).filter(([name]) => scoped(name)));
  verifyPrivateResolutions(lock.packages, archives);
  for (const [name, spec] of Object.entries(archives)) {
    const path = resolve(cwd, spec.slice(5));
    const artifact = JSON.parse(
      execFileSync('tar', ['-xOzf', path, 'package/package.json'], { encoding: 'utf8' }),
    );
    assert.equal(artifact.name, name);
    const entry = lock.packages['node_modules/' + name];
    assert.equal(entry.version, artifact.version);
    for (const field of fields)
      assert.deepEqual(
        entry[field] ?? {},
        artifact[field] ?? {},
        'Re-record ' + variant + ' after changing ' + name + ' ' + field,
      );
    // Only the bytes of the already-verified local build vary across candidate trees.
    entry.integrity = 'sha512-' + createHash('sha512').update(readFileSync(path)).digest('base64');
  }
  writeFileSync(join(cwd, 'package-lock.json'), JSON.stringify(lock, null, 2) + '\n');
  writeFileSync(join(cwd, '.npmrc'), '@ui-lazy-dev:registry=https://registry.invalid/\n');
  execFileSync('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund', '--strict-peer-deps'], {
    cwd,
    stdio: 'inherit',
    timeout: 180_000,
  });
  verifyPrivateResolutions(read(join(cwd, 'package-lock.json')).packages, archives);
}
