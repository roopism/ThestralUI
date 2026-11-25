'use client';
import { type ReactNode, useId } from "react";
import { type WorkflowAvailability, AvailabilityMessage, useActionFocus } from "../_shared/workflows-status/binding.js";
import { Spinner } from "../spinner/binding.js";
import { Button } from "../button/binding.js";
export type BatchState = 'queued' | 'running' | 'complete' | 'failed' | 'denied';
export interface BatchItem {
  id: string;
  label: string;
  state: BatchState;
  detail?: ReactNode;
}
export interface BatchProgressProps {
  label: string;
  items: readonly BatchItem[];
  availability?: WorkflowAvailability;
  onRetry?: (id: string) => void;
  /** One action that retries every failed operation, shown while two or more have failed. The caller supplies the localized label. */
  retryFailed?: { label: (count: number) => string; onRetry: (ids: string[]) => void };
  /** Keeps the batch heading in the surrounding outline. */
  headingLevel?: 2 | 3 | 4;
  labels?: {
    empty?: string;
    summary?: (terminal: number, total: number) => string;
    states?: Partial<Record<BatchState, string>>;
    retry?: (name: string) => string;
  };
}
export const stateNames: Record<BatchState, string> = {
  queued: 'Queued',
  running: 'In progress',
  complete: 'Completed',
  failed: 'Failed',
  denied: 'Permission denied',
};
/** The progress value counts terminal outcomes, including failures and denied operations. */
export function BatchProgress({
  label,
  items,
  availability,
  onRetry,
  retryFailed,
  headingLevel = 2,
  labels,
}: BatchProgressProps) {
  const { heading, remember } = useActionFocus();
  const headingId = useId();
  const Heading = (['h2', 'h3', 'h4'] as const)[headingLevel - 2];
  const terminal = items.filter(
    (item) => item.state === 'complete' || item.state === 'failed' || item.state === 'denied',
  ).length;
  const failed = items.filter((item) => item.state === 'failed').map((item) => item.id);
  return (
    <section onClickCapture={remember} className="uld-workflow-card" aria-labelledby={headingId}>
      <Heading id={headingId} ref={heading} tabIndex={-1}>{label}</Heading>
      {availability ? (
        <AvailabilityMessage state={availability} />
      ) : !items.length ? (
        <p role="status">{labels?.empty ?? 'No operations'}</p>
      ) : (
        <>
          <progress aria-labelledby={headingId} value={terminal} max={items.length} />
          <p role="status">
            {labels?.summary?.(terminal, items.length) ??
              terminal + ' of ' + items.length + ' finished'}
          </p>
          {failed.length > 1 && retryFailed && (
            <Button tone="secondary" onClick={() => retryFailed.onRetry(failed)}>
              {retryFailed.label(failed.length)}
            </Button>
          )}
          <ul aria-labelledby={headingId}>
            {items.map((item) => (
              <li key={item.id} data-state={item.state} data-has-action={(item.state === 'failed' && !!onRetry) || undefined}>
                <div>
                  <strong>{item.label}</strong>
                  <span className="uld-workflow-meta">
                    {item.state === 'running' && <Spinner />}
                    {labels?.states?.[item.state] ?? stateNames[item.state]}
                  </span>
                </div>
                {item.detail}
                {item.state === 'failed' && onRetry && (
                  <button type="button" onClick={() => onRetry(item.id)}>
                    {labels?.retry?.(item.label) ?? 'Retry ' + item.label}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
