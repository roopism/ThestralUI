import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { cpus, arch, release } from 'node:os';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { preview } from 'vite';
import { budgetFailures } from './quality-perf-policy.mjs';

const dir = resolve('test-results/ui-runtime');
await mkdir(dir, { recursive: true });
const server = await preview({
  build: { outDir: resolve(process.argv[2] || 'dist/catalog') },
  preview: { host: '127.0.0.1', port: 0 },
});
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 390, height: 850 },
    reducedMotion: 'no-preference',
  });
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.addInitScript(() => {
    let id = 0;
    const renderers = new Map();
    window.__qualityCommits = 0;
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      renderers,
      supportsFiber: true,
      inject(renderer) {
        renderers.set(++id, renderer);
        return id;
      },
      onCommitFiberRoot() {
        window.__qualityCommits++;
      },
      onCommitFiberUnmount() {},
      onPostCommitFiberRoot() {},
      checkDCE() {},
    };
  });
  const go = (id) =>
    page.goto(
      new URL('/iframe.html?id=' + id + '&viewMode=story', server.resolvedUrls.local[0]).href,
    );
  const p95 = (values) =>
    Number([...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1].toFixed(2));
  await go('enterprise-workspace--review');
  const invoker = page.getByRole('button', { name: 'Find command' });
  await invoker.waitFor();
  const input = page.getByRole('combobox', { name: 'Search commands' });
  // Warm the component, font and event handlers before collecting a retained-heap sample.
  await invoker.click();
  await input.fill('review');
  await input.press('Escape');
  const sampleHeap = async () => {
    await client.send('HeapProfiler.collectGarbage');
    return (await client.send('Runtime.getHeapUsage')).usedSize;
  };
  const before = await sampleHeap();
  const opening = [],
    typing = [];
  let maxTypeCommits = 0;
  await browser.startTracing(page, { path: resolve(dir, 'interactions.trace.json') });
  for (let i = 0; i < 24; i++) {
    const openMs = await invoker.evaluate(async (el) => {
      const t = performance.now();
      el.click();
      await new Promise(requestAnimationFrame);
      if (!document.querySelector('dialog[open] [role="combobox"]'))
        throw new Error('Dialog missed the next frame.');
      return performance.now() - t;
    });
    opening.push(openMs);
    await input.focus();
    await page.evaluate(() => {
      window.__qualityBefore = window.__qualityCommits;
      window.__qualityPaint = new Promise((resolve) =>
        document.addEventListener(
          'input',
          () => {
            const start = performance.now();
            requestAnimationFrame(() => resolve(performance.now() - start));
          },
          { once: true, capture: true },
        ),
      );
    });
    await page.keyboard.insertText(i % 2 ? 'rev' : 'last');
    const sample = await page.evaluate(async () => ({
      ms: await window.__qualityPaint,
      commits: window.__qualityCommits - window.__qualityBefore,
    }));
    typing.push(sample.ms);
    maxTypeCommits = Math.max(maxTypeCommits, sample.commits);
    await input.press('Escape');
    assert.equal(await page.locator('dialog[open]').count(), 0);
  }
  assert.ok(maxTypeCommits > 0, 'React commits were not observed.');
  const heapGrowthKiB = Math.max(0, Math.round(((await sampleHeap()) - before) / 1024));
  await browser.stopTracing();
  await go('enterprise-collections--virtual');
  const grid = page.getByRole('grid', { name: 'Activity log' });
  await grid.getByRole('rowheader', { name: 'Event 1', exact: true }).waitFor();
  const scroll = await grid.evaluate(async (el) => {
    const timings = [];
    let peak = 0;
    for (let i = 1; i <= 40; i++) {
      const t = performance.now();
      el.scrollTop = ((el.scrollHeight - el.clientHeight) * i) / 40;
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      timings.push(performance.now() - t);
      peak = Math.max(peak, el.querySelectorAll('[role="row"]').length);
    }
    return { timings, peak };
  });
  await grid.getByRole('rowheader', { name: 'Event 5000', exact: true }).waitFor();
  assert.ok(scroll.peak > 0, 'The row count must measure mounted records.');
  const metrics = {
    openP95Ms: p95(opening),
    typingP95Ms: p95(typing),
    typingMaxCommits: maxTypeCommits,
    scrollTwoFramesP95Ms: p95(scroll.timings),
    peakRows: scroll.peak,
    heapGrowthKiB,
  };
  const motionContext = await browser.newContext({
    viewport: { width: 390, height: 850 },
    reducedMotion: 'no-preference',
    recordVideo: { dir, size: { width: 390, height: 850 } },
  });
  const showcase = await motionContext.newPage();
  const motionClient = await motionContext.newCDPSession(showcase);
  await motionClient.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await showcase.goto(
    new URL(
      '/iframe.html?id=patterns-publicationlibrary--editorial&viewMode=story',
      server.resolvedUrls.local[0],
    ).href,
  );
  const next = showcase.getByRole('button', { name: 'Next title' });
  await next.click();
  const intervals = await showcase
    .getByRole('button', { name: 'Read details' })
    .evaluate(async (button) => {
      let last = await new Promise(requestAnimationFrame);
      const frames = [];
      for (let i = 0; i < 100; i++) {
        if (i % 10 === 0) button.click();
        const timestamp = await new Promise(requestAnimationFrame);
        frames.push(timestamp - last);
        last = timestamp;
      }
      if (button.getAttribute('aria-expanded') !== 'false')
        throw new Error('Interrupted disclosure changed the final semantic state.');
      return frames;
    });
  metrics.motionFrameP95Ms = p95(intervals);
  await showcase.getByRole('button', { name: 'Reading list (0)' }).click();
  await showcase.getByRole('button', { name: 'Close list' }).press('Escape');
  assert.equal(await showcase.getByRole('dialog').count(), 0);
  const video = showcase.video();
  await motionContext.close();
  await video.saveAs(resolve(dir, 'editorial-motion.webm'));
  await video.delete();
  const system = {
    processor: cpus()[0]?.model,
    platform: process.platform,
    os: release(),
    arch: arch(),
    browser: browser.version(),
    throttle: 4,
    dataset: 5000,
    mountCycles: 24,
    scrollSamples: 40,
  };
  await writeFile(
    resolve(dir, 'summary.json'),
    JSON.stringify({ system, metrics }, null, 2) + '\n',
  );
  console.log(JSON.stringify({ system, metrics }));
  const policy = JSON.parse(
    await readFile(new URL('./quality-perf-baseline.json', import.meta.url), 'utf8'),
  );
  const errors = budgetFailures(metrics, policy.budgets);
  if (errors.length) {
    try {
      const { frameDiagnostics } = await import('../../scripts/performance/frame-cadence.mjs');
      const diagnostic = await frameDiagnostics(browser, {
        openMs: opening, typingMs: typing, scrollTwoFramesMs: scroll.timings, motionFrameMs: intervals,
      });
      const { pairedHostedFrames } = await import('../../scripts/performance/paired-frame.mjs');
      try { diagnostic.sameHostComparison = await pairedHostedFrames(process.argv[2] || 'dist/catalog'); }
      catch (error) { diagnostic.sameHostComparison = { unavailable: error.message }; }
      await writeFile(resolve(dir, 'frame-diagnostics.json'), JSON.stringify(diagnostic) + '\n');
      console.log('FRAME_DIAGNOSTICS ' + JSON.stringify(diagnostic));
    } catch (error) {
      console.warn('Frame diagnostics unavailable:', error.message);
    }
    throw new Error(errors.join('\n'));
  }
} finally {
  await browser?.close();
  await server.close();
}
