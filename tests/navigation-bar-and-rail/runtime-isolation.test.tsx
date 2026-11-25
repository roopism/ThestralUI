import { afterEach, expect, test, vi } from 'vitest';

import { cleanup, render, screen, within } from '@testing-library/react';

import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';

import { AppNavigation } from '../../packages/web/src/workflows';

afterEach(cleanup);

test('invalid navigation destinations stay inert and never reach a custom router', () => {
  const router = vi.fn();
  const label = '<untrusted label>';
  const items = [
    'javascript:unused',
    'data:text/plain,test',
    'https://me:credential@example.test/path',
  ].map((href, i) => ({ href, label, id: String(i) }));
  const markup = renderToStaticMarkup(<AppNavigation items={items} renderLink={router} />);
  expect(router).not.toHaveBeenCalled();
  expect(markup).toContain('&lt;untrusted label&gt;');
  expect(markup).not.toContain('href=');
});

const destinations = [
  { id: 'inbox', href: '/inbox', label: 'Inbox', icon: <svg data-testid="inbox-icon" /> },
  { id: 'reports', href: '/reports', label: 'Reports' },
  { id: 'billing', href: '/billing', label: 'Billing', disabled: true },
  { id: 'help', href: 'mailto:help@example.test', label: 'Help' },
];

test('destinations keep their order in one list and only the current one is marked as the page', () => {
  render(
    <nav aria-label="Workspace">
      <AppNavigation items={destinations} currentId="reports" />
    </nav>,
  );
  const list = within(screen.getByRole('navigation', { name: 'Workspace' })).getByRole('list');
  expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
    'Inbox',
    'Reports',
    'Billing',
    'Help',
  ]);
  expect(screen.getByRole('link', { name: 'Reports' }).getAttribute('aria-current')).toBe('page');
  expect(screen.getAllByRole('link').filter((link) => link.hasAttribute('aria-current'))).toHaveLength(1);
  expect(screen.getByRole('link', { name: 'Help' }).getAttribute('href')).toBe('mailto:help@example.test');
});

test('decorative icons stay out of the name and unavailable destinations render as inert text', () => {
  render(<AppNavigation items={destinations} currentId="billing" />);
  const inbox = screen.getByRole('link', { name: 'Inbox' });
  expect(screen.getByTestId('inbox-icon').parentElement!.getAttribute('aria-hidden')).toBe('true');
  expect(inbox.contains(screen.getByTestId('inbox-icon'))).toBe(true);
  expect(screen.queryByRole('link', { name: 'Billing' })).toBeNull();
  const billing = screen.getByText('Billing');
  expect(billing.closest('a')).toBeNull();
  expect(billing.hasAttribute('aria-current')).toBe(false);
  expect(screen.getAllByRole('link')).toHaveLength(3);
});

test('a custom router receives the safe destination, current marker and content for valid links only', () => {
  const router = vi.fn((item: { id: string }, props: { href: string; 'aria-current'?: 'page'; children: ReactNode }) => (
    <a data-router={item.id} {...props} />
  ));
  render(<AppNavigation items={destinations} currentId="inbox" renderLink={router} />);
  expect(router.mock.calls.map(([item]) => item.id)).toEqual(['inbox', 'reports', 'help']);
  const [, props] = router.mock.calls[0];
  expect(props.href).toBe('/inbox');
  expect(props['aria-current']).toBe('page');
  expect(router.mock.calls[1][1]['aria-current']).toBeUndefined();
  expect(screen.getByRole('link', { name: 'Inbox' }).getAttribute('data-router')).toBe('inbox');
});
