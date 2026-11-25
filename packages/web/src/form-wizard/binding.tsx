'use client';
import { type ReactNode, useRef, useEffect } from "react";
import { Button } from "../button/binding.js";
export interface WizardStep {
  id: string;
  label: string;
  content: ReactNode;
  canAdvance?: boolean;
}
export interface WizardProps {
  label: string;
  steps: readonly WizardStep[];
  activeId: string;
  onStepChange: (id: string) => void;
  onFinish: () => void;
  busy?: boolean;
  error?: ReactNode;
  labels?: { back?: string; next?: string; finish?: string };
}
/** Step and submission state are owned by the host and may be restored from a saved draft. */
export function Wizard({
  label,
  steps,
  activeId,
  onStepChange,
  onFinish,
  busy = false,
  error,
  labels,
}: WizardProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const previous = useRef(activeId);
  const index = steps.findIndex((step) => step.id === activeId);
  useEffect(() => {
    if (previous.current !== activeId) {
      previous.current = activeId;
      heading.current?.focus({ preventScroll: true });
    }
  }, [activeId]);
  if (index < 0) return null;
  const current = steps[index];
  return (
    <section aria-label={label} className="uld-wizard">
      <ol aria-label={label}>
        {steps.map((step) => (
          <li key={step.id} aria-current={step.id === activeId ? 'step' : undefined}>
            {step.label}
          </li>
        ))}
      </ol>
      <h2 ref={heading} tabIndex={-1}>
        {current.label}
      </h2>
      <form
        aria-busy={busy}
        onSubmit={(event) => {
          event.preventDefault();
          if (busy || current.canAdvance === false) return;
          if (index + 1 < steps.length) onStepChange(steps[index + 1].id);
          else onFinish();
        }}
      >
        {steps.map((step) => (
          <fieldset
            key={step.id}
            hidden={step.id !== activeId}
            disabled={step.id !== activeId || busy}
            aria-label={step.label}
          >
            {step.content}
          </fieldset>
        ))}
        {error && <div role="alert">{error}</div>}
        <div className="uld-workflow-actions">
          {index > 0 && (
            <Button type="button" busy={busy} onClick={() => onStepChange(steps[index - 1].id)}>
              {labels?.back ?? 'Back'}
            </Button>
          )}
          <Button type="submit" busy={busy} disabled={current.canAdvance === false}>
            {index === steps.length - 1 ? (labels?.finish ?? 'Finish') : (labels?.next ?? 'Next')}
          </Button>
        </div>
      </form>
    </section>
  );
}
