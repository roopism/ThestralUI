import { expect, test } from '@playwright/test';
import axe from 'axe-core';
import { mountFixture } from '../scenarios/web/mount';

const story = (id: string, args = '') => '/iframe.html?id=components--' + id + '&viewMode=story' + (args ? '&args=' + args : '');

test('backdrop and Escape request dismissal only when the owner accepts it', async ({ page }) => {
  await page.goto(story('preference-panel', 'veto:true;backdrop:true'));
  await page.getByRole('button', { name: 'Open preferences' }).click();
  const dialog = page.getByRole('dialog', { name: 'Notification delivery' });
  const count = page.locator('output[aria-label="Dismissal requests"]');
  await expect(dialog).toHaveAttribute('data-part', 'root');
  await expect(dialog).toHaveClass(/\buld-dialog-root\b/);
  await dialog.getByRole('heading').click();
  await expect(count).toHaveText('0');
  await page.mouse.click(2, 2);
  await expect(count).toHaveText('1');
  await page.keyboard.press('Escape');
  await expect(count).toHaveText('2');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(dialog).toHaveCount(0);

  await page.goto(story('minimal-review'));
  await page.getByRole('button', { name: 'Open dialog' }).click();
  const minimal = page.getByRole('dialog', { name: 'Change review' });
  await page.mouse.click(2, 2);
  await expect(minimal).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(minimal).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(story('confirmation'));
  await page.getByRole('button', { name: 'Open dialog' }).click();
  await expect(page.getByRole('dialog', { name: 'Discard changes?' })).toBeVisible();
  await page.mouse.click(2, 2);
  await expect(page.getByRole('dialog', { name: 'Discard changes?' })).toHaveCount(0);
});

test('a retained dialog returns focus to the current launcher on every opening', async ({ page }) => {
  await page.goto(story('preference-panel'));
  const dialog = page.locator('dialog.preference-dialog');
  await expect(dialog).toHaveCount(1);
  const original = await dialog.elementHandle();
  for (const name of ['Open preferences', 'Preview preferences']) {
    const launcher = page.getByRole('button', { name });
    await launcher.click();
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAccessibleDescription('Choose how to receive updates about your workspace.');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(launcher).toBeFocused();
    expect(await dialog.evaluate((node, first) => node === first, original)).toBe(true);
  }
});

test('only the top dialog dismisses and the workspace keeps its input and focus', async ({ page, browserName }) => {
  await page.goto(story('draft-workspace'));
  const launcher = page.getByRole('button', { name: 'Review changes' });
  await launcher.press('Enter');
  const outer = page.getByRole('dialog', { name: 'Workspace review' });
  const field = outer.getByRole('textbox', { name: 'Draft title' });
  await field.fill('Amendment 日本語 — اختبار');
  const details = outer.getByRole('button', { name: 'Review details' });
  await details.press('Enter');
  const inner = page.getByRole('alertdialog', { name: 'Confirm discard' });
  const keep = inner.getByRole('button', { name: 'Keep editing' });
  await expect(keep).toBeFocused();
  const tab = browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab';
  await page.keyboard.press(tab);
  await expect(inner.getByRole('button', { name: 'Discard draft' })).toBeFocused();
  await page.keyboard.press(tab);
  await expect(keep).toBeFocused();
  await page.keyboard.press('Shift+' + tab);
  await expect(inner.getByRole('button', { name: 'Discard draft' })).toBeFocused();
  await page.keyboard.press(tab);
  await expect(keep).toBeFocused();
  await launcher.evaluate(node => (node as HTMLElement).focus());
  await expect(keep).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(inner).toHaveCount(0);
  await expect(details).toBeFocused();
  await expect(field).toHaveValue('Amendment 日本語 — اختبار');
  await page.keyboard.press('Escape');
  await expect(outer).toHaveCount(0);
  await expect(launcher).toBeFocused();
});

test('sizes, unstyled parts and consumer CSS apply to the active dialog', async ({ page }) => {
  const widths = [];
  for (const size of ['sm', 'md', 'lg']) {
    await page.goto(story('preference-panel', 'size:' + size));
    await page.getByRole('button', { name: 'Open preferences' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toHaveAttribute('data-size', size);
    widths.push((await dialog.boundingBox())!.width);
    await expect(dialog.locator('[data-part="actions"]')).toHaveCSS('display', 'flex');
    expect(await dialog.locator('[data-part="actions"]').evaluate(node => parseFloat(getComputedStyle(node).marginBlockStart))).toBeGreaterThan(0);
    await expect(dialog.locator('[data-part="heading"]')).toHaveClass(/\buld-dialog-heading\b/);
    await expect(dialog.locator('[data-part="body"]')).toHaveClass(/\buld-dialog-body\b/);
  }
  expect(widths[0]).toBeLessThan(widths[1]);
  expect(widths[1]).toBeLessThan(widths[2]);
  await page.addStyleTag({ content: '.preference-dialog { inline-size: 239px; padding: 7px } .uld-dialog-actions { display: grid }' });
  const styled = page.getByRole('dialog');
  await expect(styled).toHaveCSS('inline-size', '239px');
  await expect(styled).toHaveCSS('padding-top', '7px');
  await expect(styled.locator('[data-part="actions"]')).toHaveCSS('display', 'grid');
  await page.goto(story('preference-panel', 'unstyled:true'));
  await page.getByRole('button', { name: 'Open preferences' }).click();
  const plain = page.getByRole('dialog');
  await expect(plain).toHaveClass('uld-dialog-root preference-dialog');
  await expect(plain.locator('[data-part="actions"]')).toHaveCSS('display', 'block');
  await expect(plain.locator('[data-part="actions"]')).toHaveCSS('margin-block-start', '0px');
  await page.keyboard.press('Escape');
  await expect(plain).toHaveCount(0);

  // A styled outer modal must not give its ring to the headless content of a nested unstyled modal.
  for (const unstyled of [false, true]) {
    await page.goto(story('draft-workspace', 'unstyledConfirmation:' + unstyled));
    await page.getByRole('button', { name: 'Review changes' }).press('Enter');
    await page.getByRole('button', { name: 'Review details' }).press('Enter');
    const inner = page.getByRole('alertdialog');
    const heading = inner.getByRole('heading');
    await heading.evaluate(node => { node.tabIndex = -1; });
    await heading.focus();
    await expect(heading).toBeFocused();
    expect(await heading.evaluate(node => getComputedStyle(node).outlineOffset === '3px')).toBe(!unstyled);
    const keep = inner.getByRole('button', { name: 'Keep editing' });
    await keep.focus();
    await expect(keep).toHaveCSS('outline-offset', '3px');
    await page.addStyleTag({ content: 'dialog { --uld-focus-width: 4px; --uld-focus-offset: 6px }' });
    await expect(keep).toHaveCSS('outline-width', '4px');
    await expect(keep).toHaveCSS('outline-offset', '6px');
    if (!unstyled) {
      await heading.focus();
      await expect(heading).toHaveCSS('outline-offset', '6px');
    }
  }
});

test('long RTL content scrolls inside the modal and stays reachable at twice normal layout zoom', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 520 });
  await page.goto(story('preference-panel', 'direction:rtl;long:true'));
  await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
  await page.getByRole('button', { name: 'Open preferences' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveCSS('direction', 'rtl');
  const box = (await dialog.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(520);
  expect(await dialog.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true);
  expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  const pageOffset = await page.evaluate(() => scrollY);
  await dialog.hover();
  await page.mouse.wheel(0, 240);
  await expect.poll(() => dialog.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => scrollY)).toBe(pageOffset);
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('button', { name: 'Open preferences' })).toBeFocused();
});

test('open dialogs pass accessibility checks in both themes on phone and desktop', async ({ page }) => {
  for (const width of [390, 1100]) {
    await page.setViewportSize({ width, height: 850 });
    for (const mode of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: mode, reducedMotion: 'reduce' });
      await page.goto(story('preference-panel', 'mode:' + mode + ';scheme:' + mode));
      await page.getByRole('button', { name: 'Open preferences' }).click();
      const dialog = page.getByRole('dialog', { name: 'Notification delivery' });
      await expect(dialog).toBeVisible();
      await page.addScriptTag({ content: axe.source });
      const issues = await page.evaluate(async () => (await window.axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
      })).violations.map(issue => issue.id + ': ' + issue.nodes.map(node => node.target).join(', ')));
      expect(issues, width + 'px ' + mode).toEqual([]);
    }
  }
});

test('the open modal inherits theme, density, brand and motion changes without losing its input', async ({ page }) => {
  await page.goto(story('preference-panel'));
  await page.getByRole('button', { name: 'Open preferences' }).press('Enter');
  const dialog = page.getByRole('dialog');
  const input = dialog.getByRole('checkbox');
  await expect(input).toBeChecked();
  await input.focus();
  await page.keyboard.press('Space');
  await expect(input).not.toBeChecked();
  const observed = await dialog.evaluate(node => {
    const owner = node.closest('section')!;
    const swatch = document.createElement('span');
    swatch.style.cssText = 'background:var(--uld-surface);color:var(--uld-text);border-radius:var(--uld-radius);padding:var(--uld-space-lg)';
    owner.append(swatch);
    const colors = new Set<string>();
    const mismatches = [];
    for (const scheme of ['light', 'dark', 'high-contrast']) for (const brand of ['enterprise', 'expressive'])
      for (const density of ['compact', 'comfortable', 'spacious']) for (const motion of ['full', 'reduced']) {
        Object.assign(owner.dataset, { uldTheme: scheme === 'dark' ? 'dark' : 'light', uldScheme: scheme, uldBrand: brand, uldDensity: density, uldMotion: motion });
        const actual = getComputedStyle(node);
        const expected = getComputedStyle(swatch);
        colors.add(actual.backgroundColor);
        if (actual.backgroundColor !== expected.backgroundColor || actual.color !== expected.color ||
            actual.borderRadius !== expected.borderRadius || actual.paddingTop !== expected.paddingTop || actual.animationName !== 'none')
          mismatches.push([scheme, brand, density, motion]);
      }
    swatch.remove();
    return { colors: colors.size, mismatches };
  });
  expect(observed.mismatches).toEqual([]);
  expect(observed.colors).toBeGreaterThan(1);
  await expect(input).not.toBeChecked();
});

test('Tab wraps past unavailable controls around the editable note and final action', async ({ page, browserName }) => {
  await mountFixture(page, 'modal-dialog', 'keyboard-contenteditable');
  const launcher = page.getByRole('button', { name: 'Edit review notes' });
  await launcher.press('Enter');
  const note = page.getByRole('textbox', { name: 'Reviewer notes' });
  await expect(note).toHaveAttribute('contenteditable', 'true');
  const finish = page.getByRole('button', { name: 'Finish review' });
  await expect(note).toBeFocused();
  const tab = browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab';
  await page.getByRole('dialog').focus();
  await page.keyboard.press('Shift+' + tab);
  await expect(finish).toBeFocused();
  await page.keyboard.press(tab);
  await expect(note).toBeFocused();
  await page.keyboard.press('Shift+' + tab);
  await expect(finish).toBeFocused();
  await page.keyboard.press(tab);
  await expect(note).toBeFocused();
  await note.fill('Ready for review');
  await page.keyboard.press(tab);
  await expect(finish).toBeFocused();
  await finish.press('Enter');
  await expect(launcher).toBeFocused();
});

test('a vetoed controlled dialog stays open after two consecutive Escape presses', async ({ page }) => {
  await page.goto(story('preference-panel', 'veto:true'));
  await page.getByRole('button', { name: 'Open preferences' }).click();
  const dialog = page.getByRole('dialog', { name: 'Notification delivery' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('status', { name: 'Dismissal requests' })).toHaveText('1');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await expect.poll(() => dialog.evaluate(node => node.matches(':modal'))).toBe(true);
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(dialog).toHaveCount(0);
});
