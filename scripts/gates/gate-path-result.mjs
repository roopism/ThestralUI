import assert from 'node:assert/strict';

// Verify the API's workflow, run and job together. A same-named status supplied
// by a different app or for a different proposal does not establish this check.
export function requireGatePathResult({ workflow, run, jobs, baseWorkflow, mergeWorkflow }, { base, head, pr, repositoryId }) {
  assert.match(baseWorkflow, /^[a-f0-9]{40}$/);
  assert.equal(mergeWorkflow, baseWorkflow, 'Proposed workflow differs from the trusted gate workflow');
  assert.equal(workflow.state, 'active');
  assert.equal(workflow.path, '.github/workflows/gate-paths.yml');
  assert.equal(run.path, workflow.path);
  assert.equal(run.workflow_id, workflow.id);
  assert.equal(run.repository.id, repositoryId);
  assert.equal(run.head_repository.id, repositoryId);
  assert.equal(run.event, 'pull_request');
  assert.equal(run.head_sha, head);
  assert.equal(run.run_attempt, 1);
  assert.equal(run.status, 'completed');
  assert.equal(run.conclusion, 'success');
  assert.ok(run.pull_requests.some(item => item.number === pr && item.base.sha === base && item.head.sha === head));
  const frozen = jobs.filter(job => job.name === 'frozen');
  assert.equal(frozen.length, 1, 'Missing or duplicate Gate paths job');
  const [job] = frozen;
  assert.equal(job.run_id, run.id);
  assert.equal(job.run_attempt, 1);
  assert.equal(job.head_sha, head);
  assert.equal(job.status, 'completed');
  assert.equal(job.conclusion, 'success');
  return job.id;
}

export async function readGatePathResult(api, expected) {
  for (const oid of [expected.base, expected.head]) assert.match(oid, /^[a-f0-9]{40}$/);
  assert.ok(Number.isSafeInteger(expected.pr) && expected.pr > 0);
  assert.equal(expected.repositoryId, 1471056545);
  const pr = await api('/pulls/' + expected.pr);
  assert.equal(pr.state, 'open');
  assert.equal(pr.base.ref, 'feat/enterprise-ui');
  assert.equal(pr.base.repo.id, expected.repositoryId);
  assert.equal(pr.head.repo.id, expected.repositoryId);
  assert.equal(pr.head.sha, expected.head);
  assert.match(pr.merge_commit_sha, /^[a-f0-9]{40}$/);
  const merge = await api('/git/commits/' + pr.merge_commit_sha);
  assert.deepEqual(merge.parents.map(row => row.sha), [expected.base, expected.head]);
  const file = '/contents/.github/workflows/gate-paths.yml?ref=';
  const blob = async ref => {
    const entry = await api(file + ref);
    assert.equal(entry.type, 'file');
    return entry.sha;
  };
  const baseWorkflow = await blob(expected.base), mergeWorkflow = await blob(pr.merge_commit_sha);
  const workflow = await api('/actions/workflows/gate-paths.yml');
  const query = new URLSearchParams({ event: 'pull_request', head_sha: expected.head, per_page: '100' });
  const listing = await api('/actions/workflows/' + workflow.id + '/runs?' + query);
  assert.equal(listing.total_count, listing.workflow_runs.length, 'Incomplete Gate paths run list');
  const matches = listing.workflow_runs.filter(run => run.pull_requests.some(item =>
    item.number === expected.pr && item.base.sha === expected.base && item.head.sha === expected.head));
  assert.equal(matches.length, 1, 'Missing or ambiguous Gate paths run for this proposal');
  const [run] = matches;
  const listingJobs = await api('/actions/runs/' + run.id + '/attempts/1/jobs?per_page=100');
  assert.equal(listingJobs.total_count, listingJobs.jobs.length, 'Incomplete Gate paths job list');
  return requireGatePathResult({ workflow, run, jobs: listingJobs.jobs, baseWorkflow, mergeWorkflow }, expected);
}
