import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const { buildCommand } = JSON.parse(readFileSync(new URL('vercel.json', root)));
const workspaces = ['tokens', 'ui-web', 'ui-native'];

function deployment(t, platform) {
  const dir = mkdtempSync(join(tmpdir(), 'catalog-build-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const source = join(dir, 'source');
  const bin = join(source, 'node_modules/.bin');
  mkdirSync(bin, { recursive: true });
  for (const file of ['package.json', 'scripts', 'catalog']) symlinkSync(new URL(file, root), join(source, file));
  // Run the real root build and reservation. Replace only the four expensive build tools.
  writeFileSync(join(dir, 'record.cjs'), `
    const fs = require('node:fs');
    const id = process.env.ULD_TIMING_RESERVATION;
    const owner = id && JSON.parse(fs.readFileSync(process.env.LOCK_ROOT + '/uld-locks/timing-activities/' + id));
    fs.appendFileSync(process.env.BUILD_LOG, JSON.stringify({ command: process.argv.slice(2).join(' '), owner }) + '\\n');
  `);
  const record = 'exec node "$RECORDER" "$@"';
  writeFileSync(join(bin, 'npm'), '#!/bin/sh\nif [ "$*" = "run build" ]; then exec "$REAL_NPM" "$@"; fi\n' + record, { mode: 0o755 });
  writeFileSync(join(bin, 'storybook'), '#!/bin/sh\n' + record, { mode: 0o755 });
  writeFileSync(join(bin, 'uname'), '#!/bin/sh\necho ' + platform + '\n', { mode: 0o755 });
  const env = { ...process.env, PATH: bin + ':' + process.env.PATH, BUILD_LOG: join(dir, 'steps'),
    RECORDER: join(dir, 'record.cjs'), REAL_NPM: execFileSync('sh', ['-c', 'command -v npm'], { encoding: 'utf8' }).trim(),
    GIT_CEILING_DIRECTORIES: dir, VERCEL: '1' };
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'ULD_ARTIFACT_COMMON', 'ULD_TIMING_RESERVATION'])
    delete env[key];
  return { dir, source, env, run: () => spawnSync('sh', ['-ec', buildCommand], { cwd: source, env, encoding: 'utf8' }) };
}

for (const layout of ['checkout', 'source export']) {
  test('local catalog ' + layout + ' holds one active reservation across all four build steps', t => {
    const { dir, source, env, run } = deployment(t, 'Darwin');
    const checkout = layout === 'checkout' ? source : join(dir, 'checkout');
    execFileSync('git', ['init', '--quiet', '--template=', checkout]);
    env.LOCK_ROOT = join(checkout, '.git');
    if (layout === 'source export') env.ULD_ARTIFACT_COMMON = env.LOCK_ROOT;
    const result = run();
    assert.equal(result.status, 0, result.stderr);
    const steps = readFileSync(env.BUILD_LOG, 'utf8').trim().split('\n').map(line => JSON.parse(line));
    assert.ok(steps[0].owner, 'first package build started without a timing reservation');
    assert.deepEqual(steps.map(step => step.command), [...workspaces.map(name => 'run build -w @ui-lazy-dev/' + name),
      'build -o dist/catalog --disable-telemetry']);
    for (const { owner } of steps) {
      assert.equal(owner.id, steps[0].owner.id);
      assert.equal(owner.mode, 'activity');
      assert.equal(owner.state, 'active');
    }
  });
}

test('a local source export without a reservation root stops before building', t => {
  const { env, run } = deployment(t, 'Darwin');
  const result = run();
  assert.notEqual(result.status, 0, 'local export built without a shared reservation root');
  assert.equal(existsSync(env.BUILD_LOG), false);
});

test('a hosted source export builds the packages and catalog without Git metadata', t => {
  const { env, run } = deployment(t, 'Linux');
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readFileSync(env.BUILD_LOG, 'utf8').trim().split('\n').map(line => JSON.parse(line).command),
    [...workspaces.map(name => 'run build -w @ui-lazy-dev/' + name),
      'exec --offline -- storybook build -o dist/catalog --disable-telemetry']);
});

test('a local source export cannot borrow an unrelated enclosing checkout', t => {
  const { dir, env, run } = deployment(t, 'Darwin');
  execFileSync('git', ['init', '--quiet', '--template=', dir]);
  delete env.GIT_CEILING_DIRECTORIES;
  env.LOCK_ROOT = join(dir, '.git');
  const result = run();
  assert.notEqual(result.status, 0, 'local export used the enclosing checkout instead of its shared root');
  assert.equal(existsSync(env.BUILD_LOG), false);
});
