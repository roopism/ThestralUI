import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { servicePorts } from './scripts/workers/ports.mjs';

const port = servicePorts().preview;
const baseURL = 'http://127.0.0.1:' + port;
const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  testDir: './tests',
  outputDir: './test-results/browser',
  testMatch: '**/tests/*/*.spec.ts',
  use: { baseURL },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        launchOptions: {
          executablePath:
            process.env.UI_GATE_SNAPSHOT === '1' ? undefined : process.env.CHROME_EXECUTABLE_PATH,
        },
      },
    },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  webServer: {
    command:
      'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port ' + port + ' --strictPort --outDir dist/catalog',
    cwd: root,
    url: baseURL,
  },
});
