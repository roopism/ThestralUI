import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { cloudProposal } from './proposal.mjs';
import { repositoryId } from './results.mjs';

// The workflow verifies the live integration SHA before checking out this file.
export function requireDispatch(env, pr, root) {
  assert.equal(env.GITHUB_EVENT_NAME, 'workflow_dispatch');
  assert.equal(env.GITHUB_RUN_ATTEMPT, '1');
  assert.equal(env.GITHUB_REPOSITORY_ID, String(repositoryId));
  assert.equal(env.GITHUB_SHA, env.MERGE);
  const expected = cloudProposal(root, env.BASE, env.MERGE, pr);
  assert.equal(env.GITHUB_REF, 'refs/heads/' + expected.branch);
  assert.equal(String(expected.number), env.NUMBER);
  return expected;
}
if (import.meta.main) {
  const { NUMBER, GITHUB_EVENT_PATH } = process.env;
  assert.match(NUMBER, /^(?:0|[1-9][0-9]*)$/);
  const pr = NUMBER === '0' ? null : JSON.parse(execFileSync('gh', ['api', 'repos/roopism/ThestralUI/pulls/' + NUMBER]));
  const event = JSON.parse(readFileSync(GITHUB_EVENT_PATH));
  assert.equal(event.inputs.merge, process.env.GITHUB_SHA);
  requireDispatch(process.env, pr, process.argv[2]);
}
