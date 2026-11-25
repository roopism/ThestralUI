import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { afterEach, expect, test } from 'vitest';

import { CodeField } from '../../packages/web/src/entry-fields';

afterEach(cleanup);

test('a code uses a single editable value with browser autofill and preserves leading zeros', () => {
  render(
    <form>
      <CodeField label="PIN" name="pin" digits={4} required />
    </form>,
  );
  const field = screen.getByRole<HTMLInputElement>('textbox', { name: 'PIN' });
  expect(field.autocomplete).toBe('one-time-code');
  expect(field.maxLength).toBe(4);
  fireEvent.change(field, { target: { value: '0017' } });
  expect(new FormData(field.form!).get('pin')).toBe('0017');
  expect(field.validity.valid).toBe(true);
  fireEvent.change(field, { target: { value: '00x7' } });
  expect(field.validity.patternMismatch).toBe(true);
});
