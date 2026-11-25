import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installSnapshotDependencies } from '../../packages/policy/quality/snapshot-dependencies.mjs';

test('an install is reused only for matching staged inputs and keeps workspace links isolated', t => {
  const base = mkdtempSync(join(tmpdir(), 'ui-module-cache-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const cache = join(base, 'cache');
  let installs = 0;
  function snapshot(id, manifest = {}, lockVersion = 3, extra = false) {
    const root = join(base, id);
    mkdirSync(join(root, 'packages/example'), { recursive: true });
    writeFileSync(join(root, 'package.json'), JSON.stringify({ workspaces: ['packages/*'] }));
    if (extra) {
      mkdirSync(join(root, 'packages/added'));
      writeFileSync(join(root, 'packages/added/package.json'), JSON.stringify({ name: 'added' }));
    }
    writeFileSync(join(root, 'packages/example/package.json'), JSON.stringify(manifest));
    writeFileSync(join(root, 'packages/example/index.js'), id);
    writeFileSync(join(root, 'package-lock.json'), JSON.stringify({
      lockfileVersion: lockVersion, packages: { '': {}, 'packages/example': {} },
    }));
    installSnapshotDependencies(root, cache, process.env, () => {
      installs++;
      mkdirSync(join(root, 'node_modules/@ui'), { recursive: true });
      symlinkSync('../../packages/example', join(root, 'node_modules/@ui/example'));
      writeFileSync(join(root, 'node_modules/.package-lock.json'), '{}');
      writeFileSync(join(root, 'node_modules/dependency.js'), 'installed');
    });
    return root;
  }
  const first = snapshot('first');
  writeFileSync(join(first, 'node_modules/dependency.js'), 'edited');
  const second = snapshot('second');
  assert.equal(installs, 1);
  assert.equal(readFileSync(join(second, 'node_modules/@ui/example/index.js'), 'utf8'), 'second');
  assert.equal(readFileSync(join(second, 'node_modules/dependency.js'), 'utf8'), 'installed');
  writeFileSync(join(second, 'node_modules/dependency.js'), 'later edit');
  assert.equal(readFileSync(join(snapshot('third'), 'node_modules/dependency.js'), 'utf8'), 'installed');
  snapshot('new-public-entry', { exports: { './button': './dist/button.js' }, scripts: { build: 'node build.mjs' } });
  assert.equal(installs, 1, 'A public entry change must reuse the installed dependencies');
  snapshot('manifest-change', { dependencies: { added: '1.0.0' } });
  snapshot('lock-change', {}, 2);
  snapshot('unrecorded-workspace', {}, 3, true);
  assert.equal(installs, 4);
});
