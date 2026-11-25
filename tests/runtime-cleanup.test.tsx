import { fireEvent, render, screen, cleanup } from '@testing-library/react';

import { afterEach, expect, test, vi } from 'vitest';

import { Trigger, TooltipTrigger, Tooltip, Modal, ModalOverlay, DialogTrigger, OverlayDialog } from '../packages/web/src/navigation';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('unmount cancels a pending tooltip and restores document scroll after a modal', () => {
  vi.useFakeTimers();
  vi.stubGlobal('CSS', { escape: (value: string) => value, supports: () => false });
  const frame = render(
    <TooltipTrigger delay={900}>
      <Trigger>Details</Trigger>
      <Tooltip>Restricted field</Tooltip>
    </TooltipTrigger>,
  );
  fireEvent.pointerEnter(screen.getByRole('button'), { pointerType: 'mouse' });
  frame.unmount();
  vi.advanceTimersByTime(1200);
  expect(screen.queryByRole('tooltip')).toBeNull();
  const root = document.documentElement;
  const previous = root.style.overflow;
  const view = render(
    <DialogTrigger defaultOpen>
      <Trigger>Confirm</Trigger>
      <ModalOverlay>
        <Modal>
          <OverlayDialog aria-label="Confirm">Approval</OverlayDialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>,
  );
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(root.style.overflow).toBe('hidden');
  view.unmount();
  expect(root.style.overflow).toBe(previous);
  expect(document.querySelector('[data-overlay-container]')).toBeNull();
});
