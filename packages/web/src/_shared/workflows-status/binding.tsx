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
  const pending = useRef<{ button: HTMLButtonElement; next: HTMLButtonElement[] } | null>(null);
  useLayoutEffect(() => {
    const action = pending.current;
    if (!action || (action.button.isConnected && !action.button.disabled)) return;
    pending.current = null;
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
      ':scope > button, :scope > ul > li[data-has-action] > button:last-child',
    ));
    const index = actions.indexOf(button);
    if (index >= 0) pending.current = { button, next: actions.slice(index + 1) };
  }
  return { heading, remember };
}
