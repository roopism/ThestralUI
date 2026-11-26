import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { depthRegistry } from './registrations.mjs';

const gateDirectories = [
  'scripts/', '.githooks/', '.github/', 'packages/policy/', 'packages/style-policy/', 'tests/android/', 'tests/simulator/',
];
const gateCode = path => gateDirectories.some(directory => path.startsWith(directory));

// derived holds the registry outputs that derivedRegistrations verified for a family branch.
export function requireGateIsolation(branch, paths, _owners, derived = new Set()) {
  if (paths.includes('scripts/gates/landing-evidence.allowed-signers'))
    throw Error('Landing evidence signer enrollment requires an owner-controlled signing channel');
  paths = paths.filter(path => !(path === depthRegistry && branch.startsWith('family/') && derived.has(path)));
  if (!paths.some(gateCode)) return;
  if (!branch.startsWith('gates/')) throw Error('Protected changes require a gates/ branch');
  if (!paths.every(gateCode)) throw Error('Cannot mix protected gate paths and other paths');
}

export function recordMergeResult(directory, commit, actualTree, qualifiedTree, identityMismatch = false) {
  if (actualTree === qualifiedTree && !identityMismatch) return;
  const file = join(directory, 'landing-blocked.json');
  const tmp = file + '.' + process.pid;
  writeFileSync(tmp, JSON.stringify({ commit, actualTree, qualifiedTree }) + '\n', { mode: 0o600 });
  renameSync(tmp, file);
}

// Call only while holding the landing lock. A different tree needs its own full receipt.
export function requireResolvedMerge(directory, verifiedReceipt) {
  const file = join(directory, 'landing-blocked.json');
  if (!existsSync(file)) return;
  const { commit, actualTree } = JSON.parse(readFileSync(file));
  if (![commit, actualTree].every((id) => /^[a-f0-9]{40}$/.test(id)))
    throw Error('Malformed blocked landing record');
  const receipt = verifiedReceipt(commit, actualTree);
  if (receipt?.status !== 'passed' || receipt.commit !== commit || receipt.tree !== actualTree)
    throw Error('First qualify the mismatched integration commit ' + commit);
  unlinkSync(file);
}
