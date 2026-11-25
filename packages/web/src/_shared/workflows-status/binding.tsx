'use client';
import { type MouseEvent, type ReactNode, useLayoutEffect, useRef } from "react";
export type WorkflowAvailability =
  | { kind: 'loading' | 'denied'; message: ReactNode }
  | { kind: 'error'; message: ReactNode; retryLabel: string; onRetry: () => void };
export function AvailabilityMessage({ state }: { state: WorkflowAvailability }) {
  return (
    <div className="uld-workflow-status">
      <p role={state.kind === 'error' ? 'alert' : 'status'}>{state.message}</p>
      {state.kind === 'error' && (
        <button type="button" onClick={state.onRetry}>
          {state.retryLabel}
        </button>
      )}
    </div>
  );
}

/** Retain the user's place when a controlled update removes the action they activated. */
export function useActionFocus() {
  const heading = useRef<HTMLHeadingElement>(null);
  const pending = useRef<{ button: HTMLButtonElement; next: HTMLButtonElement[]; clear(): void } | null>(null);
  useLayoutEffect(() => () => pending.current?.clear(), []);
  useLayoutEffect(() => {
    const action = pending.current;
    if (!action || (action.button.isConnected && !action.button.disabled)) return;
    action.clear();
    const { activeElement, body } = action.button.ownerDocument;
    if (activeElement === body || activeElement === action.button)
      (action.next.find(button => button.isConnected && !button.disabled) ?? heading.current)?.focus();
  });
  function remember(event: MouseEvent<HTMLElement>) {
    const button = (event.target as Element).closest('button');
    if (!button) return;
    const { activeElement, body } = button.ownerDocument;
    if (activeElement !== button && activeElement !== body) return;
    const actions = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>(
      ':scope > button, :scope > .uld-workflow-status > button, :scope > ul > li[data-has-action] > button:last-child',
    ));
    const index = actions.indexOf(button);
    if (index < 0) return;
    pending.current?.clear();
    const doc = button.ownerDocument;
    const outside = (event: Event) => {
      if (!button.contains(event.target as Node)) clear();
    };
    function clear() {
      doc.removeEventListener('focusin', outside, true);
      doc.removeEventListener('pointerdown', outside, true);
      pending.current = null;
    }
    pending.current = { button, next: actions.slice(index + 1), clear };
    doc.addEventListener('focusin', outside, true);
    doc.addEventListener('pointerdown', outside, true);
  }
  return { heading, remember };
}
