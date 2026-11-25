import { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, test } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { KeyboardShortcutLabel, useKeyboardShortcutLabel, getKeyboardShortcutLabelProps } from '@ui-lazy-dev/ui-web/keyboard-shortcut-label';
import { Keyboard as DocumentKeyboard } from '@ui-lazy-dev/ui-web/document';
import { Keyboard as NavigationKeyboard } from '@ui-lazy-dev/ui-web/navigation';

afterEach(cleanup);

test('uses nested native keyboard input semantics in its initial HTML', () => {
  const host = document.createElement('div');
  host.innerHTML = renderToStaticMarkup(<KeyboardShortcutLabel keys={['Ctrl', 'Shift', 'P']} />);
  const label = host.firstElementChild!;
  expect(label.tagName).toBe('KBD');
  expect(label.textContent).toBe('Ctrl+Shift+P');
  expect([...label.querySelectorAll('kbd')].map(k => k.textContent)).toEqual(['Ctrl', 'Shift', 'P']);
  expect(label.getAttribute('dir')).toBe('ltr');
  expect(label.hasAttribute('tabindex')).toBe(false);
});

test('exposes the same headless contract used by the styled label', () => {
  const options = { keys: [' ', '⌘', 'K'], separator: '', spokenLabel: ' Command K ' };
  const props = useKeyboardShortcutLabel(options);
  expect(getKeyboardShortcutLabelProps(options)).toEqual(props);
  const label = render(<KeyboardShortcutLabel {...options} />).container.firstElementChild!;
  expect(label.querySelector('[data-part="keys"]')?.getAttribute('aria-hidden')).toBe('true');
  expect(label.querySelector('[data-part="keys"]')?.textContent).toBe(props.keys.join(props.separator));
  expect(label.querySelector('[data-part="spoken"]')?.textContent).toBe(props.spokenLabel);
});

test('lets callers own host attributes and refs without adding a tab stop', () => {
  const ref = createRef<HTMLElement>();
  render(<KeyboardShortcutLabel ref={ref} keys="إدخال" dir="rtl" lang="ar" id="send" className="owner"
    style={{ fontWeight: 700 }} unstyled />);
  expect(ref.current?.outerHTML).toContain('lang="ar"');
  expect(ref.current?.id).toBe('send');
  expect(ref.current?.dir).toBe('rtl');
  expect(ref.current?.className).toBe('owner');
  expect(ref.current?.style.fontWeight).toBe('700');
  expect(ref.current?.matches('[data-uld-shortcut]')).toBe(false);
  expect(ref.current?.tabIndex).toBe(-1);
});

test('omits missing keys and preserves repeated keys and custom visual separators', () => {
  const view = render(<KeyboardShortcutLabel keys={[' ', '']} spokenLabel="Unused" />);
  expect(view.container.childNodes.length).toBe(0);
  view.rerender(<KeyboardShortcutLabel keys={['G', 'G']} separator=" then " spokenLabel=" " />);
  expect(view.container.textContent).toBe('G then G');
  expect(view.container.querySelector('[aria-hidden]')).toBeNull();
  expect(view.container.querySelector('[data-part="spoken"]')).toBeNull();
});

test('keeps the previous document host and React Aria navigation default direction', () => {
  const view = render(<div dir="rtl"><DocumentKeyboard className="manual" /><NavigationKeyboard className="menu">Tab</NavigationKeyboard></div>);
  const [documentKey, menuKey] = view.container.querySelectorAll('kbd');
  expect(documentKey.outerHTML).toBe('<kbd class="manual"></kbd>');
  expect(menuKey.className).toBe('menu');
  expect(menuKey.dir).toBe('ltr');
  expect(menuKey.textContent).toBe('Tab');
});
