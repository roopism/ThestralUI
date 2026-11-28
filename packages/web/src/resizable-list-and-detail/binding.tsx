'use client';
import { type ReactNode, useState, useRef, useId, type CSSProperties } from "react";
export interface SplitViewProps {
  listLabel: string;
  detailLabel: string;
  resizeLabel: string;
  list: ReactNode;
  detail: ReactNode;
  /** Initial list size in percent when uncontrolled. */
  defaultSize?: number;
  /** Controlled list size in percent; pair it with `onSizeChange`. */
  size?: number;
  /** Smallest list size in percent (default 20). */
  minSize?: number;
  /** Largest list size in percent (default 80). */
  maxSize?: number;
  onSizeChange?: (percentage: number) => void;
}
export const clamp = (value: number, min = 20, max = 80) => Math.min(max, Math.max(min, Math.round(value)));
/** Logical start pane size is a percentage. F6 switches between panes and restores the last focused control. Enter on the handle collapses the list to its minimum and restores it. */
export function SplitView({
  listLabel,
  detailLabel,
  resizeLabel,
  list,
  detail,
  defaultSize = 40,
  size: controlled,
  minSize = 20,
  maxSize = 80,
  onSizeChange,
}: SplitViewProps) {
  const [internal, setSize] = useState(() => clamp(Number.isFinite(defaultSize) ? defaultSize : 40, minSize, maxSize));
  const size = clamp(controlled ?? internal, minSize, maxSize);
  const restore = useRef(size);
  const frame = useRef<HTMLDivElement>(null);
  const start = useRef<HTMLElement>(null),
    end = useRef<HTMLElement>(null);
  const lastList = useRef<HTMLElement | null>(null),
    lastDetail = useRef<HTMLElement | null>(null);
  const drag = useRef<{
    id: number;
    startX: number;
    startSize: number;
    width: number;
    direction: number;
  } | null>(null);
  const listId = useId();
  const change = (next: number) => {
    const limited = clamp(next, minSize, maxSize);
    if (limited !== size) {
      setSize(limited);
      onSizeChange?.(limited);
    }
  };
  const direction = () =>
    frame.current && getComputedStyle(frame.current).direction === 'rtl' ? -1 : 1;
  return (
    <div className="uld-split">
      <div
        className="uld-split-frame"
        ref={frame}
        style={{ '--uld-list-size': size + '%' } as CSSProperties}
        onKeyDown={(event) => {
          if (event.key !== 'F6' || event.altKey || event.ctrlKey || event.metaKey) return;
          const fromList = start.current?.contains(event.target as Node);
          const pane = fromList ? end.current : start.current;
          const last = fromList ? lastDetail.current : lastList.current;
          event.preventDefault();
          if (last && pane?.contains(last)) last.focus({ preventScroll: true });
          if (pane && !pane.matches(':focus-within')) pane.focus({ preventScroll: true });
        }}
      >
        <section
          className="uld-split-pane"
          ref={start}
          id={listId}
          tabIndex={-1}
          aria-label={listLabel}
          aria-keyshortcuts="F6"
          onFocus={(event) => {
            if (event.target !== start.current) lastList.current = event.target as HTMLElement;
          }}
        >
          {list}
        </section>
        <div
          role="separator"
          tabIndex={0}
          className="uld-split-handle"
          aria-label={resizeLabel}
          aria-orientation="vertical"
          aria-controls={listId}
          aria-valuemin={minSize}
          aria-valuemax={maxSize}
          aria-valuenow={size}
          aria-valuetext={size + '%'}
          onKeyDown={(event) => {
            const step = event.shiftKey ? 10 : 1;
            if (event.key === 'Enter') restore.current = size > minSize ? size : restore.current;
            const target =
              event.key === 'Home'
                ? minSize
                : event.key === 'End'
                  ? maxSize
                  : event.key === 'Enter'
                    ? size > minSize ? minSize : restore.current
                  : event.key === 'ArrowRight'
                    ? size + step * direction()
                    : event.key === 'ArrowLeft'
                      ? size - step * direction()
                      : undefined;
            if (target !== undefined) {
              event.preventDefault();
              change(target);
            }
          }}
          onPointerDown={(event) => {
            if (event.button !== 0 || !event.isPrimary || !frame.current) return;
            const width = frame.current.getBoundingClientRect().width;
            if (!width) return;
            drag.current = {
              id: event.pointerId,
              startX: event.clientX,
              startSize: size,
              width,
              direction: direction(),
            };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const pointer = drag.current;
            if (pointer?.id === event.pointerId)
              change(
                pointer.startSize +
                  (((event.clientX - pointer.startX) * 100) / pointer.width) * pointer.direction,
              );
          }}
          onLostPointerCapture={() => {
            drag.current = null;
          }}
        />
        <section
          className="uld-split-pane"
          ref={end}
          tabIndex={-1}
          aria-label={detailLabel}
          aria-keyshortcuts="F6"
          onFocus={(event) => {
            if (event.target !== end.current) lastDetail.current = event.target as HTMLElement;
          }}
        >
          {detail}
        </section>
      </div>
    </div>
  );
}
