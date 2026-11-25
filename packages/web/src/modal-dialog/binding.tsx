'use client';
import { containTab } from './focus.js';
import { useEffect, useImperativeHandle, useRef, type DialogHTMLAttributes, type ReactNode, type Ref, type RefObject } from 'react';

export interface UseDialogOptions extends Omit<DialogHTMLAttributes<HTMLDialogElement>, 'open' | 'onCancel' | 'role' | 'closedby'> {
  role?: 'dialog' | 'alertdialog';
  labelledBy: string;
  describedBy?: string;
  /** Omit to use the legacy mount-to-open behavior. */
  open?: boolean;
  onDismiss: () => void;
  dismissOnBackdrop?: boolean;
  /** Supply the launcher when pointer activation does not move focus to it. */
  returnFocusRef?: RefObject<HTMLElement | null>;
  ref?: Ref<HTMLDialogElement>;
}

/** Native host props returned by the hook, including the installed ref and dismissal handlers. */
export interface DialogBehavior extends Omit<DialogHTMLAttributes<HTMLDialogElement>, 'open'> {
  role?: 'dialog' | 'alertdialog';
  ref: RefObject<HTMLDialogElement | null>;
  'aria-labelledby': string;
  'aria-describedby': string | undefined;
  closedby: 'any' | 'closerequest';
  onKeyDown(event: React.KeyboardEvent<HTMLDialogElement>): void;
  onCancel(event: React.SyntheticEvent<HTMLDialogElement>): void;
}

/** Spread the result on a native dialog. The owner decides whether a dismissal request closes it. */
export function useDialog({ labelledBy, describedBy, open = true, onDismiss, dismissOnBackdrop, returnFocusRef, ref, onKeyDown, ...host }: UseDialogOptions): DialogBehavior {
  const element = useRef<HTMLDialogElement>(null);
  useImperativeHandle(ref, () => element.current!, []);
  useEffect(() => {
    if (!open) return;
    const dialog = element.current!;
    const owner = dialog.ownerDocument;
    // Capture the current launcher once per opening, even when the owner swaps refs before reopening.
    const explicit = returnFocusRef?.current;
    const previous = explicit ?? owner.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => {
      dialog.close();
      if (previous?.isConnected && (explicit || owner.activeElement === owner.body))
        previous.focus?.({ preventScroll: true });
    };
  }, [open]);
  return {
    ...host,
    ref: element,
    'aria-labelledby': labelledBy,
    'aria-describedby': describedBy,
    closedby: dismissOnBackdrop ? 'any' as const : 'closerequest' as const,
    onKeyDown(event: React.KeyboardEvent<HTMLDialogElement>) {
      onKeyDown?.(event);
      containTab(event);
    },
    onCancel(event: React.SyntheticEvent<HTMLDialogElement>) {
      event.preventDefault();
      event.stopPropagation();
      onDismiss();
    },
  };
}

export interface DialogProps extends UseDialogOptions {
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  unstyled?: boolean;
}

export function Dialog({ size, unstyled, className, ...options }: DialogProps) {
  const behavior = useDialog(options);
  return <dialog {...behavior} data-part="root" data-size={size}
    className={(unstyled ? '' : 'uld-dialog ') + 'uld-dialog-root' + (className ? ' ' + className : '')} />;
}
