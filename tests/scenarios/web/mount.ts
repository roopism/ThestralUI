import type { Page } from '@playwright/test';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const bundles = new Map<string, Promise<{ script: string; css: string }>>();

function fixtureBundle(family: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(family)) throw Error('Invalid web scenario family ' + family);
  const existing = bundles.get(family);
  if (existing) return existing;

  const bundle = build({
    absWorkingDir: root,
    entryPoints: ['tests/scenarios/web/fixtures.tsx'],
    bundle: true, format: 'iife', globalName: 'scenarioFixtures',
    jsx: 'automatic', outdir: resolve(root, 'dist/scenario-fixtures'), write: false,
    define: {
      'process.env.NODE_ENV': '"production"',
      ULD_WEB_FIXTURE: JSON.stringify('../../' + family + '/web-fixtures.tsx'),
    },
  }).then(bundle => ({
    script: bundle.outputFiles.find(file => file.path.endsWith('.js'))!.text,
    css: bundle.outputFiles.find(file => file.path.endsWith('.css'))?.text ?? '',
  }));
  bundles.set(family, bundle);
  return bundle;
}

export async function mountFixture(page: Page, family: string, fixture: string) {
  const { script, css } = await fixtureBundle(family);
  await page.setContent('<html lang="en"><head><title>Behavior scenario</title></head><body><div id="app"></div></body></html>');
  if (css) await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: script });
  await page.evaluate(async ({ slug, fixture }) => {
    const host = window as Window & {
      scenarioFixtures?: { mount(slug: string, fixture: string): Promise<void> };
    };
    if (!host.scenarioFixtures) throw Error('Web scenario fixture bundle failed to load');
    await host.scenarioFixtures.mount(slug, fixture);
  }, { slug: family, fixture });
}
