import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
import behavior from '../../../playwright.config';
import visual from '../../../tests/browser/motion.visual.config';
import scenarios from '../../../tests/scenarios/web/playwright.config';

const profiles = { behavior, visual, scenarios };
const kind = process.env.ULD_CLOUD_BROWSER_KIND;
if (kind !== 'behavior' && kind !== 'visual' && kind !== 'scenarios') {
  throw new Error('Missing cloud browser profile');
}

// Load configuration and tooling from integration. The candidate supplies the cases and built site.
const profile = profiles[kind];
const server = profile.webServer;
if (Array.isArray(server)) throw new Error('The trusted browser profile now has multiple servers');
export default defineConfig({
  ...profile,
  testDir: resolve(kind === 'scenarios' ? 'tests/scenarios/web' : 'tests'),
  outputDir: resolve('test-results', 'cloud-' + kind),
  ...(server && { webServer: { ...server, cwd: process.cwd(), reuseExistingServer: false } }),
  ...(kind === 'visual' && {
    snapshotPathTemplate: '{testDir}/cloud-snapshots/macos-26/{testFilePath}/{projectName}/{arg}{ext}',
  }),
  updateSnapshots: 'none',
  forbidOnly: true,
  retries: 0,
});
