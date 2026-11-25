import { afterEach, beforeAll, expect, test, vi } from 'vitest';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { AlertDialog, Drawer, GestureSheet } from '../packages/web/src/motion';

beforeAll(() => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = true;
      },
    },
    close: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = false;
      },
    },
  });
});

afterEach(cleanup);

test.each([
  { name: 'GestureSheet', Panel: GestureSheet },
  { name: 'Drawer', Panel: Drawer },
])('$name provides a named modal, close button, and Escape', ({ Panel }) => {
  const dismiss = vi.fn();
  render(
    <Panel title="Reading list" closeLabel="Close panel" onDismiss={dismiss}>
      Saved items
    </Panel>,
  );
  const panel = screen.getByRole('dialog', { name: 'Reading list' });
  expect(panel.textContent).toContain('Saved items');
  fireEvent.click(screen.getByRole('button', { name: 'Close panel' }));
  fireEvent(panel, new Event('cancel', { cancelable: true }));
  expect(dismiss).toHaveBeenCalledTimes(2);
});

test('nested cancellation dismisses the active alert and leaves its parent mounted', () => {
  const closePanel = vi.fn();
  const closeAlert = vi.fn();
  render(
    <GestureSheet title="Saved titles" closeLabel="Close" onDismiss={closePanel}>
      <AlertDialog
        title="Delete title?"
        description="This removes the entry."
        cancelLabel="Keep"
        confirmLabel="Delete"
        onCancel={closeAlert}
        onConfirm={() => {}}
      />
    </GestureSheet>,
  );
  fireEvent(screen.getByRole('alertdialog'), new Event('cancel', { cancelable: true }));
  expect(closeAlert).toHaveBeenCalledOnce();
  expect(closePanel).not.toHaveBeenCalled();
});
