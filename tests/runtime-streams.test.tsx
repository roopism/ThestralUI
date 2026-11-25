import { act, Suspense } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { execFileSync } from 'node:child_process';
import { fireEvent, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { useLocale } from 'react-aria-components';
import { I18nProvider } from '@ui-lazy-dev/ui-web/navigation';
import { ModeProvider } from '@ui-lazy-dev/ui-web/modes';
import { modeProps, passwordFields } from './fixtures/streamed-fields.js';

function HydratedFields() {
  const { locale, direction } = useLocale();
  return <ModeProvider {...modeProps(locale, direction)}>{passwordFields(locale)}</ModeProvider>;
}

test('overlapping streamed requests hydrate independently in reverse order and preserve distinct IDs, refs and edits', async () => {
  const server = 'tests/fixtures/streamed-fields.ts';
  const [first, second]: [string, string] = JSON.parse(execFileSync(process.execPath, [server], { encoding: 'utf8' }));
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  expect(first).toContain('dir="rtl"');
  expect(second).toContain('dir="ltr"');
  expect(first).toContain('data-uld-brand="expressive"');
  expect(first).toContain('data-uld-scheme="dark"');
  expect(second).toContain('data-uld-brand="enterprise"');
  expect(second).toContain('data-uld-scheme="light"');
  expect(first).not.toContain('ja hint');
  expect(second).not.toContain('ar hint');
  const roots: Root[] = [],
    containers: HTMLElement[] = [];
  const recover = vi.fn();
  const errors = vi.spyOn(console, 'error');
  try {
    for (const [prefix, markup] of [
      ['ja', second],
      ['ar', first],
    ]) {
      const container = document.createElement('article');
      container.innerHTML = markup;
      document.body.append(container);
      containers.push(container);
      await act(async () => {
        roots.push(
          hydrateRoot(container, <Suspense fallback={null}>
            <I18nProvider locale={prefix}><HydratedFields /></I18nProvider>
          </Suspense>, {
            identifierPrefix: prefix,
            onRecoverableError: recover,
          }),
        );
      });
      const inputs = container.querySelectorAll('input');
      expect(inputs).toHaveLength(2);
      for (const input of inputs) {
        expect(container.querySelector('label[for="' + input.id + '"]')).toBeTruthy();
        expect(document.getElementById(input.getAttribute('aria-describedby')!)?.textContent).toBe(
          prefix + ' hint',
        );
      }
    }
    const ids = containers.flatMap((c) => [...c.querySelectorAll('[id]')].map((n) => n.id));
    expect(new Set(ids).size).toBe(ids.length);
    fireEvent.change(within(containers[1]).getByLabelText('ar 1'), {
      target: { value: 'local draft' },
    });
    fireEvent.click(within(containers[1]).getByRole('button', { name: 'ar reveal 1' }));
    expect((within(containers[1]).getByLabelText('ar 1') as HTMLInputElement).type).toBe('text');
    expect((within(containers[0]).getByLabelText('ja 1') as HTMLInputElement).value).toBe('');
    expect((within(containers[0]).getByLabelText('ja 1') as HTMLInputElement).type).toBe(
      'password',
    );
    expect(recover).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
  } finally {
    errors.mockRestore();
    await act(async () => {
      for (const root of roots) root.unmount();
    });
    for (const container of containers) container.remove();
    vi.unstubAllGlobals();
  }
});
