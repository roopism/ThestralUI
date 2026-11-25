import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { afterEach, expect, test, vi } from 'vitest';

import { EmptyState } from '../../packages/web/src/patterns';

afterEach(cleanup);

test('empty states accept product actions and keep heading levels in the surrounding outline', () => {
  const act = vi.fn();
  render(
    <EmptyState
      title="No invoices"
      headingLevel={3}
      description="Create the first invoice."
      action={<button onClick={act}>Create invoice</button>}
    />,
  );
  expect(screen.getByRole('heading', { level: 3, name: 'No invoices' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Create invoice' }));
  expect(act).toHaveBeenCalledOnce();
});

test('optional slots collapse without leaving empty paragraphs or extra headings', () => {
  const { container } = render(<EmptyState title="No saved filters" />);
  const root = container.firstElementChild!;
  expect(root.className).toBe('uld-empty-state');
  expect(root.children).toHaveLength(1);
  expect(screen.getByRole('heading', { level: 2, name: 'No saved filters' })).toBeTruthy();
  expect(container.querySelector('p')).toBeNull();
});

test('reading order runs illustration, heading, description, then the action, and caller attributes are kept', () => {
  render(
    <EmptyState
      id="empty-invoices"
      className="page-empty"
      aria-live="off"
      title="No invoices"
      headingLevel={4}
      illustration={<svg aria-hidden="true" data-testid="art" />}
      description="Invoices you create appear here."
      action={<button type="button">Create invoice</button>}
    />,
  );
  const root = document.getElementById('empty-invoices')!;
  expect(root.className).toBe('uld-empty-state page-empty');
  const order = [...root.children].map((node) => node.tagName);
  expect(order).toEqual(['svg', 'H4', 'P', 'BUTTON']);
  expect(screen.getByTestId('art').getAttribute('aria-hidden')).toBe('true');
  expect(screen.queryByRole('status')).toBeNull();
});
