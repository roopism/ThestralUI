import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const scope = '@ui-lazy-dev/';

export function packageWorkspaces(root) {
  const packages = new Map();
  const entries = readdirSync(join(root, 'packages'), { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    if (!entry.isDirectory()) continue;
    const directory = join(root, 'packages', entry.name);
    const path = join(directory, 'package.json');
    if (!existsSync(path)) continue;
    const manifest = JSON.parse(readFileSync(path, 'utf8'));
    assert.ok(manifest.name?.startsWith(scope), 'Unexpected workspace package in ' + directory);
    assert.ok(!packages.has(manifest.name), 'Duplicate workspace name ' + manifest.name);
    packages.set(manifest.name, { directory, manifest });
  }
  return packages;
}

// Install each local runtime dependency from this candidate archive set.
export function runtimeWorkspaces(packages, names) {
  const selected = new Map();
  function visit(name) {
    if (selected.has(name)) return;
    const pkg = packages.get(name);
    assert.ok(pkg, 'Missing candidate workspace ' + name);
    selected.set(name, pkg);
    const { dependencies, optionalDependencies, peerDependencies, peerDependenciesMeta } = pkg.manifest;
    for (const dependency of Object.keys({ ...dependencies, ...optionalDependencies }))
      if (dependency.startsWith(scope)) visit(dependency);
    for (const peer of Object.keys(peerDependencies ?? {}))
      if (peer.startsWith(scope) && !peerDependenciesMeta?.[peer]?.optional) visit(peer);
  }
  for (const name of names) visit(name);
  return selected;
}

export function selectArchives(records, packages) {
  return Array.from(packages.keys(), name => {
    const matches = records.filter(item => item.name === name);
    assert.equal(matches.length, 1, 'Expected one candidate archive for ' + name);
    assert.equal(matches[0].version, packages.get(name).manifest.version, 'Wrong candidate version for ' + name);
    return matches[0];
  });
}
