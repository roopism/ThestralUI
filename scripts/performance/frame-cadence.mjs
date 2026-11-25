import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Sample outside the qualification interval. A diagnostic failure must preserve the gate failure.
async function displayCadence() {
  if (process.platform !== 'darwin') return { available: false, platform: process.platform };
  const directory = await mkdtemp(join(tmpdir(), 'ui-display-cadence-'));
  try {
    const executable = join(directory, 'display');
    const source = fileURLToPath(new URL('./display-cadence.c', import.meta.url));
    execFileSync('clang', ['-Wno-deprecated-declarations', source, '-framework', 'CoreVideo',
      '-framework', 'CoreGraphics', '-o', executable], { timeout: 20_000 });
    return JSON.parse(execFileSync(executable, [], { encoding: 'utf8', timeout: 7_000 }));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export async function plainFrames(browser, viewport, videoDir, recordVideo, timeout = 25_000, { rate = 4, motion = recordVideo, repetitions = motion ? 100 : 40 } = {}) {
  const context = await browser.newContext({
    viewport, reducedMotion: 'no-preference', ...(recordVideo ? { recordVideo: { dir: videoDir, size: viewport } } : {}),
  });
  try {
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    await page.setContent('<button aria-expanded="false" onclick="this.setAttribute(\'aria-expanded\',this.getAttribute(\'aria-expanded\')===\'false\')">Read details</button><div id="scroll" style="overflow:auto;height:400px"><div style="height:200000px"></div></div>');
    // Playwright enforces this deadline outside the page, including when RAF stops entirely.
    const completed = await page.waitForFunction(async ({ motion, repetitions }) => {
      const frameIntervals = [], wallIntervals = [], elapsed = [];
      const button = document.querySelector('button'), grid = document.querySelector('#scroll');
      let last = await new Promise(requestAnimationFrame), lastWall = performance.now();
      for (let i = 0; i < repetitions; i++) {
        const start = performance.now();
        if (motion && i % 10 === 0) button.click();
        if (!motion) grid.scrollTop = (grid.scrollHeight - grid.clientHeight) * (i + 1) / 40;
        for (let tick = 0; tick < (motion ? 1 : 2); tick++) {
          const frame = await new Promise(requestAnimationFrame), wall = performance.now();
          frameIntervals.push(frame - last);
          wallIntervals.push(wall - lastWall);
          last = frame;
          lastWall = wall;
        }
        elapsed.push(performance.now() - start);
      }
      return { visibility: document.visibilityState, frameIntervals, wallIntervals, elapsed };
    }, { motion, repetitions }, { timeout });
    return await completed.jsonValue();
  } finally {
    await context.close();
  }
}

// Each cell runs the same button/one-frame workload. Only recording and CPU rate differ.
export async function blankCadenceMatrix(browser, viewport, videoDir, timeout = 15_000) {
  const rows = [];
  for (const [rate, recordVideo] of [[1, false], [4, true], [4, false], [1, true]]) {
    const row = { rate, recordVideo, repetitions: 30 };
    try {
      row.samples = await plainFrames(browser, viewport, videoDir, recordVideo, timeout, {
        rate, motion: true, repetitions: row.repetitions,
      });
    } catch (error) {
      row.unavailable = error.message;
    }
    rows.push(row);
  }
  return rows;
}

export async function frameDiagnostics(browser, samples) {
  const viewport = { width: 390, height: 850 };
  const videoDir = await mkdtemp(join(tmpdir(), 'ui-cadence-video-'));
  try {
    // The recording and unrecorded controls run serially to avoid competing for the compositor.
    const result = { samples };
    for (const [key, call] of [
      ['plainMotion', () => plainFrames(browser, viewport, videoDir, true)],
      ['plainScroll', () => plainFrames(browser, viewport, videoDir, false)],
      ['nativeDisplay', displayCadence],
      ['blankFactorial', () => blankCadenceMatrix(browser, viewport, videoDir)],
    ]) {
      try { result[key] = await call(); }
      catch (error) { result[key] = { unavailable: error.message }; }
    }
    return result;
  } finally {
    await rm(videoDir, { recursive: true, force: true });
  }
}
