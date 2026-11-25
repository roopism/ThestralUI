import { Fragment, type ComponentPropsWithRef, type CSSProperties } from 'react';

export interface KeyboardShortcutLabelOptions {
  /** The visible keys, in their intended reading order. */
  keys: string | readonly string[];
  /** Localized text for a chord whose glyphs alone would be ambiguous. */
  spokenLabel?: string;
  separator?: string;
  dir?: 'ltr' | 'rtl' | 'auto';
}

export interface KeyboardShortcutLabelProps
  extends Omit<ComponentPropsWithRef<'kbd'>, 'children' | 'dir'>, KeyboardShortcutLabelOptions {
  unstyled?: boolean;
}

// Keep the spoken alternative in the reading sequence even in a bare, CSS-free consumer.
const spokenStyle: CSSProperties = {
  position: 'absolute', inlineSize: 1, blockSize: 1, overflow: 'hidden',
  clipPath: 'inset(50%)', whiteSpace: 'nowrap', userSelect: 'none',
};

export interface KeyboardShortcutLabelBehavior {
  keys: readonly string[];
  separator: string;
  spokenLabel?: string;
  kbdProps: { dir: 'ltr' | 'rtl' | 'auto'; 'data-part': 'root' };
  keysProps: { 'data-part': 'keys'; 'aria-hidden'?: true };
  spokenProps: { 'data-part': 'spoken'; dir: 'auto'; style: CSSProperties };
}

/** Describes keyboard input. The command owns its shortcut and all event handling. */
export function useKeyboardShortcutLabel({
  keys, spokenLabel, separator = '+', dir = 'ltr',
}: KeyboardShortcutLabelOptions): KeyboardShortcutLabelBehavior {
  const label = spokenLabel?.trim() || undefined;
  return {
    keys: (typeof keys === 'string' ? [keys] : keys).filter(key => key.trim()),
    separator, spokenLabel: label,
    kbdProps: { dir, 'data-part': 'root' },
    keysProps: { 'data-part': 'keys', 'aria-hidden': label ? true : undefined },
    spokenProps: { 'data-part': 'spoken', dir: 'auto', style: spokenStyle },
  };
}

export { useKeyboardShortcutLabel as getKeyboardShortcutLabelProps };

export function KeyboardShortcutLabel({
  keys, dir, separator, spokenLabel, unstyled, className, ...host
}: KeyboardShortcutLabelProps) {
  const behavior = useKeyboardShortcutLabel({ keys, dir, separator, spokenLabel });
  if (!behavior.keys.length) return null;
  return <kbd {...host} {...behavior.kbdProps} className={className} data-uld-shortcut={unstyled ? undefined : ''}>
    <span {...behavior.keysProps}>{behavior.keys.map((key, index) =>
      <Fragment key={index}>{index > 0 && behavior.separator}
        {behavior.keys.length === 1 ? key : <kbd data-part="key">{key}</kbd>}
      </Fragment>)}</span>
    {behavior.spokenLabel && <span {...behavior.spokenProps}>{behavior.spokenLabel}</span>}
  </kbd>;
}
