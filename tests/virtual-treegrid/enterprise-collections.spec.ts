import { expect, test } from '@playwright/test';

test('tree expands, selects and collapses with the keyboard', async ({ page }) => {
  await page.goto('/iframe.html?id=enterprise-collections--virtual&viewMode=story');
  const tree = page.getByRole('treegrid', { name: 'Teams' });
  const team = tree.getByRole('row', { name: /Team 1\b/ }).first();
  await team.click();
  await page.keyboard.press('ArrowRight');
  await expect(team).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Space');
  await expect(tree.getByRole('row', { name: /Team 1 member/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowLeft');
  await expect(team).toHaveAttribute('aria-expanded', 'false');
  expect(await tree.getByRole('row').count()).toBeLessThan(60);
});
