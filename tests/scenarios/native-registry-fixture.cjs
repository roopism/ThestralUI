const { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const fixtures = require('../../catalog/native/scenarios/fixtures.cjs');

async function withAdditionalFixture(root, entry, test) {
  const checkout = mkdtempSync(join(tmpdir(), 'ui-native-registration-'));
  const dir = join(checkout, 'docs/components');
  try {
    mkdirSync(dir, { recursive: true });
    for (const slug of new Set(Object.keys(fixtures).map(id => id.split('.')[0]))) {
      const file = slug + '.scenarios.yaml';
      cpSync(join(root, 'docs/components', file), join(dir, file));
    }
    const scenario = { id: 'quote.shows-preview', fixture: 'preview', steps: [
      { expect: 'visible', target: { role: 'text', name: 'Quote ready' } },
    ] };
    const save = (row) => writeFileSync(join(dir, 'quote.scenarios.yaml'), JSON.stringify({ family: 'Quote', scenarios: [row] }));
    save(scenario);
    await test(checkout, { ...fixtures, 'quote.preview': entry }, scenario, save);
  } finally {
    rmSync(checkout, { recursive: true, force: true });
  }
}
module.exports = { withAdditionalFixture };
