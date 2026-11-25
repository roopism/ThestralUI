import { expect, test, type Page } from '@playwright/test';

async function openGallery(page: Page, theme: 'enterprise' | 'editorial') {
  await page.goto('/iframe.html?id=patterns-publicationlibrary--' + theme + '&viewMode=story');
  await expect(page.getByRole('region', { name: 'Publications' })).toBeVisible();
}

test('sheet grip dismisses only after an outward drag; a cancelled drag and content scroll stay open', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 720 });
  await openGallery(page, 'editorial');
  await page.getByRole('button', { name: 'Reading list (0)' }).click();
  const sheet = page.getByRole('dialog', { name: 'Reading list' });
  const grip = sheet.locator('.uld-edge-grip');
  const bounds = (await grip.boundingBox())!;
  const x = bounds.x + bounds.width / 2,
    y = bounds.y + 8;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 12, { steps: 3 });
  await page.mouse.up();
  await expect(sheet).toBeVisible();
  await sheet.locator('.uld-edge-content').hover();
  await page.mouse.wheel(0, 80);
  await expect(sheet).toBeVisible();
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 100, { steps: 8 });
  await page.mouse.up();
  await expect(sheet).toHaveCount(0);
});
