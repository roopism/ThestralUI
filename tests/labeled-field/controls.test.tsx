import { afterEach, expect, test } from 'vitest';

import { cleanup, render, screen } from '@testing-library/react';

import { FormField } from '@ui-lazy-dev/ui-web';

afterEach(cleanup);

test('fields keep independent labels and compose help with existing descriptions and errors', () => {
  render(
    <>
      <p id="policy">Digits only</p>
      <FormField label="PIN" hint="Four digits" error="Enter four digits">
        <input id="pin" aria-describedby="policy" />
      </FormField>
      <FormField label="Confirm PIN">
        <input />
      </FormField>
    </>,
  );
  const field = screen.getByRole('textbox', { name: 'PIN' });
  expect(field.id).toBe('pin');
  expect(field.getAttribute('aria-invalid')).toBe('true');
  const descriptions = field
    .getAttribute('aria-describedby')!
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent);
  expect(descriptions).toEqual(['Digits only', 'Four digits', 'Enter four digits']);
  expect(screen.getByRole('alert').textContent).toBe('Enter four digits');
  expect(screen.getByRole('textbox', { name: 'Confirm PIN' }).id).not.toBe(field.id);
});
