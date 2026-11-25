import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

import { afterEach, expect, test, vi } from 'vitest';

import { NotificationCenter, SettingsPanel } from '../packages/web/src/workflows';

afterEach(cleanup);

test('notification actions target unread IDs and settings convey restrictions and descriptions', () => {
  const read = vi.fn(),
    all = vi.fn(),
    update = vi.fn();
  render(
    <>
      <NotificationCenter
        label="Updates"
        items={[
          { id: 'a', title: 'First', read: true },
          { id: 'b', title: 'Second', read: false },
        ]}
        onRead={read}
        onReadAll={all}
      />
      <SettingsPanel
        label="Workspace settings"
        groups={[
          {
            id: 'group',
            label: 'Delivery',
            settings: [
              {
                id: 'daily',
                label: 'Daily digest',
                description: 'One email per day',
                enabled: true,
              },
              { id: 'billing', label: 'Billing alerts', enabled: false, disabled: true },
            ],
          },
        ]}
        onChange={update}
      />
    </>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Mark Second as read' }));
  expect(read).toHaveBeenCalledWith('b');
  fireEvent.click(screen.getByRole('button', { name: 'Mark all as read' }));
  expect(all).toHaveBeenCalledWith(['b']);
  const group = screen.getByRole('group', { name: 'Delivery' });
  const daily = within(group).getByRole('switch', { name: 'Daily digest' });
  expect(daily.getAttribute('aria-describedby')).toBe(screen.getByText('One email per day').id);
  fireEvent.click(daily);
  expect(update).toHaveBeenCalledWith('daily', false);
  expect(
    (screen.getByRole('switch', { name: 'Billing alerts' }) as HTMLInputElement).disabled,
  ).toBe(true);
});

const deliveryGroups = [
  {
    id: 'delivery',
    label: 'Delivery',
    description: 'Applies to every workspace member',
    settings: [
      { id: 'daily', label: 'Daily digest', enabled: false },
      { id: 'billing', label: 'Billing alerts', enabled: true, disabled: true },
    ],
  },
  { id: 'unused', label: 'Unused', settings: [] },
];

test('settings groups name their switches, describe the group and omit groups without settings', () => {
  const update = vi.fn();
  render(<SettingsPanel label="Workspace settings" groups={deliveryGroups} onChange={update} />);
  const panel = screen.getByRole('region', { name: 'Workspace settings' });
  expect(within(panel).getByRole('heading', { name: 'Workspace settings' })).toBeTruthy();
  expect(within(panel).getAllByRole('group')).toHaveLength(1);
  const group = screen.getByRole('group', { name: 'Delivery' });
  expect(group.getAttribute('aria-describedby')).toBe(screen.getByText('Applies to every workspace member').id);
  expect(screen.queryByRole('group', { name: 'Unused' })).toBeNull();
  const daily = within(group).getByRole('switch', { name: 'Daily digest' }) as HTMLInputElement;
  expect(daily.checked).toBe(false);
  expect(daily.hasAttribute('aria-describedby')).toBe(false);
  fireEvent.click(screen.getByText('Daily digest'));
  expect(update).toHaveBeenCalledWith('daily', true);
  // The owner keeps the value: the switch shows the supplied state until the owner changes it.
  expect(daily.checked).toBe(false);
});

test('a restricted setting keeps its value and name but ignores activation', () => {
  const update = vi.fn();
  render(<SettingsPanel label="Workspace settings" groups={deliveryGroups} onChange={update} />);
  const billing = screen.getByRole('switch', { name: 'Billing alerts' }) as HTMLInputElement;
  expect(billing.disabled).toBe(true);
  expect(billing.checked).toBe(true);
  fireEvent.click(screen.getByText('Billing alerts'));
  expect(update).not.toHaveBeenCalled();
  expect(billing.checked).toBe(true);
});

test('availability and empty states replace the groups with an announced message', () => {
  const retry = vi.fn();
  const view = render(
    <SettingsPanel
      label="Workspace settings"
      groups={deliveryGroups}
      onChange={vi.fn()}
      availability={{ kind: 'loading', message: 'Loading settings' }}
    />,
  );
  expect(screen.getByRole('status').textContent).toBe('Loading settings');
  expect(screen.queryByRole('switch')).toBeNull();
  view.rerender(
    <SettingsPanel
      label="Workspace settings"
      groups={deliveryGroups}
      onChange={vi.fn()}
      availability={{ kind: 'error', message: 'Settings could not load', retryLabel: 'Try again', onRetry: retry }}
    />,
  );
  expect(screen.getByRole('alert').textContent).toBe('Settings could not load');
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(retry).toHaveBeenCalledTimes(1);
  view.rerender(
    <SettingsPanel
      label="Workspace settings"
      groups={[{ id: 'none', label: 'None', settings: [] }]}
      onChange={vi.fn()}
      empty="Nothing to configure"
    />,
  );
  expect(screen.getByRole('status').textContent).toBe('Nothing to configure');
  expect(screen.queryByRole('group')).toBeNull();
});
