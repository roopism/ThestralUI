import { type LabeledInput } from "../_shared/entry-fields/binding.js";
import { FormField } from "../labeled-field/binding.js";
/** A single focus stop lets the OS handle paste, autofill, text selection and IME. */
export function CodeField({
  label,
  hint,
  error,
  digits,
  autoComplete = 'one-time-code',
  ...input
}: Omit<LabeledInput, 'maxLength' | 'pattern' | 'inputMode'> & { digits: number }) {
  if (!Number.isSafeInteger(digits) || digits < 1)
    throw new RangeError('digits must be a positive integer');
  return (
    <FormField label={label} hint={hint} error={error} className="uld-code">
      <input
        {...input}
        type="text"
        autoComplete={autoComplete}
        inputMode="numeric"
        pattern={'[0-9]{' + digits + '}'}
        maxLength={digits}
      />
    </FormField>
  );
}
