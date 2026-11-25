import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import configuration from '../../vitest.config.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(new URL('../../package.json', import.meta.url));
const fromBase = (name: string) =>
  name.startsWith('.') || name.startsWith('/') ? resolve(root, name) : require.resolve(name);
const base = configuration as { test?: { setupFiles?: string | string[], globalSetup?: string | string[] } };
const paths = (value: string | string[]) => (Array.isArray(value) ? value : [value]).map(fromBase);
export default {
  ...configuration,
  test: {
    ...base.test,
    ...(base.test?.setupFiles && { setupFiles: paths(base.test.setupFiles) }),
    ...(base.test?.globalSetup && { globalSetup: paths(base.test.globalSetup) }),
  },
};
