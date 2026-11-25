import { type ReactNode, type Ref } from 'react';
export interface DialogProps {
    labelledBy: string;
    onDismiss: () => void;
    dismissOnBackdrop?: boolean;
    className?: string;
    children: ReactNode;
    ref?: Ref<HTMLDialogElement>;
}
/** Mount to open. The consumer controls dismissal and owns its title and action order. */
export declare function Dialog({ labelledBy, onDismiss, dismissOnBackdrop, className, children, ref, }: DialogProps): import("react").JSX.Element;
