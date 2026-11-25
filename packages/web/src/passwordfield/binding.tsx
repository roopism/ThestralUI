'use client';
import { type LabeledInput } from "../_shared/entry-fields/binding.js";
import { useId, useState } from "react";
import { FormField } from "../labeled-field/binding.js";
import { Button } from "../button/binding.js";
export function PasswordField({
  label,
  hint,
  error,
  revealLabel,
  concealLabel,
  id,
  disabled,
  ...input
}: LabeledInput & { revealLabel: string; concealLabel: string }) {
  const generatedId = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div className="uld-password">
      <FormField label={label} hint={hint} error={error}>
        <input
          {...input}
          id={id ?? generatedId}
          disabled={disabled}
          type={visible ? 'text' : 'password'}
        />
      </FormField>
      <Button
        tone="secondary"
        disabled={disabled}
        aria-controls={id ?? generatedId}
        onClick={() => setVisible((value) => !value)}
      >
        {visible ? concealLabel : revealLabel}
      </Button>
    </div>
  );
}
