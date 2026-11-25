import { installLockedConsumer } from './gates/packed-install.mjs';
import { packageWorkspaces, runtimeWorkspaces, selectArchives } from './package-workspaces.mjs';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { command, root, readJson, saveJson } from './verify-artifacts.mjs';
import { sha256 } from './verify-policy.mjs';

const output = resolve(process.argv[2] || 'release/evidence');
const { packages } = readJson(join(output, 'provenance.json'));
const selected = runtimeWorkspaces(packageWorkspaces(root), ['@ui-lazy-dev/ui-native']);
const archives = selectArchives(packages, selected);
const results = [];
for (const [react, native] of [
  ['19.3.0', '0.88.0'],
  ['19.3.1', '0.88.1'],
]) {
  const cwd = mkdtempSync(join(tmpdir(), 'ui-native-'));
  try {
    cpSync(join(root, 'tests/packaging/native'), cwd, { recursive: true });
    const dependencies = { react, 'react-native': native };
    for (const pkg of archives) {
      const tarball = join(output, pkg.filename);
      assert.equal(sha256(readFileSync(tarball)), pkg.sha256);
      cpSync(tarball, join(cwd, pkg.filename));
      dependencies[pkg.name] = 'file:' + pkg.filename;
    }
    saveJson(join(cwd, 'package.json'), {
      name: 'ui-native-probe',
      private: true,
      version: '1.0.0',
      dependencies,
      devDependencies: {
        '@react-native/metro-config': native,
        '@react-native/babel-preset': native,
      },
    });
    installLockedConsumer(cwd, native === '0.88.0' ? 'native-min' : 'native-max');
    for (const name of Object.keys(dependencies)) {
      assert.equal(
        realpathSync(join(cwd, 'node_modules', name)),
        join(realpathSync(cwd), 'node_modules', name),
      );
    }
    command(cwd, process.execPath, ['build.cjs'], { timeout: 180_000 });
    results.push({ react, native, bundles: readJson(join(cwd, 'results.json')) });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}
saveJson(join(output, 'native-consumers.json'), results);
console.log(JSON.stringify(results, null, 2));
