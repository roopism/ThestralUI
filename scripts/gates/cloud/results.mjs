import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const oid = /^[a-f0-9]{40}$/;
const digest = /^[a-f0-9]{64}$/;
const workflowPath = '.github/workflows/qualify.yml';
export const repositoryId = 1471056545;
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function requireCloudRun(run, expected) {
  for (const value of [expected.base, expected.merge, expected.tree, expected.baseWorkflow, expected.mergeWorkflow])
    assert.match(value, oid);
  assert.equal(expected.baseWorkflow, expected.mergeWorkflow, 'Qualification workflow differs from the trusted base');
  assert.equal(run.repository.id, repositoryId);
  assert.equal(run.head_repository.id, repositoryId);
  assert.equal(run.path, workflowPath);
  assert.equal(run.workflow_id, expected.workflowId);
  assert.equal(run.event, 'workflow_dispatch');
  assert.equal(run.head_sha, expected.merge, 'Hosted run belongs to a different commit');
  assert.equal(run.head_branch, expected.branch);
  assert.equal(run.run_attempt, 1, 'A retried workflow cannot qualify a change');
  assert.equal(run.status, 'completed');
  assert.equal(run.conclusion, 'success');
}

export function verifyCloudResults({ run, expected, shards, jobs, artifacts, reports }) {
  requireCloudRun(run, expected);
  const cloud = shards.filter(shard => shard.lane !== 'local');
  const expectedIds = cloud.map(shard => shard.id).sort();
  const executed = jobs.filter(job => job.name.startsWith('Qualify / '));
  assert.deepEqual(executed.map(job => job.name.slice('Qualify / '.length)).sort(), expectedIds, 'Missing, extra or duplicate hosted job');
  assert.deepEqual(artifacts.map(artifact => artifact.name).sort(), expectedIds, 'Missing, extra or duplicate shard artifact');
  assert.deepEqual([...reports.keys()].sort(), expectedIds, 'Missing verified download');
  return cloud.map(shard => {
    const job = executed.find(item => item.name === 'Qualify / ' + shard.id);
    assert.equal(job.run_id, run.id);
    assert.equal(job.run_attempt, 1);
    assert.equal(job.head_sha, expected.merge);
    assert.equal(job.status, 'completed');
    assert.deepEqual(job.labels, [shard.lane === 'github-linux' ? 'ubuntu-24.04-arm' : 'macos-26'], 'Unexpected runner for ' + shard.id);
    assert.equal(job.conclusion, 'success', 'Shard failed: ' + shard.id);
    const artifact = artifacts.find(item => item.name === shard.id);
    assert.equal(artifact.expired, false);
    assert.equal(artifact.workflow_run.id, run.id);
    assert.equal(artifact.workflow_run.repository_id, repositoryId);
    assert.equal(artifact.workflow_run.head_repository_id, repositoryId);
    assert.equal(artifact.workflow_run.head_sha, expected.merge);
    const { result, archiveSha256, evidenceSha256 } = reports.get(shard.id);
    assert.match(archiveSha256, digest);
    assert.equal(artifact.digest, 'sha256:' + archiveSha256, 'Downloaded shard archive differs from GitHub');
    assert.match(evidenceSha256, digest);
    assert.equal(result.evidenceSha256, evidenceSha256, 'Evidence digest differs for ' + shard.id);
    assert.deepEqual(result.shard, shard);
    assert.equal(result.base, expected.base);
    assert.equal(result.merge, expected.merge);
    assert.equal(result.tree, expected.tree);
    assert.equal(result.workflow, expected.baseWorkflow);
    assert.equal(result.runId, run.id);
    assert.equal(result.result, 'passed');
    assert.match(expected.controlDigest, digest);
    assert.equal(result.controlDigest, expected.controlDigest, 'Hosted tools or configuration differ from integration');
    assert.equal(result.retries, 0);
    return { id: shard.id, jobId: job.id, artifactId: artifact.id, archiveSha256, evidenceSha256 };
  });
}
