import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { installSnapshotDependencies } from '../../../packages/policy/quality/snapshot-dependencies.mjs';

const { groups } = JSON.parse(readFileSync(new URL('../../../tests/acceptance/suite-inputs.json', import.meta.url)));

test('packed component reuse requires the installed browser fact', () => {
  assert.ok(groups['Packed component specifications'].envFacts.includes('playwright-browsers'));
});

test('a snapshot installed in production mode caches the development tools needed by the next snapshot', t => {
  const root = mkdtempSync(join(tmpdir(), 'snapshot-dev-tools-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const cold = join(root, 'cold'), warm = join(root, 'warm'), cache = join(root, 'cache');
  const env = { ...process.env, npm_config_cache: join(root, 'npm'), npm_config_offline: 'true' };
  mkdirSync(join(cold, 'package'), { recursive: true });
  writeFileSync(join(cold, 'package/package.json'), JSON.stringify({ name: 'dev-tool', version: '1.0.0' }));
  execFileSync('tar', ['-czf', 'tool.tgz', 'package'], { cwd: cold });
  writeFileSync(join(cold, 'package.json'), JSON.stringify({ devDependencies: { 'dev-tool': 'file:tool.tgz' } }));
  execFileSync('npm', ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: cold, env });
  cpSync(cold, warm, { recursive: true });
  // A production-only tree may already exist under the original lock-and-manifest key.
  const legacyKey = createHash('sha256').update(readFileSync(join(cold, 'package-lock.json')))
    .update([process.version, process.platform, process.arch].join('/'))
    .update('\0').update(readFileSync(join(cold, 'package.json'))).update('\0').digest('hex');
  const legacyModules = join(cache, legacyKey, 'node_modules');
  mkdirSync(legacyModules, { recursive: true });
  writeFileSync(join(legacyModules, '.package-lock.json'), '{}');
  installSnapshotDependencies(cold, cache, { ...env, NODE_ENV: 'production', npm_config_omit: 'dev' });
  installSnapshotDependencies(warm, cache, env, () => assert.fail('expected the cached installation'));
  assert.ok(existsSync(join(warm, 'node_modules/dev-tool/package.json')), 'warm snapshot lacks its dev dependency');
});
