import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

export async function withBrowserServers(snapshot, run) {
  const temporary = mkdtempSync(join(tmpdir(), 'uld-browser-server-'));
  const path = '/' + randomUUID();
  const cli = join(snapshot, 'node_modules/playwright/cli.js');
  // The pinned Playwright server selects each browser from the client project.
  // Its default safe launch options remain in effect.
  // Drain stdin so the CLI sees EOF when the parent finishes the test.
  const child = spawn(process.execPath, ['--import', 'data:text/javascript,process.stdin.resume()', cli, 'run-server', '--host', '127.0.0.1', '--port', '0',
    '--path', path, '--artifacts-dir', temporary], { cwd: temporary, stdio: ['pipe', 'pipe', 'inherit'] });
  const closed = new Promise(resolve => child.once('close', resolve));
  const ready = createInterface({ input: child.stdout });
  try {
    const endpoint = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Local Playwright server did not become ready')), 30000);
      const end = (fn, value) => { clearTimeout(timer); fn(value); };
      child.once('error', error => end(reject, error));
      child.once('close', code => end(reject, Error('Local Playwright server exited (' + code + ')')));
      ready.on('line', line => {
        if (line.startsWith('Listening on ')) end(resolve, line.slice('Listening on '.length).trim());
      });
    });
    const url = new URL(endpoint);
    assert.equal(url.protocol, 'ws:');
    assert.equal(url.hostname, '127.0.0.1');
    assert.equal(url.pathname, path);
    assert.ok(Number(url.port) > 0);
    return await run({ PW_TEST_CONNECT_WS_ENDPOINT: url.href, PW_TEST_CONNECT_HEADERS: '{}', PW_TEST_CONNECT_EXPOSE_NETWORK: '' });
  } finally {
    ready.close();
    // Playwright's run-server shuts down on stdin close, including after a browser has connected.
    child.stdin.end();
    const forceExit = setTimeout(() => child.kill('SIGKILL'), 5000);
    try { await closed; } finally { clearTimeout(forceExit); }
    rmSync(temporary, { recursive: true, force: true });
  }
}
