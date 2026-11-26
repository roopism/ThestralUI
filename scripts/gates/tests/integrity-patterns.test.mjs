import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { inspectSecret } from '../../../packages/policy/quality/integrity.mjs';

// Planted values are assembled at runtime so this file never contains a credential-shaped literal.
const join = (...parts) => parts.join('');
const run = (alphabet, length) => Array.from({length}, (_, i) => alphabet[(i * 7 + 3) % alphabet.length]).join('');
const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567', mixed = 'aB3dE5gH7jK9mN1pQ2sT4vW6yZ8cF0', hex = '0123456789abcdef';
const planted = {
  'private key (DSA)': join('-----BEGIN DSA ', 'PRIVATE KEY-----'),
  'private key (encrypted)': join('-----BEGIN ENCRYPTED ', 'PRIVATE KEY-----'),
  'private key (PGP block)': join('-----BEGIN PGP ', 'PRIVATE KEY BLOCK-----'),
  'AWS access key': join('AK', 'IA', run(upper, 16)),
  'AWS session key': join('AS', 'IA', run(upper, 16)),
  'AWS secret key': join('aws_secret', '_access_key = "', run(mixed + '/+', 40), '"'),
  'unsigned JWT': join('ey', run(mixed, 20), '.ey', run(mixed, 20), '.'),
  'short-signature JWT': join('ey', run(mixed, 20), '.ey', run(mixed, 20), '.', run(mixed, 12)),
  'npm token': join('np', 'm_', run(mixed, 36)),
  'GitLab token': join('gl', 'pat-', run(mixed, 20)),
  'Slack token': join('xo', 'xb-', run(hex, 12), '-', run(mixed, 24)),
  'Slack webhook': join('https://hooks.', 'slack.com/services/', run(mixed, 44)),
  'Stripe key': join('sk', '_live_', run(mixed, 24)),
  'Google API key': join('AI', 'za', run(mixed, 35)),
  'PyPI token': join('py', 'pi-AgEIcHlwaS5vcmc', run(mixed, 60)),
  'SendGrid key': join('S', 'G.', run(mixed, 22), '.', run(mixed, 43)),
  'Docker Hub token': join('dckr', '_pat_', run(mixed, 27)),
  'Shopify token': join('shp', 'at_', run(hex, 32)),
  'Hugging Face token': join('h', 'f_', run('abcdefghijKLMNOPQRSTuvwxyz', 34)),
  'npmrc auth token': join('//registry.npmjs.org/:_auth', 'Token=', run(mixed, 36)),
  'generic key assignment': join('api', '_key: "', run(mixed, 32), '"'),
};
for (const [name, value] of Object.entries(planted)) {
  test('credential scan rejects a planted ' + name, () => {
    assert.equal(inspectSecret('src/config.ts', Buffer.from('const value = ' + value + ';\n')).length, 1, value);
  });
}

test('credential scan allows placeholders, low-entropy values and the current tree', () => {
  for (const text of [
    '//registry.npmjs.org/:_authToken=${NPM_TOKEN}',
    'api_key: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"',
    'token: "aaaaaaaaaabbbbbbbbbbaaaaaaaaaa"',
    'const tokenName = "primary-surface";',
    'AKIA-is-a-prefix, not a key',
  ]) assert.deepEqual(inspectSecret('src/config.ts', Buffer.from(text)), [], text);
  const names = execFileSync('git', ['ls-files', '-z']).toString().split('\0').filter(Boolean);
  const flagged = names.filter(path => existsSync(path) && inspectSecret(path, readFileSync(path)).length);
  assert.deepEqual(flagged, []);
});
