import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { build } from 'esbuild';
import { command } from './verify-artifacts.mjs';
import { verifyServerFoundations } from './verify-server-foundations.mjs';

async function exercise(browser, url, setup) {
  const page = await browser.newPage();
  const errors = [];
  const remoteRequests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== new URL(url).origin)
      remoteRequests.push(request.resourceType());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  try {
    await setup?.(page);
    const response = await page.goto(url);
    assert.equal(response?.status(), 200);
    assert.match(await response.text(), /Enter a working title/, 'Initial HTML omitted the field');
    await page.locator('main[data-ready=true]').waitFor();
    if (!setup) {
      const styles = await page
        .getByRole('button', { name: 'Review', exact: true })
        .evaluate((node) => ({
          control: getComputedStyle(node).getPropertyValue('--uld-control').trim(),
          minHeight: getComputedStyle(node).minHeight,
        }));
      assert.match(styles.control, /^\d+(?:\.\d+)?px$/, 'Token stylesheet missing in production');
      assert.ok(parseFloat(styles.minHeight) >= 24, 'Button stylesheet missing in production');
    }
    const input = page.getByRole('textbox', { name: 'Project' });
    await input.fill('Saved on the client');
    assert.equal((await input.getAttribute('aria-describedby')) !== null, true);
    const trigger = page.getByRole('button', { name: 'Review', exact: true });
    await trigger.click();
    await page.getByRole('dialog', { name: 'Review project' }).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    assert.equal(await input.inputValue(), 'Saved on the client');
    assert.equal(await trigger.evaluate((node) => node === document.activeElement), true);
    assert.deepEqual(errors, [], 'Browser or hydration errors');
    assert.deepEqual(remoteRequests, [], 'Unexpected external asset or font request');
  } finally {
    await page.close();
  }
}

export async function verifyHydration(cwd, browser) {
  const markup = command(cwd, process.execPath, ['render.mjs']);
  const result = await build({
    absWorkingDir: cwd,
    entryPoints: ['client.mjs'],
    write: false,
    bundle: true,
    minify: true,
    platform: 'browser',
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  const html =
    '<!doctype html><div id="root">' + markup + '</div><script src="/client.js"></script>';
  await exercise(browser, 'http://fixture.test/', (page) =>
    page.route('**/*', (route) => {
      const script = route.request().url().endsWith('/client.js');
      return route.fulfill({
        contentType: script ? 'application/javascript' : 'text/html',
        body: script ? result.outputFiles[0].text : html,
      });
    }),
  );
}

export async function verifyNext(cwd, browser) {
  const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1', NODE_ENV: 'production' };
  const next = join(cwd, 'node_modules/next/dist/bin/next');
  command(cwd, process.execPath, [next, 'build'], { env, timeout: 150_000 });
  const server = spawn(process.execPath, [next, 'start', '-H', '127.0.0.1', '-p', '0'], {
    cwd,
    env,
  });
  let log = '';
  server.stdout.on('data', (chunk) => {
    log += chunk;
  });
  server.stderr.on('data', (chunk) => {
    log += chunk;
  });
  try {
    const deadline = Date.now() + 30_000;
    let url;
    while (!url && Date.now() < deadline && server.exitCode === null) {
      await sleep(100);
      url = log.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
    }
    assert.ok(url, 'Local Next server did not start: ' + log);
    await exercise(browser, url);
    await verifyServerFoundations(browser, url);
  } finally {
    if (server.exitCode === null && server.signalCode === null) {
      const exit = once(server, 'exit');
      server.kill();
      await exit;
    }
  }
}
