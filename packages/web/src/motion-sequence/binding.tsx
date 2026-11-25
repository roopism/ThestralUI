import { motion, space, inline, hold, type MotionOptions, type MotionHandle, play } from "../_shared/motion-choreography/binding.js";
/**
 * Entrances: `enter` rises into place, `fade-in` changes opacity only, `slide-in` arrives from the
 * inline start, `pop` grows with a small overshoot and `spring` settles with an overshoot.
 * Exits: `exit`, `fade-out` and `slide-out`. Feedback: `emphasis` pulses and `shake` signals a
 * rejected action without moving layout.
 */
export type MotionPreset =
  | 'enter'
  | 'exit'
  | 'emphasis'
  | 'spring'
  | 'fade-in'
  | 'fade-out'
  | 'slide-in'
  | 'slide-out'
  | 'pop'
  | 'shake';
export interface MotionStep {
  element: HTMLElement;
  preset: MotionPreset;
  /** Extra start offset for this step, in milliseconds, added to its stagger position. */
  delay?: number;
}
type Preset = { duration: number; frames: (direction: number) => Keyframe[]; easing: string };
const swell = 'scale(' + (2 - motion.pressScale) + ')';
const small = 'scale(' + motion.pressScale * motion.pressScale + ')';
export const presets: Record<MotionPreset, Preset> = {
  enter: {
    duration: motion.enterDuration,
    easing: 'ease-out',
    frames: () => [
      { opacity: 0, transform: 'translateY(' + space.spaceSm + 'px)' },
      { opacity: 1, transform: 'none' },
    ],
  },
  exit: {
    duration: motion.exitDuration,
    easing: 'ease-in',
    frames: () => [
      { opacity: 1, transform: 'none' },
      { opacity: 0, transform: 'translateY(' + space.spaceXs + 'px)' },
    ],
  },
  emphasis: {
    duration: motion.enterDuration,
    easing: 'ease-in-out',
    frames: () => [{ transform: 'scale(1)' }, { transform: swell }, { transform: 'scale(1)' }],
  },
  spring: {
    duration: motion.enterDuration * 2,
    easing: 'linear',
    frames: () => [
      { transform: small },
      { transform: swell, offset: 0.48 },
      { transform: 'scale(' + (1 + (1 - motion.pressScale) / 6) + ')', offset: 0.76 },
      { transform: 'scale(1)' },
    ],
  },
  'fade-in': {
    duration: motion.enterDuration,
    easing: 'ease-out',
    frames: () => [{ opacity: 0 }, { opacity: 1 }],
  },
  'fade-out': {
    duration: motion.exitDuration,
    easing: 'ease-in',
    frames: () => [{ opacity: 1 }, { opacity: 0 }],
  },
  'slide-in': {
    duration: motion.enterDuration,
    easing: 'ease-out',
    frames: (direction) => [
      { opacity: 0, transform: 'translateX(' + -direction * space.spaceLg + 'px)' },
      { opacity: 1, transform: 'none' },
    ],
  },
  'slide-out': {
    duration: motion.exitDuration,
    easing: 'ease-in',
    frames: (direction) => [
      { opacity: 1, transform: 'none' },
      { opacity: 0, transform: 'translateX(' + direction * space.spaceLg + 'px)' },
    ],
  },
  pop: {
    duration: motion.enterDuration,
    easing: 'ease-out',
    frames: () => [
      { opacity: 0, transform: small },
      { opacity: 1, transform: swell, offset: 0.6 },
      { opacity: 1, transform: 'scale(1)' },
    ],
  },
  shake: {
    duration: motion.enterDuration * 2,
    easing: 'ease-in-out',
    frames: (direction) =>
      [0, -1, 1, -1, 1, 0].map((side) => ({
        transform: 'translateX(' + side * direction * space.spaceXs + 'px)',
      })),
  },
};
type Order = 'forward' | 'reverse' | 'center';
function position(index: number, count: number, order: Order) {
  if (order === 'reverse') return count - 1 - index;
  if (order === 'center') return Math.abs(index - (count - 1) / 2);
  return index;
}
/**
 * Plays visual feedback only; the caller owns the semantic end state. A step on an element that is
 * already animating supersedes the earlier motion. Reduced motion, a disconnected element or an
 * aborted signal skips the whole sequence, and a live reduced-motion change cancels it.
 * `order` chooses where the stagger starts: the first step, the last step or the middle.
 */
export function playMotionSequence(
  steps: readonly MotionStep[],
  options: MotionOptions & { order?: 'forward' | 'reverse' | 'center' } = {},
): MotionHandle {
  const { order = 'forward', stagger = 0, signal } = options;
  return play(
    steps.map(({ element, preset, delay = 0 }, index) => {
      const { duration, frames, easing } = presets[preset];
      const start = delay + position(index, steps.length, order) * Math.max(0, stagger);
      return hold(element, frames(inline(element)), duration, start, easing);
    }),
    { signal },
  );
}
