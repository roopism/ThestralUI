import { expect, test } from '@playwright/test';

for (const mode of ['light', 'dark'] as const) {
  for (const viewport of [
    { name: 'phone', width: 390, height: 900 },
    { name: 'desktop', width: 1100, height: 900 },
  ]) {
    test(['button', mode, viewport.name].join(' '), async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.emulateMedia({ colorScheme: mode, reducedMotion: 'reduce' });
      await page.goto('/iframe.html?id=actions-button-states--tones&viewMode=story&args=mode:' + mode);
      await expect(page.getByRole('main')).toHaveAttribute('data-uld-theme', mode);
      await page.evaluate(() => document.fonts.ready);
      await expect(page).toHaveScreenshot(['button', mode, viewport.name].join('-') + '.png', {
        animations: 'disabled',
        scale: 'css',
        maxDiffPixelRatio: 0.001,
      });
    });
  }
}
