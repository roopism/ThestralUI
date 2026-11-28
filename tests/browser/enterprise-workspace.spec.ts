import { expect, test } from '@playwright/test';
import axe from 'axe-core';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SplitView } from '@ui-lazy-dev/ui-web/workflows';
const story = (id: string) => '/iframe.html?id=enterprise-workspace--' + id + '&viewMode=story';

test('a review retains its draft, focus, selection and list scroll when resized mid-task', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 850 });
  await page.goto(story('review'));
  const list = page.getByRole('region', { name: 'Position list' });
  const detail = page.getByRole('region', { name: 'Application details' });
  const divider = page.getByRole('separator', { name: 'Resize list' });
  await expect(divider).toBeVisible();
  const bounds = await divider.boundingBox();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + 24);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + 80, bounds!.y + 24);
  await page.mouse.up();
  expect(Number(await divider.getAttribute('aria-valuenow'))).toBeGreaterThan(40);
  await divider.focus();
  await page.keyboard.press('Home');
  await expect(divider).toHaveAttribute('aria-valuenow', '20');
  const selected = list.getByRole('option', { name: 'Opportunity 30', exact: true });
  await selected.click();
  await expect(selected).toHaveAttribute('aria-selected', 'true');
  const scroll = await list.evaluate((element) => element.scrollTop);
  expect(scroll).toBeGreaterThan(0);
  const draft = detail.getByRole('textbox', { name: 'Review notes' });
  await draft.fill('Discuss with the hiring manager');
  await page.setViewportSize({ width: 320, height: 750 });
  await expect(divider).toBeHidden();
  expect((await detail.boundingBox())!.y).toBeGreaterThan((await list.boundingBox())!.y);
  await expect(draft).toBeFocused();
  await expect(draft).toHaveValue('Discuss with the hiring manager');
  await expect(selected).toHaveAttribute('aria-selected', 'true');
  expect(await list.evaluate((element) => element.scrollTop)).toBe(scroll);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.setViewportSize({ width: 1366, height: 850 });
  await expect(divider).toBeVisible();
  await page.keyboard.press('F6');
  await expect(selected).toBeFocused();
  await page.keyboard.press('F6');
  await expect(draft).toBeFocused();
});

test('command dialog supports keyboard activation and returns focus on dismissal', async ({
  page,
}) => {
  await page.goto(story('review'));
  const trigger = page.getByRole('button', { name: 'Find command' });
  await trigger.click();
  const input = page.getByRole('combobox', { name: 'Search commands' });
  await expect(input).toBeFocused();
  await input.fill('last');
  await input.press('Enter');
  await expect(page.getByRole('option', { name: 'Opportunity 48', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(trigger).toBeFocused();
  await trigger.click();
  await input.press('Escape');
  await expect(trigger).toBeFocused();
});

test('Arabic and mixed-script content reflows at twice the default text size', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(story('regional-team'));
  await page.addStyleTag({ content: 'html {font-size:200%}' });
  await expect(page.getByRole('heading', { name: 'مراجعة الفريق' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.addScriptTag({ content: axe.source });
  const report = await page.evaluate(() =>
    window.axe.run(document.querySelector('main')!, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
    }),
  );
  expect(report.violations.map((issue) => issue.id)).toEqual([]);
});
test('restores a saved workflow after reload and retries interrupted batch items', async ({
  page,
}) => {
  await page.goto(story('delivery'));
  await page.getByRole('textbox', { name: 'Destination' }).fill('design-review');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Confirm delivery' })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('textbox', { name: 'Destination' })).toHaveValue('design-review');
  await page.getByRole('button', { name: 'Retry Portfolio' }).click();
  await expect(page.getByRole('button', { name: 'Retry Portfolio' })).toBeHidden();
  await expect(
    page.getByRole('region', { name: 'Deliverables' }).getByText('2 of 2 finished'),
  ).toBeVisible();
});

test('split pane and divider focus rings stay visible independently of the indicator stroke', async ({ page }) => {
  await page.setContent(renderToStaticMarkup(createElement(SplitView, {
    listLabel: 'Positions', detailLabel: 'Review', resizeLabel: 'Resize', list: 'List', detail: 'Detail',
  })));
  await page.addStyleTag({ path: 'packages/web/dist/workflows.css' });
  await page.addStyleTag({ content: ':root { --uld-indicator-stroke: 0px }' });
  const targets = [page.getByRole('separator'), page.getByRole('region', { name: 'Review' })];
  await page.keyboard.press('Tab');
  for (const width of ['3px', '5px']) {
    if (width === '5px') await page.addStyleTag({ content: ':root { --uld-focus-width: 5px }' });
    for (const target of targets) {
      await target.focus();
      await expect(target).toBeFocused();
      expect(await target.evaluate(el => getComputedStyle(el).outlineWidth)).toBe(width);
    }
  }
});
