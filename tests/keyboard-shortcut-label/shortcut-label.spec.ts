import { expect, test } from '@playwright/test';
import { mountFixture } from '../scenarios/web/mount';

const story = (name: string) => '/iframe.html?id=foundations-keyboard-shortcut-label--' + name + '&viewMode=story';

test('a native chord reads one spoken phrase and leaves keyboard input to the command owner', async ({page, browserName}) => {
  await mountFixture(page, 'keyboard-shortcut-label', 'chord');
  const region = page.getByRole('region', {name:'Command palette'});
  const label = region.locator('kbd[data-part="root"]');
  await expect(label.locator('kbd')).toHaveText(['Ctrl', 'Shift', 'P']);
  const tree = await region.ariaSnapshot();
  expect(tree.match(/Control Shift P/g)).toHaveLength(1);
  expect(tree).not.toContain('Ctrl+Shift+P');
  await page.keyboard.press('Control+Shift+p');
  await expect(region.getByText('Palette closed')).toBeVisible();
  await page.keyboard.press(browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab');
  await expect(region.getByRole('button', {name:'Open command palette'})).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(region.getByText('Command palette opened')).toBeVisible();
});

test('an inline chord in Arabic retains its left-to-right glyph order and localized reading text', async ({page}) => {
  await mountFixture(page, 'keyboard-shortcut-label', 'inline-help');
  await page.getByRole('button', {name:'Keyboard help'}).click();
  const line = page.locator('p').filter({has:page.locator('kbd[data-part="root"]')});
  const label=line.locator('kbd[data-part="root"]');
  await expect(line).toHaveCSS('direction','rtl');
  await expect(label).toHaveCSS('direction','ltr');
  const [command,key] = await label.locator('kbd').evaluateAll(nodes => nodes.map(el => el.getBoundingClientRect().x));
  expect(command).toBeLessThan(key);
  const tree=await line.ariaSnapshot();
  expect(tree.match(/Command K/g)).toHaveLength(1);
  expect(tree).not.toContain('⌘K');
});

test('the contextual keyboard slot describes the real menu command and Enter performs its action', async ({page}) => {
  await mountFixture(page, 'keyboard-shortcut-label', 'menu-command');
  const trigger=page.getByRole('button',{name:'File actions'});
  await trigger.press('Enter');
  const item=page.getByRole('menuitem',{name:'Rename file'});
  await expect(item).toBeFocused();
  await expect(item).toHaveAccessibleDescription('Control R');
  const reference=await item.getAttribute('aria-describedby');
  expect(await item.locator('kbd[id]').getAttribute('id')).toBe(reference?.split(' ').find(id => id));
  await page.keyboard.press('Enter');
  await expect(page.getByText('File renamed')).toBeVisible();
  await expect(page.getByRole('menu')).toHaveCount(0);
});

test('CJK and RTL guide rows reflow at double layout zoom and key borders survive forced colors', async ({page}) => {
  await page.setViewportSize({width:320,height:720});
  await page.emulateMedia({forcedColors:'active'});
  await page.goto(story('editor-shortcuts'));
  const guide=page.getByRole('main',{name:'Editor shortcuts'});
  await expect(guide).toBeVisible();
  await page.locator('html').evaluate(el=>{el.style.zoom='2'});
  await expect(guide.getByText('次の結果へ移動')).toBeVisible();
  const dimensions=await guide.evaluate(el=>({scroll:el.scrollWidth, available:el.clientWidth}));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.available + 1);
  const heading = guide.getByRole('heading', { name: 'Editor shortcuts' });
  await heading.evaluate(el => { el.style.fontFamily = 'monospace'; });
  const fits = await heading.evaluate(el => {
    const text = document.createRange();
    text.selectNodeContents(el);
    const box = el.getBoundingClientRect();
    return [...text.getClientRects()].every(line => line.left >= box.left - 1 && line.right <= box.right + 1);
  });
  expect(fits).toBe(true);
  const chord=guide.locator('kbd[data-part="root"]').first();
  await expect(chord).toHaveCSS('border-top-style','solid');
  expect(await chord.evaluate(el=>parseFloat(getComputedStyle(el).borderTopWidth))).toBeGreaterThan(0);
  const colors=await chord.evaluate(el=>[getComputedStyle(el).color,getComputedStyle(el).backgroundColor]);
  expect(colors[0]).not.toBe(colors[1]);
});
