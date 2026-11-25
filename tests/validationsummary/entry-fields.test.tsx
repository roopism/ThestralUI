import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { afterEach, expect, test } from 'vitest';

import { ValidationSummary } from '../../packages/web/src/entry-fields';

afterEach(cleanup);

test('a summary renders only current errors and links focus to the matching field', () => {
  const { rerender } = render(
    <>
      <input id="contact:email" />
      <ValidationSummary
        label="Review these fields"
        errors={[{ fieldId: 'contact:email', message: 'Enter an email' }]}
      />
    </>,
  );
  fireEvent.click(screen.getByRole('link', { name: 'Enter an email' }));
  expect(document.activeElement?.id).toBe('contact:email');
  rerender(<ValidationSummary label="Review these fields" errors={[]} />);
  expect(screen.queryByRole('alert')).toBeNull();
});
