import {
  KeyboardShortcutLabel, getKeyboardShortcutLabelProps, useKeyboardShortcutLabel,
} from '@ui-lazy-dev/ui-web/keyboard-shortcut-label';
import { Keyboard as DocumentKeyboard } from '@ui-lazy-dev/ui-web/document';

export function ShortcutServerConsumer() {
  const next = useKeyboardShortcutLabel({keys:'Tab'});
  const previous = getKeyboardShortcutLabelProps({keys:'Shift'});
  return <main>
    <p dir="rtl" lang="ar">بحث <KeyboardShortcutLabel id="command" keys={['⌘', 'K']} lang="en" separator="" spokenLabel="Command K" /></p>
    <p><kbd {...next.kbdProps}>{next.keys}</kbd> <kbd {...previous.kbdProps}>{previous.keys}</kbd></p>
    <DocumentKeyboard id="old-key" className="owner">Escape</DocumentKeyboard>
    <KeyboardShortcutLabel keys={[]} />
  </main>;
}
