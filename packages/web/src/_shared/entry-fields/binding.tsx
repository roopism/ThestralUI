import { type FormFieldProps } from "../../labeled-field/binding.js";
import { type ComponentProps } from "react";
export type LabeledInput = Pick<FormFieldProps, 'label' | 'hint' | 'error'> &
  Omit<ComponentProps<'input'>, 'type' | 'children'>;
