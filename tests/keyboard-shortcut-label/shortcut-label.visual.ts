import { expect, test } from '@playwright/test';

for (const [size,width] of [['phone',320],['desktop',1280]] as const) {
  for (const scheme of ['light','dark'] as const) {
    test('editor shortcuts at ' + size + ' ' + scheme, async ({page}) => {
      await page.setViewportSize({width,height:800});
      await page.emulateMedia({colorScheme:scheme,reducedMotion:'reduce'});
      await page.goto('/iframe.html?id=foundations-keyboard-shortcut-label--editor-shortcuts&viewMode=story');
      const guide=page.getByRole('main',{name:'Editor shortcuts'});
      await guide.evaluate((el,theme)=>{el.setAttribute('data-uld-brand','enterprise');el.setAttribute('data-uld-scheme',theme)},scheme);
      await expect(guide.locator('kbd[data-part="root"]')).toHaveCount(4);
      await page.evaluate(()=>document.fonts.ready);
      await expect(guide).toHaveScreenshot(size+'-'+scheme+'.png',{animations:'disabled',scale:'css',maxDiffPixelRatio:0.001});
    });
  }
}
