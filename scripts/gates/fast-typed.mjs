import { join } from 'node:path';
import { buildTokens, buildTypedInputs, trustedRoot } from './typed-tools.mjs';
import { trustedVerdict } from './verdict.mjs';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { cases } from '../../packages/policy/quality/browser-matrix.mjs';

const exec = (bin, args) => execFileSync(bin, args, { stdio: 'inherit' });
export function fast() {
  for (const args of [
    ['packages/policy/cli.mjs', 'check', '--config', 'ui-policy.json'],
    ['packages/style-policy/cli.mjs', '--profile', 'library', '--root', '.', '--prove'],
    ['packages/policy/quality/integrity.mjs'], ['scripts/manifests/generate.mjs', '--check'],
  ]) exec(process.execPath, args);
}
function background(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0 ? resolve() : reject(Error(command + ' ' + args.join(' ') + ' failed (' + (signal ?? code) + ')')));
  });
}
export async function typed() {
  buildTypedInputs();
  // Both lanes depend on dist. Only the package lane writes release/evidence.
  const results = await Promise.allSettled([
    background(process.execPath, [trustedVerdict('unit-matrix.mjs')]),
    (async () => {
      await background(process.execPath, [join(trustedRoot, 'scripts/gates/type-project.mjs'), 'tsconfig.json']);
      await background(process.execPath, ['--test', 'tests/contracts/api.test.mjs']);
      await background(process.execPath, [join(trustedRoot, 'scripts/check-api.mjs')]);
      buildTokens(process.cwd(), true);
      for (const args of [
        ['scripts/inventory.mjs'],
        [trustedVerdict('verify-artifacts.mjs'), '--built-snapshot'],
        [trustedVerdict('verify-version.mjs')], [trustedVerdict('verify-inventory.mjs')],
      ]) await background(process.execPath, args);
    })(),
  ]);
  const failures = results.filter(result => result.status === 'rejected');
  if (failures.length) throw new AggregateError(failures.map(result => result.reason), 'Typed or roster checks failed');
}
export function browserRosters() {
  for (const [name, config] of [['browser', []], ['visual', ['-c', 'tests/browser/motion.visual.config.ts']]]) {
    const baseline = JSON.parse(readFileSync('tests/acceptance/' + name + '-matrix.json'));
    const report = JSON.parse(execFileSync(process.execPath, ['node_modules/@playwright/test/cli.js',
      'test', ...config, '--list', '--reporter=json'], { maxBuffer: 64 * 1024 * 1024 }));
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.config.projects.map(project => project.name).sort(), baseline.projects);
    assert.deepEqual(cases(report.suites).map(row => row.name).sort(), baseline.cases);
    console.log('Verified', name, 'roster:', baseline.cases.length);
  }
}
