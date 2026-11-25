import { installLockedConsumer } from './gates/packed-install.mjs';
import { packageWorkspaces } from './package-workspaces.mjs';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { command, readJson, root, saveJson } from './verify-artifacts.mjs';
import { sha256, validateBom } from './verify-policy.mjs';

const output = resolve(process.argv[2] || 'release/evidence');
const { packages } = readJson(join(output, 'provenance.json'));
const cwd = mkdtempSync(join(tmpdir(), 'ui-inventory-'));
try {
  const dependencies = {
    react: '19.3.1',
    'react-dom': '19.3.1',
    'react-native': '0.88.1',
    typescript: '6.0.3',
  };
  for (const pkg of packages) {
    const archive = join(output, pkg.filename);
    assert.equal(pkg.sha256, sha256(readFileSync(archive)));
    cpSync(archive, join(cwd, pkg.filename));
    dependencies[pkg.name] = 'file:' + pkg.filename;
  }
  assert.deepEqual(
    packages.map((pkg) => pkg.name).sort(),
    [...packageWorkspaces(root).keys()].sort(),
    'Release inventory must cover all runtime packages, policy tools and migrations',
  );
  saveJson(join(cwd, 'package.json'), {
    name: 'ui-release-fixture',
    version: '1.0.0',
    private: true,
    dependencies,
  });
  installLockedConsumer(cwd, 'inventory');
  const bom = JSON.parse(command(cwd, 'npm', ['sbom', '--sbom-format=cyclonedx', '--omit=dev']));

  for (const entry of bom.components) {
    entry.externalReferences = entry.externalReferences?.filter(
      (reference) => !reference.url.startsWith('file:'),
    );
  }
  saveJson(join(output, 'release-sbom.json'), bom);
  const licenses = validateBom(bom.components);
  saveJson(join(output, 'release-licenses.json'), licenses);
  console.log(licenses.length + ' dependencies checked for ' + packages.length + ' installed archives');
} finally {
  rmSync(cwd, { recursive: true, force: true });
}
