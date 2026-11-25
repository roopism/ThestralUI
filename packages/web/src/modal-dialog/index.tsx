import { Children, Fragment, isValidElement, type ComponentPropsWithRef, type ReactNode } from 'react';
export { Dialog, useDialog, type DialogBehavior, type DialogProps, type UseDialogOptions } from './binding.js';

/** Supply the same id to the heading and to the dialog's labelledBy prop. */
export function DialogHeading({ className = '', ...props }: ComponentPropsWithRef<'h2'>) {
  return <h2 {...props} data-part="heading" className={'uld-dialog-heading ' + className} />;
}

export function DialogBody({ className = '', ...props }: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-part="body" className={'uld-dialog-body ' + className} />;
}

function hasActions(children: ReactNode): boolean {
  return Children.toArray(children).some(child => isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment
    ? hasActions(child.props.children) : child !== '');
}

export function DialogActions({ children, className = '', ...props }: ComponentPropsWithRef<'footer'>) {
  return !hasActions(children) ? null : (
    <footer {...props} data-part="actions" className={'uld-dialog-actions ' + className}>{children}</footer>
  );
}
