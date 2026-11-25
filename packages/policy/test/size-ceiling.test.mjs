import assert from 'node:assert/strict';
import test from 'node:test';
import { historicalBasket, readDefaultCeiling, verifyHistoricalBasket } from '../quality/size-ceiling.mjs';
import { defaultInputs, verifyDefaultTransfer, verifyDefaultStyleOwners } from '../quality/transfer-policy.mjs';

test('the default install total counts each default import once and enforces the ceiling', () => {
  const entries = {
    '@uld/web': 1,
    '@uld/web/forms': 40,
    '@uld/web/forms#Button': 5,
    '@uld/tokens#tokens': 25,
  };
  const rows = Object.entries(entries).map(([entry, gzip]) => ({ entry, gzip }));
  const imports = ['@uld/web', '@uld/web/forms#Button'];
  assert.deepEqual(verifyHistoricalBasket(rows, entries, 6, imports), { total: 6, ceiling: 6, headroom: 0 });
  for (const actual of [rows.slice(1), [...rows, rows[0]], rows.map((r) => ({ ...r, gzip: -1 }))])
    assert.throws(() => verifyHistoricalBasket(actual, entries, 6, imports));
  assert.throws(() => verifyHistoricalBasket(rows, entries, 5, imports), /ceiling exceeded/);
});

test('the released independent imports stay mandatory with a separate cap when families grow', () => {
  const entries = Object.fromEntries(historicalBasket.map(name => [name, 1]));
  const rows = Object.entries(entries).map(([entry, gzip]) => ({ entry, gzip }));
  const future = { entry: '@ui-lazy-dev/ui-web/optional#NewWidget', gzip: 500 };
  const all = { ...entries, [future.entry]: 500 };
  assert.equal(historicalBasket.length, 20);
  for (const route of ['modal-dialog#Dialog', 'modal-dialog#DialogHeading', 'modal-dialog#DialogBody',
    'modal-dialog#DialogActions', 'data-table#DataTable']) {
    assert.ok(historicalBasket.includes('@ui-lazy-dev/ui-web/' + route));
  }
  assert.deepEqual(verifyHistoricalBasket([...rows, future], all, 20), { total: 20, ceiling: 20, headroom: 0 });
  for (const actual of [rows.slice(1), [...rows, rows[0]], rows.map(row => ({ ...row, gzip: 0 }))])
    assert.throws(() => verifyHistoricalBasket(actual, entries, 20));
  assert.throws(() => verifyHistoricalBasket(rows, {}, 20), /Removed historical/);
  assert.throws(() => verifyHistoricalBasket(rows, entries, 19), /ceiling exceeded/);
});

function fixture() {
  const asset = (name, inputs) => ({ name, gzip: 3, raw: 7, sha256: 'f'.repeat(64), inputs });
  const host = [asset('app.js', ['consumer.tsx'])];
  const js = asset('app.js', ['consumer.tsx', ...defaultInputs['app.js']]);
  const css = asset('app.css', [...defaultInputs['app.css']]);
  const build = externalPeers => ({
    externalPeers,
    full: structuredClone(externalPeers).map(row => row.name === 'app.js'
      ? { ...row, inputs: [...row.inputs, 'react/index.js', 'react-dom/client.js'] } : row),
    network: externalPeers.map(({ name }) => ({ name, encoded: 3, decoded: 7, served: 1 })),
  });
  return { emptyHost: build(host), application: build([js, css]) };
}

test('the canonical application budgets each unique asset and rejects coverage gaps, leaks and duplicate requests', () => {
  assert.deepEqual(verifyDefaultTransfer(fixture(), 6), { total: 6, ceiling: 6, headroom: 0 });
  assert.throws(() => verifyDefaultTransfer(fixture(), 5), /ceiling exceeded/);
  const corruptions = [
    r => r.application.externalPeers.pop(),
    r => r.application.full.push(r.application.full[0]),
    r => r.application.full[0].inputs.pop(),
    r => r.application.full[0].inputs.push('@ui-lazy-dev/ui-web/dist/data-table/binding.js'),
    r => r.application.externalPeers[1].inputs.push('@ui-lazy-dev/ui-web/dist/data-table.css'),
    r => r.application.network.pop(),
    r => r.application.network.push(r.application.network[0]),
    r => { r.application.network[0].encoded--; },
    r => { r.application.network[1].decoded--; },
    r => { r.application.network[0].served++; },
    r => { r.emptyHost.externalPeers[0].gzip = -1; },
  ];
  for (const corrupt of corruptions) {
    const report = fixture();
    corrupt(report);
    assert.throws(() => verifyDefaultTransfer(report, 60_000));
  }
});

test('default CSS assembly retains the released owners', () => {
  verifyDefaultStyleOwners(new URL('../../..', import.meta.url).pathname);
});

test('the default install ceiling is 60 KB gzip', () => {
  assert.equal(readDefaultCeiling(new URL('../../..', import.meta.url).pathname), 60000);
});
