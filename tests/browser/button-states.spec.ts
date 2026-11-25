import { expect, test } from '@playwright/test';
import axe from 'axe-core';

const story = (id: string, args = '') => '/iframe.html?id=actions-button-states--' + id + '&viewMode=story' + args;

for (const mode of ['light', 'dark'] as const) {
  test('every tone and state passes the accessibility scan in ' + mode, async ({ page }) => {
    await page.goto(story('tones', '&args=mode:' + mode));
    const main = page.getByRole('main');
    await expect(main).toHaveAttribute('data-uld-theme', mode);
    await page.addScriptTag({ content: axe.source });
    const violations = await page.evaluate(async () =>
      (
        await (window as unknown as { axe: typeof axe }).axe.run(document.querySelector('main')!, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
        })
      ).violations.map((v) => v.id + ': ' + v.nodes.map((n) => n.target.join(' ')).join(', ')),
    );
    expect(violations).toEqual([]);
  });
}

for (const scheme of ['light', 'dark', 'high-contrast'] as const) {
  for (const brand of ['enterprise', 'expressive'] as const) {
    test('every tone passes the accessibility scan in the ' + brand + ' brand with the ' + scheme + ' scheme', async ({ page }) => {
      const mode = scheme === 'dark' ? 'dark' : 'light';
      await page.goto(story('tones', '&args=mode:' + mode + ';scheme:' + scheme + ';brand:' + brand));
      const main = page.getByRole('main');
      await expect(main).toHaveAttribute('data-uld-scheme', scheme);
      await expect(main).toHaveAttribute('data-uld-brand', brand);
      await page.addScriptTag({ content: axe.source });
      const violations = await page.evaluate(async () =>
        (
          await (window as unknown as { axe: typeof axe }).axe.run(document.querySelector('main')!, {
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
          })
        ).violations.map((v) => v.id + ': ' + v.nodes.map((n) => n.target.join(' ')).join(', ')),
      );
      expect(violations).toEqual([]);
    });
  }
}

test.describe('touch', () => {
  test.use({ hasTouch: true });
  test('every density keeps a 48 pixel target for every size on a touch screen', async ({ page }) => {
    for (const density of ['compact', 'comfortable', 'spacious'] as const) {
      await page.goto(story('tones', '&args=mode:light;density:' + density));
      await expect(page.getByRole('main')).toHaveAttribute('data-uld-density', density);
      for (const name of ['Publish', 'Skip', 'Learn more', 'Confirm order']) {
        const box = (await page.getByRole('button', { name, exact: true }).boundingBox())!;
        // Firefox reports layout heights with sub-pixel error, for example 47.99997.
        expect(Math.round(box.height), name + ' in ' + density).toBeGreaterThanOrEqual(48);
      }
    }
  });
});

test('a busy submit keeps focus and width, and blocks every way of submitting again', async ({ page }) => {
  await page.goto(story('pending'));
  const save = page.getByRole('button', { name: 'Save draft' });
  const count = page.getByRole('status', { name: 'Submissions' }).or(page.locator('output'));
  const before = (await save.boundingBox())!;
  await page.getByRole('textbox', { name: 'Title' }).press('Enter');
  await expect(count).toHaveText('1');
  await expect(save).toHaveAttribute('aria-busy', 'true');
  await expect(save).toHaveAttribute('aria-disabled', 'true');
  // Busy is not the native disabled state: the button stays in the focus order.
  expect(await save.evaluate((node) => (node as HTMLButtonElement).disabled)).toBe(false);
  const busy = (await save.boundingBox())!;
  expect(busy.width).toBe(before.width);
  expect(busy.height).toBe(before.height);
  await expect(save.locator('[data-part="busy-indicator"]')).toBeVisible();

  await page.getByRole('textbox', { name: 'Title' }).press('Enter');
  await save.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  await expect(save).toBeFocused();
  // A real pointer click: Playwright's own click would wait for the aria-disabled button.
  // Safari does not move focus to a clicked button, so focus is checked before the click.
  await page.mouse.click(busy.x + busy.width / 2, busy.y + busy.height / 2);
  await expect(count).toHaveText('1');

  await page.getByRole('button', { name: 'Finish saving' }).click();
  await expect(save).not.toHaveAttribute('aria-busy');
  await save.click();
  await expect(count).toHaveText('2');
});

test('unstyled mode keeps behaviour and part names and drops library styles', async ({ page }) => {
  await page.goto(story('tones', '&args=mode:light'));
  const styled = page.getByRole('button', { name: 'Publish', exact: true });
  const plain = page.getByRole('button', { name: 'Unstyled action' });
  await expect(plain).toHaveAttribute('data-part', 'root');
  await expect(plain).toHaveClass('uld-button-root app-action');
  await expect(plain.locator('[data-part="label"]')).toHaveText('Unstyled action');
  const background = (locator: typeof plain) => locator.evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(await background(plain)).not.toBe(await background(styled));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await plain.click();
  await expect(plain).toHaveAttribute('aria-busy', 'true');
  const indicator = plain.locator('[data-part="busy-indicator"]');
  await expect(indicator).toHaveCSS('position', 'static');
  await expect(indicator).toHaveCSS('animation-name', 'none');
  await expect(plain.locator('[data-part="label"]')).toHaveCSS('opacity', '1');
  const fill = await page.getByRole('button', { name: 'Confirm order' }).boundingBox();
  const row = await page.getByRole('main').boundingBox();
  expect(Math.round(fill!.width)).toBe(Math.round(row!.width - (fill!.x - row!.x) * 2));
});

test('the busy indicator stays still when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(story('tones', '&args=mode:light'));
  const indicator = page.getByRole('button', { name: 'Publish busy' }).locator('[data-part="busy-indicator"]');
  expect(await indicator.evaluate((node) => getComputedStyle(node).animationName)).toBe('none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  expect(await indicator.evaluate((node) => getComputedStyle(node).animationName)).toBe('uld-button-busy');
});
