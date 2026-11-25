import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { afterEach, expect, test, vi } from 'vitest';

import { PasswordField } from '../../packages/web/src/entry-fields';

afterEach(cleanup);

test('revealing a password keeps its value, label and form submission behavior', () => {
  const submit = vi.fn();
  render(
    <form onSubmit={submit}>
      <PasswordField
        label="Password"
        revealLabel="Show password"
        concealLabel="Hide password"
        name="secret"
        defaultValue="example"
      />
    </form>,
  );
  const field = screen.getByLabelText<HTMLInputElement>('Password');
  expect(field.type).toBe('password');
  fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
  expect(field.type).toBe('text');
  expect(field.value).toBe('example');
  fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
  expect(field.type).toBe('password');
  expect(submit).not.toHaveBeenCalled();
});
