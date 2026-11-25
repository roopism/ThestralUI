import type { Ref } from 'react';

interface TableFieldProps {
  mode: 'search' | 'edit';
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  controls?: string;
  disabled?: boolean;
  readOnly?: boolean;
  ref?: Ref<HTMLInputElement>;
}

/** Search and in-place edits retain native text selection, composition and form submission. */
export function TableField({ mode, label, value, onValueChange, controls, disabled, readOnly, ref }: TableFieldProps) {
  return <input ref={ref} type={mode === 'search' ? 'search' : 'text'}
    data-part={mode === 'search' ? 'search' : undefined} aria-label={label} aria-controls={controls}
    autoFocus={mode === 'edit'} disabled={disabled} readOnly={readOnly}
    value={value} onChange={event => onValueChange(event.currentTarget.value)} />;
}

interface SelectionCheckboxProps {
  label: string;
  checked: boolean | 'mixed';
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

/** The browser clears indeterminate on activation even when a controlled owner vetoes the change. */
export function SelectionCheckbox({ label, checked, disabled, onChange }: SelectionCheckboxProps) {
  const mixed = checked === 'mixed';
  return <label data-part="selector"><input type="checkbox" disabled={disabled}
    aria-label={label} aria-checked={mixed ? 'mixed' : undefined} checked={checked === true}
    ref={input => { if (input) input.indeterminate = mixed; }}
    onChange={event => {
      const input = event.currentTarget;
      input.indeterminate = mixed;
      onChange(input.checked);
    }} /></label>;
}
