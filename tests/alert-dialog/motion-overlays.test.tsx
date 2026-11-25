import { afterEach, beforeAll, expect, test, vi } from 'vitest';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { AlertDialog } from '../../packages/web/src/motion';

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

test('confirmation keeps dismissal and destructive decisions separate', () => {
  const cancel = vi.fn();
  const confirm = vi.fn();
  render(
    <AlertDialog
      title="Remove itinerary?"
      description="This clears the saved route."
      cancelLabel="Keep route"
      confirmLabel="Remove"
      onCancel={cancel}
      onConfirm={confirm}
    />,
  );
  const dialog = screen.getByRole('alertdialog', { name: 'Remove itinerary?' });
  expect(document.getElementById(dialog.getAttribute('aria-describedby')!)?.textContent).toBe(
    'This clears the saved route.',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Keep route' }));
  expect(confirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
  expect(confirm).toHaveBeenCalledOnce();
  expect(cancel).toHaveBeenCalledOnce();
});
