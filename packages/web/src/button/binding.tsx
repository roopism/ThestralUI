import { type ButtonHTMLAttributes, type MouseEvent, type Ref, type ReactElement } from "react";

export interface UseButtonOptions {
  /** An operation is in progress. The button stays focusable, reports busy and ignores activation. */
  busy?: boolean;
  /** The action is unavailable. The button leaves the focus order. */
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
}

export interface ButtonBehavior {
  buttonProps: {
    type: 'button' | 'submit' | 'reset';
    disabled?: true;
    'aria-disabled'?: true;
    'aria-busy'?: true;
    onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  };
  busy: boolean;
  disabled: boolean;
}

/**
 * Button behaviour without styling. Spread `buttonProps` on a native button.
 * A busy button keeps keyboard focus and blocks repeat activation, including form submission.
 */
export function useButton({
  busy = false,
  disabled = false,
  type = 'button',
  onClick,
}: UseButtonOptions): ButtonBehavior {
  const pending = busy && !disabled;
  return {
    buttonProps: {
      type,
      disabled: disabled || undefined,
      'aria-disabled': pending || undefined,
      'aria-busy': busy || undefined,
      onClick(event) {
        if (pending) {
          event.preventDefault();
          event.stopPropagation();
        } else onClick?.(event);
      },
    },
    busy,
    disabled,
  };
}


export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  ref?: Ref<HTMLButtonElement>;
  size?: 'sm' | 'md' | 'lg';
  startIcon?: ReactElement;
  endIcon?: ReactElement;
  /** An operation is in progress. The button keeps focus and its width, and ignores activation. */
  busy?: boolean;
  tone?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
  /** Fill the width of the container. */
  fullWidth?: boolean;
  motion?: 'press' | 'none';
  /** Keep the behaviour and accessibility, and apply no library styles. Part class names stay. */
  unstyled?: boolean;
}

function part(name: string, icon?: ReactElement) {
  if (!icon || (typeof icon.type === 'string' && (icon.props as { hidden?: boolean }).hidden)) return;
  return (
    <span className={'uld-button-' + name} data-part={name} inert aria-hidden>
      {icon}
    </span>
  );
}

/** Shared native press target. A composed control can own its own slots and presentation. */
export function ButtonTarget({ behavior: { buttonProps, busy }, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { ref?: Ref<HTMLButtonElement>; behavior: ButtonBehavior }) {
  return <button {...props} {...buttonProps}
    onClick={props.onClick || busy ? buttonProps.onClick : undefined}
    aria-busy={buttonProps['aria-busy'] ?? props['aria-busy']}
    aria-disabled={buttonProps['aria-disabled'] ?? props['aria-disabled']} />;
}

export function Button({
  busy,
  disabled,
  tone = 'primary',
  type,
  motion = 'none',
  fullWidth,
  unstyled,
  className,
  size,
  startIcon,
  children,
  endIcon,
  onClick,
  ...props
}: ButtonProps) {
  const behavior = useButton({ busy, disabled, type, onClick });
  return (
    <ButtonTarget {...props} onClick={onClick} behavior={behavior}
      className={(unstyled ? 'uld-button-root' : 'uld-button uld-button-root') + (className ? ' ' + className : '')}
      data-part="root"
      data-size={size}
      data-tone={tone}
      data-motion={motion}
      data-full-width={fullWidth || undefined}
    >
      {part('start-icon', startIcon)}
      <span className="uld-button-label" data-part="label">
        {children}
      </span>
      {part('end-icon', endIcon)}
      {busy && <span className="uld-button-busy-indicator" data-part="busy-indicator" aria-hidden />}
    </ButtonTarget>
  );
}
