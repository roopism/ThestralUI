import { afterEach, expect, test, vi } from 'vitest';

import { playMotionSequence } from '../../packages/web/src/motion';

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

function participant() {
  const element = document.createElement('div');
  document.body.append(element);
  let finish!: () => void;
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const animation = { reverse: vi.fn(), cancel: vi.fn(), finished };
  const animate = vi.fn(() => animation);
  Object.defineProperty(element, 'animate', { value: animate });
  return { element, animate, animation, finish };
}

test('new reduced-motion preference cancels all steps and releases listeners', async () => {
  const preference = Object.assign(new EventTarget(), { matches: false });
  vi.stubGlobal('matchMedia', () => preference);
  const first = participant(),
    second = participant();
  const sequence = playMotionSequence(
    [
      { element: first.element, preset: 'enter' },
      { element: second.element, preset: 'spring' },
    ],
    { stagger: 30 },
  );
  expect(second.animate.mock.calls[0]).toHaveLength(2);
  sequence.reverse();
  expect(first.animation.reverse).toHaveBeenCalledOnce();
  preference.matches = true;
  preference.dispatchEvent(new Event('change'));
  expect(await sequence.finished).toBe('cancelled');
  expect(second.animation.cancel).toHaveBeenCalledOnce();
  expect(first.animation.cancel).toHaveBeenCalledOnce();
  const skipped = playMotionSequence([{ element: first.element, preset: 'exit' }]);
  expect(await skipped.finished).toBe('skipped');
  expect(first.animate).toHaveBeenCalledOnce();
});

test('a new choreography supersedes the previous run on the same element', async () => {
  const target = participant();
  const old = playMotionSequence([{ element: target.element, preset: 'exit' }]);
  const newer = playMotionSequence([{ element: target.element, preset: 'emphasis' }]);
  expect(await old.finished).toBe('cancelled');
  expect(target.animate).toHaveBeenCalledTimes(2);
  target.finish();
  expect(await newer.finished).toBe('finished');
});

test('completion and cancellation release the identical media and abort listener functions', async () => {
  for (const outcome of ['cancel', 'complete']) {
    const media = Object.assign(new EventTarget(), { matches: false });
    const controller = new AbortController();
    const mediaAdd = vi.spyOn(media, 'addEventListener'),
      mediaRemove = vi.spyOn(media, 'removeEventListener');
    const abortAdd = vi.spyOn(controller.signal, 'addEventListener'),
      abortRemove = vi.spyOn(controller.signal, 'removeEventListener');
    vi.stubGlobal('matchMedia', () => media);
    const target = participant();
    const handle = playMotionSequence([{ element: target.element, preset: 'enter' }], {
      signal: controller.signal,
    });
    expect(mediaAdd).toHaveBeenCalledTimes(1);
    expect(abortAdd).toHaveBeenCalledTimes(1);
    if (outcome === 'cancel') handle.cancel();
    else target.finish();
    expect(await handle.finished).toBe(outcome === 'cancel' ? 'cancelled' : 'finished');
    expect(mediaRemove).toHaveBeenCalledWith('change', mediaAdd.mock.calls[0][1]);
    expect(abortRemove).toHaveBeenCalledWith('abort', abortAdd.mock.calls[0][1]);
  }
});

test('a reversal that returns every step to its start reports reversed exactly once', async () => {
  const first = participant(),
    second = participant();
  const sequence = playMotionSequence([
    { element: first.element, preset: 'pop' },
    { element: second.element, preset: 'fade-in' },
  ]);
  sequence.reverse();
  sequence.reverse();
  sequence.reverse();
  expect(first.animation.reverse).toHaveBeenCalledTimes(3);
  first.finish();
  second.finish();
  expect(await sequence.finished).toBe('reversed');
  sequence.cancel();
  expect(first.animation.cancel).not.toHaveBeenCalled();
});

test('center order staggers outward from the middle and inline slides mirror in right-to-left text', () => {
  const steps = [participant(), participant(), participant()];
  steps[0].element.style.direction = 'rtl';
  playMotionSequence(
    steps.map(({ element }) => ({ element, preset: 'slide-in' as const })),
    { stagger: 40, order: 'center' },
  );
  const call = (index: number) =>
    steps[index].animate.mock.calls[0] as unknown as [Keyframe[], KeyframeAnimationOptions];
  // The stagger becomes a held first frame, so cancel and reverse cover the wait too.
  expect(steps.map((_, index) => call(index)[1].duration)).toEqual([260, 220, 260]);
  expect(call(0)[0].map((frame) => frame.offset)).toEqual([0, 40 / 260, 1]);
  expect(call(1)[0].map((frame) => frame.offset)).toEqual([0, 1]);
  const start = (index: number) => call(index)[0][0].transform;
  expect(start(0)).toBe('translateX(24px)');
  expect(start(2)).toBe('translateX(-24px)');
});

test('reverse order and per-step delays add to the stagger position', () => {
  const steps = [participant(), participant()];
  playMotionSequence(
    [
      { element: steps[0].element, preset: 'exit', delay: 10 },
      { element: steps[1].element, preset: 'shake' },
    ],
    { stagger: 50, order: 'reverse' },
  );
  const call = (index: number) =>
    steps[index].animate.mock.calls[0] as unknown as [Keyframe[], KeyframeAnimationOptions];
  expect(call(0)[1].duration).toBe(220);
  expect(call(0)[0][1]).toMatchObject({ offset: 60 / 220, easing: 'ease-in', opacity: 1 });
  expect(call(1)[1].duration).toBe(440);
  const shake = (steps[1].animate.mock.calls[0] as unknown[])[0] as Keyframe[];
  expect(shake.at(0)?.transform).toBe(shake.at(-1)?.transform);
});
