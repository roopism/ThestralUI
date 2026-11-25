import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { compileProject } from '../type-project.mjs';
import { trustedRoot, unitCommand } from '../typed-tools.mjs';

function fixture(t) {
  const path = mkdtempSync(join(tmpdir(), 'thestral-controls-'));
  t.after(() => rmSync(path, { recursive: true, force: true }));
  return path;
}
function file(root, name, text) {
  mkdirSync(dirname(join(root, name)), { recursive: true });
  writeFileSync(join(root, name), text);
}
for (const change of ['package type command', 'candidate compiler settings']) {
  test('trusted compiler reports candidate type errors with different ' + change, t => {
    const base = fixture(t), candidate = fixture(t);
    file(base, 'tsconfig.json', JSON.stringify({ compilerOptions: { strict: true, noEmit: true, types: [], skipLibCheck: true }, include: ['case.ts'] }));
    file(candidate, 'tsconfig.json', JSON.stringify({ compilerOptions: { strict: change !== 'candidate compiler settings' } }));
    file(candidate, 'package.json', JSON.stringify({ scripts: { typecheck: change === 'package type command' ? 'true' : 'tsc' } }));
    file(candidate, 'case.ts', 'const typedValue: string = undefined;');
    assert.ok(compileProject(candidate, base, 'tsconfig.json').some(error => error.code === 2322 && error.file.fileName === join(candidate, 'case.ts')));
  });
}
for (const change of ['unit command', 'unit setup']) {
  test('trusted unit runner reports the failing candidate case with different ' + change, t => {
    const base = fixture(t), candidate = fixture(t);
    file(base, 'scripts/gates/trusted-vitest.config.mts', readFileSync(join(trustedRoot, 'scripts/gates/trusted-vitest.config.mts')));
    for (const root of [base, candidate]) symlinkSync(join(trustedRoot, 'node_modules'), join(root, 'node_modules'), 'dir');
    file(base, 'vitest.config.ts', 'export default {test:{include:["case.test.ts"], setupFiles:[' +
      JSON.stringify('./setup.ts') + ']}}');
    file(base, 'setup.ts', 'globalThis.expectedFromBase = 2;');
    file(candidate, 'package.json', JSON.stringify({ type: 'module', scripts: { test: change === 'unit command' ? 'vitest run --passWithNoTests tests/none' : 'vitest run' } }));
    file(candidate, 'vitest.config.ts', 'export default { test: { setupFiles: [] } };');
    file(candidate, 'case.test.ts', 'import {test,expect} from "vitest";test("candidate arithmetic",()=>expect(1).toEqual(globalThis.expectedFromBase));');
    const report = join(candidate, 'report.json');
    const result = spawnSync(process.execPath, unitCommand('vitest', base, candidate,
      ['--maxWorkers=1', '--reporter=json', '--outputFile=' + report]), { cwd: candidate, encoding: 'utf8' });
    assert.equal(result.status, 1, result.stderr);
    const output = JSON.parse(readFileSync(report));
    assert.equal(output.numFailedTests, 1);
    assert.match(output.testResults[0].assertionResults[0].failureMessages.join(' '), /expected 1 to deeply equal 2/i);
  });
}

test('the trusted native runner discovers and reports a failure in the candidate tree', t => {
  const root = fixture(t), candidate = fixture(t);
  symlinkSync(join(trustedRoot, 'node_modules'), join(root, 'node_modules'), 'dir');
  cpSync(join(trustedRoot, 'node_modules/react'), join(candidate, 'node_modules/react'), { recursive: true });
  file(root, 'jest.native.config.cjs', 'module.exports={testMatch:["<rootDir>/*.test.cjs"],transform:{}}');
  file(candidate, 'package.json', '{"name":"native-fixture"}');
  file(candidate, 'real.test.cjs', 'test("native candidate case",()=>{expect(require("react")).toBe(require(' +
    JSON.stringify(join(root, 'node_modules/react')) + '));expect(4).toBe(5)});');
  const path = join(candidate, 'native.json');
  const actual = spawnSync(process.execPath, unitCommand('jest', root, candidate, ['--json', '--outputFile=' + path]), { cwd: candidate, encoding: 'utf8' });
  assert.equal(actual.status, 1, actual.stderr);
  const report = JSON.parse(readFileSync(path));
  assert.equal(report.numFailedTests, 1);
  const assertion = report.testResults[0].assertionResults[0];
  assert.equal(report.testResults[0].assertionResults[0].fullName, 'native candidate case');
  assert.match(assertion.failureMessages.join(' '), /Expected: 5/);
});

test('the trusted inventory reader uses the proposed family manifest data', async t => {
  const { inventoryFromSources } = await import('../../inventory.mjs');
  const candidate = fixture(t);
  cpSync(join(trustedRoot, 'manifests'), join(candidate, 'manifests'), { recursive: true });
  const source = join(candidate, 'manifests/families/text.json');
  const text = JSON.parse(readFileSync(source));
  text.inventory.note = 'Documented by the proposed library';
  writeFileSync(source, JSON.stringify(text));
  const registered = inventoryFromSources(candidate).families.find(row => row.id === 'Text');
  assert.equal(registered.note, text.inventory.note);
});
