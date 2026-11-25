import { expect, test } from '@playwright/test';

const story = (name: string) => '/iframe.html?id=' + name + '&viewMode=story';

test('retrying unavailable workflows restores focus inside the recovered region', async ({ page }) => {
  await page.goto(story('enterprise-workflow-recovery--status'));
  for (const [label, action] of [['Transfer notices', 'Reload inbox'], ['Transfer jobs', 'Reload jobs']]) {
    const region = page.getByRole('region', { name: label });
    const retry = region.getByRole('button', { name: action });
    await retry.focus();
    await retry.press('Enter');
    await expect(retry).toHaveCount(0);
    await expect.soft(region.getByRole('heading', { name: label })).toBeFocused();
  }
});

test('refreshing from an external action keeps focus outside the notification center', async ({ page }) => {
  await page.goto(story('enterprise-workflow-recovery--status'));
  const region = page.getByRole('region', { name: 'Transfer notices' });
  await region.getByRole('button', { name: 'Reload inbox' }).press('Enter');
  const mark = region.getByRole('button', { name: 'Mark Archive ready as read' });
  await mark.focus();
  await mark.press('Enter');
  const refresh = page.getByRole('button', { name: 'Apply refreshed inbox' });
  await refresh.focus();
  await refresh.press('Enter');
  await expect(mark).toHaveCount(0);
  await expect(refresh).toHaveCount(0);
  await expect.poll(() => region.evaluate(element => element.contains(document.activeElement))).toBe(false);
});

test('submitting from the wizard field keeps keyboard focus on the pending submit button', async ({ page }) => {
  await page.goto(story('enterprise-workflow-recovery--request'));
  await page.getByRole('button', { name: 'Next' }).click();
  const note = page.getByRole('textbox', { name: 'Confirmation note' });
  await note.focus();
  await expect(note).toBeFocused();
  await note.press('Enter');
  const submit = page.getByRole('button', { name: 'Finish' });
  await expect(submit).toHaveAttribute('aria-busy', 'true');
  await expect(submit).toBeFocused();
});

test('a tall wizard step reveals its newly focused heading on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto(story('enterprise-workflow-recovery--request'));
  await page.addStyleTag({ content: '.uld-wizard fieldset { min-block-size: 165vh; }' });
  const next = page.getByRole('button', { name: 'Next' });
  await next.scrollIntoViewIfNeeded();
  await expect(page.getByRole('heading', { name: 'Transfer details' })).not.toBeInViewport();
  await next.press('Enter');
  const heading = page.getByRole('heading', { name: 'Review transfer' });
  await expect(heading).toBeFocused();
  await expect(heading).toBeInViewport();
});

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
