import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { prepareGuest } from '../linux-prepare.mjs';

test('a warm guest restores pristine package bytes and removes surplus files before browser checks', t => {
  const home = mkdtempSync(join(tmpdir(), 'uld-guest-deps-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const root = join(home, 'guest'), cache = join(home, 'host-cache');
  mkdirSync(root);
  mkdirSync(join(root, '.git'));
  writeFileSync(join(root, 'package.json'), '{"name":"calendar","version":"1.0.0"}');
  writeFileSync(join(root, 'package-lock.json'), '{"lockfileVersion":3,"packages":{"":{"name":"calendar"}}}');
  let installs = 0;
  const file = 'node_modules/almanac/season.txt';
  const operations = {
    installDependencies(stage = root) {
      installs++;
      mkdirSync(join(stage, 'node_modules/almanac'), { recursive: true });
      writeFileSync(join(stage, file), 'winter');
      writeFileSync(join(stage, 'node_modules/.package-lock.json'), '{"packages":{"node_modules/almanac":{}}}');
    },
    playwrightVersion() {
      assert.equal(readFileSync(join(root, file), 'utf8'), 'winter');
      assert.equal(existsSync(join(root, 'node_modules/unregistered.txt')), false);
      return '1.0';
    },
    browsersPresent: () => true,
    installBrowsers() {},
  };
  const cold = prepareGuest(root, operations, cache);
  writeFileSync(join(root, file), 'spring');
  writeFileSync(join(root, 'node_modules/unregistered.txt'), 'extra');
  const warm = prepareGuest(root, operations, cache);
  assert.equal(warm.dependencies, 'reused');
  assert.equal(installs, 1);
  assert.equal(warm.archiveSha256, cold.archiveSha256);
  assert.match(warm.archiveSha256, /^[a-f0-9]{64}$/);
  assert.equal(existsSync(join(root, '.git/uld-browser-install.json')), false);
  appendFileSync(join(cache, warm.installationKey, 'node_modules.tgz'), 'changed local fixture');
  assert.throws(() => prepareGuest(root, operations, cache), /archive digest differs/);
  assert.equal(readFileSync(join(root, file), 'utf8'), 'winter');
});

test('the Mac dependency cache requires a guest with no shared directories or filesystem devices', async () => {
  const { requireGuestCacheIsolation } = await import('../linux-vm.mjs');
  requireGuestCacheIsolation([], ['ext4', 'proc'], ['0x0001']);
  assert.throws(() => requireGuestCacheIsolation(['fixture'], ['ext4'], ['0x0001']), /UTM shared directories/);
  assert.throws(() => requireGuestCacheIsolation([], ['virtiofs'], ['0x0001']), /filesystem share/);
  for (const id of ['0x0009', '0x001a'])
    assert.throws(() => requireGuestCacheIsolation([], ['ext4'], [id]), /sharing device/);
});

test('a cold guest archive retains npm workspace executables with lifecycle scripts disabled', t => {
  const home = mkdtempSync(join(tmpdir(), 'uld-guest-workspace-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const root = join(home, 'guest'), workspace = join(root, 'packages/calendar'), cache = join(home, 'cache');
  mkdirSync(workspace, { recursive: true });
  writeFileSync(join(root, '.npmrc'), 'offline=true\n');
  writeFileSync(join(root, 'package.json'), JSON.stringify({
    name: 'fixture-root', version: '1.0.0', private: true, workspaces: ['packages/*'],
  }));
  writeFileSync(join(workspace, 'package.json'), JSON.stringify({
    name: 'fixture-calendar', version: '1.0.0', bin: { season: './cli.cjs' },
    scripts: { postinstall: 'node -e "process.exit(31)"' },
  }));
  writeFileSync(join(workspace, 'cli.cjs'), '#!/usr/bin/env node\n', { mode: 0o755 });
  execFileSync('npm', ['install', '--package-lock-only', '--offline', '--ignore-scripts', '--no-fund', '--no-audit'], { cwd: root });
  const operations = { playwrightVersion: () => '1.0', browsersPresent: () => true, installBrowsers() {} };
  const result = prepareGuest(root, operations, cache);
  assert.equal(result.dependencies, 'installed');
  assert.equal(realpathSync(join(root, 'node_modules/.bin/season')), realpathSync(join(workspace, 'cli.cjs')));
});
