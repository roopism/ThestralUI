import { afterEach, expect, test } from 'vitest';

import { cleanup, render, screen } from '@testing-library/react';

import { Keyboard, Toolbar, Trigger } from '@ui-lazy-dev/ui-web/navigation';

afterEach(cleanup);

test('an RTL toolbar names the controls and preserves the direction of shortcut notation', () => {
  render(
    <Toolbar dir="rtl" aria-label="Editing tools" orientation="vertical">
      <Trigger>Save</Trigger>
      <Keyboard aria-label="Control S">Ctrl+S</Keyboard>
    </Toolbar>,
  );
  const toolbar = screen.getByRole('toolbar', { name: 'Editing tools' });
  expect(toolbar.getAttribute('aria-orientation')).toBe('vertical');
  expect(toolbar.contains(screen.getByRole('button', { name: 'Save' }))).toBe(true);
  const shortcut = screen.getByText('Ctrl+S');
  expect(shortcut.tagName).toBe('KBD');
  expect(shortcut.getAttribute('dir')).toBe('ltr');
  expect(shortcut.tabIndex).toBe(-1);
});
