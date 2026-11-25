import { expect, test, type Page } from '@playwright/test';
import { Dialog as ReactAriaDialog } from 'react-aria-components';
import { OverlayDialog } from '@ui-lazy-dev/ui-web/navigation';
import { mountFixture } from '../scenarios/web/mount';

declare global {
  interface Window { releaseOverlayFrame(): void }
}

async function holdFrame(page: Page) {
  await page.evaluate(() => {
    const frame = window.requestAnimationFrame.bind(window);
    const cancel = window.cancelAnimationFrame.bind(window);
    const queued = new Map<number, FrameRequestCallback>();
    let id = -1;
    window.requestAnimationFrame = callback => { queued.set(id, callback); return id--; };
    window.cancelAnimationFrame = handle => { if (handle == null || !queued.delete(handle)) cancel(handle); };
    Object.assign(window, { releaseOverlayFrame() {
      window.requestAnimationFrame = frame;
      window.cancelAnimationFrame = cancel;
      frame(time => queued.forEach(callback => callback(time)));
    } });
  });
}

test('a previously dismissed Select cannot take focus from the more recent dialog trigger', async ({ page }) => {
  // Consumers can recognize an overlay through React's actual forwardRef component.
  expect(typeof OverlayDialog).toBe(typeof ReactAriaDialog);
  expect(Reflect.get(OverlayDialog, '$$typeof')).toBe(Reflect.get(ReactAriaDialog, '$$typeof'));
  expect(typeof Reflect.get(OverlayDialog, 'render')).toBe('function');
  expect(Reflect.get(OverlayDialog, 'displayName')).toBe(Reflect.get(ReactAriaDialog, 'displayName'));
  await page.goto('/iframe.html?id=enterprise-navigation--actions&viewMode=story');
  const language = page.getByRole('button', { name: /Language/ });
  await language.press('Enter');
  const french = page.getByRole('option', { name: 'French' });
  await expect(french).toBeVisible();

  // Both overlays close before the compositor presents another frame, as on a busy host.
  await holdFrame(page);
  await french.press('Enter');
  await expect(language).toContainText('French');
  await page.getByRole('slider', { name: 'Priority' }).press('ArrowRight');
  const trigger = page.getByRole('button', { name: 'Review summary' });
  await trigger.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Review summary' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await page.evaluate(() => window.releaseOverlayFrame());
  await expect(trigger).toBeFocused();
});

async function settleFrame(page: Page) {
  await page.evaluate(() => {
    window.releaseOverlayFrame();
    return new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done())));
  });
}

async function expectRefBalancedOnce(page: Page, names: string[]) {
  for (const name of names) {
    await expect(page.locator('body')).toHaveAttribute('data-' + name + '-mounts', '1');
    await expect(page.locator('body')).toHaveAttribute('data-' + name + '-unmounts', '1');
  }
}

test('two siblings dismissed before the next frame return focus to the last launcher', async ({ page }) => {
  await mountFixture(page, 'modal-dialog', 'sequential-dialogs');
  const parent = page.getByRole('dialog', { name: 'Parent' });
  const sibling = page.getByRole('dialog', { name: 'Sibling' });
  const launcher = page.getByRole('button', { name: 'Open sibling' });
  await page.getByRole('button', { name: 'Open parent' }).press('Enter');
  await expect(parent).toBeVisible();
  await parent.getByRole('button', { name: 'Finish parent' }).focus();
  await expect(parent.getByRole('button', { name: 'Finish parent' })).toBeFocused();
  await holdFrame(page);
  await page.keyboard.press('Escape');
  await expect(parent).toBeHidden();
  await launcher.press('Enter');
  await expect(sibling).toBeVisible();
  await sibling.getByRole('button', { name: 'Finish sibling' }).focus();
  await expect(sibling.getByRole('button', { name: 'Finish sibling' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(sibling).toBeHidden();
  await settleFrame(page);
  await expect(launcher).toBeFocused();
  await expectRefBalancedOnce(page, ['parent', 'sibling']);
});

test('a child and parent dismissed before the next frame return focus outside both', async ({ page }) => {
  await mountFixture(page, 'modal-dialog', 'sequential-dialogs');
  const parent = page.getByRole('dialog', { name: 'Parent' });
  const child = page.getByRole('dialog', { name: 'Child' });
  const launcher = page.getByRole('button', { name: 'Open parent' });
  await launcher.press('Enter');
  await parent.getByRole('button', { name: 'Open child' }).press('Enter');
  await expect(child).toBeVisible();
  await child.getByRole('button', { name: 'Finish child' }).focus();
  await expect(child.getByRole('button', { name: 'Finish child' })).toBeFocused();
  await holdFrame(page);
  await page.keyboard.press('Escape');
  await expect(child).toBeHidden();
  await parent.getByRole('button', { name: 'Finish parent' }).press('Enter');
  await expect(parent).toBeHidden();
  await settleFrame(page);
  await expect(launcher).toBeFocused();
  await expectRefBalancedOnce(page, ['child', 'parent']);
});

test('one owner action may dismiss two controlled siblings inside the same task', async ({ page }) => {
  await mountFixture(page, 'modal-dialog', 'sequential-dialogs');
  await page.getByRole('button', { name: 'Open parent' }).press('Enter');
  const finish = page.getByRole('button', { name: 'Dismiss both' });
  await expect(finish).toBeVisible();
  await holdFrame(page);
  await finish.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await settleFrame(page);
  await expect(page.getByRole('button', { name: 'Open sibling' })).toBeFocused();
  await expectRefBalancedOnce(page, ['parent', 'sibling']);
});
