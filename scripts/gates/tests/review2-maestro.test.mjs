import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('the offline Maestro control rejects a parser that accepts the broken fixture', t => {
  const dir = mkdtempSync(join(tmpdir(), 'uld-parser-control-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const fake = join(dir, 'accept-all');
  writeFileSync(fake, '#!/bin/sh\nexit 0\n', { mode: 0o700 });
  const check = spawnSync(process.execPath, ['scripts/gates/maestro-canary.mjs', '--offline'], {
    cwd: new URL('../../../', import.meta.url), encoding: 'utf8',
    env: { ...process.env, MAESTRO_BIN: fake },
  });
  assert.equal(check.status, 1, check.stdout + check.stderr);
  assert.match(check.stderr, /Maestro parser accepted the invalid command/);
});

test('the session compiler loads the Java bridge beside its trusted launcher', t => {
  const dir = mkdtempSync(join(tmpdir(), 'uld-bridge-location-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'maestro'), '');
  writeFileSync(join(dir, 'javac'), '#!/bin/sh\nfor arg do last=$arg; done\nprintf %s "$last" > source.txt\nexit 3\n', { mode: 0o700 });
  const module = new URL('../../../tests/simulator/maestro-session.mjs', import.meta.url);
  const script = 'import {withMaestroSession} from ' + JSON.stringify(module.href) +
    ';withMaestroSession({maestro:"./maestro",reports:".",env:process.env})';
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script],
    { cwd: dir, env: { ...process.env, PATH: dir + ':' + process.env.PATH } });
  assert.notEqual(result.status, 0);
  assert.equal(readFileSync(join(dir, 'source.txt'), 'utf8'), fileURLToPath(new URL('MaestroSession.java', module)));
});

test('retention copies raw XCTest elements alongside each session request and reply', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'uld-raw-evidence-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const report = join(dir, 'report'), retained = join(dir, 'retained');
  const step = 'maestro-session-test/2';
  mkdirSync(join(report, step), { recursive: true });
  for (const file of ['request.json', 'reply.json', 'elements.json'])
    writeFileSync(join(report, step, file), JSON.stringify({ file }));
  const { retainDeviceEvidence } = await import('../device-evidence.mjs');
  retainDeviceEvidence(report, retained);
  for (const file of ['request.json', 'reply.json', 'elements.json'])
    assert.deepEqual(readFileSync(join(retained, step, file)), readFileSync(join(report, step, file)));
});
