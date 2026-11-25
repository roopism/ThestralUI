import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { afterEach, expect, test, vi } from 'vitest';

import { NotificationCenter } from '../../packages/web/src/workflows';

afterEach(cleanup);

test('loading, permission denial, retrieval failure and empty notifications are distinct', () => {
  const retry = vi.fn();
  const props = { label: 'Inbox', items: [], onRead: vi.fn() };
  const { rerender } = render(
    <NotificationCenter {...props} availability={{ kind: 'loading', message: 'Loading inbox' }} />,
  );
  expect(screen.getByRole('status').textContent).toBe('Loading inbox');
  rerender(
    <NotificationCenter {...props} availability={{ kind: 'denied', message: 'Request access' }} />,
  );
  expect(screen.getByText('Request access')).toBeTruthy();
  rerender(
    <NotificationCenter
      {...props}
      availability={{
        kind: 'error',
        message: 'Offline',
        retryLabel: 'Reload inbox',
        onRetry: retry,
      }}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Reload inbox' }));
  expect(retry).toHaveBeenCalledOnce();
  rerender(<NotificationCenter {...props} />);
  expect(screen.getByText('No notifications')).toBeTruthy();
});

test('reading an item focuses the next unread action and reading all focuses the heading', () => {
  const items = [{ id: 'a', title: 'First', read: false }, { id: 'b', title: 'Second', read: false }];
  const props = { items, label: 'Inbox', onRead: vi.fn(), onReadAll: vi.fn() };
  const { rerender } = render(<NotificationCenter {...props} />);
  const first = screen.getByRole('button', { name: 'Mark First as read' });
  first.focus();
  fireEvent.click(first);
  expect(props.onRead).toHaveBeenCalledWith('a');
  rerender(<NotificationCenter {...props} items={[{ ...items[0], read: true }, items[1]]} />);
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Mark Second as read' }));
  const all = screen.getByRole('button', { name: 'Mark all as read' });
  all.focus();
  fireEvent.click(all);
  expect(props.onReadAll).toHaveBeenCalledWith(['b']);
  rerender(<NotificationCenter {...props} items={items.map(item => ({ ...item, read: true }))} />);
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Inbox' }));

  // A button supplied by the caller as detail owns its own focus behavior.
  const detail = <button type="button">Show details</button>;
  rerender(<NotificationCenter {...props} items={[{ ...items[0], read: true, detail }, items[1]]} />);
  const externalAction = screen.getByRole('button', { name: 'Show details' });
  externalAction.focus();
  fireEvent.click(externalAction);
  rerender(<NotificationCenter {...props} items={[{ ...items[0], read: true }, items[1]]} />);
  expect(document.activeElement).toBe(document.body);
});
