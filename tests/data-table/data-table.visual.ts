import { expect, test } from '@playwright/test';
for (const theme of ['light', 'dark'] as const) for (const [form, width] of [['phone', 390], ['desktop', 1100]] as const) {
  test('data table audit queue ' + theme + ' ' + form, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('/iframe.html?id=enterprise-collections--audit-queue&viewMode=story&globals=scheme:' + theme);
    await expect(page.getByRole('table', { name: 'Audit records' })).not.toHaveAttribute('aria-busy', 'true');
    await expect(page.getByRole('button', { name: 'Edit Title, Atlas audit' })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot('data-table-' + theme + '-' + form + '.png', { animations: 'disabled', scale: 'css', maxDiffPixelRatio: 0.001 });
  });
}
