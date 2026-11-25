import { afterEach, expect, test } from 'vitest';

import { cleanup, render, screen } from '@testing-library/react';

import { Spinner } from '@ui-lazy-dev/ui-web/primitives';

afterEach(cleanup);

test('an indeterminate spinner is a named status and adds no tab stop', () => {
  render(<Spinner label="Loading audit trail" />);
  const status = screen.getByRole('status', { name: 'Loading audit trail' });
  expect(status.tabIndex).toBe(-1);
  expect(status.classList.contains('uld-spinner')).toBe(true);
});


test('without a label the ring is decorative inside an already named busy region', () => {
  const { container } = render(
    <section aria-label="Invoices" aria-busy="true">
      <Spinner />
      <p>Loading invoices</p>
    </section>,
  );
  const ring = container.querySelector('.uld-spinner')!;
  expect(ring.getAttribute('aria-hidden')).toBe('true');
  expect(ring.hasAttribute('role')).toBe(false);
  expect(ring.hasAttribute('aria-label')).toBe(false);
  expect(screen.queryByRole('status')).toBeNull();
  expect(screen.getByRole('region', { name: 'Invoices' }).getAttribute('aria-busy')).toBe('true');
});

test('adding a label turns the same ring into one named status', () => {
  const { rerender, container } = render(<Spinner />);
  const ring = container.querySelector('.uld-spinner')!;
  rerender(<Spinner label="Syncing ledger" />);
  const status = screen.getByRole('status', { name: 'Syncing ledger' });
  expect(status).toBe(ring);
  expect(status.hasAttribute('aria-hidden')).toBe(false);
  expect(screen.getAllByRole('status')).toHaveLength(1);
});

test('a decorative spinner inside a busy action leaves the action name unchanged', () => {
  render(
    <button type="button" aria-busy="true">
      <Spinner /> Saving
    </button>,
  );
  expect(screen.getByRole('button', { name: 'Saving' })).toBeTruthy();
  expect(screen.queryByRole('status')).toBeNull();
});
