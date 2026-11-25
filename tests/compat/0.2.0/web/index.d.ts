import { type ButtonHTMLAttributes, type HTMLAttributes, type ReactElement } from 'react';
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    busy?: boolean;
    tone?: 'primary' | 'secondary';
    motion?: 'press' | 'none';
}
export declare function Button({ busy, disabled, tone, motion, type, className, ...props }: ButtonProps): import("react").JSX.Element;
export interface FormFieldProps {
    label: string;
    hint?: string;
    error?: string;
    children: ReactElement<HTMLAttributes<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>, 'input' | 'textarea' | 'select'>;
    className?: string;
}
export declare function FormField({ label, hint, error, children, className, }: FormFieldProps): import("react").JSX.Element;
/** Flows from a single column into as many readable columns as the parent permits. */
export declare function AdaptiveGrid({ className, ...props }: HTMLAttributes<HTMLDivElement>): import("react").JSX.Element;
