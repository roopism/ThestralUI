import { test, expect } from '@playwright/test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Stack, Inline } from '@ui-lazy-dev/ui-web/primitives';
const resolve = createRequire(import.meta.url).resolve;

const css = ['@ui-lazy-dev/tokens/styles.css', '@ui-lazy-dev/ui-web/primitives.css']
  .map((file) => readFileSync(resolve(file), 'utf8'))
  .join('\n');
const button = (name: string) => h('button', { type: 'button', key: name }, name);
const ordinary = { containerType: 'inline-size' } as const;
const names = ['فتح التقرير', 'Review', 'خيارات'];
const panel = (name: string, width: number) =>
  h(
    'section',
    {
      id: name,
      dir: 'rtl',
      style: { ...ordinary, width },
    },
    h(
      Stack,
      {
        gap: { base: 'xs', wide: 'lg' },
        align: 'start',
        justify: 'end',
        className: 'consumer',
        style: { height: 160 },
        'aria-label': name,
        role: 'group',
      },
      ...names.map((label) => button(label + ' ' + name)),
    ),
    h(
      Inline,
      { gap: { base: 'sm', wide: 'xl' }, justify: 'start', align: 'end' },
      ...names.map((label) => button(label + ' inline ' + name)),
    ),
  );

test('Stack and Inline resolve gaps from independent parents and retain focus while resizing', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.setContent(
    '<style>' +
      css +
      '</style>' +
      renderToStaticMarkup(
        h(
          'main',
          null,
          panel('small', 240),
          panel('large', 720),
          h(Stack, {
            role: 'group',
            'aria-label': 'Ordinary parent',
            gap: { base: 'sm', wide: 'xl' },
          }),
        ),
      ),
  );
  const small = page.getByRole('group', { name: 'small' });
  const large = page.getByRole('group', { name: 'large' });
  await expect(small).toHaveCSS('gap', '4px');
  await expect(large).toHaveCSS('gap', '24px');
  await expect(page.locator('#small .uld-inline')).toHaveCSS('gap', '8px');
  await expect(page.locator('#large .uld-inline')).toHaveCSS('gap', '40px');
  await expect(small).toHaveCSS('justify-items', 'start');
  await expect(small).toHaveCSS('align-content', 'end');
  await expect(page.locator('#small .uld-inline')).toHaveCSS('align-items', 'end');
  await expect(small).toHaveClass(/consumer/);
  await expect(page.getByRole('group', { name: 'Ordinary parent' })).toHaveCSS('gap', '8px');
  const first = small.getByRole('button').first();
  await first.focus();
  await page.locator('#small').evaluate((el) => {
    el.style.width = '575px';
  });
  await expect(small).toHaveCSS('gap', '4px');
  await page.locator('#small').evaluate((el) => {
    el.style.width = '576px';
  });
  await expect(small).toHaveCSS('gap', '24px');
  await expect(first).toBeFocused();
  await expect(large).toHaveCSS('gap', '24px');
  await page.locator('#large').evaluate((el) => {
    el.style.width = '230px';
  });
  await expect(large).toHaveCSS('gap', '4px');
  await expect(page.locator('#large .uld-inline')).toHaveCSS('gap', '8px');
});

test('logical RTL alignment, wrapping, nested defaults and keyboard order survive tight layouts', async ({
  page,
  browserName,
}) => {
  await page.setContent(
    '<style>' +
      css +
      '</style>' +
      renderToStaticMarkup(
        h(
          'section',
          { dir: 'rtl', style: { ...ordinary, width: 640 } },
          h(
            Stack,
            { gap: { base: 'xs', wide: 'xl' } },
            h(
              Inline,
              { align: 'center', justify: 'start', style: { width: 110 } },
              button('فتح التقرير'),
              button('Review more'),
              button('خيارات'),
            ),
            h(
              Inline,
              { wrap: false, gap: 'md', style: { width: 120 } },
              button('One'),
              button('Two'),
            ),
            h(Stack, null, button('Last')),
          ),
        ),
      ),
  );
  const rows = page.locator('.uld-inline');
  await expect(rows.first()).toHaveCSS('gap', '8px');
  await expect(page.locator('.uld-stack').nth(1)).toHaveCSS('gap', '8px');
  await expect(rows.first()).toHaveCSS('flex-wrap', 'wrap');
  await expect(rows.last()).toHaveCSS('flex-wrap', 'nowrap');
  await expect(rows.last()).toHaveCSS('gap', '16px');
  const first = rows.first().getByRole('button').first();
  const second = rows.first().getByRole('button').nth(1);
  const [a, b, lane] = await Promise.all([
    first.boundingBox(),
    second.boundingBox(),
    rows.first().boundingBox(),
  ]);
  expect(a!.x + a!.width).toBeCloseTo(lane!.x + lane!.width, 0);
  expect(b!.y).toBeGreaterThan(a!.y);
  const next = browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab';
  await page.keyboard.press(next);
  await expect(first).toBeFocused();
  await page.keyboard.press(next);
  await expect(second).toBeFocused();
  await expect(rows.first().locator(':scope > button')).toHaveCount(3);
});
