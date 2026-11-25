import { expect, test } from '@playwright/test';

test('keeps sheet controls above the keyboard and inside safe areas on resize', async ({
  page,
  browserName,
}) => {
  await page.setViewportSize({ width: 390, height: 850 });
  await page.goto('/iframe.html?id=patterns-publicationlibrary--editorial&viewMode=story');
  const trigger = page.getByRole('button', { name: 'Reading list (0)' });
  await trigger.press('Enter');
  const panel = page.getByRole('dialog', { name: 'Reading list' });
  const close = panel.getByRole('button', { name: 'Close list' });
  await expect(close).toBeFocused();
  if (browserName === 'chromium') {
    const session = await page.context().newCDPSession(page);
    await session.send('Emulation.setSafeAreaInsetsOverride', {
      insets: { top: 32, left: 42, right: 39, bottom: 34 },
    });
    await session.send('Emulation.setVirtualKeyboardGeometryOverride', {
      keyboardRect: { x: 0, y: 440, width: 390, height: 410 },
    });
    await expect
      .poll(() => panel.evaluate((el) => el.getBoundingClientRect().bottom))
      .toBeLessThanOrEqual(441);
    const insets = await panel.evaluate((el) => [
      getComputedStyle(el).paddingLeft,
      getComputedStyle(el).paddingRight,
      getComputedStyle(el).paddingBottom,
    ]);
    expect(insets).toEqual(['42px', '39px', '34px']);
    const body = panel.locator('.uld-edge-content');
    await body.evaluate((el) => {
      const list = document.createElement('ol');
      for (let i = 0; i < 100; i++) {
        const item = document.createElement('li');
        item.textContent = 'Saved publication ' + i;
        list.append(item);
      }
      el.append(list);
    });
    await expect
      .poll(() => panel.evaluate((el) => el.getBoundingClientRect().top))
      .toBeGreaterThanOrEqual(31);
    expect(await body.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    await expect(close).toBeFocused();
    await session.send('Emulation.setVirtualKeyboardGeometryOverride', {});
    await session.send('Emulation.setSafeAreaInsetsOverride', { insets: {} });
    await session.detach();
  } else {
    await page.setViewportSize({ width: 390, height: 440 });
  }
  await expect(close).toBeFocused();
  await close.press('Escape');
  await expect(trigger).toBeFocused();
});
