import assert from 'node:assert/strict';
import { stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { preview } from 'vite';

// Run the identical foreground work on each compiled catalog. Only the diagnostic
// uses this shorter sample. The original absolute-budget suite keeps its full counts.
export async function sampleCatalog(root, output) {
  const server = await preview({ configFile: false, root: dirname(root), build: { outDir: root }, preview: { host: '127.0.0.1', port: 0 } });
  let browser, deadline;
  const data = { openMs: [], typingMs: [], scrollTwoFramesMs: [], motionFrameMs: [] };
  const viewport = { width: 390, height: 850 };
  const url = id => new URL('/iframe.html?id=' + id + '&viewMode=story', server.resolvedUrls.local[0]).href;
  try {
    browser = await chromium.launch();
    data.browser = browser.version();
    deadline = setTimeout(() => { void browser.close().catch(() => {}); }, 55_000);
    const page = await browser.newPage({ viewport, reducedMotion: 'no-preference' });
    await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const flush = () => writeFile(output, JSON.stringify(data) + '\n');
    await page.goto(url('enterprise-workspace--review'));
    const launcher = page.getByRole('button', { name: 'Find command' });
    const input = page.getByRole('combobox', { name: 'Search commands' });
    await launcher.click(); await input.fill('review'); await input.press('Escape');
    await browser.startTracing(page);
    for (let i = 0; i < 12; i++) {
      data.openMs.push(await launcher.evaluate(async element => {
        const start = performance.now();
        element.click(); await new Promise(requestAnimationFrame);
        if (!document.querySelector('dialog[open] [role="combobox"]')) throw Error('Dialog missed its opening frame');
        return performance.now() - start;
      }));
      await input.focus();
      await page.evaluate(() => {
        window.pairedInputFrame = new Promise(resolve => document.addEventListener('input', () => {
          const start = performance.now();
          requestAnimationFrame(() => resolve(performance.now() - start));
        }, { once: true, capture: true }));
      });
      const query = i % 2 ? 'rev' : 'last';
      await page.keyboard.insertText(query);
      data.typingMs.push(await page.evaluate(() => window.pairedInputFrame));
      assert.equal(await input.inputValue(), query);
      await input.press('Escape');
      assert.equal(await page.locator('dialog[open]').count(), 0);
      await flush();
    }
    await browser.stopTracing();
    await page.goto(url('enterprise-collections--virtual'));
    const grid = page.getByRole('grid', {name:'Activity log'});
    await grid.getByRole('rowheader', {name:'Event 1',exact:true}).waitFor();
    data.scrollTwoFramesMs = await grid.evaluate(async element => {
      const values = [];
      for (let i = 1; i <= 20; i++) {
        const start = performance.now();
        element.scrollTop = (element.scrollHeight - element.clientHeight) * i / 20;
        await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
        values.push(performance.now() - start);
      }
      return values;
    });
    await grid.getByRole('rowheader', {name:'Event 5000',exact:true}).waitFor(); await flush();
    const motion = await browser.newContext({
      viewport, reducedMotion: 'no-preference', recordVideo: { dir: dirname(output), size: viewport },
    });
    const showcase = await motion.newPage();
    await (await motion.newCDPSession(showcase)).send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await showcase.goto(url('patterns-publicationlibrary--editorial'));
    await showcase.getByRole('button', {name:'Next title'}).click();
    data.motionFrameMs = await showcase.getByRole('button', {name:'Read details'}).evaluate(async button => {
      const values = [];
      let previous = await new Promise(requestAnimationFrame);
      for (let i = 0; i < 40; i++) {
        if (i % 10 === 0) button.click();
        const current = await new Promise(requestAnimationFrame);
        values.push(current - previous); previous = current;
      }
      if (button.getAttribute('aria-expanded') !== 'false') throw Error('Disclosure did not return to its initial state');
      return values;
    });
    await flush();
    const video = showcase.video();
    await motion.close();
    const file = await video.path();
    const { size } = await stat(file);
    assert.ok(size > 0, 'The paired motion recording is empty');
    data.motionVideoBytes = size;
    await video.delete();
    await flush();
  } finally {
    clearTimeout(deadline);
    await browser?.close(); await server.close();
  }
}

if (import.meta.main) await sampleCatalog(resolve(process.argv[2]), resolve(process.argv[3]));
