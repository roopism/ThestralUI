import { expect, test } from '@playwright/test';
import { catalogHeaders } from '../packaging/catalog-headers.mjs';

test('the deployed headers allow the catalog manager to display an interactive story', async ({ page }) => {
  await page.route('**/*', async route => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const headers = catalogHeaders(new URL(route.request().url()).pathname);
    expect(headers['content-security-policy']).toBeTruthy();
    expect(headers['permissions-policy']).toBeTruthy();
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), ...headers } });
  });
  await page.goto('/?path=/story/molecules-preferences--english', { waitUntil: 'domcontentloaded' });
  const control = page.frameLocator('#storybook-preview-iframe').getByRole('checkbox');
  await expect(control).toBeVisible();
  await expect(control).not.toBeChecked();
  await control.focus();
  await page.keyboard.press('Space');
  await expect(control).toBeChecked();
});
