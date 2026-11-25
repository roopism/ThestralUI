import assert from 'node:assert/strict';
import { test } from '@playwright/test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mountFixture } from './mount';
import { runWebScenario, type Scenario } from './adapter';

const require = createRequire(import.meta.url);
const { readScenarios } = require('../../../scripts/scenarios/read.cjs');
const root = fileURLToPath(new URL('../../../', import.meta.url));
const scenarios: Scenario[] = readScenarios(root, process.env.ULD_SCENARIOS?.split(','));
assert.ok(scenarios.length, 'No web behavior scenarios were discovered');
for (const scenario of scenarios) {
  test(scenario.id, async ({ page }) => {
    await test.step(scenario.id + ' setup ' + scenario.fixture, async () => {
      await mountFixture(page, scenario.id.split('.')[0], scenario.fixture);
    });
    await runWebScenario(page, scenario);
  });
}
