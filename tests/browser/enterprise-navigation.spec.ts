import { expect, test } from '@playwright/test';
const story = '/iframe.html?id=enterprise-navigation--actions&viewMode=story';
test('opens nested menu commands by keyboard and returns to the toolbar', async ({ page }) => {
  await page.goto(story);
  const trigger = page.getByRole('button', { name: 'Actions', exact: true });
  await trigger.focus();
  await trigger.press('Enter');
  await expect(page.getByRole('menu', { name: 'Actions', exact: true })).toBeVisible();
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('menuitem', { name: 'Plain text' })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status', { name: 'Action result' })).toHaveText(
    'Plain text exported',
  );
  await expect(trigger).toBeFocused();
});
test('toggles details, changes selector values, dismisses nested modal and reads its tooltip', async ({
  page,
}) => {
  await page.goto(story);
  const disclosure = page.getByRole('button', { name: 'Review policy' });
  await disclosure.click();
  await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('Review retention is 30 days.')).toBeVisible();
  const language = page.getByRole('button', { name: /Language/ });
  await language.click();
  await page.getByRole('option', { name: 'French' }).click();
  await expect(language).toContainText('French');
  const slider = page.getByRole('slider', { name: 'Priority' });
  await slider.focus();
  await slider.press('ArrowRight');
  await expect(slider).toHaveValue('3');
  const info = page.getByRole('button', { name: 'Review summary' });
  await info.focus();
  await info.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Review summary' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(info).toBeFocused();
  await page.keyboard.press('Tab');
  const help = page.getByRole('button', { name: 'Policy help' });
  await expect(help).toBeFocused();
  await expect(page.getByRole('tooltip')).toContainText('Contact the review owner');
  await help.press('Escape');
  await expect(page.getByRole('tooltip')).toBeHidden();
});

test('exposes named destinations, separators, headings and segmented settings', async ({
  page,
}) => {
  await page.goto(story);
  await expect(page.getByRole('list', { name: 'Location' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Workspace' })).toHaveAttribute('href', '#home');
  await expect(page.getByRole('heading', { name: 'Review settings' })).toBeVisible();
  await expect(page.locator('kbd')).toHaveText('Tab');
  const compact = page.getByRole('radio', { name: 'Compact' });
  await compact.click();
  await expect(compact).toBeChecked();
  await page.getByRole('button', { name: 'Actions', exact: true }).click();
  await expect(page.getByRole('separator')).toBeVisible();
});
