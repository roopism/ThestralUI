import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { checkProposal, gatePaths } from '../../../.github/gate-review.mjs';
import { requireGatePathResult } from '../gate-path-result.mjs';
import { trustedRoot } from '../typed-tools.mjs';
import { fixtureGit, isolateFixtureProcess } from './fixtures/hermetic-git.mjs';

const home = isolateFixtureProcess();

function fixture(t) {
  const path = mkdtempSync(join(tmpdir(), 'thestral-controls-'));
  t.after(() => rmSync(path, { recursive: true, force: true }));
  return path;
}
function file(root, name, text) {
  mkdirSync(dirname(join(root, name)), { recursive: true });
  writeFileSync(join(root, name), text);
}
test('gate paths accepts same-repository gate topics and keeps gate changes separate', () => {
  const repo = 'roopism/ThestralUI', owners = gatePaths(readFileSync(join(trustedRoot, '.github/CODEOWNERS'), 'utf8'));
  const identity = { repository: repo, headRepository: repo, headBranch: 'gates/clean' };
  checkProposal(['scripts/verify-consumers.mjs'], owners, identity);
  assert.throws(() => checkProposal(['scripts/verify-consumers.mjs', 'package.json'], owners, identity));
  const product = { ...identity, headBranch: 'family/text' };
  checkProposal(['packages/web/src/text.ts'], owners, product);
  assert.throws(() => checkProposal(['packages/web/src/text.ts', 'package.json', 'manifests/shared.json'], owners, product), /Propose these gate changes/);
  assert.throws(() => checkProposal(['scripts/verify-consumers.mjs'], owners, product));
});

test('docs and family topics preserve base ownership of package and shared registration files', () => {
  const repository = 'roopism/ThestralUI';
  const owners = gatePaths(readFileSync(join(trustedRoot, '.github/CODEOWNERS'), 'utf8'));
  for (const headBranch of ['docs/process', 'family/text']) {
    const identity = { repository, headRepository: repository, headBranch };
    for (const path of ['package.json', 'package-lock.json', 'manifests/shared.json']) {
      assert.throws(() => checkProposal([path], owners, identity), /Propose these gate changes/);
      assert.throws(() => checkProposal(['packages/web/src/text.ts', path], owners, identity), /Propose these gate changes/);
    }
  }
});

test('gate path verification requires a successful exact-base job from the trusted workflow', () => {
  const expected = { base: 'b'.repeat(40), head: 'a'.repeat(40), pr: 5, repositoryId: 1 };
  const workflow = { state: 'active', path: '.github/workflows/gate-paths.yml', id: 6 };
  const run = { id: 7, path: workflow.path, workflow_id: 6, run_attempt: 1, event: 'pull_request', head_sha: expected.head,
    repository: { id: 1 }, head_repository: { id: 1 }, status: 'completed', conclusion: 'success',
    pull_requests: [{ number: 5, head: { sha: expected.head }, base: { sha: expected.base } }] };
  const job = { id: 8, name: 'frozen', run_id: 7, run_attempt: 1, head_sha: expected.head, status: 'completed', conclusion: 'success' };
  const blob = 'f'.repeat(40);
  const inspect = (jobs, mergeWorkflow = blob) => requireGatePathResult({ workflow, run, jobs, baseWorkflow: blob, mergeWorkflow }, expected);
  assert.equal(inspect([job]), 8);
  assert.throws(() => inspect([]));
  assert.throws(() => inspect([job], '0'.repeat(40)), /differs from the trusted/);
  assert.throws(() => inspect([{ ...job, conclusion: 'failure' }]));
  assert.throws(() => inspect([{ ...job, head_sha: expected.base }]));
});

test('the typed gate flags changed control blobs while accepting unrelated manifest fields', async t => {
  const { requireTypedControls } = await import('../typed-tools.mjs');
  const root = fixture(t);
  const git = (...args) => fixtureGit(root, args);
  git('init', '--quiet', '--template=');
  file(root, 'tsconfig.json', '{"compilerOptions":{"strict":true}}');
  file(root, 'package.json', JSON.stringify({ name: 'fixture', scripts: { typecheck: 'tsc' } }));
  git('add', '.');
  const base = git('write-tree');
  requireTypedControls(root, base, base);
  file(root, 'package.json', JSON.stringify({ name: 'fixture', description: 'candidate text', scripts: { typecheck: 'tsc' } }));
  git('add', 'package.json');
  requireTypedControls(root, base, git('write-tree'));
  file(root, 'tsconfig.json', '{}');
  git('add', 'tsconfig.json');
  assert.throws(() => requireTypedControls(root, base, git('write-tree')), /tsconfig\.json/);
});

test('a gate topic must pass the base content check as well as the path check', async t => {
  const { withRevisionSnapshot } = await import('../../../packages/policy/quality/staged-tree.mjs');
  const { noWeakening } = await import('../no-weakening.mjs');
  const workflow = readFileSync(join(trustedRoot, '.github/workflows/gate-paths.yml'), 'utf8');
  assert.ok(workflow.includes('node trusted-gate/scripts/gates/no-weakening.mjs "$BASE" "$HEAD" "$PWD"'));
  const input = 'tests/android/low-end-budget.json';
  const base = fixtureGit(home, ['-C', trustedRoot, 'rev-parse', 'HEAD^{tree}']);
  withRevisionSnapshot(trustedRoot, base, root => {
    const git = (...args) => fixtureGit(root, args);
    const current = git('rev-parse', 'HEAD');
    assert.deepEqual(noWeakening(root, current, current), []);
    const data = JSON.parse(readFileSync(join(root, input)));
    data.limits.scroll.p95InputToCommitMs += 1;
    file(root, input, JSON.stringify(data, null, 2) + '\n');
    git('add', input);
    const issues = noWeakening(root, current, git('write-tree'));
    assert.ok(issues.some(issue => issue.includes(input) && /raised|increased|ceiling/i.test(issue)), String(issues));
  });
});
