import { useState } from 'react';
import { Button } from '@ui-lazy-dev/ui-web';
import { KeyboardShortcutLabel } from '@ui-lazy-dev/ui-web/keyboard-shortcut-label';
import { Keyboard, Menu, MenuItem, MenuTrigger, Popover, Trigger } from '@ui-lazy-dev/ui-web/navigation';

export function Chord() {
  const [message, setMessage] = useState('Palette closed');
  return <section aria-label="Command palette">
    <p>Command palette</p>
    <KeyboardShortcutLabel keys={['Ctrl', 'Shift', 'P']} spokenLabel="Control Shift P" />
    <p><Button onClick={() => setMessage('Command palette opened')}>Open command palette</Button></p>
    <p>{message}</p>
  </section>;
}

export function InlineHelp() {
  const [open, setOpen] = useState(false);
  return <section aria-label="Shortcut help">
    <Button aria-expanded={open} onClick={() => setOpen(value => !value)}>Keyboard help</Button>
    {open && <div lang="ar" dir="rtl">
      <p>للبحث في المستند <KeyboardShortcutLabel lang="en" keys={['⌘', 'K']} separator="" spokenLabel="Command K" /></p>
      <p>يمكنك أيضًا اختيار البحث من القائمة.</p>
    </div>}
  </section>;
}

export function MenuCommand() {
  const [message, setMessage] = useState('File ready');
  return <section aria-label="File commands">
    <MenuTrigger>
      <Trigger>File actions</Trigger>
      <Popover className="catalog-shortcut-menu">
        <Menu aria-label="File actions" onAction={() => setMessage('File renamed')}>
          <MenuItem id="rename" aria-label="Rename file" textValue="Rename file">
            <span>Rename file</span>
            <Keyboard><KeyboardShortcutLabel keys={['Ctrl', 'R']} spokenLabel="Control R" /></Keyboard>
          </MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
    <p>{message}</p>
  </section>;
}

export function Guide() {
  return <main className="catalog-shortcut-guide specimen" aria-label="Editor shortcuts">
    <h1>Editor shortcuts</h1>
    <dl>
      <div><dt>Open command palette</dt><dd><KeyboardShortcutLabel keys={['Ctrl', 'Shift', 'P']} spokenLabel="Control Shift P" /></dd></div>
      <div><dt>Find in document</dt><dd><KeyboardShortcutLabel keys={['⌘', 'K']} separator="" spokenLabel="Command K" /></dd></div>
      <div lang="ja"><dt>次の結果へ移動</dt><dd><KeyboardShortcutLabel keys={['Shift', 'Enter']} /></dd></div>
      <div dir="rtl" lang="ar"><dt>إغلاق المساعدة</dt><dd><KeyboardShortcutLabel lang="en" keys="Esc" spokenLabel="Escape" /></dd></div>
    </dl>
    <MenuCommand />
  </main>;
}
