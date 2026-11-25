import { expect, test } from '@playwright/test';

test('a shortlist adapts to the available space and supports touch, keyboard and reduced motion', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(
    '/iframe.html?id=patterns-opportunityshortlist--adaptive&viewMode=story',
  );
  const shortlist = page.getByRole('region', { name: 'Opportunity shortlist' });
  const actions = shortlist.getByRole('button');
  await expect(actions).toHaveCount(2, { timeout: 4000 });
  const box = (i: number) => actions.nth(i).boundingBox();
  const first = (await box(0))!;
  expect(first.height).toBeGreaterThanOrEqual(44);
  expect((await box(1))!.y).toBeGreaterThan(first.y);
  await page.setViewportSize({ width: 1366, height: 850 });
  expect(Math.abs((await box(0))!.y - (await box(1))!.y)).toBeLessThan(2);
  const narrowParent = await page.addStyleTag({
    content: '.shortlist { max-inline-size: 21rem; }',
  });
  expect((await box(1))!.y).toBeGreaterThan((await box(0))!.y);
  await narrowParent.evaluate((node) => node.parentNode?.removeChild(node));
  await actions.first().focus();
  await page.keyboard.press('Space');
  await expect(actions.first()).toHaveAttribute('aria-pressed', 'true');
  const action = actions.first();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(action).toHaveCSS('transition-property', 'transform');
  await action.hover();
  await page.mouse.down();
  await expect(action).not.toHaveCSS('transform', 'none');
  await page.mouse.up();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(action).toHaveCSS('transition-duration', '0s');
  await action.hover();
  await page.mouse.down();
  await expect(action).toHaveCSS('transform', 'none');
  await page.mouse.up();
});

test.describe('touch input', () => {
  test.use({ hasTouch: true, viewport: { width: 320, height: 700 } });
  test('shortlist saves by tap on a narrow screen', async ({ page }) => {
    await page.goto(
      '/iframe.html?id=patterns-opportunityshortlist--adaptive&viewMode=story',
    );
    const action = page.getByRole('button', { name: 'Save Design engineer' });
    await action.tap();
    await expect(action).toHaveAttribute('aria-pressed', 'true');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(320);
  });
});
