import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('packed type contracts compile once per distinct current and proposed case set', t => {
  const dir = mkdtempSync(join(tmpdir(), 'uld-packed-type-calls-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const entry = join(dir, 'run-types.mjs');
  copyFileSync(new URL('../../../packages/policy/quality/api-depth/run-types.mjs', import.meta.url), entry);
  const registry = join(dir, 'registry.mjs');
  writeFileSync(registry, 'export const families = [];');
  writeFileSync(join(dir, 'families.json'), JSON.stringify({ revision: 'fixture', families: [] }));
  writeFileSync(join(dir, 'api-depth.mjs'), `
    export function verifyFamilies() {}
    export function verifyTypes(_consumer, _families, cases) {
      console.log('compiling ' + cases.id);
      return cases.id;
    }
  `);
  for (const [proposed, expected] of [
    ['shippedMinimum', ['current']],
    ["{ id: 'proposed' }", ['current', 'proposed']],
  ]) {
    writeFileSync(join(dir, 'consumer-cases.mjs'), "export const shippedMinimum = { id: 'current' }; export const cases = " + proposed + ';');
    const output = execFileSync(process.execPath, [entry, dir, registry], { encoding: 'utf8' });
    const compiles = [...output.matchAll(/^compiling (\w+)$/gm)].map(match => match[1]);
    assert.deepEqual(compiles, expected);
    assert.match(output, /Packed current API contracts fixture current/);
    assert.ok(output.includes('Proposed API requirements fixture ' + expected.at(-1)));
  }
});

test('Button, Stack and Inline use the maintained packed layout probes', async () => {
  const runtime = await import('../../../packages/policy/quality/api-depth/runtime-probes.mjs');
  const { priorityProbes } = await import('../../../packages/policy/quality/api-depth/packed-probes.mjs');
  const active = priorityProbes({}, null, '');
  for (const name of ['.:Button', 'primitives:Stack', 'primitives:Inline']) assert.equal(typeof active[name], 'function', name);
  assert.equal(Object.hasOwn(runtime, 'layoutProbes'), false, 'The unused second layout probe factory is still exported');
});
