import { isTypedGateInput } from '../typed-tools.mjs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const guardrails = JSON.parse(readFileSync(new URL('./guardrails.json', import.meta.url)));
const digest = /^[a-f0-9]{64}$/;
const oid = /^[a-f0-9]{40}$/;
const bytes = (left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right));

function canonical(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || Number.isFinite(value))
    return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  assert.ok(typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype, 'Unsupported fingerprint input');
  return '{' + Object.keys(value).sort(bytes).map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
}

export const canonicalFingerprint = value => createHash('sha256').update(canonical(value)).digest('hex');

function matches(path, pattern) {
  if (pattern === '*.md') return !path.includes('/') && path.endsWith('.md');
  if (pattern.endsWith('/**')) return path.startsWith(pattern.slice(0, -2));
  return path === pattern;
}
const protectedInput = path => guardrails.neverExclude.some(pattern => matches(path, pattern));

function entries(root, revision) {
  assert.match(revision, oid);
  const output = execFileSync('git', ['--no-replace-objects', 'ls-tree', '-rz', '--full-tree', revision], {
    cwd: root, maxBuffer: 128 * 1024 * 1024,
  });
  const text = new TextDecoder('utf-8', { fatal: true }).decode(output);
  return text.split('\0').filter(Boolean).map(record => {
    const match = /^(100644|100755) blob ([a-f0-9]{40})\t([\s\S]+)$/.exec(record);
    assert.ok(match && !/[\u0000-\u001f]/.test(match[3]), 'Unsupported Git tree entry');
    return { path: match[3], mode: match[1], oid: match[2] };
  }).sort((a, b) => bytes(a.path, b.path));
}

export function gitInputs(root, tree, base) {
  const candidate = entries(root, tree);
  const trustedInput = path => isTypedGateInput(path) || protectedInput(path) || /^(?:scripts\/|packages\/(?:policy|style-policy)\/|tests\/(?:android|simulator|scenarios)\/|manifests\/|package(?:-lock)?\.json$)/.test(path);
  const basePipeline = entries(root, base).filter(row => trustedInput(row.path));
  const candidatePipeline = candidate.filter(row => trustedInput(row.path));
  return { candidate, basePipeline: canonicalFingerprint(basePipeline), pipelineChanged:
    canonicalFingerprint(basePipeline) !== canonicalFingerprint(candidatePipeline) };
}

function validateFacts(facts) {
  assert.ok(facts && Object.keys(facts).length && Object.values(facts).every(value =>
    value !== null && value !== undefined && value !== '' && value !== 'unavailable'), 'Required environment fact unavailable');
}

export function treeFingerprint({root,tree,base,groupId,exclude = [],envFacts,extraInputs = {},inputs = gitInputs(root,tree,base)}) {
  validateFacts(envFacts);
  assert.ok(exclude.every(pattern => pattern === 'docs/**' || pattern === '*.md'), 'Unsupported suite exclusion');
  const included = inputs.candidate.filter(row => protectedInput(row.path) || !exclude.some(pattern => matches(row.path, pattern)));
  // Parent directory listing can still reveal an excluded file's name and type.
  const fileModes = canonicalFingerprint(inputs.candidate.map(row => [row.path,row.mode]));
  const treeEntries = included.map(row => [row.path,row.oid]);
  return canonicalFingerprint({contractVersion:guardrails.contractVersion,groupId,treeEntries,
    envFacts:{...envFacts,fileModes,trustedPipeline:inputs.basePipeline},extraInputs});
}

export function appFingerprint({root,tree,base,groupId,appManifests,deviceImage,scope,envFacts,inputs = gitInputs(root,tree,base)}) {
  validateFacts(envFacts);
  assert.ok(appManifests && Object.keys(appManifests).length && deviceImage && Object.keys(deviceImage).length);
  const content = Object.fromEntries(Object.entries(appManifests).map(([profile, identity]) => {
    assert.match(identity.manifestSha256, digest);
    assert.match(identity.fileSha256, digest);
    return [profile, identity.manifestSha256];
  }));
  const scenarioFiles = [], driverFiles = [];
  for (const row of inputs.candidate) {
    if (/^(?:tests\/(?!browser\/)|docs\/components\/.*\.scenarios\.ya?ml$|catalog\/native\/)/.test(row.path))
      scenarioFiles.push([row.path,row.mode,row.oid]);
    else if (protectedInput(row.path) || /^(?:scripts\/|packages\/policy\/|manifests\/)/.test(row.path))
      driverFiles.push([row.path,row.mode,row.oid]);
  }
  // A phone harness can read any tracked fixture independently of the installed
  // app. Bind its functional verdict to the complete immutable input tree.
  assert.match(tree, oid);
  return canonicalFingerprint({contractVersion:guardrails.contractVersion,groupId,tree,appManifests:content,scenarioFiles,
    driverFiles,deviceImage,envFacts:{...envFacts,scope,trustedPipeline:inputs.basePipeline}});
}
