import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const key = (root, file, title) =>
  (isAbsolute(file) ? relative(root, file) : file).split(sep).join('/') + ' | ' + title;
export function assertCases(actual, expected) {
  assert.ok(Array.isArray(expected) && expected.length, 'Required unit matrix is missing or empty');
  assert.ok(actual.length, 'No unit test identities');
  const repeated = actual.filter((name, i) => actual.indexOf(name) !== i);
  assert.deepEqual(repeated, [], 'Duplicate unit test identities: ' + repeated.join(', '));
  assert.deepEqual(
    [...actual].sort(),
    [...expected].sort(),
    'Required unit cases changed. Review case additions and removals and regenerate the exact matrix.',
  );
}
export function unitCases(report, root = process.cwd()) {
  assert.ok(
    report?.success && Array.isArray(report.testResults),
    'Unit test report failed or is incomplete',
  );
  return report.testResults
    .flatMap((file) =>
      file.assertionResults.map((entry) => {
        assert.equal(
          entry.status,
          'passed',
          'Unit test skipped, pending or failed: ' + entry.fullName,
        );
        assert.ok(
          !entry.retryReasons?.length && !entry.retryMessages?.length,
          'Unit case retried: ' + entry.fullName,
        );
        return key(root, file.name, entry.fullName);
      }),
    )
    .sort();
}
// The actual node:test reporter captures subtest identities at runtime, including generated cases.
export async function* nodeReporter(events) {
  const ancestors = [];
  for await (const event of events) {
    const data = event.data;
    if (event.type === 'test:start') ancestors[data.nesting] = data.name;
    if (event.type === 'test:pass' || event.type === 'test:fail') {
      const status = event.type === 'test:pass' && !data.skip && !data.todo ? 'passed' : 'failed';
      yield JSON.stringify({
        file: data.file,
        name: [...ancestors.slice(0, data.nesting), data.name].join(' > '),
        status,
        detail: data.details?.error?.message,
      }) + '\n';
    }
  }
}
export function nodeCases(files, root = process.cwd()) {
  const temp = mkdtempSync(join(tmpdir(), 'ui-unit-matrix-')),
    report = join(temp, 'node.ndjson');
  try {
    execFileSync(
      process.execPath,
      [
        '--test',
        '--test-reporter=spec',
        '--test-reporter=' + fileURLToPath(new URL('./unit-reporter.mjs', import.meta.url)),
        '--test-reporter-destination=stdout',
        '--test-reporter-destination=' + report,
        ...files,
      ],
      { cwd: root, stdio: 'inherit' },
    );
    return readFileSync(report, 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .map((item) => {
        assert.equal(item.status, 'passed', 'Node case skipped, pending or failed: ' + item.name);
        return key(root, item.file, item.name);
      })
      .sort();
  } finally {
    rmSync(temp, { force: true, recursive: true });
  }
}
