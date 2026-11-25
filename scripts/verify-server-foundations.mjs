import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { expect } from '@playwright/test';

async function routeScripts(browser, base, route) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    const scripts = [];
    page.on('response', response => {
      if (response.request().resourceType() !== 'script') return;
      scripts.push(response.body().then(bytes => {
        assert.equal(new URL(response.url()).origin, new URL(base).origin);
        assert.equal(response.ok(), true, response.url());
        return [createHash('sha256').update(bytes).digest('hex'), gzipSync(bytes, { level: 9 }).length];
      }));
    });
    const response = await page.goto(new URL(route, base).href, { waitUntil: 'networkidle' });
    assert.equal(response?.status(), 200, route);
    const assets = new Map(await Promise.all(scripts));
    assert.ok(assets.size, 'Next must serve its framework runtime for ' + route);
    return assets;
  } finally {
    await context.close();
  }
}

function additionalBytes(assets, framework) {
  let bytes = 0;
  for (const [digest, gzip] of assets) if (!framework.has(digest)) bytes += gzip;
  return bytes;
}

async function verifyContextualBindings(browser, base) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    assert.equal((await page.goto(new URL('/composition', base).href))?.status(), 200);
    const choose = page.getByRole('button', { name: 'Choose edition' });
    await choose.click();
    const dialog = page.getByRole('dialog', { name: 'Edition preferences' });
    const title = dialog.getByRole('heading', { level: 2, name: 'Edition preferences' });
    await title.waitFor();
    assert.equal(await dialog.getAttribute('aria-labelledby'), await title.getAttribute('id'));
    await dialog.getByRole('button', { name: 'Close' }).click();
    await dialog.waitFor({ state: 'detached' });
    // React Aria restores the original trigger on the frame after unmount.
    await expect(choose).toBeFocused();

    await page.getByRole('button', { name: 'Reading actions' }).click();
    const menu = page.getByRole('menu', { name: 'Reading actions' });
    await menu.getByRole('separator').waitFor();
    const save = menu.getByRole('menuitem', { name: /Save chapter/ });
    const shortcut = save.locator('kbd');
    assert.equal(await shortcut.textContent(), '⌘S');
    const shortcutId = await shortcut.getAttribute('id');
    assert.ok(shortcutId && (await save.getAttribute('aria-describedby'))?.split(' ').includes(shortcutId));
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowDown');
    await expect(menu.getByRole('menuitem', { name: 'Print chapter' })).toBeFocused();
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

export async function verifyServerFoundations(browser, base) {
  const html = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await html.newPage();
    const response = await page.goto(new URL('/foundations', base).href);
    assert.equal(response?.status(), 200);
    const main = page.getByRole('main');
    const heading = main.getByRole('heading', { name: 'Reading progress', level: 1, exact: true });
    await expect(heading.and(main.locator('h1')), 'Initial HTML must show the reading heading').toBeVisible();
    await expect(main, 'Initial HTML must show the page description')
      .toContainText('Review and save reading progress', { useInnerText: true });
    const print = main.getByRole('button', { name: 'Print chapter', exact: true })
      .and(main.locator('button[type="button"]'));
    await expect(print, 'Initial HTML must show a native, named Print chapter button').toBeVisible();
    await expect(print).toBeEnabled();
    await expect(print).toHaveText('Print chapter');
    assert.equal(await page.getByRole('progressbar', { name: 'Pages read' }).getAttribute('value'), '3');
    assert.equal(await page.getByRole('textbox', { name: 'Bookmark' }).inputValue(), 'Chapter one');
    assert.equal(await page.getByRole('separator', { name: 'Reading tools divider' }).getAttribute('aria-orientation'), 'vertical');
    assert.equal(await page.locator('kbd[aria-label="Print shortcut"]').textContent(), '⌘P');
    const nav = page.getByRole('navigation', { name: 'Book navigation' });
    const contents = nav.getByRole('link', { name: 'Contents', exact: true }).and(nav.locator('a[href="#contents"]'));
    await expect(contents, 'Initial HTML must show a native Contents link').toBeVisible();
    await expect(contents).toHaveAttribute('aria-current', 'page');
    await contents.click();
    await expect(page).toHaveURL(new URL('#contents', response.url()).href);
    const destination = main.locator(':target');
    await expect(destination, 'Contents must navigate to a visible section without JavaScript').toBeVisible();
    await expect(destination).toHaveText('Reading tools');
    const skip = page.getByRole('link', { name: 'Skip to reading list' });
    assert.equal(await skip.getAttribute('href'), '#' + await page.getByRole('main').getAttribute('id'));
    assert.equal(await page.getByRole('region', { name: 'Manuscript preview' }).count(), 1);
    assert.equal(await page.getByRole('heading', { name: 'No annotations' }).count(), 1);
    assert.equal(await page.getByRole('textbox', { name: 'Book code' }).inputValue(), '1234');
    assert.equal(await page.getByLabel('Attach manuscript').getAttribute('type'), 'file');
    const scope = page.locator('[data-uld-brand=enterprise][data-uld-density=compact][data-uld-scheme=dark]');
    assert.equal(await scope.getByRole('region', { name: 'Chapters' }).count(), 1);
  } finally {
    await html.close();
  }

  const [framework, foundations, interactive] = await Promise.all(
    ['/framework', '/foundations', '/'].map(route => routeScripts(browser, base, route)),
  );
  const extra = additionalBytes(foundations, framework);
  assert.equal(extra, 0, 'The server-only foundation route shipped ' + extra + ' B gzip of client scripts');
  assert.ok(additionalBytes(interactive, framework) > 0, 'The interactive control route must load a distinct client script');
  await verifyContextualBindings(browser, base);
  console.log('Server-only foundations rendered without JavaScript and shipped 0 incremental client-script bytes.');
}
