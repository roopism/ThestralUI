'use client';
import { type ReactNode, useId, useRef, useState, useLayoutEffect } from "react";
import { type SharedElementBounds, captureSharedElement, animateSharedElement } from "../shared-element-transition/binding.js";
import { type MotionHandle } from "../_shared/motion-choreography/binding.js";
export interface ExpandableMediaCardProps {
  title: string;
  media: ReactNode;
  children: ReactNode;
  expandLabel: string;
  collapseLabel: string;
  /** Opt in to a compositor transform between media sizes. Reduced motion skips it. */
  animate?: boolean;
  /** Controls the disclosure. Pair with `onExpandedChange`. */
  expanded?: boolean;
  /** Initial state when the card manages its own disclosure. */
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /** Keeps the title in the surrounding outline. */
  headingLevel?: 2 | 3 | 4;
}
export function ExpandableMediaCard({
  title,
  media,
  children,
  expandLabel,
  collapseLabel,
  animate = false,
  expanded: controlled,
  defaultExpanded = false,
  onExpandedChange,
  headingLevel = 2,
}: ExpandableMediaCardProps) {
  const detailsId = useId();
  const visual = useRef<HTMLDivElement>(null);
  const source = useRef<SharedElementBounds | null>(null);
  const animation = useRef<MotionHandle | null>(null);
  const [own, setOwn] = useState(defaultExpanded);
  const expanded = controlled ?? own;
  const Heading = (['h2', 'h3', 'h4'] as const)[headingLevel - 2];

  function toggle() {
    if (animate && visual.current) source.current = captureSharedElement(visual.current);
    if (controlled === undefined) setOwn(!expanded);
    onExpandedChange?.(!expanded);
  }

  useLayoutEffect(() => {
    if (animate && source.current && visual.current)
      animation.current = animateSharedElement(source.current, visual.current);
    source.current = null;
    return () => {
      animation.current?.cancel();
    };
  }, [expanded, animate]);

  return (
    <article className="uld-media-card" data-expanded={expanded || undefined}>
      <div className="uld-media-visual" ref={visual}>
        {media}
      </div>
      <div className="uld-motion-header">
        <Heading>{title}</Heading>
        <button
          type="button"
          className="uld-motion-action"
          aria-expanded={expanded}
          aria-controls={detailsId}
          onClick={toggle}
        >
          {expanded ? collapseLabel : expandLabel}
        </button>
      </div>
      <div id={detailsId} className="uld-media-details" hidden={!expanded}>
        {children}
      </div>
    </article>
  );
}
