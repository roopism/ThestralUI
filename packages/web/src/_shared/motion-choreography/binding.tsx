import { tokens } from "@ui-lazy-dev/tokens";
/**
 * `finished` when every step reached its end, `reversed` when a reversal returned every step
 * to its start, `cancelled` when interrupted and `skipped` when nothing animated.
 */
export type MotionResult = 'finished' | 'reversed' | 'cancelled' | 'skipped';
export interface MotionHandle {
  /** Resolves exactly once with the terminal result. */
  finished: Promise<MotionResult>;
  cancel(): void;
  /** Play the remaining motion backwards from where it is. Calling it again plays forwards. */
  reverse(): void;
}
export interface MotionOptions {
  /** Delay between successive starts, in milliseconds. */
  stagger?: number;
  signal?: AbortSignal;
}
export const { motion, space } = tokens;
export const active = new WeakMap<HTMLElement, MotionHandle>();
export const skipped: MotionHandle = { finished: Promise.resolve('skipped'), reverse() {}, cancel() {} };
export type Track = { element: HTMLElement; frames: Keyframe[]; duration: number };
/**
 * Fold a start delay and an easing into the keyframes themselves: the first frame holds for the
 * delay, then the motion runs with the easing. The track keeps one timeline, so cancel and
 * reverse act on the delay and the motion together.
 */
export function hold(element: HTMLElement, frames: Keyframe[], duration: number, delay: number, easing: string): Track {
  const total = duration + Math.max(0, delay);
  const lead = total ? Math.max(0, delay) / total : 0;
  const last = frames.length - 1;
  const timed = frames.map((frame, index) => ({
    ...frame,
    offset: lead + (1 - lead) * (frame.offset ?? (last ? index / last : 1)),
    easing,
  }));
  return { element, duration: total, frames: lead ? [{ ...frames[0], offset: 0 }, ...timed] : timed };
}
/** Inline-direction factor: 1 in left-to-right text and -1 in right-to-left text. */
export function inline(element: HTMLElement) {
  return element.ownerDocument.defaultView?.getComputedStyle?.(element).direction === 'rtl' ? -1 : 1;
}
export function play(tracks: Track[], { stagger = 0, signal }: MotionOptions): MotionHandle {
  for (const track of tracks) active.get(track.element)?.cancel();
  const preference = tracks[0]?.element.ownerDocument.defaultView?.matchMedia?.(
    '(prefers-reduced-motion: reduce)',
  );
  if (
    signal?.aborted ||
    preference?.matches ||
    !tracks.length ||
    tracks.some(({ element }) => !element.isConnected || typeof element.animate !== 'function')
  )
    return skipped;

  const animations = tracks.map(({ element, frames, duration }, index) =>
    element.animate(frames, {
      duration,
      delay: index * Math.max(0, stagger),
      easing: 'ease-out',
      fill: 'backwards',
    }),
  );
  let resolve!: (value: MotionResult) => void;
  let settled = false;
  let backwards = false;
  const finished = new Promise<MotionResult>((done) => {
    resolve = done;
  });
  const handle = {
    finished,
    cancel,
    reverse() {
      if (settled) return;
      backwards = !backwards;
      animations.forEach((animation) => animation.reverse());
    },
  };

  function settle(result: MotionResult) {
    if (settled) return;
    settled = true;
    preference?.removeEventListener('change', onPreference);
    signal?.removeEventListener('abort', cancel);
    for (const { element } of tracks) {
      if (active.get(element) === handle) active.delete(element);
    }
    resolve(result);
  }

  function cancel() {
    if (settled) return;
    settle('cancelled');
    animations.forEach((animation) => animation.cancel());
  }

  function onPreference() {
    if (preference?.matches) cancel();
  }

  tracks.forEach(({ element }) => active.set(element, handle));
  preference?.addEventListener('change', onPreference);
  signal?.addEventListener('abort', cancel, { once: true });
  Promise.all(animations.map((animation) => animation.finished)).then(
    () => settle(backwards ? 'reversed' : 'finished'),
    cancel,
  );
  return handle;
}
