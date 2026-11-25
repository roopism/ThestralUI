import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { verifyBaseline } from './verify-policy.mjs';
import { command, readJson, root, saveJson } from './verify-artifacts.mjs';

function versionParts(value) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[A-Za-z0-9.-]+)?$/.exec(value);
  assert.ok(match, 'Invalid release version');
  return match.slice(1, 4).map(Number);
}
export function verifySurface(previous, candidate) {
  const [oldMajor, oldMinor, oldPatch] = versionParts(previous.version);
  const [major, minor, patch] = versionParts(candidate.version);
  assert.ok(
    major > oldMajor ||
      (major === oldMajor && (minor > oldMinor || (minor === oldMinor && patch > oldPatch))),
    'Candidate must advance the public version from the supported stable release',
  );
  for (const key of previous.exports)
    assert.ok(candidate.exports.includes(key), 'Removed public subpath: ' + key);
  for (const name of previous.styles)
    assert.ok(candidate.styles.includes(name), 'Removed public CSS class: ' + name);
  for (const [name, type] of Object.entries(previous.tokens))
    assert.equal(candidate.tokens[name], type, 'Changed token type: ' + name);
  const additions =
    candidate.exports.length > previous.exports.length ||
    Object.keys(candidate.tokens).length > Object.keys(previous.tokens).length ||
    candidate.styles.length > previous.styles.length;
  if (additions)
    assert.ok(
      major > oldMajor || minor > oldMinor,
      'Public additions require a minor or major version',
    );
}
function surface(path) {
  const unpack = (name) => command('.', 'tar', ['-xOzf', path, 'package/' + name]);
  const manifest = JSON.parse(unpack('package.json'));
  const tokens = {},
    styles = new Set();
  function inspect(node, id) {
    if (!node || typeof node !== 'object') return;
    if ('$type' in node) {
      tokens[id] = node.$type;
      return;
    }
    for (const [key, child] of Object.entries(node)) inspect(child, id ? id + '.' + key : key);
  }
  for (const [entry, target] of Object.entries(manifest.exports)) {
    if (entry.endsWith('.css'))
      for (const match of unpack(target.slice(2)).matchAll(/\.(uld-[\w-]+)/g)) styles.add(match[1]);
    if (entry.endsWith('tokens.json')) inspect(JSON.parse(unpack(target.slice(2))), '');
  }
  return {
    name: manifest.name,
    version: manifest.version,
    exports: Object.keys(manifest.exports),
    styles: [...styles],
    tokens,
  };
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const dir = resolve(process.argv[2] || 'release/evidence');
  const { packages } = readJson(join(dir, 'provenance.json'));
  const evidence = [];
  for (const path of verifyBaseline()) {
    const previous = surface(path);
    const candidate = surface(
      join(dir, packages.find((pkg) => pkg.name === previous.name).filename),
    );
    verifySurface(previous, candidate);
    evidence.push({
      name: previous.name,
      from: previous.version,
      to: candidate.version,
      oldExports: previous.exports,
      oldTokenPaths: Object.keys(previous.tokens).length,
      oldStyleClasses: previous.styles.length,
    });
  }
  const migration = readFileSync(join(root, 'docs/compatibility-web.md'), 'utf8');
  for (const entry of evidence)
    assert.ok(
      migration.includes(entry.from) && migration.includes(entry.to),
      'Add versioned migration instructions',
    );
  saveJson(join(dir, 'upgrade-contracts.json'), evidence);
  console.log(evidence);
}
