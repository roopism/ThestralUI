import { type MotionOptions, type MotionHandle, active, skipped, play, motion, space } from "../_shared/motion-choreography/binding.js";
export type SharedElementBounds = Pick<DOMRectReadOnly, 'left' | 'top' | 'width' | 'height'> & {
  /** Corner radius of the source in CSS pixels, captured so the corners morph with the move. */
  radius?: number;
};
function cornerRadius(element: HTMLElement) {
  const style = element.ownerDocument.defaultView?.getComputedStyle?.(element);
  const value = parseFloat(style?.borderRadius || style?.borderTopLeftRadius || '');
  return Number.isFinite(value) ? value : 0;
}
/** Capture immediately before a layout or route change, including any in-flight transform. */
export function captureSharedElement(source: HTMLElement): SharedElementBounds {
  const { left, top, width, height } = source.getBoundingClientRect();
  return { left, top, width, height, radius: cornerRadius(source) };
}
/**
 * Animate a destination visual from the captured bounds after the new layout has committed.
 * Longer journeys take proportionally longer, up to twice the entrance duration. `fade` also
 * dissolves the destination in, for a cross-fade with an outgoing copy. Capturing an element
 * that is still moving and animating it again continues from where it is.
 */
export function animateSharedElement(
  source: SharedElementBounds,
  destination: HTMLElement,
  options: MotionOptions & { fade?: boolean } = {},
): MotionHandle {
  active.get(destination)?.cancel();
  const next = destination.getBoundingClientRect();
  if (Math.min(source.width, source.height, next.width, next.height) <= 0) return skipped;
  const deltaX = source.left - next.left;
  const deltaY = source.top - next.top;
  const scaleX = source.width / next.width;
  const scaleY = source.height / next.height;
  if (!deltaX && !deltaY && scaleX === 1 && scaleY === 1) return skipped;
  const from: Keyframe = {
    transformOrigin: '0 0',
    transform: 'translate(' + deltaX + 'px, ' + deltaY + 'px) scale(' + scaleX + ', ' + scaleY + ')',
  };
  const to: Keyframe = { transformOrigin: '0 0', transform: 'none' };
  if (source.radius !== undefined) {
    // Express the source corners in the destination's scaled space so they look unchanged at the start.
    const radius = source.radius;
    from.borderRadius = radius / scaleX + 'px / ' + radius / scaleY + 'px';
    to.borderRadius = cornerRadius(destination) + 'px';
  }
  if (options.fade) {
    from.opacity = 0;
    to.opacity = 1;
  }
  const distance = Math.hypot(deltaX, deltaY) / (space.spaceXl * 20);
  const duration = motion.enterDuration * Math.min(2, 1 + distance);
  return play([{ element: destination, duration, frames: [from, to] }], options);
}
