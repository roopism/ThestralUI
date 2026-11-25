import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { verifyDefaultTransfer } from './transfer-policy.mjs';

export function readDefaultCeiling(root = process.cwd()) {
  const file = join(root, 'tests/packaging/default-ceiling.json');
  const { defaultCeiling } = JSON.parse(readFileSync(file, 'utf8'));
  assert.ok(Number.isSafeInteger(defaultCeiling) && defaultCeiling > 0, 'Expected a default ceiling in gzip bytes');
  return defaultCeiling;
}

// All 20 independent imports in the 60,000-byte guard at cutover, including Modal and Data Table.
// Named imports added by later families retain their own budgets and family bands.
export const historicalBasket = [
  '@ui-lazy-dev/tokens',
  '@ui-lazy-dev/ui-web',
  '@ui-lazy-dev/ui-web#Button',
  ...['dialog#Dialog', 'forms#Checkbox', 'navigation#Tabs', 'primitives#Stack',
    'collections#DataTable', 'workflows#AppShell', 'entry-fields#CodeField', 'patterns#EmptyState',
    'color#ColorPicker', 'avatar#Avatar', 'modes#ModeProvider', 'document#Heading',
    'modal-dialog#Dialog', 'modal-dialog#DialogHeading', 'modal-dialog#DialogBody',
    'modal-dialog#DialogActions', 'data-table#DataTable'
  ].map(entry => '@ui-lazy-dev/ui-web/' + entry),
];

export function verifyHistoricalBasket(rows, registered, ceiling, basket = historicalBasket) {
  assert.ok(basket.length && new Set(basket).size === basket.length, 'Missing or duplicate historical basket entries');
  const expected = new Set(basket);
  const measured = rows.filter(row => expected.has(row.entry));
  for (const entry of basket) assert.ok(Object.hasOwn(registered, entry), 'Removed historical entry: ' + entry);
  assert.deepEqual(measured.map(row => row.entry).sort(), [...basket].sort(), 'Incomplete or duplicate historical measurements');
  let total = 0;
  for (const { gzip } of measured) {
    assert.ok(Number.isSafeInteger(gzip) && gzip > 0, 'Expected measured gzip bytes');
    total += gzip;
  }
  assert.ok(total <= ceiling, 'Historical basket ceiling exceeded: ' + total + ' > ' + ceiling);
  return { total, ceiling, headroom: ceiling - total };
}

export function verifyPackedCeiling(snapshot, ceiling = readDefaultCeiling(snapshot)) {
  const read = file => JSON.parse(readFileSync(join(snapshot, file), 'utf8'));
  const basket = verifyHistoricalBasket(read('release/evidence/bundles.json'), read('tests/packaging/bundle-baseline.json'), ceiling);
  const transfer = verifyDefaultTransfer(read('release/evidence/default-transfer.json'), ceiling);
  console.log('Packed default application:', transfer.total, '/', ceiling, 'B. Historical import basket:', basket.total, '/', ceiling, 'B.');
  return { transfer, basket };
}
