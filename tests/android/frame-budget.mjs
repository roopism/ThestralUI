import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { bounds, target } from './tree.mjs';
import { appId } from './host.mjs';

export function summarize(frames, logcat) {
  const elapsed = [],
    late = [];
  const seen = new Set();
  for (const section of frames
    .split('---PROFILEDATA---')
    .filter((part) => part.trim().startsWith('Flags,'))) {
    const [header, ...rows] = section.trim().split(/\r?\n/);
    const fields = header.split(',');
    for (const row of rows) {
      const cells = row.split(',');
      const value = (field) => Number(cells[fields.indexOf(field)]);
      const start = value('IntendedVsync'),
        end = value('FrameCompleted'),
        deadline = value('FrameDeadline');
      if (
        value('Flags') !== 0 ||
        ![start, end, deadline].every(Number.isSafeInteger) ||
        !(end > start && deadline > start) ||
        seen.has(start)
      )
        continue;
      seen.add(start);
      elapsed.push((end - start) / 1e6);
      late.push(end > deadline);
    }
  }
  const latency = [...logcat.matchAll(/inputToFrameCommitNs=(\d+)/g)].map(
    (match) => Number(match[1]) / 1e6,
  );
  assert.ok(elapsed.length >= 15, 'Insufficient rendered Android frames: ' + elapsed.length);
  assert.ok(
    latency.length >= 5,
    'Insufficient input-to-committed-frame samples: ' + latency.length,
  );
  const p95 = (values) => values.sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1];
  return {
    frames: elapsed.length,
    inputs: latency.length,
    p95FrameMs: p95(elapsed),
    deadlineMissFraction: late.filter(Boolean).length / late.length,
    p95InputToCommitMs: p95(latency),
  };
}

export function enforceBudget(metrics, budget, subject = '') {
  for (const metric of ['p95FrameMs', 'deadlineMissFraction', 'p95InputToCommitMs']) {
    const actual = metrics[metric];
    const limit = budget[metric];
    if (!Number.isFinite(limit) || !Number.isFinite(actual) || actual < 0 || actual > limit) {
      const error = new Error((subject ? subject + ' ' : '') + metric + ' ' + actual + ' exceeds ' + limit);
      error.code = 'android/frame-budget';
      throw error;
    }
  }
}

export function summarizeTrials(samples) {
  assert.equal(samples.length, 3, 'Android requires three independent timing trials');
  const median = (key) => samples.map((sample) => sample[key]).sort((a, b) => a - b)[1];
  return {
    frames: samples.reduce((sum, sample) => sum + sample.frames, 0),
    inputs: samples.reduce((sum, sample) => sum + sample.inputs, 0),
    p95FrameMs: median('p95FrameMs'),
    p95InputToCommitMs: median('p95InputToCommitMs'),
    deadlineMissFraction: median('deadlineMissFraction'),
    trials: samples,
  };
}

export async function measureFrameTrial({ device, tree, reports }) {
  for (const setting of [
    'window_animation_scale',
    'transition_animation_scale',
    'animator_duration_scale',
  ]) {
    device('shell', 'settings', 'put', 'global', setting, '1.0');
    assert.equal(
      Number(device('shell', 'settings', 'get', 'global', setting)),
      1,
      'Expected system motion for ' + setting,
    );
  }
  device('shell', 'am', 'start', '-S', '-W', '-n', appId + '/com.helloworld.FrameActivity');
  await delay(1200);
  const screen = tree();
  const button = bounds(
    target(screen, 'frame-review', { role: 'Button', name: 'Review item', enabled: true }),
  );
  const list = bounds(target(screen, 'frame-scroll'));
  const tap = () =>
    device(
      'shell',
      'input',
      'swipe',
      String(button.centerX),
      String(button.centerY),
      String(button.centerX),
      String(button.centerY),
      '80',
    );
  const swipe = (up) => {
    const top = list.y + Math.floor((list.bottom - list.y) * 0.2),
      bottom = list.bottom - Math.floor((list.bottom - list.y) * 0.2);
    device(
      'shell',
      'input',
      'swipe',
      String(list.centerX),
      String(up ? bottom : top),
      String(list.centerX),
      String(up ? top : bottom),
      '360',
    );
  };
  // Warm the actual press animation and list, then confirm the offscreen records really moved.
  tap();
  swipe(true);
  assert.ok(
    !tree().some((node) => node['resource-id']?.endsWith('frame-row-0')),
    'Scroll failed to move the first item offscreen',
  );
  swipe(false);
  await delay(500);
  const measured = {};
  for (const journey of ['press', 'scroll']) {
    device('logcat', '-c');
    device('shell', 'dumpsys', 'gfxinfo', appId, 'reset');
    for (let i = 0; i < 12; i++) {
      if (journey === 'press') tap();
      else swipe(i % 2 === 0);
      await delay(journey === 'press' ? 210 : 180);
    }
    await delay(400);
    const frames = device('shell', 'dumpsys', 'gfxinfo', appId, 'framestats');
    const events = device('logcat', '-d', '-s', 'UldFrameProbe:I');
    writeFileSync(join(reports, journey + '-frames.txt'), frames);
    writeFileSync(join(reports, journey + '-input.txt'), events);
    measured[journey] = summarize(frames, events);
    if (journey === 'press') target(tree(), 'frame-count', { name: 'Reviewed 13' });
  }
  return measured;
}

export async function measureFrameBudget({ device, tree, reports }) {
  const trials = [];
  for (let index = 1; index <= 3; index++) {
    const directory = join(reports, 'frame-trial-' + index);
    mkdirSync(directory, { recursive: true });
    trials.push(await measureFrameTrial({ device, tree, reports: directory }));
  }
  const result = {};
  for (const name of ['press', 'scroll']) result[name] = summarizeTrials(trials.map(trial => trial[name]));
  writeFileSync(join(reports, 'frame-measurements.json'), JSON.stringify(result, null, 2) + '\n');
  return result;
}
