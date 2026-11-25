import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { servicePorts } from '../../scripts/workers/ports.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const port = servicePorts().visual;
const baseURL = 'http://127.0.0.1:' + port;

export default defineConfig({
  testDir: '..',
  testMatch: '**/tests/*/*.visual.ts',
  outputDir: '../../test-results/motion-visual',
  workers: 3,
  use: {
    baseURL,
    reducedMotion: 'reduce',
    deviceScaleFactor: 1,
    locale: 'en-US',
    timezoneId: 'UTC',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  webServer: {
    command:
      'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port ' + port + ' --strictPort --outDir "$ULD_VISUAL_CATALOG"',
    cwd: root,
    env: {
      ULD_VISUAL_CATALOG:
        process.env.UI_GATE_SNAPSHOT === '1'
          ? 'dist/catalog'
          : process.env.ULD_VISUAL_CATALOG || 'dist/catalog',
    },
    url: baseURL,
  },
});
