import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Spinner } from '@ui-lazy-dev/ui-web/primitives';

test('the standalone primitives sheet paints the spinner and honors the stroke token', async ({ page }) => {
  const css = readFileSync(createRequire(import.meta.url).resolve('@ui-lazy-dev/ui-web/primitives.css'), 'utf8');
  const html = renderToStaticMarkup(createElement(Spinner, { label: 'Loading records' }));
  await page.setContent('<style>' + css + '</style>' + html);
  const ring = page.getByRole('status', { name: 'Loading records' });
  expect(await ring.evaluate(el => getComputedStyle(el).borderTopWidth)).toBe('2px');
  await expect(ring).toHaveCSS('border-top-style', 'solid');
  expect(await ring.evaluate(el => getComputedStyle(el).borderTopColor)).toBe(await ring.evaluate(el => getComputedStyle(el).color));
  await expect(ring).toHaveCSS('border-inline-end-color', 'rgba(0, 0, 0, 0)');
  await page.addStyleTag({ content: ':root { --uld-indicator-stroke: 4px; }' });
  await expect(ring).toHaveCSS('border-top-width', '4px');
});
