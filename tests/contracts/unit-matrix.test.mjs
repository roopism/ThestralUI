import assert from 'node:assert/strict';
import test from 'node:test';
import { unitCases, assertCases } from '../../packages/policy/quality/unit-matrix.mjs';
test('matches required unit case identities including nested suites and rejects skips, duplicates and removed cases', () => {
  const a = 'tests/form.tsx | Form validates state';
  const report = {
    success: true,
    testResults: [
      {
        name: process.cwd() + '/tests/form.tsx',
        assertionResults: [{ fullName: 'Form validates state', status: 'passed' }],
      },
    ],
  };
  const actual = unitCases(report);
  assert.deepEqual(actual, [a]);
  assertCases(actual, [a]);
  for (const changed of [[], [a, a], [a + ' changed']])
    assert.throws(() => assertCases(changed, [a]));
  for (const status of ['pending', 'skipped', 'todo', 'failed'])
    assert.throws(() =>
      unitCases({
        ...report,
        testResults: [
          {
            ...report.testResults[0],
            assertionResults: [{ fullName: 'Form validates state', status }],
          },
        ],
      }),
    );
});
