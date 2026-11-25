import { expect, test } from '@playwright/test';

test('grid recycles rows and reveals the final record by keyboard', async ({ page }) => {
  await page.goto('/iframe.html?id=enterprise-collections--virtual&viewMode=story');
  const grid = page.getByRole('grid', { name: 'Activity log' });
  const first = grid.getByRole('rowheader', { name: 'Event 1', exact: true });
  await expect(first).toBeVisible();
  expect(await grid.getByRole('row').count()).toBeLessThan(60);
  await grid.getByRole('row', { name: 'Event 1', exact: true }).focus();
  await page.keyboard.press('End');
  await expect(grid.getByText('Event 5000', { exact: true })).toBeVisible();
  expect(await grid.getByRole('row').count()).toBeLessThan(60);
});
