import { expect, test, type Page } from '@playwright/test';

import axe from 'axe-core';

const route = '/iframe.html?id=quality-draftreview--interactive&viewMode=story';

async function audit(page: Page, selector = 'main') {
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(
    async (context) =>
      (
        await window.axe.run(document.querySelector(context)!, {
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
          },
        })
      ).violations.map((issue) => ({
        id: issue.id,
        elements: issue.nodes.map((node) => node.target),
      })),
    selector,
  );
  expect(violations).toEqual([]);
}

test('failed saves retain input and stale or unmounted submissions cannot replace the latest result', async ({
  page,
}) => {
  await page.goto(route);
  const field = page.getByRole('textbox', { name: 'Draft title' });
  const save = page.getByRole('button', { name: 'Save draft' });
  await field.fill('Retained draft');
  await audit(page);
  await save.dblclick({ force: true });
  await expect(save).toBeDisabled();
  await expect(save).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByRole('button', { name: 'Reset draft' })).toBeDisabled();
  await expect(page.getByRole('status', { name: 'Requests created' })).toHaveText('1');
  await audit(page);
  await page.getByRole('button', { name: 'Fail request 1' }).click();
  await expect(field).toHaveValue('Retained draft');
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  await audit(page);
  await save.click();
  await page.getByRole('button', { name: 'Cancel save' }).click();
  await field.fill('Published revision');
  await save.click();
  await page.getByRole('button', { name: 'Resolve request 3' }).click();
  await page.getByRole('button', { name: 'Resolve request 2' }).click();
  await expect(page.getByRole('status', { name: 'Last saved title' })).toHaveText(
    'Published revision',
  );
  await field.fill('Unmounted draft');
  await save.click();
  await page.getByRole('button', { name: 'Close editor' }).click();
  await page.getByRole('button', { name: 'Resolve request 4' }).click();
  await page.getByRole('button', { name: 'Open editor' }).click();
  await expect(page.getByRole('status', { name: 'Last saved title' })).toHaveText(
    'Published revision',
  );
  await field.fill('Unsaved edit');
  await page.getByRole('button', { name: 'Reset draft' }).click();
  await expect(field).toHaveValue('Published revision');
});

test('audits regional content, nested themes and focus across landscape, tablet and constrained desktop', async ({
  page,
}) => {
  await page.goto(route);
  const section = page.getByRole('region', { name: 'Regional proof' });
  await expect(section.getByRole('img', { name: 'Mina Chen' })).toHaveText('MC');
  await expect(section.locator('bdi')).toHaveText('نسخة-東京-v2.pdf');
  await expect(section.getByRole('status')).toContainText('مستندان · ١٬٢٠٠');
  const regionalDate = await page.evaluate(() =>
    new Intl.DateTimeFormat('ar-EG', { dateStyle: 'long', timeZone: 'UTC' }).format(
      Date.UTC(2026, 10, 20),
    ),
  );
  await expect(section.locator('time')).toHaveText(regionalDate);
  await expect(section.locator('time')).toHaveAttribute('datetime', '2026-11-20');
  expect(await section.locator('bdi').evaluate((el) => getComputedStyle(el).unicodeBidi)).toBe(
    'isolate',
  );
  expect(
    await section.evaluate(
      (el) => getComputedStyle(el).color !== getComputedStyle(el.closest('main')!).color,
    ),
  ).toBe(true);
  const field = page.getByRole('textbox', { name: 'Draft title' });
  await field.fill('Keep this draft across resize');
  for (const [width, height] of [
    [812, 375],
    [768, 1024],
    [1440, 900],
    [390, 440],
  ]) {
    await page.setViewportSize({ width, height });
    await field.scrollIntoViewIfNeeded();
    await expect(field).toBeFocused();
    await expect(field).toHaveValue('Keep this draft across resize');
    const box = await field.boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await audit(page);
  await page.getByRole('button', { name: 'Preview draft' }).click();
  await audit(page, 'dialog');
  await expect(page.getByRole('button', { name: 'Close preview' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Preview draft' })).toBeFocused();
});

test('interrupting editorial motion by leaving the feature allows fresh keyboard interaction after return', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/iframe.html?id=patterns-publicationlibrary--editorial&viewMode=story');
  await page.getByRole('button', { name: 'Read details' }).press('Enter');
  await page.goto(route);
  await page.getByRole('button', { name: 'Preview draft' }).press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Preview draft' })).toBeFocused();
  expect(errors).toEqual([]);
});

test('retains navigation, focus and reflow at 200 and 400 percent magnification', async ({
  page,
  browserName,
}) => {
  await page.goto('/iframe.html?id=enterprise-workspace--review&viewMode=story');
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  const draft = page.getByRole('textbox', { name: 'Review notes' });
  const nav = page.getByRole('navigation', { name: 'Workspace' });
  await draft.fill('Keep ⇄ 東京');
  for (const [width, height, zoom] of [
    [1280, 900, 2],
    [1280, 900, 4],
    [812, 375, 1],
    [1440, 900, 1],
  ]) {
    await page.setViewportSize({ width, height });
    await page.evaluate((factor) => {
      document.documentElement.style.zoom = String(factor);
    }, zoom);
    await expect(draft).toBeFocused();
    await expect(draft).toHaveValue('Keep ⇄ 東京');
    await expect(nav.getByRole('link', { name: 'Review', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(nav.getByRole('link', { name: 'Review notes' })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      'page overflow at ' + zoom + '×',
    ).toBe(true);
  }
  await nav.getByRole('link', { name: 'Review', exact: true }).focus();
  // macOS WebKit uses Option-Tab to traverse links with default keyboard preferences.
  await page.keyboard.press(
    browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab',
  );
  const destination = nav.getByRole('link', { name: 'Review notes' });
  await expect(destination).toBeFocused();
  const visibleFocus = await destination.evaluate((el) => ({
    outline: getComputedStyle(el).outlineStyle,
    forced: matchMedia('(forced-colors: active)').matches,
  }));
  expect(visibleFocus.outline).not.toBe('none');
  if (browserName === 'chromium') expect(visibleFocus.forced).toBe(true);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#notes$/);
});

test('Button preserves native activation, nearby text selection and scrolling at increased layout zoom', async ({
  page, browser, browserName,
}) => {
  await page.setViewportSize({ width: 640, height: 300 });
  await page.goto('/iframe.html?id=actions-button-states--pending&viewMode=story');
  const title = page.getByRole('textbox', { name: 'Title' });
  const save = page.getByRole('button', { name: 'Save draft' });
  const count = page.getByRole('status', { name: 'Submissions' });
  await expect(count).toHaveText('0');

  await test.step('copy is offered the selected neighboring text', async () => {
    const heading = page.getByRole('heading', { name: 'Pending save' });
    await heading.click({ clickCount: 3 });
    await expect.poll(() => page.evaluate(() => getSelection()?.toString().trim())).toBe('Pending save');
    // Observe the trusted default action after the app handlers, then keep it off the host clipboard.
    await heading.evaluate(element => {
      window.addEventListener('copy', event => {
        element.setAttribute('data-copy-observation', JSON.stringify({
          trusted: event.isTrusted,
          canceled: event.defaultPrevented,
          text: getSelection()?.toString().trim(),
        }));
        event.preventDefault();
      }, { once: true });
    });
    await page.keyboard.press('ControlOrMeta+c');
    await expect(heading).toHaveAttribute('data-copy-observation', JSON.stringify({
      trusted: true, canceled: false, text: 'Pending save',
    }));
  });

  await test.step('a focused submit button retains its native key timing', async () => {
    expect(await save.evaluate(element => element instanceof HTMLButtonElement && element.type === 'submit')).toBe(true);
    await title.click();
    await page.keyboard.press(browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab');
    await expect(save).toBeFocused();
    await page.keyboard.down('Space');
    await expect(count).toHaveText('0');
    await page.keyboard.up('Space');
    await expect(count).toHaveText('1');
    await page.getByRole('button', { name: 'Finish saving' }).click();
    await save.focus();
    await page.keyboard.press('Enter');
    await expect(count).toHaveText('2');
  });

  await test.step('the magnified action stays readable and lets its page scroll', async () => {
    await page.getByRole('button', { name: 'Finish saving' }).click();
    await save.focus();
    const normal = (await save.boundingBox())!;
    // CSS layout zoom gives a 320 CSS-pixel content area at 2x on this 640px viewport.
    await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
    const enlarged = (await save.boundingBox())!;
    expect(enlarged.height).toBeGreaterThan(normal.height * 1.8);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const label = (await save.getByText('Save draft', { exact: true }).boundingBox())!;
    expect(label.x).toBeGreaterThanOrEqual(enlarged.x);
    expect(label.x + label.width).toBeLessThanOrEqual(enlarged.x + enlarged.width + 1);
    await expect(save).toBeFocused();
    await save.hover();
    const before = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, 180);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before);
    await expect(count).toHaveText('2');
  });

  // Playwright exposes browser-level multi-touch input through the Chromium protocol.
  if (browserName === 'chromium') {
    await test.step('a native two-finger gesture over the action magnifies the viewport', async () => {
      const mobile = await browser.newPage({ isMobile: true, hasTouch: true, viewport: { width: 390, height: 680 } });
      try {
        await mobile.goto(page.url());
        const action = mobile.getByRole('button', { name: 'Save draft' });
        await expect(action).toBeVisible();
        const box = (await action.boundingBox())!;
        const scale = () => mobile.evaluate(() => window.visualViewport!.scale);
        const initial = await scale();
        const input = await mobile.context().newCDPSession(mobile);
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        const start = Math.min(12, box.height / 3);
        const contacts = (radius: number) => [-1, 1].map((side, id) => ({
          id: id + 1, x, y: y + side * radius, radiusX: 3, radiusY: 3, force: 1,
        }));
        // The compositor's high-level pinch chooses its own starting span, which can hit neighboring controls.
        await action.evaluate(button => {
          button.addEventListener('touchstart', event => {
            const touches = Array.from((event as TouchEvent).touches);
            if (event.isTrusted && touches.length === 2 && touches.every(touch => button.contains(touch.target as Node)))
              button.setAttribute('data-pinch-contacts', '2');
          }, { passive: true });
        });
        await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: contacts(start) });
        await expect(action).toHaveAttribute('data-pinch-contacts', '2');
        // Start inside the target, then spread beyond Chromium's native gesture threshold across rendered frames.
        for (let radius = start + 10; radius <= start + 100; radius += 10) {
          await mobile.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
          await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: contacts(radius) });
        }
        await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await expect.poll(scale).toBeGreaterThan(initial * 1.2);
      } finally {
        await mobile.close();
      }
    });
  }
});
