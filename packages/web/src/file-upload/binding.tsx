import { type LabeledInput } from "../_shared/entry-fields/binding.js";
import { FormField } from "../labeled-field/binding.js";
export function FileUpload({
  label,
  hint,
  error,
  ...input
}: Omit<LabeledInput, 'value' | 'defaultValue'>) {
  return (
    <FormField label={label} hint={hint} error={error}>
      <input {...input} type="file" />
    </FormField>
  );
}
