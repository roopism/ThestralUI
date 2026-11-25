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
