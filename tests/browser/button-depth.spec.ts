import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createElement as element } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button } from '@ui-lazy-dev/ui-web';
import { IconButton } from '@ui-lazy-dev/ui-web/primitives';

const buttonStyles =
  readFileSync('packages/tokens/dist/styles.css', 'utf8') +
  readFileSync('packages/web/dist/styles.css', 'utf8').replace(/^@import[^;]+;/, '') +
  readFileSync('packages/web/dist/primitives.css', 'utf8');

test('public button sizes retain native form behavior, square targets and logical icon placement', async ({
  page,
}) => {
  const sizes = [undefined, 'sm', 'md', 'lg'] as const;
  const controls = sizes.flatMap((size) => [
    element(Button, { key: 'text-' + size, size }, 'Action ' + size),
    element(IconButton, { key: 'icon-' + size, size, label: 'Search ' + size, children: '⌕' }),
  ]);
  const decorated = element(
    Button,
    {
      startIcon: element('span', { 'data-testid': 'leading', tabIndex: 0 }, 'A'),
      endIcon: element('span', { 'data-testid': 'trailing', tabIndex: 0 }, 'B'),
    },
    'Publish',
  );
  await page.setContent(
    renderToStaticMarkup(
      element(
        'form',
        null,
        ...controls,
        decorated,
        element('input', { 'aria-label': 'Next control' }),
      ),
    ),
  );
  await page.addStyleTag({ content: buttonStyles });
  const heights = [];
  for (const size of sizes) {
    const action = page.getByRole('button', { name: 'Action ' + size });
    await expect(action).toHaveAttribute('type', 'button');
    const box = (await action.boundingBox())!;
    heights.push(box.height);
    const icon = (await page.getByRole('button', { name: 'Search ' + size }).boundingBox())!;
    expect(icon.width).toBe(icon.height);
    expect(icon.height).toBeGreaterThanOrEqual(32);
  }
  expect(heights[0]).toBe(44);
  expect(heights[1]).toBeLessThan(heights[2]);
  expect(heights[2]).toBe(heights[0]);
  expect(heights[3]).toBeGreaterThan(heights[2]);
  const button = page.getByRole('button', { name: 'Publish' });
  const leading = page.getByTestId('leading');
  const trailing = page.getByTestId('trailing');
  expect((await leading.boundingBox())!.x).toBeLessThan((await trailing.boundingBox())!.x);
  await button.evaluate((node) => {
    node.setAttribute('dir', 'rtl');
  });
  expect((await leading.boundingBox())!.x).toBeGreaterThan((await trailing.boundingBox())!.x);
  await button.focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('textbox', { name: 'Next control' })).toBeFocused();

  await test.step('a keyboard submit goes to the explicitly associated form', async () => {
    const submit = element(Button, {
      type: 'submit', form: 'shipment', name: 'action', value: 'preview',
    }, 'Preview shipment');
    await page.setContent(renderToStaticMarkup(element('main', null,
      element('form', { id: 'draft' }, submit),
      element('form', { id: 'shipment' }),
      element('output', null),
    )));
    await page.evaluate(() => {
      document.addEventListener('submit', event => {
        event.preventDefault();
        const form = event.target as HTMLFormElement;
        const data = new FormData(form, event.submitter);
        document.querySelector('output')!.value += form.id + '/' + data.get('action');
      });
    });
    await page.getByRole('button', { name: 'Preview shipment' }).press('Enter');
    await expect(page.locator('output')).toHaveText('shipment/preview');
  });
});

test.describe('coarse pointer', () => {
  test.use({ hasTouch: true });
  test('explicit compact actions retain a 48 pixel touch target', async ({ page }) => {
    const markup = renderToStaticMarkup(
      element(IconButton, { label: 'Filter', size: 'sm', children: '⌕' }),
    );
    await page.setContent(markup);
    await page.addStyleTag({ content: buttonStyles });
    const action = page.getByRole('button', { name: 'Filter' });
    const box = (await action.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(48);
    expect(box.width).toBe(box.height);
  });
});
