import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// On the reviewed historical source, preserve its original owners and all of
// its exceptions. Every later version uses the current owners and is rescanned.
export function selectOwners(root, config) {
  const owners = [...config.owners];
  const retired = new Map();
  const triggers = new Set();
  for (const change of config.ownerTransitions ?? []) {
    if (config.mode !== 'library' || !/^packages\/(?:native|web)\/src\/(?:[a-z0-9-]+\/)+[a-z0-9-]+\.tsx?$/.test(change.file) ||
        !/^[a-f0-9]{64}$/.test(change.previousSha256) || triggers.has(change.file) ||
        !Array.isArray(change.previousOwners) || !Array.isArray(change.currentOwners))
      throw Error('An ownership transition requires one exact library source, its historical digest and both owner lists.');
    for (const rule of [...change.previousOwners, ...change.currentOwners]) {
      if (dirname(rule.file) !== dirname(change.file) || !/^[a-z0-9-]+\.tsx?$/.test(rule.file.split('/').at(-1)) ||
          !/^[A-Za-z_$][\w$]*$/.test(rule.symbol) || !/^[a-z][a-z0-9-]*$/.test(rule.family))
        throw Error('A replacement owner must name a specific symbol and family within its existing implementation directory.');
    }
    triggers.add(change.file);
    const file = resolve(realpathSync(root), change.file);
    if (realpathSync(file) !== file) throw Error('The ownership source must be a regular repository file: ' + change.file);
    const digest = createHash('sha256').update(readFileSync(file)).digest('hex');
    const previous = digest === change.previousSha256;
    owners.push(...(previous ? change.previousOwners : change.currentOwners));
    for (const fingerprint of change.previousExceptions ?? []) {
      if (!/^[a-f0-9]{64}$/.test(fingerprint) || retired.has(fingerprint))
        throw Error('Historical ownership exceptions need unique, exact fingerprints.');
      retired.set(fingerprint, { file: change.file, inactive: !previous });
    }
  }
  return { owners, retired };
}

// Match metadata to the named source even while its old finding is inactive.
// New, changed and expired active exceptions still undergo the ordinary review.
export function applicableExceptions(exceptions, retired) {
  if (!retired.size) return exceptions;
  const byId = new Map(exceptions.map(entry => [entry.fingerprint, entry]));
  for (const [id, source] of retired) {
    if (byId.get(id)?.file !== source.file || exceptions.filter(row => row.fingerprint === id).length !== 1)
      throw Error('Historical exception does not identify exactly one finding from ' + source.file + ': ' + id);
  }
  return exceptions.filter(entry => !retired.get(entry.fingerprint)?.inactive);
}
