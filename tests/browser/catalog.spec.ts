import { expect, test } from '@playwright/test';
import axe from 'axe-core';
test('field names, validation and modal focus work in the shipped catalog', async ({ page }) => {
  await page.goto('/iframe.html?id=library--overview&viewMode=story');
  await expect(page.getByRole('heading', { name: 'Component library' })).toBeVisible();
  const input = page.getByRole('textbox', { name: 'Workspace name' });
  await page.getByRole('button', { name: 'Validate name' }).click();
  await expect(input).toHaveAccessibleDescription(
    'Use at least three characters. Enter at least three characters.',
  );
  await input.fill('Elevate');
  await page.getByRole('button', { name: 'Validate name' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  const opener = page.getByRole('button', { name: 'Open dialog' });
  await opener.focus();
  await opener.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Discard changes?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Keep editing' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  await page.addScriptTag({ content: axe.source });
  for (const dark of [false, true]) {
    if (dark) await page.getByRole('button', { name: 'Dark theme' }).click();
    const violations = await page.evaluate(async () =>
      (
        await (window as unknown as { axe: typeof axe }).axe.run(document.querySelector('main')!, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
        })
      ).violations.map((v) => v.id),
    );
    expect(violations).toEqual([]);
  }
  await page.setViewportSize({ width: 320, height: 700 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

  await page.goto('/iframe.html?id=components--embedded-draft&viewMode=story');
  const workspace = page.frameLocator('iframe[title="Draft workspace"]');
  const editorTrigger = workspace.getByRole('button', { name: 'Edit draft' });
  await page.getByRole('button', { name: 'Review embedded draft' }).click();
  const review = workspace.getByRole('dialog', { name: 'Review changes' });
  await expect(review).toBeVisible();
  const details = review.getByRole('button', { name: 'Review details' });
  // Native pointer activation can choose a different target on each engine.
  // Capture that choice before React handles the click and updates the dialog.
  const pointerFocus = await details.evaluateHandle(button => {
    const chosen = { element: null as Element | null };
    button.addEventListener('click', () => { chosen.element = button.ownerDocument.activeElement; },
      { capture: true, once: true });
    return chosen;
  });
  await details.click();
  await expect(details).toHaveAttribute('aria-expanded', 'true');
  expect(await pointerFocus.evaluate(({ element }) =>
    element !== null && element.ownerDocument.activeElement === element,
  ), 'The content update preserves pointer focus').toBe(true);
  await pointerFocus.dispose();

  await details.focus();
  await expect(details).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(details).toHaveAttribute('aria-expanded', 'false');
  await expect(details).toBeFocused();
  await review.getByRole('button', { name: 'Return to editor' }).click();
  await expect(review).toHaveCount(0);
  await expect(editorTrigger).toBeFocused();
  await workspace.getByRole('button', { name: 'Review new draft' }).click();
  await expect(editorTrigger).toHaveCount(0);
  await review.getByRole('button', { name: 'Continue to billing' }).click();
  await expect(review).toHaveCount(0);
  await expect(workspace.getByRole('heading', { name: 'Billing' })).toBeFocused();
});
