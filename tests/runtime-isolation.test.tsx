import { afterEach, expect, test } from 'vitest';

import { cleanup } from '@testing-library/react';

import { renderToString } from 'react-dom/server';

import { FormField } from '../packages/web/src/index';

import { I18nProvider } from '../packages/web/src/navigation';

afterEach(cleanup);

test('independent server renders retain their own locale, theme and field identifiers', async () => {
  const build = (locale: string, theme: string, hint: string) =>
    renderToString(
      <I18nProvider locale={locale}>
        <section lang={locale} data-uld-theme={theme}>
          {[1, 2].map((n) => (
            <FormField key={n} label={locale + n} hint={hint}>
              <input />
            </FormField>
          ))}
        </section>
      </I18nProvider>,
      { identifierPrefix: locale },
    );
  const [a, b] = await Promise.all([
    Promise.resolve().then(() => build('ar', 'dark', 'أمثلة')),
    Promise.resolve().then(() => build('ja', 'light', '限定')),
  ]);
  expect(a).not.toContain('限定');
  expect(b).not.toContain('أمثلة');
  expect(a).toContain('data-uld-theme="dark"');
  expect(b).toContain('data-uld-theme="light"');
  const ids = [...(a + b).matchAll(/ id="([^"]+)"/g)].map((match) => match[1]);
  expect(ids.length).toBeGreaterThanOrEqual(8);
  expect(new Set(ids).size).toBe(ids.length);
});
