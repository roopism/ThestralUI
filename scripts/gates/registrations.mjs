import { execFileSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { renderDepthRegistry } from '../manifests/depth-registry.mjs';
import { checkFamilyRegistration, preserveRegistrations } from '../manifests/product-registrations.mjs';

// Family manifests own their API-depth rows. The registry file is their exact
// generated output, so a family branch may carry it with its product change.
export const depthRegistry = 'packages/policy/quality/api-depth/families.json';
const familyBranch = /^family\/([a-z0-9][a-z0-9-]*)$/;
const manifestEntry = /^100644 blob ([a-f0-9]{40})\t([a-z0-9-]+\.json)$/;
const slugOf = id => id.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-');
const required = ['id', 'representative', 'exports', 'expectation', 'oracle', 'evidence'];
const filled = value => typeof value === 'string' ? value.length > 0
  : Array.isArray(value) ? value.length > 0
    : value !== null && typeof value === 'object' && Object.keys(value).length > 0;

function reject(message) {
  throw Object.assign(new Error('gate/derived-registration: ' + message), { code: 'gate/derived-registration' });
}

// The modules above come from the trusted landing checkout. The candidate
// supplies only JSON blobs, which are read from Git objects, never from disk.
export function derivedRegistrations(root, base, tree, branch) {
  const owner = familyBranch.exec(branch)?.[1];
  if (!owner) return new Set();
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 128 << 20 });
  const blob = (revision, path) => {
    const entry = /^100644 blob ([a-f0-9]{40})\t/.exec(git(['ls-tree', '-z', revision, '--', path]));
    return entry ? git(['cat-file', 'blob', entry[1]]) : undefined;
  };
  const previousText = blob(base, depthRegistry), currentText = blob(tree, depthRegistry);
  if (previousText === currentText) return new Set();
  if (previousText === undefined || currentText === undefined) reject(depthRegistry + ' removed or replaced');
  const listed = git(['ls-tree', '-z', tree + ':manifests/families']).split('\0').filter(Boolean).map(entry => {
    const match = manifestEntry.exec(entry);
    if (!match) reject('invalid family manifest entry ' + JSON.stringify(entry));
    return { id: match[1], path: 'manifests/families/' + match[2] };
  });
  // One batch read keeps the check fast for a hundred manifests.
  const batch = execFileSync('git', ['cat-file', '--batch'], { cwd: root, input: listed.map(item => item.id).join('\n') + '\n', maxBuffer: 128 << 20 });
  let offset = 0;
  const families = listed.map(({ id, path }) => {
    const end = batch.indexOf(10, offset);
    const [object, type, size] = batch.subarray(offset, end).toString().split(' ');
    if (object !== id || type !== 'blob') reject(path + ' is not a blob');
    const body = batch.subarray(end + 1, end + 1 + Number(size)).toString('utf8');
    offset = end + 2 + Number(size);
    let row;
    try { row = JSON.parse(body); } catch { reject(path + ' is not JSON'); }
    checkFamilyRegistration(null, row, path);
    return row;
  }).sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
  const shared = JSON.parse(blob(base, 'manifests/shared.json'));
  let generated;
  try { generated = renderDepthRegistry(families, shared); } catch (error) { reject(error.message); }
  if (currentText !== generated) reject(depthRegistry + ' differs from the registry generated from the candidate family manifests');
  const previous = JSON.parse(previousText), current = JSON.parse(currentText);
  if (current.revision !== previous.revision) reject(depthRegistry + ' revision changed');
  const ids = current.families.map(row => row.id);
  if (new Set(ids).size !== ids.length) reject(depthRegistry + ' repeats a family id');
  const prior = new Map(previous.families.map(row => [row.id, row]));
  if (!isDeepStrictEqual(ids.filter(id => prior.has(id)), [...prior.keys()]))
    reject(depthRegistry + ' removed or reordered an existing family registration');
  for (const row of current.families) {
    const old = prior.get(row.id);
    if (old && isDeepStrictEqual(old, row)) continue;
    if (slugOf(row.id) !== owner)
      reject(depthRegistry + ': ' + row.id + ' is owned by family/' + slugOf(row.id) + ', not ' + branch);
    if (old) preserveRegistrations(old, row, depthRegistry + ': ' + row.id);
    else for (const key of required) if (!filled(row[key])) reject(depthRegistry + ': ' + row.id + ' lacks ' + key);
  }
  return new Set([depthRegistry]);
}
