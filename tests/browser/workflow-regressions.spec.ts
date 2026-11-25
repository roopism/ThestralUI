import { expect, test } from '@playwright/test';

const story = (name: string) => '/iframe.html?id=' + name + '&viewMode=story';

test('completed notification and batch actions return focus to their headings', async ({ page }) => {
  for (const [label, action] of [
    ['Notifications', 'Mark Résumé ready as read'],
    ['Notifications', 'Mark all as read'],
    ['Deliverables', 'Retry Portfolio'],
  ]) {
    await page.goto(story('enterprise-workspace--delivery'));
    const section = page.getByRole('region', { name: label });
    const button = section.getByRole('button', { name: action });
    await button.focus();
    await button.press('Enter');
    await expect.soft(section.getByRole('heading', { name: label })).toBeFocused();
  }
});
