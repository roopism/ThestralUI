'use client';
import { useId } from "react";
export type FieldIssue = { fieldId: string; message: string };
export function ValidationSummary({
  label,
  errors,
}: {
  label: string;
  errors: readonly FieldIssue[];
}) {
  const heading = useId();
  if (!errors.length) return null;
  return (
    <section role="alert" aria-labelledby={heading} className="uld-validation">
      <h2 id={heading}>{label}</h2>
      <ul>
        {errors.map(({ fieldId, message }, i) => (
          <li key={fieldId + '-' + i}>
            <a
              href={'#' + encodeURIComponent(fieldId)}
              onClick={(event) => {
                const target = event.currentTarget.ownerDocument.getElementById(fieldId);
                if (target) {
                  event.preventDefault();
                  target.focus();
                }
              }}
            >
              {message}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
