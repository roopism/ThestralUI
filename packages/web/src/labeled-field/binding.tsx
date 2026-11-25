import { type ReactElement, type HTMLAttributes, useId, cloneElement } from "react";
export interface FormFieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: ReactElement<
    HTMLAttributes<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
    'input' | 'textarea' | 'select'
  >;
  className?: string;
}
export function FormField({
  label,
  hint,
  error,
  children,
  className,
}: FormFieldProps) {
  const generated = useId();
  const id = children.props.id || generated;
  const hintId = id + '-hint';
  const errorId = id + '-error';
  const describedBy =
    [children.props['aria-describedby'], hint && hintId, error && errorId]
      .filter(Boolean)
      .join(' ') || undefined;
  const control = cloneElement(children, {
    id,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : children.props['aria-invalid'],
  });
  return (
    <div className={['uld-field', className].filter(Boolean).join(' ')}>
      <label htmlFor={id}>
        {label}
        {control}
      </label>
      {hint && <small id={hintId}>{hint}</small>}
      {error && (
        <small id={errorId} role="alert">
          {error}
        </small>
      )}
    </div>
  );
}
