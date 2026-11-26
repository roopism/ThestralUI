import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { budgetFailures } from '../../tests/browser/quality-perf-policy.mjs';

// Run the incumbent probe once. Apply both committed policies to those same samples.
export function runMacPerformance(root, base, commit) {
  const probe = fileURLToPath(new URL('../../tests/browser/quality-perf.mjs', import.meta.url));
  execFileSync(process.execPath, [probe], { stdio: 'inherit' });
  const { metrics } = JSON.parse(readFileSync('test-results/ui-runtime/summary.json'));
  for (const revision of new Set([base, commit])) {
    const path = revision + ':tests/browser/quality-perf-baseline.json';
    const { budgets } = JSON.parse(execFileSync('git', ['--no-replace-objects', 'show', path], {cwd:root}));
    const errors = budgetFailures(metrics, budgets);
    assert.equal(errors.length, 0, path + ' ' + errors.join('\n'));
  }
}

if (import.meta.main) runMacPerformance(...process.argv.slice(2));
