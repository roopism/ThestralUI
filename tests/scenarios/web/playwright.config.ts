import { defineConfig } from '@playwright/test';

export default defineConfig({
  forbidOnly: true,
  testDir: '.', testMatch: process.env.ULD_SCENARIOS ? 'scenarios.spec.ts' : ['scenarios.spec.ts', 'adapter-regressions.spec.ts'],
  outputDir: '../../../test-results/web-scenarios',
  workers: 1,
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
});
