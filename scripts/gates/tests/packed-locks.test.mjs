import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);

test('packed web, native and inventory consumers use committed dependency locks', () => {
  for (const script of ['verify-consumers', 'verify-native-consumer', 'verify-inventory']) {
    const source = readFileSync(new URL('scripts/' + script + '.mjs', root), 'utf8');
    assert.match(source, /installLockedConsumer\(/, script);
    assert.doesNotMatch(source, /['"](?:install|uninstall)['"]/, script);
  }
  for (const name of [
    'web-min-base',
    'web-max-base',
    'web-min',
    'web-max',
    'next-min',
    'next-max',
    'native-min',
    'native-max',
    'inventory',
  ]) {
    assert.ok(existsSync(new URL('tests/packaging/locks/' + name + '.json', root)), name);
  }
});

test('a consumer lock must resolve every project package to its supplied archive', async () => {
  const { verifyPrivateResolutions } = await import('../packed-install.mjs');
  const token = '@ui-lazy-dev/tokens';
  const file = 'file:../candidate/tokens.tgz';
  const local = { [token]: file };
  const entry = { version: '1.0.0', resolved: file };
  const packages = { '': { dependencies: local }, ['node_modules/' + token]: entry };
  assert.doesNotThrow(() => verifyPrivateResolutions(packages, local));
  assert.throws(
    () =>
      verifyPrivateResolutions(
        {
          ...packages,
          ['node_modules/' + token]: {
            ...entry,
            resolved: 'https://registry.npmjs.org/@ui-lazy-dev/tokens',
          },
        },
        local,
      ),
    /local archive/,
  );
  assert.throws(() => verifyPrivateResolutions(packages, {}), /local archive/);
});
