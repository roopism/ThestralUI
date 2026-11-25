'use client';
import {
  Button,
  FieldError,
  Group,
  Input,
  Label,
  NumberField as AriaNumberField,
  Text,
  type NumberFieldProps as AriaNumberFieldProps,
  type ValidationResult,
} from 'react-aria-components';
import type { ReactNode, Ref } from 'react';

export interface NumberFieldProps extends AriaNumberFieldProps {
  ref?: Ref<HTMLDivElement>;
  /** Visible label. Use aria-label or aria-labelledby when the label is elsewhere. */
  label?: ReactNode;
  /** Help text exposed as the field description. */
  description?: ReactNode;
  /** Message shown while the field is invalid. A function receives the current validation result. */
  errorMessage?: ReactNode | ((validation: ValidationResult) => ReactNode);
  /** Placeholder for the default input. */
  placeholder?: string;
  /** Hide the default decrement and increment buttons. Arrow keys still step the value. */
  hideStepper?: boolean;
}

/**
 * A locale-aware number entry. Without children it renders a label, the input
 * between localized decrement and increment buttons, a description and an
 * error message; omitted slots collapse. Composed children replace the default.
 */
export function NumberField({
  label,
  description,
  errorMessage,
  placeholder,
  hideStepper,
  children,
  ...props
}: NumberFieldProps) {
  return (
    <AriaNumberField {...props}>
      {(state) =>
        children !== undefined ? (
          typeof children === 'function' ? children(state) : children
        ) : (
          <>
            {label != null && <Label>{label}</Label>}
            <Group>
              {!hideStepper && (
                <Button slot="decrement" className="uld-button" data-tone="secondary">
                  <span aria-hidden>−</span>
                </Button>
              )}
              <Input placeholder={placeholder} />
              {!hideStepper && (
                <Button slot="increment" className="uld-button" data-tone="secondary">
                  <span aria-hidden>+</span>
                </Button>
              )}
            </Group>
            {description != null && <Text slot="description">{description}</Text>}
            {errorMessage != null && <FieldError>{errorMessage}</FieldError>}
          </>
        )
      }
    </AriaNumberField>
  );
}
