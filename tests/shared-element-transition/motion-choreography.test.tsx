import { afterEach, expect, test, vi } from 'vitest';

import { animateSharedElement, captureSharedElement } from '../../packages/web/src/motion';

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

test('shared elements skip zero-size bounds and unsupported browsers', async () => {
  const target = document.createElement('aside');
  expect(await animateSharedElement(captureSharedElement(target), target).finished).toBe('skipped');
});

test('shared element maps the new bounds back to its source before animating', async () => {
  const target = participant();
  vi.spyOn(target.element, 'getBoundingClientRect').mockReturnValue(new DOMRect(50, 80, 120, 60));
  const transition = animateSharedElement(
    { left: 10, top: 20, width: 60, height: 30 },
    target.element,
  );
  expect(target.animate.mock.calls[0]).toContainEqual(
    expect.arrayContaining([
      expect.objectContaining({ transform: 'translate(-40px, -60px) scale(0.5, 0.5)' }),
    ]),
  );
  target.finish();
  expect(await transition.finished).toBe('finished');
});

test('captured corners morph into the destination and a long journey lasts at most twice the entrance', async () => {
  const target = participant();
  target.element.style.borderRadius = '12px';
  vi.spyOn(target.element, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 100, 100));
  const transition = animateSharedElement(
    { left: 4000, top: 0, width: 50, height: 25, radius: 6 },
    target.element,
    { fade: true },
  );
  const [frames, timing] = target.animate.mock.calls[0] as unknown as [Keyframe[], KeyframeAnimationOptions];
  expect(frames[0]).toMatchObject({ borderRadius: '12px / 24px', opacity: 0 });
  expect(frames[1]).toMatchObject({ borderRadius: '12px', opacity: 1, transform: 'none' });
  expect(timing.duration).toBe(440);
  transition.reverse();
  target.finish();
  expect(await transition.finished).toBe('reversed');
});

test('capture records the source corner radius from its computed style', () => {
  const source = document.createElement('div');
  source.style.borderRadius = '8px';
  document.body.append(source);
  expect(captureSharedElement(source)).toMatchObject({ width: 0, height: 0, radius: 8 });
});
