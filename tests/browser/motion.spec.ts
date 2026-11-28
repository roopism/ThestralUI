import { expect, test, type Page } from '@playwright/test';

import axe from 'axe-core';

async function openGallery(page: Page, theme: 'enterprise' | 'editorial') {
  await page.goto('/iframe.html?id=patterns-publicationlibrary--' + theme + '&viewMode=story');
  await expect(page.getByRole('region', { name: 'Publications' })).toBeVisible();
}

for (const theme of ['enterprise', 'editorial'] as const) {
  test('save and remove a publication in the ' + theme + ' theme', async ({ page }) => {
    await page.setViewportSize({ width: theme === 'enterprise' ? 1200 : 390, height: 850 });
    await openGallery(page, theme);
    const next = page.getByRole('button', { name: 'Next title' });
    await next.click();
    await expect(page.getByRole('status')).toHaveText('2 of 3');
    const details = page.getByRole('button', { name: 'Read details' });
    await details.click();
    await page.getByRole('button', { name: 'Save After Hours' }).click();
    const notice = page.getByRole('region', { name: 'Reading list updates' });
    await expect(notice).toContainText('After Hours saved');
    await notice.getByRole('button', { name: 'Dismiss' }).click();
    const trigger = page.getByRole('button', { name: 'Reading list (1)' });
    await trigger.click();
    const sheet = page.getByRole('dialog', { name: 'Reading list' });
    await sheet.getByRole('button', { name: 'Remove After Hours' }).click();
    const alert = page.getByRole('alertdialog', { name: 'Remove After Hours?' });
    await expect(alert.getByRole('button', { name: 'Keep title' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(alert).toHaveCount(0);
    await expect(sheet.getByRole('button', { name: 'Remove After Hours' })).toBeFocused();
    await sheet.getByRole('button', { name: 'Remove After Hours' }).click();
    await alert.getByRole('button', { name: 'Remove title' }).click();
    await expect(sheet).toContainText('No saved publications.');
    await expect(sheet.getByRole('heading', { name: 'Reading list' })).toBeFocused();
    await sheet.getByRole('button', { name: 'Close list' }).click();
    await expect(page.getByRole('button', { name: 'Reading list (0)' })).toBeFocused();
  });
}

test('removing a saved publication moves focus to the next title', async ({ page }) => {
  await openGallery(page, 'enterprise');
  await page.getByRole('button', { name: 'Read details' }).click();
  await page.getByRole('button', { name: 'Save Currents' }).click();
  await page.getByRole('button', { name: 'Next title' }).click();
  await page.getByRole('button', { name: 'Read details' }).click();
  await page.getByRole('button', { name: 'Save After Hours' }).click();
  await page.getByRole('button', { name: 'Reading list (2)' }).click();
  const sheet = page.getByRole('dialog', { name: 'Reading list' });
  await sheet.getByRole('button', { name: 'Remove Currents' }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Remove Currents?' });
  await confirm.getByRole('button', { name: 'Remove title' }).click();
  await expect(sheet.getByRole('button', { name: 'Remove Currents' })).toHaveCount(0);
  await expect(sheet.getByRole('button', { name: 'Remove After Hours' })).toBeFocused();
});

test('native scroll, RTL keys and reduced-motion disclosures work without horizontal page overflow', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 700 });
  await openGallery(page, 'editorial');
  const viewport = page.getByRole('group', { name: 'Publications', exact: true });
  await viewport.evaluate((node) => {
    node.scrollLeft = node.clientWidth * 2;
  });
  await expect(page.getByRole('status')).toHaveText('3 of 3');
  await viewport.evaluate((node) => {
    (node as HTMLElement).dir = 'rtl';
  });
  await viewport.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('status')).toHaveText('2 of 3');
  await page.getByRole('button', { name: 'Read details' }).click();
  await expect(page.getByRole('button', { name: 'Save After Hours' })).toBeVisible();
  expect(
    await page
      .locator('.uld-media-card[data-expanded] .uld-media-visual')
      .evaluate((node) => node.getAnimations().length),
  ).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async () =>
    (
      await (window as unknown as { axe: typeof axe }).axe.run(document.querySelector('main')!, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
      })
    ).violations.map((v) => v.id),
  );
  expect(violations).toEqual([]);
});

test('browse drawer returns focus on Escape and media tolerates rapid reversals', async ({
  page,
}) => {
  await openGallery(page, 'enterprise');
  const browse = page.getByRole('button', { name: 'Browse by topic' });
  await browse.click();
  await expect(page.getByRole('dialog', { name: 'Browse by topic' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(browse).toBeFocused();
  const card = page.getByRole('article').first();
  const toggle = card.getByRole('button', { name: 'Read details' });
  await toggle.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect(card.getByRole('button', { name: 'Hide details' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await expect(card.getByRole('button', { name: 'Save Currents' })).toBeVisible();
});

test('reflows with doubled text size and preserves keyboard focus in system colors', async ({
  page,
  browserName,
}) => {
  await page.setViewportSize({ width: 375, height: 750 });
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await openGallery(page, 'enterprise');
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  await page.getByRole('button', { name: 'Reading list (0)' }).focus();
  await page.keyboard.press('Enter');
  const close = page.getByRole('button', { name: 'Close list' });
  await expect(close).toBeFocused();
  const systemFocus = await close.evaluate((element) => ({
    forced: matchMedia('(forced-colors: active)').matches,
    outline: getComputedStyle(element).outlineStyle,
    withinWidth: element.getBoundingClientRect().right <= document.documentElement.clientWidth,
  }));
  if (browserName === 'chromium') expect(systemFocus.forced).toBe(true);
  expect(systemFocus.outline).toBe('solid');
  expect(systemFocus.withinWidth).toBe(true);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('cross-parent motion keeps work movable while sequences reverse or are interrupted', async ({
  page,
}) => {
  await page.goto('/iframe.html?id=motion-proofreview--interactive&viewMode=story');
  const queue = page.getByRole('region', { name: 'In review' });
  const approved = page.getByRole('region', { name: 'Approved' });
  await expect(queue).toContainText('Cover proof');
  const move = page.getByRole('button', { name: 'Move proof' });
  await move.click();
  await expect(approved).toContainText('Cover proof');
  await move.click();
  await expect(queue).toContainText('Cover proof');
  await page.getByRole('button', { name: 'Play sequence' }).click();
  await page.getByRole('button', { name: 'Reverse' }).click();
  const stages = page.getByRole('list');
  await stages.evaluate((list) => {
    // Hold the live tracks between driver commands. Restore their speed before the Cancel handler.
    window.addEventListener('click', () => {
      for (const track of list.getAnimations({ subtree: true })) {
        if (track.playState !== 'running') continue;
        const rate = track.playbackRate;
        track.playbackRate = 0;
        window.addEventListener('click', () => { track.playbackRate = rate; }, { capture: true, once: true });
      }
    }, { once: true });
  });
  await page.getByRole('button', { name: 'Play sequence' }).click();
  await expect(page.getByRole('status')).toHaveText('Playing');
  expect(await stages.evaluate((list) =>
    list.getAnimations({ subtree: true }).some((track) => track.playState === 'running'),
  )).toBe(true);
  await page.getByRole('button', { name: 'Cancel sequence' }).click();
  await expect(page.getByRole('status')).toHaveText('cancelled');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Play sequence' }).click();
  await expect(page.getByRole('status')).toHaveText('skipped');
});
