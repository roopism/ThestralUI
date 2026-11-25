import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import yaml from 'js-yaml';

const workflow = new URL('../../../.github/workflows/checks.yml', import.meta.url);
test('the disabled library workflow pins the three actions and discards checkout credentials', () => {
  const steps = yaml.safeLoad(readFileSync(workflow, 'utf8')).jobs.verify.steps;
  for (const name of ['actions/checkout', 'actions/setup-node', 'actions/upload-artifact']) {
    const step = steps.find((step) => step.uses?.startsWith(name + '@'));
    assert.ok(step && /^[^@]+@[0-9a-f]{40}$/.test(step.uses), name);
    if (name === 'actions/checkout') assert.equal(step.with?.['persist-credentials'], false);
  }
});
