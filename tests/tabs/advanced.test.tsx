import { act, render, screen, cleanup, fireEvent } from '@testing-library/react';

import { afterEach, beforeEach, test, expect, vi } from 'vitest';
import type { ComponentProps } from 'react';

import { I18nProvider, Tab, TabList, TabPanel, Tabs } from '../../packages/web/src/navigation';

afterEach(cleanup);

test('tabs expose the active panel and allow owner-controlled selection', () => {
  function Fixture({ selected }: { selected: string }) {
    return (
      <Tabs selectedKey={selected}>
        <TabList aria-label="Settings">
          <Tab id="profile">Profile</Tab>
          <Tab id="contact">Contact</Tab>
        </TabList>
        <TabPanel id="profile">First panel</TabPanel>
        <TabPanel id="contact">Second panel</TabPanel>
      </Tabs>
    );
  }
  const view = render(<Fixture selected="profile" />);
  expect(screen.getByRole('tabpanel').textContent).toEqual('First panel');
  view.rerender(<Fixture selected="contact" />);
  expect(screen.getByRole('tab', { name: 'Contact' }).getAttribute('aria-selected')).toBe('true');
  expect(screen.getByRole('tabpanel').textContent).toEqual('Second panel');
});

// jsdom has no CSS object; the collection keys in these fixtures need no escaping.
beforeEach(() => vi.stubGlobal('CSS', { escape: (value: string) => value, supports: () => false }));
afterEach(() => vi.unstubAllGlobals());

function Workspace(props: Omit<ComponentProps<typeof Tabs>, 'children'>) {
  return (
    <Tabs {...props}>
      <TabList aria-label="Workspace">
        <Tab id="profile">Profile</Tab>
        <Tab id="billing">Billing</Tab>
        <Tab id="archive">Archive</Tab>
      </TabList>
      <TabPanel id="profile">Profile details</TabPanel>
      <TabPanel id="billing">
        Billing details <a href="#invoices">Invoices</a>
      </TabPanel>
      <TabPanel id="archive">Archive details</TabPanel>
    </Tabs>
  );
}

const tab = (name: string) => screen.getByRole('tab', { name });
const press = (key: string) => fireEvent.keyDown(document.activeElement!, { key });
const selected = () => screen.getAllByRole('tab').filter((item) => item.getAttribute('aria-selected') === 'true');

test('only the selected tab is a tab stop and its panel is labelled by that tab', () => {
  render(<Workspace defaultSelectedKey="billing" />);
  expect(screen.getByRole('tablist', { name: 'Workspace' }).getAttribute('aria-orientation')).toBe('horizontal');
  expect(screen.getAllByRole('tab').map((item) => item.tabIndex)).toEqual([-1, 0, -1]);
  const panel = screen.getByRole('tabpanel');
  expect(panel.getAttribute('aria-labelledby')).toBe(tab('Billing').id);
  expect(tab('Billing').getAttribute('aria-controls')).toBe(panel.id);
  expect(screen.queryByText('Profile details')).toBeNull();
});

test('automatic activation selects the focused tab and wraps from the last tab to the first', () => {
  const onSelectionChange = vi.fn();
  render(<Workspace onSelectionChange={onSelectionChange} />);
  act(() => tab('Profile').focus());
  press('ArrowRight');
  expect(document.activeElement).toBe(tab('Billing'));
  expect(selected()).toEqual([tab('Billing')]);
  expect(screen.getByRole('tabpanel').textContent).toContain('Billing details');
  press('End');
  expect(selected()).toEqual([tab('Archive')]);
  press('ArrowRight');
  expect(selected()).toEqual([tab('Profile')]);
  press('ArrowLeft');
  expect(selected()).toEqual([tab('Archive')]);
  press('Home');
  expect(selected()).toEqual([tab('Profile')]);
  // The first call reports the initial selection of the first available tab.
  expect(onSelectionChange.mock.calls.map(([key]) => key)).toEqual(['profile', 'billing', 'archive', 'profile', 'archive', 'profile']);
});

test('manual activation moves focus without changing the panel until Enter or Space', () => {
  render(<Workspace keyboardActivation="manual" />);
  act(() => tab('Profile').focus());
  press('ArrowRight');
  expect(document.activeElement).toBe(tab('Billing'));
  expect(selected()).toEqual([tab('Profile')]);
  expect(screen.getByRole('tabpanel').textContent).toBe('Profile details');
  press('Enter');
  expect(selected()).toEqual([tab('Billing')]);
  press('ArrowRight');
  press(' ');
  expect(selected()).toEqual([tab('Archive')]);
});

test('right-to-left reading order reverses horizontal arrow keys', () => {
  render(
    <I18nProvider locale="ar">
      <div dir="rtl">
        <Workspace />
      </div>
    </I18nProvider>,
  );
  act(() => tab('Profile').focus());
  press('ArrowLeft');
  expect(selected()).toEqual([tab('Billing')]);
  press('ArrowRight');
  expect(selected()).toEqual([tab('Profile')]);
});

test('vertical tabs add the up and down arrows while horizontal tabs ignore them', () => {
  const view = render(<Workspace />);
  act(() => tab('Profile').focus());
  press('ArrowDown');
  expect(selected()).toEqual([tab('Profile')]);
  view.unmount();
  render(<Workspace orientation="vertical" />);
  expect(screen.getByRole('tablist').getAttribute('aria-orientation')).toBe('vertical');
  act(() => tab('Profile').focus());
  press('ArrowDown');
  expect(selected()).toEqual([tab('Billing')]);
  press('ArrowUp');
  expect(selected()).toEqual([tab('Profile')]);
  press('ArrowUp');
  expect(selected()).toEqual([tab('Archive')]);
});

test('disabled destinations are skipped by the keyboard and cannot be chosen by pointer', () => {
  const onSelectionChange = vi.fn();
  render(<Workspace disabledKeys={['billing']} onSelectionChange={onSelectionChange} />);
  expect(tab('Billing').getAttribute('aria-disabled')).toBe('true');
  act(() => tab('Profile').focus());
  press('ArrowRight');
  expect(selected()).toEqual([tab('Archive')]);
  fireEvent.pointerDown(tab('Billing'), { pointerType: 'mouse', button: 0 });
  fireEvent.pointerUp(tab('Billing'), { pointerType: 'mouse', button: 0 });
  fireEvent.click(tab('Billing'));
  expect(selected()).toEqual([tab('Archive')]);
  expect(onSelectionChange.mock.calls.map(([key]) => key)).toEqual(['profile', 'archive']);
});

test('a disabled tab set exposes every tab as unavailable', () => {
  render(<Workspace isDisabled />);
  expect(screen.getAllByRole('tab').map((item) => item.getAttribute('aria-disabled'))).toEqual(['true', 'true', 'true']);
});

test('a controlled set renders the owner key and reports requests without changing itself', () => {
  const onSelectionChange = vi.fn();
  const view = render(<Workspace selectedKey="profile" onSelectionChange={onSelectionChange} />);
  fireEvent.pointerDown(tab('Archive'), { pointerType: 'mouse', button: 0 });
  fireEvent.pointerUp(tab('Archive'), { pointerType: 'mouse', button: 0 });
  fireEvent.click(tab('Archive'));
  expect(onSelectionChange).toHaveBeenLastCalledWith('archive');
  expect(selected()).toEqual([tab('Profile')]);
  view.rerender(<Workspace selectedKey="archive" onSelectionChange={onSelectionChange} />);
  expect(selected()).toEqual([tab('Archive')]);
  expect(screen.getByRole('tabpanel').textContent).toBe('Archive details');
});
