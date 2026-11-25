import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { withBrowserServers } from '../reuse/browser-run.mjs';

test('the local browser server receives EOF after a passing or failing check', async t => {
  const root = mkdtempSync(join(tmpdir(), 'uld-browser-shutdown-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const moduleDir = join(root, 'node_modules', 'playwright');
  mkdirSync(moduleDir, { recursive: true });
  const marker = join(moduleDir, 'exits');
  // Model the pinned CLI's stdin close handler without starting a browser in the hook.
  writeFileSync(join(moduleDir, 'cli.js'), `
    const { appendFileSync } = require('node:fs');
    const timer = setInterval(() => {}, 1000);
    const path = process.argv[process.argv.indexOf('--path') + 1];
    process.stdin.once('close', () => {
      appendFileSync(${JSON.stringify(marker)}, 'closed\\n');
      clearInterval(timer);
    });
    console.log('Listening on ws://127.0.0.1:1' + path);
  `);
  await withBrowserServers(root, () => {});
  const failure = Error('controlled test failure');
  await assert.rejects(withBrowserServers(root, () => { throw failure; }), error => error === failure);
  assert.equal(readFileSync(marker, 'utf8'), 'closed\nclosed\n');
});
