import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { createTheme, registerBrand, type ContextDefinition, type ModeSelection } from '@ui-lazy-dev/tokens/modes';
import { expressive } from '@ui-lazy-dev/tokens/brands/expressive';
import { createBrandCSS, createContextCSS } from '@ui-lazy-dev/tokens/theme-css';
import { createRequire } from 'node:module';

declare module '@ui-lazy-dev/tokens/modes' {
  interface ConsumerBrands { partner: true }
  interface ConsumerModes { 'contrast-test': true }
}

const require = createRequire(import.meta.url);
const context: ContextDefinition = JSON.parse(readFileSync(new URL('../../catalog/modes/reading.json', import.meta.url), 'utf8'));
const theme = createTheme({ brands: [expressive], modes: [context] });
const css = [
  ...['styles.css', 'modes.css', 'brands/enterprise.css', 'brands/expressive.css'].map(name =>
    readFileSync(require.resolve('@ui-lazy-dev/tokens/' + name), 'utf8')),
  createContextCSS(context),
].join('\n');

test('nested axis and context changes preserve sibling styles, focus, input and scroll', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setContent(`<style>${css}
    #scroll {height:50px; overflow:auto} #spacer {height:400px}
    input {background:var(--uld-surface); color:var(--uld-text)}
  </style><main><section id="reading" data-uld-brand="expressive" data-uld-mode="reading">
    <div id="dark" data-uld-scheme="dark"><div id="compact" data-uld-density="compact">
      <div id="enterprise" data-uld-brand="enterprise"><input aria-label="Draft"></div>
      <div id="reset" data-uld-mode="default"></div>
    </div></div><div id="scroll"><div id="spacer"></div></div>
    </section><aside id="sibling"></aside></main>`);
  const tokens = (id: string) => page.locator('#' + id).evaluate(el =>
    ['accent', 'control', 'enter-duration', 'surface', 'body-size'].map(key =>
      getComputedStyle(el).getPropertyValue('--uld-' + key).trim()));
  async function check(id: string, mode: ModeSelection) {
    const { tokens: values } = theme.resolve({ ...mode, motion: mode.motion ?? 'reduced' });
    expect(await tokens(id)).toEqual([values.color.accent, values.size.control + 'px',
      values.motion.enterDuration + 'ms', values.color.surface, values.type.bodySize + 'px']);
  }
  await check('sibling', {});
  await check('reading', { brand: 'expressive', mode: 'reading' });
  await check('compact', { brand: 'expressive', scheme: 'dark', density: 'compact', mode: 'reading' });
  await check('enterprise', { scheme: 'dark', density: 'compact', mode: 'reading' });
  await check('reset', { brand: 'expressive', scheme: 'dark', density: 'compact' });
  const field = page.getByRole('textbox', { name: 'Draft' });
  await field.fill('unsaved value');
  await page.locator('#scroll').evaluate(el => { el.scrollTop = 120; });
  await page.locator('#dark').evaluate(el => {
    el.setAttribute('data-uld-scheme', 'high-contrast');
    el.setAttribute('data-uld-motion', 'full');
  });
  await check('enterprise', { scheme: 'high-contrast', density: 'compact', motion: 'full', mode: 'reading' });
  await expect(field).toBeFocused();
  await expect(field).toHaveValue('unsaved value');
  expect(await page.locator('#scroll').evaluate(el => el.scrollTop)).toBe(120);
  await check('sibling', {});
  await page.locator('html').evaluate(el => el.setAttribute('data-uld-scheme', 'dark'));
  await check('sibling', { scheme: 'dark' });
  await page.locator('html').evaluate(el => {
    el.removeAttribute('data-uld-scheme');
    el.setAttribute('data-uld-theme', 'dark');
  });
  await check('sibling', { scheme: 'dark' });
});

test('registered brand aliases resolve in alternate schemes and nested contexts', async ({ page }) => {
  const base = registerBrand('partner', {
    scheme: { light: { 'color.accent': '{color.text}' }, dark: { 'color.text': '{color.accent}' } },
    motion: { full: { 'motion.enterDuration': '{motion.pressDuration}' } },
  });
  const partner = { ...base, rules: [...base.rules, {
    when: { scheme: 'dark', density: 'compact' }, tokens: { 'space.spaceMd': '{size.control}' },
  } as const] };
  const contrast: ContextDefinition = { name: 'contrast-test', overrides: ['color.accent', 'color.text'],
    tokens: { 'color.accent': '#204060', 'color.text': '{color.accent}' } };
  const registered = createTheme({ brands: [partner], modes: [contrast] });
  await page.setContent(`<style>${css}${createBrandCSS(partner)}${createContextCSS(contrast)}</style>
    <main data-uld-brand="partner" id="default">
      <aside data-uld-scheme="dark" id="dark"><div data-uld-density="compact" id="inherited">
        <div data-uld-scheme="light" id="light"><section data-uld-mode="contrast-test" id="context">
          <span data-uld-mode="default" id="reset"></span>
        </section></div></div></aside>
    </main>`);
  await page.locator('html').evaluate(el => {
    el.id = 'root';
    el.setAttribute('data-uld-brand', 'partner');
  });
  for (const motion of ['full', 'reduced'] as const) {
    await page.emulateMedia({ reducedMotion: motion === 'full' ? 'no-preference' : 'reduce' });
    for (const [id, scheme, density, mode] of [
      ['root', 'light', 'comfortable', 'default'], ['default', 'light', 'comfortable', 'default'],
      ['dark', 'dark', 'comfortable', 'default'], ['inherited', 'dark', 'compact', 'default'],
      ['light', 'light', 'compact', 'default'], ['context', 'light', 'compact', 'contrast-test'],
      ['reset', 'light', 'compact', 'default'],
    ] as const) {
      const { color, space, motion: durations } = registered.resolve({ brand: 'partner', scheme, density, mode, motion }).tokens;
      const actual = await page.locator('#' + id).evaluate(el =>
        ['--uld-accent', '--uld-text', '--uld-space-md', '--uld-enter-duration'].map(name =>
          getComputedStyle(el).getPropertyValue(name).trim()));
      expect(actual, id).toEqual([color.accent, color.text, space.spaceMd + 'px', durations.enterDuration + 'ms']);
    }
  }
});

test.describe('coarse pointer', () => {
  test.use({ hasTouch: true });
  test('compact density preserves the minimum target for existing control sizes', async ({ page }) => {
    await page.setContent(`<style>${css}button { min-height:var(--uld-control); min-width:var(--uld-control); }
      button[aria-label=Small] {min-height:var(--uld-compact-target); min-width:var(--uld-compact-target)}</style>
      <main data-uld-density="compact"><button aria-label="Small"></button><button aria-label="Medium"></button></main>`);
    for (const name of ['Small', 'Medium']) {
      const box = await page.getByRole('button', { name }).boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(48);
      expect(box?.width).toBeGreaterThanOrEqual(48);
    }
  });
});

for (const width of [390, 1100]) {
  test('the catalog reading flow exposes brand and contextual modes at ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    for (const brand of ['enterprise', 'expressive'] as const) {
      const mode = brand === 'expressive' ? 'reading' : 'default';
      await page.goto('/iframe.html?id=themes-reading-list--reading-list&viewMode=story&globals=brand:' +
        brand + ';scheme:dark;density:comfortable;mode:' + mode);
      const scope = page.locator('[data-uld-brand="' + brand + '"][data-uld-mode="' + mode + '"]');
      const button = scope.getByRole('button', { name: 'Save to reading list' });
      await button.click();
      await expect(scope.getByRole('status')).toHaveText('Saved to your list');
      const expected = theme.resolve({ brand, scheme: 'dark', mode }).tokens;
      expect(await scope.evaluate(el => getComputedStyle(el).getPropertyValue('--uld-accent').trim()))
        .toBe(expected.color.accent);
    }
  });
}
