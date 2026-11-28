import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { verdictInputRoot } from './gates/verdict.mjs';

export const packedGzipSize = bytes => gzipSync(bytes, { level: 9 }).length;

export function packedEntrySize(label, output) {
  const size = { entry: label, gzip: packedGzipSize(output.contents) };
  if (label.endsWith('.css')) size.css = output.text;
  return size;
}

export const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const releaseDigests = {
  'ui-lazy-dev-tokens-0.2.0.tgz':
    '9715d0f5b7cacb2f73f0a9006aff3403a060f21d464e71ee26feba2099df0a09',
  'ui-lazy-dev-ui-web-0.2.0.tgz':
    '68390ac8d4780564efc3b6870405f56c02ce75c2bf9c58caba5775ac99441f92',
};

export function verifyBaseline(read = readFileSync) {
  return Object.entries(releaseDigests).map(([name, digest]) => {
    const path = join(verdictInputRoot, 'tests/packaging/baseline', name);
    assert.equal(sha256(read(path)), digest, 'Historical release digest mismatch: ' + name);
    return path;
  });
}

export function assertCoverage(exportKeys, budgetKeys) {
  assert.deepEqual(
    [...exportKeys].sort(),
    [...budgetKeys].sort(),
    'Public entry budget coverage mismatch',
  );
}

export function enforceBudget(name, actual, ceiling) {
  assert.ok(
    Number.isFinite(actual) && actual <= ceiling,
    name + ' exceeded ' + ceiling + ' B with ' + actual + ' B',
  );
}

// Any new identifier or expression needs a human dependency-policy change.
const allowed = new Set(['MIT', 'Apache-2.0', 'BSD-3-Clause', 'BSD-2-Clause', 'ISC', '0BSD']);
// Distribution retains each package's notices. Data and alternative license expressions
// are accepted only for the named package; every new pairing requires review.
const namedLicenses = new Map([
  ['caniuse-lite', 'CC-BY-4.0'],
  ['fb-dotslash', '(MIT OR Apache-2.0)'],
  ['graceful-fs', 'BlueOak-1.0.0'],
  ['mdn-data', 'CC0-1.0'],
  ['type-fest', '(MIT OR CC0-1.0)'],
]);
const proprietary = new Set([
  '@ui-lazy-dev/tokens',
  '@ui-lazy-dev/ui-web',
  '@ui-lazy-dev/ui-native',
  '@ui-lazy-dev/policy',
  '@ui-lazy-dev/style-policy',
  '@ui-lazy-dev/codemods',
  'ui-release-fixture',
]);
export function validateBom(components) {
  assert.ok(components?.length, 'Empty software bill of materials');
  return components.map((component) => {
    const name = [component.group, component.name].filter(Boolean).join('/');
    assert.ok(name && component.version, 'Missing package identity');
    assert.ok(
      component.hashes?.some(
        (hash) =>
          (hash.alg === 'SHA-512' && /^[a-f0-9]{128}$/i.test(hash.content)) ||
          (hash.alg === 'SHA-256' && /^[a-f0-9]{64}$/i.test(hash.content)),
      ),
      'Missing distribution digest: ' + name,
    );
    const licenses = (component.licenses ?? []).map(
      (item) => item.license?.id ?? item.license?.name ?? item.expression,
    );
    if (!licenses.length && proprietary.has(name)) licenses.push('Private first-party');
    assert.ok(
      licenses.length &&
        licenses.every(
          (id) =>
            allowed.has(id) ||
            namedLicenses.get(name) === id ||
            (id === 'Private first-party' && proprietary.has(name)),
        ),
      'Review dependency license: ' + name + ' ' + licenses.join(', '),
    );
    return { name, version: component.version, licenses };
  });
}
