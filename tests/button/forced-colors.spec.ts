import {expect, test, type Locator} from '@playwright/test';

// Forced colors may paint a backing rectangle behind text which computed styles cannot see.
async function paintedContrast(label: Locator) {
  await label.scrollIntoViewIfNeeded();
  const box = await label.boundingBox();
  if (!box) throw new Error('The label has no rendered bounds');
  // Element screenshots round outwards and can include the contrasting control border.
  // Sample only pixels strictly inside this part on the actual complete viewport.
  const png = await label.page().screenshot({animations: 'disabled', scale: 'css'});
  return label.page().evaluate(async ({encoded, box}) => {
    const image = new Image();
    image.src = 'data:image/png;base64,' + encoded;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(image, 0, 0);
    const x = Math.ceil(box.x), y = Math.ceil(box.y);
    const {data} = ctx.getImageData(x, y, Math.floor(box.x + box.width) - x, Math.floor(box.y + box.height) - y);
    const linear = (value: number) => {
      const v = value / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    const luminance: number[] = [];
    for (let i = 0; i < data.length; i += 4)
      luminance.push(0.2126 * linear(data[i]) + 0.7152 * linear(data[i + 1]) + 0.0722 * linear(data[i + 2]));
    luminance.sort((a, b) => a - b);
    // Ignore isolated antialiasing pixels. Read the actual glyph interior and surrounding fill.
    const low = luminance[Math.floor(luminance.length * 0.05)];
    const high = luminance[Math.floor(luminance.length * 0.95)];
    return (high + 0.05) / (low + 0.05);
  }, {encoded: png.toString('base64'), box});
}

for (const scheme of ['light', 'dark'] as const) {
  test('forced colors paint primary and danger button labels in the ' + scheme + ' system palette', async ({page, browserName}) => {
    await page.emulateMedia({colorScheme: scheme, forcedColors: 'active', reducedMotion: 'reduce'});
    await page.goto('/iframe.html?id=actions-button-states--tones&viewMode=story&args=scheme:high-contrast;mode:' + scheme);
    await expect(page.getByRole('main')).toHaveAttribute('data-uld-scheme', 'high-contrast');
    expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
    await page.keyboard.press(browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab');
    const focused = page.getByRole('button', {name: 'Publish', exact: true});
    await expect(focused).toBeFocused();
    await expect(focused).toHaveCSS('outline-style', 'solid');
    for (const name of ['Publish', 'Delete']) {
      const action = page.getByRole('button', {name, exact: true});
      expect(await paintedContrast(action.locator('[data-part="label"]')), name).toBeGreaterThanOrEqual(4.5);
      const disabled = page.getByRole('button', {name: name + ' disabled', exact: true});
      await expect(disabled).toBeDisabled();
      expect(await paintedContrast(disabled.locator('[data-part="label"]')), name + ' disabled').toBeGreaterThan(1);
      const busy = page.getByRole('button', {name: name + ' busy', exact: true});
      await expect(busy).toHaveAttribute('aria-busy', 'true');
      await expect(busy.locator('[data-part="label"]')).toHaveCSS('opacity', '0');
      expect(await paintedContrast(busy.locator('[data-part="busy-indicator"]')), name + ' indicator').toBeGreaterThan(1);
    }
    // Unlayered consumer colors retain precedence on the actual styled button as well.
    await page.addStyleTag({content: '.uld-button[data-tone="primary"] {background-color: Canvas; color: LinkText}'});
    const systemLink = await page.evaluate(() => {
      const probe = document.createElement('span');
      probe.style.color = 'LinkText';
      document.body.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    });
    await expect(focused).toHaveCSS('color', systemLink);
    expect(await paintedContrast(focused.locator('[data-part="label"]'))).toBeGreaterThan(1);
    const unstyled = page.getByRole('button', {name: 'Unstyled action', exact: true});
    await expect(unstyled).toHaveClass(/app-action/);
    expect(await paintedContrast(unstyled.locator('[data-part="label"]'))).toBeGreaterThanOrEqual(4.5);
  });
}
