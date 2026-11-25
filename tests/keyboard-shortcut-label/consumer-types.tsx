import { createRef } from 'react';
import {
  KeyboardShortcutLabel, getKeyboardShortcutLabelProps, useKeyboardShortcutLabel,
  type KeyboardShortcutLabelProps, type KeyboardShortcutLabelOptions, type KeyboardShortcutLabelBehavior,
} from '@ui-lazy-dev/ui-web/keyboard-shortcut-label';

const options: KeyboardShortcutLabelOptions = {keys:['Ctrl', 'S'] as const, dir:'ltr', spokenLabel:'Control S'};
const headless: KeyboardShortcutLabelBehavior = getKeyboardShortcutLabelProps(options);
const props: KeyboardShortcutLabelProps = {...options, id:'save-key', ref:createRef<HTMLElement>()};
export const valid = <KeyboardShortcutLabel {...props} aria-keyshortcuts="Control+S" />;
export const unstyled = <kbd {...useKeyboardShortcutLabel(options).kbdProps}>{headless.keys.join(headless.separator)}</kbd>;
// @ts-expect-error Keys must be readable text.
export const invalidKeys = <KeyboardShortcutLabel keys={[false]} />;
// @ts-expect-error CSS writing direction must be a valid HTML direction.
export const invalidDirection = useKeyboardShortcutLabel({keys:'S', dir:'horizontal'});
