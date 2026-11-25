import { expect, test, type Page } from '@playwright/test';
import { globSync, readFileSync } from 'node:fs';
import axe from 'axe-core';
import { mountFixture } from '../scenarios/web/mount';
import { startTicketServer } from './http-fixture';

async function mountHttpQueue(page: Page, port: number) {
  await page.goto('http://127.0.0.1:' + port + '/fixture.html');
  await mountFixture(page, 'data-table', 'http-work-queue');
}

test('the production catalog omits the HTTP test transport', () => {
  const files = globSync('dist/catalog/assets/**/*.js');
  expect(files.length).toBeGreaterThan(0);
  for (const file of files) expect(readFileSync(file, 'utf8').includes('uldTablePort'), file).toBe(false);
});

const story = '/iframe.html?id=enterprise-collections--audit-queue&viewMode=story';
test('server paging, edits and cross-page bulk actions complete the same desktop and phone workflow', async ({ page }) => {
  for (const width of [1100, 390]) {
    const server = await startTicketServer();
    try {
      await page.setViewportSize({ width, height: 800 });
      await mountHttpQueue(page, server.port);
      const table = page.getByRole('table', { name: 'Audit records' });
      const row = table.locator('[data-row-id="t17"]');
      await expect(row).toHaveCSS('display', width < 400 ? 'grid' : 'table-row');
      await expect.poll(() => server.completed.length).toBeGreaterThan(0);
      const search = page.getByRole('searchbox', { name: 'Search records' });
      await search.fill('finance');
      // The server matches a private category; those words do not occur in a visible column.
      await expect(table.locator('[data-row-id="t35"]')).toBeVisible();
      await expect(table.locator('[data-row-id="t29"]')).toHaveCount(0);
      await row.getByRole('button', { name: 'Edit Title, Atlas audit' }).press('Enter');
      const draft = row.getByRole('textbox', { name: 'Edit Title, Atlas audit' });
      await draft.fill('Atlas approved');
      await draft.press('Enter');
      await expect(page.getByRole('alert')).toHaveText('Could not save changes. Try again.');
      await expect(draft).toBeFocused();
      await expect(draft).toHaveValue('Atlas approved');
      expect(server.records().find(record => record.id === 't17')?.title).toBe('Atlas audit');
      await draft.press('Enter');
      await expect(page.getByText('Saved Atlas approved', { exact: true })).toBeVisible();
      await expect(row.getByRole('button', { name: 'Edit Title, Atlas approved' })).toBeFocused();
      expect(server.records().find(record => record.id === 't17')?.title).toBe('Atlas approved');
      expect(server.requests.filter(item => item.method === 'PATCH')).toHaveLength(2);
      await search.fill('');
      await expect(table.locator('[data-row-id="t29"]')).toBeVisible();
      await row.getByRole('checkbox', { name: 'Select Atlas approved' }).check();
      await page.getByRole('button', { name: 'Next page' }).click();
      const cedar = table.locator('[data-row-id="t35"]');
      await expect(cedar).toBeVisible();
      await cedar.getByRole('checkbox', { name: 'Select Cedar audit' }).check();
      await expect(page.getByText('2 selected', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Archive selected' }).click();
      await expect(page.getByText('Archived 2 records', { exact: true })).toBeVisible();
      expect(server.requests.filter(item => item.method === 'POST').map(item => item.ids)).toEqual([['t17', 't35']]);
      expect(server.records().map(item => item.id)).toEqual(['t29', 't41']);
      await expect(table.locator('[data-row-id="t17"]')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    } finally { await server.close(); }
  }
});

test('a late server response cannot replace results from a newer search', async ({ page }) => {
  const server = await startTicketServer();
  try {
    await mountHttpQueue(page, server.port);
    const field = page.getByRole('searchbox');
    const table = page.getByRole('table');
    await table.getByRole('button', { name: 'Team' }).click();
    await expect(table.locator('[data-row-id]').first()).toHaveAttribute('data-row-id', 't41');
    expect(server.requests.some(item => item.path.includes('sort=team'))).toBe(true);
    await expect(table).not.toHaveAttribute('aria-busy', 'true');
    const before = await table.boundingBox();
    await field.fill('slow');
    await expect.poll(() => server.requests.some(item => item.path.includes('q=slow'))).toBe(true);
    await expect(table).toHaveAttribute('aria-busy', 'true');
    expect(await table.boundingBox()).toEqual(before);
    // The next browser round trip installs the listener before the server releases its response.
    const slowResponse = page.waitForResponse(response => new URL(response.url()).searchParams.get('q') === 'slow');
    await field.fill('finance');
    await expect(page.getByRole('button', { name: 'Edit Title, Cedar audit' })).toBeVisible();
    server.finishSlow();
    const response = await slowResponse;
    expect(await response.finished()).toBeNull();
    expect((await response.json()).rows.map((row: { id: string }) => row.id)).toEqual(['slow']);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect.poll(() => server.completed.some(path => path.includes('q=slow'))).toBe(true);
    await expect(page.getByRole('button', { name: 'Edit Title, Cedar audit' })).toBeVisible();
    await expect(table.locator('[data-row-id="slow"]')).toHaveCount(0);
    await expect(field).toHaveValue('finance');
  } finally { await server.close(); }
});

test('the adaptive table preserves accessible names and native controls in both themes and viewports', async ({ page }) => {
  for (const width of [390, 1100]) for (const theme of ['light', 'dark'] as const) {
    await page.setViewportSize({ width, height: 800 });
    await page.emulateMedia({ colorScheme: theme });
    await page.goto(story + '&globals=scheme:' + theme);
    const table = page.getByRole('table', { name: 'Audit records' });
    await expect(table.getByRole('columnheader', { name: 'Title' })).toBeVisible();
    await expect(table.getByRole('row')).toHaveCount(3);
    await expect(table.getByRole('checkbox', { name: 'Select Atlas audit' })).toBeVisible();
    await page.addScriptTag({ content: axe.source });
    const failures = await page.evaluate(async () => (await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
    })).violations.map(v => [v.id, v.nodes.map(node => node.target)]));
    expect(failures).toEqual([]);
  }
});

test('a controlled page checkbox retains its real mixed state when its owner vetoes selection', async ({ page }) => {
  await mountFixture(page, 'data-table', 'controlled-selection');
  const header = page.getByRole('checkbox', { name: 'Select page' });
  const row = page.getByRole('checkbox', { name: 'Select Gamma' });
  const ids = page.getByRole('status', { name: 'Proposed IDs' });
  await expect(row).toBeChecked();
  for (const activate of [() => header.press('Space'), () => header.click()]) {
    await expect(header).toBeChecked({ indeterminate: true });
    await activate();
    await expect(ids).toHaveText('a,b,c');
    await expect.poll(() => header.evaluate(node => (node as HTMLInputElement).indeterminate)).toBe(true);
    await expect(row).toBeChecked();
  }
});

test('the narrow stylesheet and legacy collection stylesheet isolate nested unstyled tables', async ({ page, browserName }) => {
  const { readFileSync } = await import('node:fs');
  const requests: string[] = [];
  await page.route('http://styles.test/**', route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('.css')) {
      if (url.pathname === '/tokens.css') {
        return route.fulfill({ contentType: 'text/css', body: readFileSync('packages/tokens/dist/styles.css', 'utf8') });
      }
      if (!['/data-table.css', '/collections.css'].includes(url.pathname)) throw Error('Unexpected stylesheet');
      requests.push(url.pathname);
      return route.fulfill({ contentType: 'text/css', body: readFileSync('packages/web/dist' + url.pathname, 'utf8') });
    }
    const css = url.searchParams.get('sheet');
    return route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><meta charset=utf-8><title>Style consumer</title><link rel="stylesheet" href="/' + css + '.css"><section class="uld-data" data-uld-table><div class="uld-data-scroll" id="scroll"><button id="edit" data-part="edit">Edit</button><label data-part="selector" id="tap"><input type="checkbox" id="styled" aria-label="Select record"></label></div><section data-uld-table><input type="checkbox" id="plain"></section></section><div class="uld-virtual-grid" id="virtual"></div>' });
  });
  for (const sheet of ['data-table', 'collections']) {
    requests.length = 0;
    await page.goto('http://styles.test/?sheet=' + sheet);
    await expect(page.locator('#scroll')).toHaveCSS('overflow-x', 'auto');
    await expect(page.locator('#styled')).toHaveCSS('width', '20px');
    expect(await page.locator('#plain').evaluate(el => getComputedStyle(el).width)).not.toBe('20px');
    await expect(page.locator('#virtual')).toHaveCSS('overflow-x', sheet === 'collections' ? 'auto' : 'visible');
    expect(requests).toEqual(sheet === 'collections' ? ['/collections.css', '/data-table.css'] : ['/data-table.css']);
  }
  const edit = page.getByRole('button', { name: 'Edit' });
  await page.keyboard.press(browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab');
  await expect(edit).toBeFocused();
  for (const theme of ['standalone', 'default tokens']) {
    if (theme === 'default tokens') await page.addStyleTag({ url: 'http://styles.test/tokens.css' });
    await expect(edit).toHaveCSS('outline-width', '3px');
    await expect(edit).toHaveCSS('outline-offset', '3px');
    await expect(edit).toHaveCSS('border-radius', '7px');
    for (const size of ['10px', '32px', '16px']) {
      await page.locator('html').evaluate((el, fontSize) => { el.style.fontSize = fontSize; }, size);
      await expect(page.locator('#tap')).toHaveCSS('min-height', '44px');
      await expect(page.locator('#tap')).toHaveCSS('min-width', '44px');
      await expect(edit).toHaveCSS('min-height', '44px');
      await expect(page.locator('.uld-data')).toHaveCSS('gap', '16px');
    }
  }
  await page.locator('html').evaluate(el => { el.style.zoom = '2'; });
  const box = await page.locator('#tap').boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(88);
  expect(box!.height).toBeGreaterThanOrEqual(88);
  await page.emulateMedia({ forcedColors: 'active' });
  const forced = await page.evaluate(() => matchMedia('(forced-colors: active)').matches);
  if (browserName === 'chromium') expect(forced).toBe(true);
  if (forced) {
    await expect(edit).toHaveCSS('outline-style', 'solid');
    await expect(edit).toHaveCSS('outline-width', '3px');
  }
  await page.addStyleTag({ content: ':root{--uld-focus-width:6px;--uld-focus-offset:9px;--uld-radius:11px}[data-uld-table] #styled { width: 32px; }' });
  await expect(edit).toHaveCSS('outline-width', '6px');
  await expect(edit).toHaveCSS('outline-offset', '9px');
  await expect(edit).toHaveCSS('border-radius', '11px');
  await expect(page.locator('#styled')).toHaveCSS('width', '32px');
});

test('record text stays selectable and copyable, with reachable controls at twice-normal layout zoom', async ({ page }) => {
  await page.goto(story);
  const north = page.getByRole('cell', { name: 'North', exact: true });
  const point = await north.evaluate(cell => {
    const text = [...cell.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim() === 'North')!;
    const range = document.createRange(); range.selectNodeContents(text);
    const box = range.getBoundingClientRect(); return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  });
  await page.mouse.dblclick(point.x, point.y);
  await expect.poll(() => page.evaluate(() => getSelection()?.toString().trim())).toBe('North');
  // Observe an uncanceled OS copy shortcut without writing fixture text into the host clipboard.
  await page.evaluate(() => document.addEventListener('copy', event => {
    document.documentElement.dataset.tableCopy = event.defaultPrevented ? 'canceled' : getSelection()?.toString().trim();
    event.preventDefault();
  }, { once: true }));
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+c' : 'Control+c');
  await expect(page.locator('html')).toHaveAttribute('data-table-copy', 'North');

  await page.setViewportSize({ width: 550, height: 700 });
  await page.evaluate(() => { document.documentElement.dir = 'rtl'; document.documentElement.style.zoom = '2'; });
  const row = page.locator('[data-row-id="t17"]');
  await expect(row).toHaveCSS('display', 'grid');
  const selector = row.locator('[data-part="selector"]');
  const box = await selector.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(88);
  expect(box!.height).toBeGreaterThanOrEqual(88);
  await row.getByRole('checkbox').check();
  await expect(page.getByText('1 selected', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test('Escape cancels a table cell edit inside a dialog and keeps focus on the cell', async ({ page }) => {
  await mountFixture(page, 'data-table', 'review-table');
  const dialog = page.getByRole('dialog', { name: 'Review' });
  const name = 'Edit Title, Gamma';
  const trigger = dialog.getByRole('button', { name });
  await trigger.click();
  const field = dialog.getByRole('textbox', { name });
  await field.fill('Uncommitted');
  await field.press('Escape');
  await expect(field).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await expect(trigger).toHaveText('Gamma');
  await expect(trigger).toBeFocused();
});

test('table viewport takes focus when an owner removes the focused editor or cell', async ({ page }) => {
  for (const editing of [true, false]) {
    await mountFixture(page, 'data-table', 'review-table');
    const table = page.getByRole('table', { name: 'Queue' });
    const row = table.locator('[data-row-id="a"]');
    const trigger = row.getByRole('button', { name: 'Edit Title, Gamma' });
    if (editing) {
      await trigger.click();
      await expect(row.getByRole('textbox')).toBeFocused();
    } else {
      await trigger.focus();
      await expect(trigger).toBeFocused();
    }
    // An owner update can remove the row without moving keyboard focus.
    await page.getByRole('button', { name: 'Remove first record' }).evaluate(button => (button as HTMLButtonElement).click());
    await expect(row).toHaveCount(0);
    await expect(page.locator('[data-part="viewport"]')).toBeFocused();
    await expect(page.getByRole('group', { name: 'Table contents', exact: true })).toBeFocused();
  }
});

test('the accessibility tree declares the table name once', async ({ page }) => {
  await mountFixture(page, 'data-table', 'queue');
  const table = page.getByRole('table', { name: 'Queue' });
  await expect(table).toBeVisible();
  const snapshot = await page.locator('[data-uld-table]').ariaSnapshot();
  expect(snapshot).toContain('table "Queue"');
  expect(snapshot.match(/(?:table|region) "Queue"/g)).toHaveLength(1);
});
