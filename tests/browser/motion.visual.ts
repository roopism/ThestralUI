import { expect, test } from '@playwright/test';

for (const theme of ['enterprise', 'editorial']) {
  for (const mode of ['light', 'dark'] as const) {
    for (const viewport of [
      { name: 'phone', width: 390, height: 850 },
      { name: 'desktop', width: 1100, height: 1000 },
    ]) {
      test([theme, mode, viewport.name].join(' '), async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.emulateMedia({ colorScheme: mode, reducedMotion: 'reduce' });
        await page.goto(
          '/iframe.html?id=patterns-publicationlibrary--' +
            theme +
            '&viewMode=story&args=mode:' +
            mode,
        );
        const main = page.getByRole('main');
        await expect(main).toHaveAttribute('data-uld-theme', mode);
        await main.getByRole('button', { name: 'Next title' }).click();
        const details = main.getByRole('button', { name: 'Read details' });
        await details.focus();
        await page.keyboard.press('Enter');
        await expect(main.getByRole('button', { name: 'Save After Hours' })).toBeVisible();
        await expect(main.getByRole('status')).toHaveText('2 of 3');
        await page.evaluate(() => document.fonts.ready);
        await expect(page).toHaveScreenshot([theme, mode, viewport.name].join('-') + '.png', {
          animations: 'disabled',
          scale: 'css',
          maxDiffPixelRatio: 0.001,
        });
      });
    }
  }
}
