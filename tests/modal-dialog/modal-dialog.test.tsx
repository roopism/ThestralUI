import { Fragment, createRef, type ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, test, vi } from 'vitest';
import { Dialog, DialogActions, DialogBody, DialogHeading, useDialog, type UseDialogOptions } from '@ui-lazy-dev/ui-web/modal-dialog';

afterEach(cleanup);

function CustomDialog(options: UseDialogOptions) {
  const behavior = useDialog(options);
  return <dialog {...behavior}><h2 id="custom-name">Print preview</h2></dialog>;
}

test('the public hook supplies native dismissal, accessible naming and a ref without presentation', () => {
  const ref = createRef<HTMLDialogElement>();
  const onDismiss = vi.fn();
  render(<CustomDialog ref={ref} open={false} labelledBy="custom-name" describedBy="detail" role="alertdialog"
    dismissOnBackdrop onDismiss={onDismiss} lang="fr" data-testid="custom" />);
  const dialog = screen.getByTestId('custom');
  expect(ref.current).toBe(dialog);
  expect(dialog).toBeInstanceOf(HTMLDialogElement);
  expect(dialog.getAttribute('aria-labelledby')).toBe('custom-name');
  expect(dialog.getAttribute('aria-describedby')).toBe('detail');
  expect(dialog.getAttribute('role')).toBe('alertdialog');
  expect(dialog.getAttribute('closedby')).toBe('any');
  expect(dialog.getAttribute('lang')).toBe('fr');
  expect(dialog.hasAttribute('class')).toBe(false);
  const request = new Event('cancel', { cancelable: true });
  fireEvent(dialog, request);
  expect(request.defaultPrevented).toBe(true);
  expect(onDismiss).toHaveBeenCalledTimes(1);
});

test('server output preserves the named dialog and its parts without opening it before hydration', () => {
  const host = document.createElement('div');
  host.innerHTML = renderToStaticMarkup(<Dialog labelledBy="review" onDismiss={() => {}} unstyled className="consumer">
    <DialogHeading id="review">Review changes</DialogHeading>
    <DialogBody>Draft is ready.</DialogBody>
    <DialogActions><button>Close</button></DialogActions>
  </Dialog>);
  const dialog = host.querySelector('dialog')!;
  expect(dialog.open).toBe(false);
  expect(dialog.className).toBe('uld-dialog-root consumer');
  expect(dialog.getAttribute('aria-labelledby')).toBe('review');
  expect([...host.querySelectorAll('[data-part]')].map(node => node.getAttribute('data-part'))).toEqual(['root', 'heading', 'body', 'actions']);
  expect(host.querySelector('h2')?.textContent).toBe('Review changes');
  expect(host.querySelector('button')?.textContent).toBe('Close');
});

test('optional actions disappear for empty slots, arrays and nested fragments', () => {
  const empty: ReactNode[] = [null, false, '', [], [false, null], <Fragment><Fragment>{false}</Fragment>{[]}</Fragment>];
  for (const children of empty) expect(renderToStaticMarkup(<DialogActions>{children}</DialogActions>)).toBe('');
  const actions = renderToStaticMarkup(<DialogActions className="confirm" aria-label="Actions"><button>Confirm</button></DialogActions>);
  expect(actions).toContain('uld-dialog-actions confirm');
  expect(actions).toContain('<button>Confirm</button>');
});
