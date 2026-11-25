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

  // The caller moves focus to its details panel as its own action disappears.
  const panel = <input aria-label="Detail note" />;
  const detail = <button type="button" onClick={() => screen.getByRole('textbox', { name: 'Detail note' }).focus()}>Show details</button>;
  function withPanel(showAction: boolean) {
    return <>{panel}<NotificationCenter {...props} items={[{ ...items[0], read: true, detail: showAction && detail }, items[1]]} /></>;
  }
  rerender(withPanel(true));
  const externalAction = screen.getByRole('button', { name: 'Show details' });
  externalAction.focus();
  fireEvent.click(externalAction);
  rerender(withPanel(false));
  const note = screen.getByRole('textbox', { name: 'Detail note' });
  expect(document.activeElement).toBe(note);
  expect(document.activeElement).not.toBe(screen.getByRole('heading', { name: 'Inbox' }));
  expect(document.activeElement).not.toBe(screen.getByRole('button', { name: 'Mark Second as read' }));

  // The caller then explicitly leaves the field. A later refresh must leave focus alone.
  fireEvent.pointerDown(document.body);
  note.blur();
  rerender(withPanel(false));
  expect(document.activeElement).toBe(document.body);
});


test('retrying unavailable notifications restores focus to the Inbox heading', () => {
  const onRetry = vi.fn();
  const props = { label: 'Inbox', items: [], onRead: vi.fn() };
  const { rerender } = render(<NotificationCenter {...props}
    availability={{ kind: 'error', message: 'Offline', retryLabel: 'Reload inbox', onRetry }} />);
  const retry = screen.getByRole('button', { name: 'Reload inbox' });
  retry.focus();
  fireEvent.click(retry);
  expect(onRetry).toHaveBeenCalledOnce();
  rerender(<NotificationCenter {...props} availability={{ kind: 'loading', message: 'Updating' }} />);
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Inbox' }));
});

test('a later notification refresh leaves focus alone after the user focuses another control', () => {
  const items = [{ id: 'a', title: 'First', read: false }, { id: 'b', title: 'Second', read: false }];
  const onRead = vi.fn();
  const inbox = (firstRead: boolean) => <>
    <button type="button">Outside the inbox</button>
    <NotificationCenter label="Inbox" items={[{ ...items[0], read: firstRead }, items[1]]} onRead={onRead} />
  </>;
  const { rerender } = render(inbox(false));
  const first = screen.getByRole('button', { name: 'Mark First as read' });
  first.focus();
  fireEvent.click(first);
  expect(onRead).toHaveBeenCalledWith('a');
  rerender(inbox(false));
  const outside = screen.getByRole('button', { name: 'Outside the inbox' });
  outside.focus();
  expect(document.activeElement).toBe(outside);
  outside.blur();
  rerender(inbox(true));
  expect(document.activeElement).toBe(document.body);
  expect(screen.getByRole('button', { name: 'Mark Second as read' })).toBeTruthy();
});
