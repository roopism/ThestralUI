import { expect, test } from '@playwright/test';

for (const [story, direction] of [
  ['english', 'ltr'],
  ['arabic', 'rtl'],
  ['japanese', 'ltr'],
  ['expanded', 'ltr'],
]) {
  test(
    story + ' preferences retain keyboard selection and reflow at 320 CSS pixels',
    async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 740 });
      await page.goto('/iframe.html?id=molecules-preferences--' + story + '&viewMode=story');
      const main = page.getByRole('main');
      await expect(main).toHaveAttribute('dir', direction);
      await page.addStyleTag({ content: 'html { font-size: 125%; }' });
      const checkbox = main.getByRole('checkbox');
      await checkbox.focus();
      await page.keyboard.press('Space');
      await expect(checkbox).toBeChecked();
      await expect(main.getByRole('status')).not.toBeEmpty();
      const toggle = main.getByRole('switch');
      await toggle.focus();
      await page.keyboard.press('Space');
      await expect(toggle).toBeChecked();
      const tabs = main.getByRole('tab');
      await tabs.first().focus();
      await page.keyboard.press(direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight');
      await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
      await expect(main.getByRole('radio').first()).toBeChecked();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        320,
      );
      // Selected controls must have a visible mark even without a supplied icon.
      expect(
        await main
          .locator('.react-aria-Radio')
          .first()
          .evaluate((el) => getComputedStyle(el, '::before').content),
      ).not.toBe('none');
    },
  );
}

test('recovery summary focuses the field in forced colors', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await page.goto('/iframe.html?id=molecules-account-recovery--recovery&viewMode=story');
  await page.getByRole('button', { name: 'Update access' }).click();
  await page.getByRole('link', { name: 'Enter the six-digit recovery code.' }).click();
  await expect(page.getByRole('textbox', { name: 'Recovery code' })).toBeFocused();
});
