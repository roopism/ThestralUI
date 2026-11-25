import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { typedControlDigest } from '../typed-tools.mjs';
import { repositoryId } from './results.mjs';

const repo = 'repos/roopism/ThestralUI';
const integration = 'feat/enterprise-ui';
const file = '.github/workflows/qualify.yml';
const oid = /^[a-f0-9]{40}$/;
const git = (root, ...args) => execFileSync('git', ['--no-replace-objects', ...args], { cwd: root, encoding: 'utf8' }).trim();
function api(endpoint, body) {
  const args = ['api', '--hostname', 'github.com', repo + endpoint];
  if (body) args.push('--method', 'POST', '--input', '-');
  const text = execFileSync('gh', args, { input: body && JSON.stringify(body), encoding: 'utf8' }).trim();
  return text ? JSON.parse(text) : null;
}

// GitHub indexes ordinary PR runs by topic head. Dispatch on the known merge
// commit so both the Actions API and the checked out commit identify that merge.
export function cloudProposal(root, base, merge, pr) {
  for (const sha of [base, merge]) assert.match(sha, oid);
  assert.equal(git(root, 'rev-parse', base + '^{commit}'), base);
  assert.equal(git(root, 'rev-parse', merge + '^{commit}'), merge);
  const permit = git(root, 'remote', 'get-url', 'origin');
  assert.ok(['https://github.com/roopism/ThestralUI', 'https://github.com/roopism/ThestralUI.git', 'git@github.com:roopism/ThestralUI.git'].includes(permit));
  const expected = { base, merge, controlDigest: typedControlDigest(root, base), tree: git(root, 'rev-parse', merge + '^{tree}'),
    baseWorkflow: git(root, 'rev-parse', base + ':' + file), mergeWorkflow: git(root, 'rev-parse', merge + ':' + file) };
  assert.equal(expected.baseWorkflow, expected.mergeWorkflow, 'A new workflow must be adopted using a trusted predecessor');
  if (base === merge) {
    assert.equal(pr, null);
    return { ...expected, branch: integration, number: 0 };
  }
  assert.ok(pr && pr.state === 'open' && Number.isSafeInteger(pr.number) && pr.number > 0, 'An open pull request is required');
  assert.equal(pr.base.repo.id, repositoryId);
  assert.equal(pr.head.repo.id, repositoryId, 'A fork cannot publish a verification ref in this repository');
  assert.equal(pr.base.ref, integration);
  assert.match(pr.head.ref, /^(?:family|gates|docs)\/[a-z0-9][a-z0-9-]*$/);
  assert.equal(pr.base.sha, base);
  assert.equal(pr.merge_commit_sha, merge);
  assert.deepEqual(git(root, 'show', '-s', '--format=%P', merge).split(' '), [base, pr.head.sha]);
  assert.equal(git(root, 'diff', '--name-only', base, merge, '--', '.github/workflows', '.github/actions'), '',
    'A verification ref may only run the workflows and actions already on integration');
  return { ...expected, number: pr.number, branch: 'gates/qualify-' + merge };
}

function hostedRuns(expected, request) {
  const query = new URLSearchParams({ event: 'workflow_dispatch', branch: expected.branch, head_sha: expected.merge, per_page: '100' });
  const { workflow_runs: runs, total_count: count } = api('/actions/workflows/qualify.yml/runs?' + query);
  assert.equal(count, runs.length);
  return runs.filter(r => r.display_title === 'Qualify ' + expected.merge + ' on ' + expected.base + ' (' + request + ')');
}

export async function startHostedRun(root, common, expected, { fresh = false, requestId } = {}) {
  const repository = api('');
  assert.equal(repository.id, repositoryId);
  assert.equal(repository.visibility, 'public', 'Cloud lanes require the public repository');
  assert.equal(repository.default_branch, integration);
  assert.equal(api('/git/ref/heads/' + integration).object.sha, expected.base, 'Integration advanced before dispatch');
  const request = fresh ? requestId : 'proposal';
  if (fresh) assert.match(request, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  const previous = hostedRuns(expected, request);
  assert.ok(previous.length <= 1, 'Ambiguous hosted attempts');
  if (previous.length) return previous[0].id;
  const directory = join(common, 'uld-delivery', 'cloud-requests');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const ticket = join(directory, [expected.base, expected.merge, request].join('-') + '.json');
  if (!existsSync(ticket)) {
    writeFileSync(ticket, JSON.stringify({ ...expected, request }) + '\n', { flag: 'wx', mode: 0o600 });
    if (expected.number) {
      const ref = 'refs/heads/' + expected.branch;
      const existing = git(root, 'ls-remote', '--refs', 'origin', ref);
      if (!existing) api('/git/refs', { ref, sha: expected.merge });
      assert.equal(api('/git/ref/heads/' + expected.branch).object.sha, expected.merge);
    }
    api('/actions/workflows/qualify.yml/dispatches', { ref: expected.branch, inputs: {
      base: expected.base, merge: expected.merge, number: String(expected.number), request } });
  }
  const deadline = statSync(ticket).mtimeMs + 15 * 60_000;
  for (;;) {
    const found = hostedRuns(expected, request);
    assert.ok(found.length <= 1, 'More than one hosted run was started for this request');
    if (found.length) return found[0].id;
    if (Date.now() > deadline) throw Error('Dispatched run was not found within 15 minutes. Inspect ' + ticket);
    await delay(5000);
  }
}
