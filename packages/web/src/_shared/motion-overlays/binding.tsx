'use client';
import { type GestureSheetProps } from "../../gesture-sheet/binding.js";
import { useId, useRef, type PointerEvent } from "react";
import { Dialog } from "../../modal-dialog/binding.js";
export interface Drag {
  pointer: number;
  start: number;
  sign: number;
}
export function EdgePanel({
  title,
  closeLabel,
  onDismiss,
  children,
  placement,
  returnFocusRef,
}: GestureSheetProps & { placement: 'bottom' | 'start' | 'end' }) {
  const titleId = useId();
  const panel = useRef<HTMLDialogElement>(null);
  const drag = useRef<Drag | null>(null);
  const horizontal = placement !== 'bottom';

  function begin(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !event.isPrimary || drag.current) return;
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    const towardStart = horizontal && (placement === 'start') !== rtl;
    drag.current = {
      pointer: event.pointerId,
      start: horizontal ? event.clientX : event.clientY,
      sign: towardStart ? -1 : 1,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    panel.current?.setAttribute('data-dragging', '');
  }

  function distance(event: PointerEvent<HTMLDivElement>, active: Drag) {
    return Math.max(0, ((horizontal ? event.clientX : event.clientY) - active.start) * active.sign);
  }

  function reset() {
    drag.current = null;
    panel.current?.removeAttribute('data-dragging');
    panel.current?.style.removeProperty('--uld-drag-offset');
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    const active = drag.current;
    if (!active || active.pointer !== event.pointerId) return;
    panel.current?.style.setProperty(
      '--uld-drag-offset',
      distance(event, active) * active.sign + 'px',
    );
  }

  function end(event: PointerEvent<HTMLDivElement>) {
    const active = drag.current;
    if (!active || active.pointer !== event.pointerId) return;
    const length = horizontal ? panel.current!.clientWidth : panel.current!.clientHeight;
    const dismiss = distance(event, active) >= Math.min(96, Math.max(40, length / 4));
    reset();
    if (dismiss) onDismiss();
  }

  return (
    <Dialog
      ref={panel}
      returnFocusRef={returnFocusRef}
      labelledBy={titleId}
      onDismiss={onDismiss}
      dismissOnBackdrop
      className={'uld-edge-panel uld-edge-' + placement}
    >
      <div
        className="uld-edge-grip"
        aria-hidden="true"
        onPointerDown={begin}
        onPointerMove={move}
        onPointerUp={end}
        onLostPointerCapture={reset}
        onPointerCancel={reset}
      >
        <span />
      </div>
      <header className="uld-motion-header">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="uld-motion-action" onClick={onDismiss}>
          {closeLabel}
        </button>
      </header>
      <div className="uld-edge-content">{children}</div>
    </Dialog>
  );
}
