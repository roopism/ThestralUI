import { isDeepStrictEqual } from 'node:util';

export const familyManifest = /^manifests\/families\/([a-z0-9]+(?:-[a-z0-9]+)*)\.json$/;
export const familyStyle = /^packages\/web\/src\/([a-z0-9]+(?:-[a-z0-9]+)*)\/.+\.css$/;
const testField = { vitest: 'unit', native: 'nativeUnit', browser: 'browser' };
const attachmentFields = ['source', 'nativeSource', 'unit', 'nativeUnit', 'browser', 'scenario', 'story', 'style'];

function requireScope(ok, reason) {
  if (!ok) throw Error(reason);
}

function rows(files) {
  return new Map([...files].filter(([file]) => familyManifest.test(file))
    .map(([file, text]) => [file, JSON.parse(text)]));
}

function owners(manifests, path) {
  return [...manifests.values()].filter(row => Object.values(row.files ?? {}).some(paths =>
    Array.isArray(paths) && paths.includes(path))).map(row => row.id);
}

function claimable(path, field, slug) {
  if (path.split('/').some(part => !part || part === '.' || part === '..')) return false;
  if (field === 'style') return familyStyle.exec(path)?.[1] === slug;
  if (field === 'source' || field === 'nativeSource')
    return path.startsWith('packages/' + (field === 'source' ? 'web' : 'native') + '/src/' + slug + '/')
      && /\.[cm]?[jt]sx?$/.test(path);
  if (field === 'scenario') return path === 'docs/components/' + slug + '.scenarios.yaml';
  if (field === 'story') return path === 'catalog/' + slug + '.stories.tsx' || path.startsWith('catalog/' + slug + '/');
  const root = 'tests/' + slug + '/';
  if (!path.startsWith(root)) return false;
  if (field === 'nativeUnit') return path === root + 'native.test.cjs';
  if (field === 'browser') return /^([^/]+)\.spec\.[cm]?[jt]sx?$/.test(path.slice(root.length));
  return field === 'unit' && /\.test\.tsx?$/.test(path);
}

function casePath(value, kind, files) {
  if (typeof value !== 'string') return;
  const [path, title] = value.split(' | ');
  if (!title || !path) return;
  const options = kind === 'browser' ? [path, 'tests/' + path, 'tests/browser/' + path] : [path];
  return files.find(file => options.includes(file));
}

function checkCoverage(before, after, priorOwners, nextOwners, slug, changed) {
  const { files: oldFiles = {}, cases: oldCases = {}, depth: oldDepth, inventory: oldInventory = {}, ...oldContract } = before;
  const { files = {}, cases = {}, depth, inventory = {}, ...contract } = after;
  const reason = 'Changed ownership, coverage or publishing contract for ' + before.id;
  requireScope(isDeepStrictEqual(oldContract, contract) && oldDepth && depth, reason);
  const { evidence: oldEvidence = {}, assertions: oldAssertions = {}, ...oldDepthContract } = oldDepth;
  const { evidence = {}, assertions = {}, ...depthContract } = depth;
  requireScope(isDeepStrictEqual(oldDepthContract, depthContract), reason);
  let native = false;
  for (const key of new Set([...Object.keys(oldInventory), ...Object.keys(inventory)])) {
    if (isDeepStrictEqual(oldInventory[key], inventory[key])) continue;
    const allowed = { test: ['unit', 'browser'], story: ['story'], nativeTest: ['nativeUnit'], nativeStory: ['story'] };
    requireScope(Object.hasOwn(allowed, key) && inventory[key], reason);
    for (const [path, attachments, mappings] of [
      [oldInventory[key], oldFiles, priorOwners], [inventory[key], files, nextOwners],
    ]) {
      if (path === undefined) continue;
      requireScope(allowed[key].some(field => attachments[field]?.includes(path))
        && isDeepStrictEqual(owners(mappings, path), [before.id]), reason);
    }
    if (key === 'nativeTest' || key === 'nativeStory') native = true;
  }
  for (const field of new Set([...Object.keys(oldFiles), ...Object.keys(files)])) {
    const old = oldFiles[field] ?? [], next = files[field] ?? [];
    if (isDeepStrictEqual(old, next)) continue;
    requireScope(attachmentFields.includes(field) && Array.isArray(old) && Array.isArray(next)
      && new Set(next).size === next.length, reason);
    // A removed ownership edge can narrow the affected graph. Run tier 2 for that migration.
    requireScope(old.every(path => next.includes(path)), reason);
    for (const path of next.filter(path => !old.includes(path))) {
      requireScope(typeof path === 'string' && claimable(path, field, slug)
        && owners(priorOwners, path).length === 0
        && isDeepStrictEqual(owners(nextOwners, path), [before.id]), reason + ': ' + path);
    }
    if (field === 'nativeSource' || field === 'nativeUnit') native = true;
  }
  for (const kind of new Set([...Object.keys(oldCases), ...Object.keys(cases)])) {
    const old = oldCases[kind] ?? [], next = cases[kind] ?? [];
    if (isDeepStrictEqual(old, next)) continue;
    const field = testField[kind];
    requireScope(field && Array.isArray(old) && Array.isArray(next) && new Set(next).size === next.length, reason);
    for (const [values, other, mappings] of [[next, old, nextOwners], [old, next, priorOwners]]) {
      for (const value of values.filter(item => !other.includes(item))) {
        const path = casePath(value, kind, files[field] ?? []);
        requireScope(path && isDeepStrictEqual(owners(mappings, path), [before.id]) && changed.has(path),
          reason + ': case edits must accompany the owning test');
      }
    }
    if (kind === 'native') native = true;
  }
  function ownedCase(identity, mappings) {
    return Object.entries(testField).some(([kind, field]) => {
      const path = casePath(identity, kind, files[field] ?? []);
      return path && changed.has(path) && isDeepStrictEqual(owners(mappings, path), [before.id]);
    });
  }
  for (const kind of new Set([...Object.keys(oldEvidence), ...Object.keys(evidence)])) {
    if (isDeepStrictEqual(oldEvidence[kind], evidence[kind])) continue;
    requireScope(['unit', 'native', 'browser'].includes(kind), reason);
    for (const [value, records, mappings] of [
      [oldEvidence[kind], oldCases, priorOwners], [evidence[kind], cases, nextOwners],
    ]) {
      const identities = value === undefined ? [] : [value].flat();
      const group = kind === 'unit' ? 'vitest' : kind;
      requireScope(identities.every(id => records[group]?.includes(id) && ownedCase(id, mappings)), reason);
    }
  }
  for (const id of new Set([...Object.keys(oldAssertions), ...Object.keys(assertions)])) {
    if (isDeepStrictEqual(oldAssertions[id], assertions[id])) continue;
    for (const [map, records, mappings] of [[oldAssertions, oldCases, priorOwners], [assertions, cases, nextOwners]]) {
      if (!Object.hasOwn(map, id)) continue;
      requireScope(Object.values(records).some(group => group.includes(id)) && ownedCase(id, mappings), reason);
    }
  }
  return native;
}

function sheets(text, path, exported) {
  const markers = [...text.matchAll(/\/\* @uld-css-chunk ([\w-]+)(?:\.\d+)? \*\/\n/g)];
  requireScope(markers[0]?.index === 0, 'Unknown stylesheet compilation rule for ' + path);
  return markers.map(match => {
    const entry = './' + match[1] + '.css';
    requireScope(exported.includes(entry), 'No exported stylesheet for ' + path + ': ' + entry);
    return entry;
  });
}

// Inspect the old and staged manifests together. In particular, a manifest edit must
// never turn a shared attachment into a private stylesheet for the same staged change.
export function familyChanges(before, after, changes) {
  const prior = rows(before), next = rows(after), changed = new Set(changes.map(change => change.path));
  const css = new Set();
  let native = false;
  for (const { path, status } of changes) {
    const slug = familyManifest.exec(path)?.[1];
    if (slug) {
      requireScope(status === 'M' && prior.has(path) && next.has(path), 'New or removed family manifest: ' + path);
      native = checkCoverage(prior.get(path), next.get(path), prior, next, slug, changed) || native;
    }
    const styleSlug = familyStyle.exec(path)?.[1];
    if (!styleSlug) continue;
    const file = 'manifests/families/' + styleSlug + '.json', owner = next.get(file);
    const oldOwners = owners(prior, path), nextOwners = owners(next, path);
    requireScope(owner?.files?.style?.includes(path) && isDeepStrictEqual(nextOwners, [owner.id])
      && (status === 'A' ? oldOwners.length === 0 : isDeepStrictEqual(oldOwners, [owner.id])),
      'Unowned or shared family stylesheet: ' + path);
    for (const inputs of [before, after]) {
      if (!inputs.has(path)) continue;
      const exported = Object.keys(JSON.parse(inputs.get('packages/web/package.json')).exports).filter(key => key.endsWith('.css'));
      for (const sheet of sheets(inputs.get(path), path, exported)) css.add(sheet);
      // A public sheet can import another. For unfamiliar imports cover every
      // public CSS budget, including parents the affected chunk does not name.
      for (const [style, body] of inputs) {
        if (!style.endsWith('.css')) continue;
        if (/@import\b/i.test(body.replace(/@import\s+(['"])@ui-lazy-dev\/tokens\/styles\.css\1\s*;/gi, ''))) {
          for (const entry of exported) css.add(entry);
          break;
        }
      }
    }
  }
  return { css: [...css].map(entry => '@ui-lazy-dev/ui-web/' + entry.slice(2)), native };
}
