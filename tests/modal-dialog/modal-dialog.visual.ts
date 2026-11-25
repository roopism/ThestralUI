import { expect, test } from '@playwright/test';

for (const mode of ['light', 'dark'] as const) {
  for (const [name, width] of [['phone', 390], ['desktop', 1100]] as const) {
    test('modal dialog ' + mode + ' ' + name, async ({ page }) => {
      await page.setViewportSize({ width, height: 720 });
      await page.emulateMedia({ colorScheme: mode, reducedMotion: 'reduce' });
      await page.goto('/iframe.html?id=components--preference-panel&viewMode=story&args=mode:' + mode + ';scheme:' + mode + '&globals=scheme:' + mode);
      await page.getByRole('button', { name: 'Open preferences' }).click();
      await expect(page.getByRole('dialog', { name: 'Notification delivery' })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await expect(page).toHaveScreenshot('modal-dialog-' + mode + '-' + name + '.png', {
        animations: 'disabled', scale: 'css', maxDiffPixelRatio: 0.001,
      });
    });
  }
}
