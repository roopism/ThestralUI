import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertCases, nodeCases, unitCases } from '../packages/policy/quality/unit-matrix.mjs';

import { verifyCandidatePassed } from '../packages/policy/quality/api-depth/evidence.mjs';

const record = process.argv.includes('--record'),
  file = 'tests/acceptance/unit-matrix.json';
const directory = mkdtempSync(join(tmpdir(), 'ui-case-lists-'));
try {
  const jsonSuite = (script, args) => {
    const output = join(directory, script + '.json');
    execFileSync('npm', ['run', script, '--', ...args, '--outputFile=' + output], {
      stdio: 'inherit',
    });
    return unitCases(JSON.parse(readFileSync(output, 'utf8')));
  };
  const matrix = {
    schema: 1,
    vitest: jsonSuite('test', ['--reporter=json']),
    native: jsonSuite('test:native', ['--json']),
    node: nodeCases([
      'tests/contracts/*.test.mjs',
      'tests/selection/*.test.mjs',
      'tests/workers/*.test.mjs',
      'tests/manifests/*.test.mjs',
      'tests/scenarios/*.test.cjs',
      'packages/codemods/*.test.mjs',
      'tests/inventory.test.mjs',
      'tests/packaging/*.test.mjs',
      'packages/policy/test/*.test.mjs',
      'packages/style-policy/test/*.test.mjs',
      'tests/browser/quality-perf-check.mjs',
    ]),
  };
  // Run the proposed gate regressions as well as the trusted base's controls.
  const gateCases = nodeCases(['scripts/gates/tests/*.test.mjs']);
  assertCases(gateCases, JSON.parse(readFileSync('scripts/gates/test-roster.json', 'utf8')));
  verifyCandidatePassed('unit', matrix.vitest);
  verifyCandidatePassed('native', matrix.native);
  if (record) {
    for (const entries of [matrix.vitest, matrix.native, matrix.node])
      assertCases(entries, entries);
    writeFileSync(file, JSON.stringify(matrix, null, 2) + '\n');
  } else {
    const expected = JSON.parse(readFileSync(file, 'utf8'));
    for (const runner of ['vitest', 'native', 'node'])
      assertCases(matrix[runner], expected[runner]);
  }
  console.log(
    'Verified unit cases:',
    matrix.vitest.length,
    'web,',
    matrix.native.length,
    'native renderer,',
    matrix.node.length,
    'policy and packaging',
  );
} finally {
  rmSync(directory, { recursive: true, force: true });
}
