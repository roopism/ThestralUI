import assert from 'node:assert/strict';
import test from 'node:test';
import { verifySurface } from '../../scripts/verify-version.mjs';
const baseline = {
  version: '0.2.0',
  exports: ['.'],
  styles: ['uld-button'],
  tokens: { 'light.text': 'color' },
};
test('requires a minor increment for additive pre-1.0 APIs and preserves existing style/token IDs', () => {
  const candidate = { ...baseline, version: '0.3.0-rc.1', exports: ['.', './dialog'] };
  assert.doesNotThrow(() => verifySurface(baseline, candidate));
  for (const difference of [
    { version: '0.2.1' },
    { version: '0.1.0' },
    { styles: [] },
    { tokens: { 'light.text': 'number' } },
    { exports: ['./dialog'] },
  ]) {
    assert.throws(() => verifySurface(baseline, { ...candidate, ...difference }));
  }
});
