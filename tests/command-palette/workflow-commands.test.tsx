import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { afterEach, expect, test, vi } from 'vitest';

import { CommandPalette } from '../../packages/web/src/workflows';

afterEach(cleanup);

test('searches labels and keywords, skips disabled commands and respects composing text', () => {
  // Native modal focus and Escape are exercised by the browser contract.
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = true;
      },
    },
    close: {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = false;
      },
    },
  });
  const choose = vi.fn(),
    dismiss = vi.fn();
  render(
    <CommandPalette
      label="Commands"
      onDismiss={dismiss}
      onChoose={choose}
      commands={[
        { id: 'restricted', label: 'Open restricted', disabled: true },
        { id: 'jobs', label: 'Open positions', keywords: ['recruit'] },
        { id: 'profile', label: 'Profile' },
      ]}
    />,
  );
  const input = screen.getByRole('combobox');
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(choose).toHaveBeenCalledWith('profile');
  fireEvent.change(input, { target: { value: 'recruit' } });
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
  expect(choose).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(choose).toHaveBeenLastCalledWith('jobs');
  fireEvent.change(input, { target: { value: 'missing' } });
  expect(screen.getByText('No matching commands')).toBeTruthy();
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(choose).toHaveBeenCalledTimes(2);
});

test('the command palette uses its locale for defaults and falls back on malformed tags', async () => {
  const options = { commands: [], label: 'Actions', onDismiss: vi.fn(), onChoose: vi.fn() };
  const { rerender } = render(<CommandPalette {...options} locale="ar" labels={{ close: 'Dismiss actions' }} />);
  expect(await screen.findByRole('combobox', { name: 'البحث في الأوامر' })).toBeTruthy();
  expect(screen.getByRole('status').textContent).toBe('لا توجد أوامر مطابقة');
  expect(screen.getByRole('button', { name: 'Dismiss actions' })).toBeTruthy();
  rerender(<CommandPalette {...options} locale="en_US" />);
  fireEvent.change(screen.getByRole('combobox', { name: 'Search commands' }), { target: { value: 'ANY' } });
  expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
  rerender(<CommandPalette {...options} locale="tr" labels={{ empty: 'No actions here' }} />);
  expect(screen.getByRole('combobox', { name: 'Search commands' })).toBeTruthy();
  expect(screen.getByRole('status').textContent).toBe('No actions here');
});

test('command search accepts malformed locale tags and keeps supported case folding', () => {
  const options = { label: 'Actions', commands: [{ id: 'is', label: 'IŞIK' }], onDismiss: vi.fn(), onChoose: vi.fn() };
  const { rerender } = render(<CommandPalette {...options} locale="en_US" />);
  expect(screen.getByRole('option', { name: 'IŞIK' })).toBeTruthy();
  rerender(<CommandPalette {...options} locale="tr" />);
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ışık' } });
  expect(screen.getByRole('option', { name: 'IŞIK' })).toBeTruthy();
});

test('the server renders the palette labels before hydration in each independent locale', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const props = { commands: [], label: 'Actions', onDismiss: vi.fn(), onChoose: vi.fn() };
  expect(renderToStaticMarkup(<CommandPalette {...props} locale="ar" />)).toContain('aria-label="البحث في الأوامر"');
  expect(renderToStaticMarkup(<CommandPalette {...props} locale="en" />)).toContain('aria-label="Search commands"');
  const catalogs = import.meta.glob<Record<string, string>>('../../packages/messages/locales/*.json', { eager: true, import: 'default' });
  for (const [file, messages] of Object.entries(catalogs)) {
    const locale = file.split('/').pop()!.replace('.json', '');
    const document = new DOMParser().parseFromString(renderToStaticMarkup(<CommandPalette {...props} locale={locale} />), 'text/html');
    expect(document.querySelector('[role="combobox"]')?.getAttribute('aria-label'), locale).toBe(messages['commandPalette.search']);
    expect(document.querySelector('[role="status"]')?.textContent, locale).toBe(messages['commandPalette.empty']);
    expect(document.querySelector('button')?.textContent, locale).toBe(messages['commandPalette.close']);
  }
});
