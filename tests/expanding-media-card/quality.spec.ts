import { expect, test } from '@playwright/test';

test('preserves focus and disclosure state when text grows to 200 and 400 percent mid-animation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1000, height: 900 });
  await page.goto('/iframe.html?id=patterns-publicationlibrary--editorial&viewMode=story');
  const action = page.getByRole('button', { name: 'Read details' });
  await action.press('Enter');
  const hide = page.getByRole('button', { name: 'Hide details' });
  for (const percent of [200, 400]) {
    await page.addStyleTag({
      content:
        '.publication-library button, .publication-library p, .publication-library h2 { font-size: ' +
        percent / 100 +
        'rem; }',
    });
    await expect(hide).toBeFocused();
    await expect(hide).toHaveCSS('font-size', String((16 * percent) / 100) + 'px');
    await expect(hide).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('button', { name: 'Save Currents' })).toBeVisible();
    const box = await hide.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(1000);
  }
  await page.keyboard.press('Enter');
  await expect(action).toBeFocused();
  await expect(action).toHaveAttribute('aria-expanded', 'false');
});
