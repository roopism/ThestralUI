import { afterEach, beforeAll, expect, test } from 'vitest';

import { act, cleanup, render, screen } from '@testing-library/react';

import { createToastQueue, ToastRegion } from '../../packages/web/src/motion';

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

test('bounded toast region shows the latest message and retains prior notifications', () => {
  const queue = createToastQueue(1);
  render(<ToastRegion queue={queue} label="Updates" dismissLabel="Dismiss notification" />);
  let latest = '';
  act(() => {
    queue.add({ title: 'Route saved', description: 'Available offline' });
    latest = queue.add({ title: 'Notes updated' });
  });
  expect(screen.getByText('Notes updated')).toBeTruthy();
  expect(screen.queryByText('Available offline')).toBeNull();
  act(() => queue.close(latest));
  expect(screen.getByText('Available offline')).toBeTruthy();
  expect(screen.queryByText('Notes updated')).toBeNull();
});
