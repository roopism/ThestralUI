import { execFileSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';

const path = 'tests/android/timing-strategy.json';
const approved = {
  active: { 'android-low-end': 'paired-ab', 'mac-browser': 'absolute' },
  minPairs: 6,
  maxExtraPairs: 4,
  relativeThreshold: 0.1,
  absoluteThresholdMs: 2,
};
const ceilings = ['maxExtraPairs', 'relativeThreshold', 'absoluteThresholdMs'];

function hasKeys(value, expected) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));
}

function readConfig(root, revision) {
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  const entry = git('ls-tree', '--full-tree', '--end-of-options', revision, '--', path);
  if (!entry) return undefined;
  const [mode, type, oid] = entry.split('\t', 1)[0].split(' ');
  if (type !== 'blob' || !['100644', '100755'].includes(mode))
    throw Error(path + ' must be a regular file at ' + revision);

  const source = git('cat-file', 'blob', oid);
  let config;
  try { config = JSON.parse(source); }
  catch (cause) { throw Error(path + ' contains invalid JSON at ' + revision, { cause }); }
  const keys = Object.keys(approved);
  const surfaces = Object.keys(approved.active);
  if (!hasKeys(config, keys) || !hasKeys(config.active, surfaces))
    throw Error(path + ' must contain the approved settings and measured surfaces');
  // JSON.parse keeps the last duplicate. Count property delimiters outside strings
  // after checking the closed schema so ambiguous settings cannot silently disappear.
  const tokens = source.match(/"(?:\\.|[^"\\])*"|:/g);
  if (tokens.filter(token => token === ':').length !== keys.length + surfaces.length)
    throw Error(path + ' contains duplicate settings or surfaces');
  for (const surface of surfaces) {
    if (typeof config.active[surface] !== 'string' || !config.active[surface].trim())
      throw Error(path + ' needs a strategy name for ' + surface);
  }
  if (!Number.isSafeInteger(config.minPairs) || config.minPairs <= 0)
    throw Error(path + ' minPairs must be a positive integer');
  if (!Number.isSafeInteger(config.maxExtraPairs) || config.maxExtraPairs < 0)
    throw Error(path + ' maxExtraPairs must be a nonnegative integer');
  for (const name of ['relativeThreshold', 'absoluteThresholdMs']) {
    if (!Number.isFinite(config[name]) || config[name] < 0)
      throw Error(path + ' ' + name + ' must be a finite nonnegative number');
  }
  return config;
}

function assertRatchet(before, after) {
  if (after.minPairs < before.minPairs) throw Error(path + ' cannot reduce minPairs');
  for (const name of ceilings) {
    if (after[name] > before[name]) throw Error(path + ' cannot increase ' + name);
  }
}

export function assertTimingConfigChange(root, base, tree) {
  const before = readConfig(root, base);
  const after = readConfig(root, tree);
  if (!after) throw Error(path + ' is missing from the candidate');
  if (!before) {
    if (!isDeepStrictEqual(after, approved))
      throw Error(path + ' first adoption requires the exact registered configuration');
    return;
  }
  if (!isDeepStrictEqual(before.active, approved.active) || !isDeepStrictEqual(after.active, before.active))
    throw Error(path + ' cannot switch an active strategy without an owner-controlled signing channel');
  assertRatchet(approved, before);
  assertRatchet(before, after);
}
