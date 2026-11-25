'use client';
import { type ReactNode, useRef, useId, useState, useLayoutEffect, type KeyboardEvent } from "react";
export interface CarouselItem {
  id: string;
  label: string;
  content: ReactNode;
}
export interface CarouselLabels {
  previous: string;
  next: string;
  carousel: string;
  slide: string;
  position: (position: number, total: number) => string;
}
export interface CarouselProps {
  label: string;
  labels: CarouselLabels;
  items: readonly CarouselItem[];
  /** Controlled current slide id; pair it with `onSelectionChange`. */
  selectedId?: string;
  /** Initial slide id when uncontrolled. Defaults to the first item. */
  defaultSelectedId?: string;
  /** Called with the requested slide id after a control, key or swipe changes the slide. */
  onSelectionChange?: (id: string) => void;
}
export function align(viewport: HTMLDivElement, index: number) {
  const sign = getComputedStyle(viewport).direction === 'rtl' ? -1 : 1;
  viewport.scrollLeft = sign * index * viewport.clientWidth;
}
/** Native touch scrolling and explicit controls. Only the current slide is keyboard-interactive. */
export function Carousel({
  label,
  labels,
  items,
  selectedId,
  defaultSelectedId,
  onSelectionChange,
}: CarouselProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const viewportId = useId();
  const [internal, setSelected] = useState<string | undefined>(defaultSelectedId ?? items[0]?.id);
  const selected = selectedId ?? internal;
  const index = Math.max(
    0,
    items.findIndex((item) => item.id === selected),
  );
  const current = items[index]?.id;
  // The slide index the viewport shows, after alignment or the reader's own scrolling.
  const shown = useRef(0);

  useLayoutEffect(() => {
    if (viewport.current && shown.current !== index) align(viewport.current, index);
    shown.current = index;
    if (selectedId === undefined && internal !== current) setSelected(current);
  }, [current, index, internal, selectedId]);

  function choose(next: number) {
    const id = items[next].id;
    if (selectedId === undefined) setSelected(id);
    onSelectionChange?.(id);
  }

  function select(next: number) {
    if (!items[next] || next === index || !viewport.current) return;
    choose(next);
    if (selectedId === undefined) {
      shown.current = next;
      align(viewport.current, next);
    }
  }

  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || event.altKey || event.metaKey || event.ctrlKey)
      return;
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    switch (event.key) {
      case 'ArrowRight':
        select(index + (rtl ? -1 : 1));
        break;
      case 'ArrowLeft':
        select(index + (rtl ? 1 : -1));
        break;
      case 'Home':
        select(0);
        break;
      case 'End':
        select(items.length - 1);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  function observeScroll() {
    const element = viewport.current!;
    if (!element.clientWidth) return;
    const visible = Math.min(
      items.length - 1,
      Math.round(Math.abs(element.scrollLeft) / element.clientWidth),
    );
    shown.current = visible;
    if (items[visible] && visible !== index) choose(visible);
  }

  if (!items.length) return null;
  return (
    <section className="uld-carousel" aria-label={label} aria-roledescription={labels.carousel}>
      <div
        ref={viewport}
        id={viewportId}
        className="uld-carousel-viewport"
        role="group"
        aria-label={label}
        tabIndex={0}
        onKeyDown={navigate}
        onScroll={observeScroll}
      >
        {items.map((item, itemIndex) => (
          <div
            key={item.id}
            className="uld-carousel-slide"
            role="group"
            aria-roledescription={labels.slide}
            aria-label={item.label}
            aria-hidden={itemIndex !== index || undefined}
            inert={itemIndex !== index}
          >
            {item.content}
          </div>
        ))}
      </div>
      <div className="uld-carousel-controls">
        <button
          type="button"
          className="uld-motion-action"
          aria-controls={viewportId}
          aria-disabled={index === 0}
          onClick={() => select(index - 1)}
        >
          {labels.previous}
        </button>
        <span role="status" aria-atomic="true">
          {labels.position(index + 1, items.length)}
        </span>
        <button
          type="button"
          className="uld-motion-action"
          aria-controls={viewportId}
          aria-disabled={index === items.length - 1}
          onClick={() => select(index + 1)}
        >
          {labels.next}
        </button>
      </div>
    </section>
  );
}
