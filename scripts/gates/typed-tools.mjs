import { trainEntryAdoption } from '../../.github/gate-review.mjs';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

export const trustedRoot = fileURLToPath(new URL('../../', import.meta.url));
const bin = {
  vitest: 'node_modules/vitest/vitest.mjs',
  jest: 'node_modules/jest/bin/jest.js',
};
export function unitCommand(kind, root, candidate, args) {
  assert.ok(Object.hasOwn(bin, kind));
  const options = kind === 'vitest'
    ? ['run', '--config', join(root, 'scripts/gates/trusted-vitest.config.mts'), '--root', candidate]
    : ['--config', JSON.stringify(nativeOptions(root, candidate)), '--runInBand'];
  // Vite's default loader writes beside its config. Hosted integration files are read-only.
  if (kind === 'vitest' && process.env.ULD_READONLY_TOOLCHAIN === '1') options.push('--configLoader', 'native');
  return [join(root, bin[kind]), ...options, ...args];
}

function nativeOptions(root, candidate) {
  const require = createRequire(join(root, 'package.json'));
  const config = require(join(root, 'jest.native.config.cjs'));
  const preset = config.preset ? require(require.resolve(config.preset)) : {};
  const { preset: presetName, ...settings } = config;
  const fromBase = name => name.startsWith('<rootDir>/') ? join(root, name.slice(10)) :
    name.startsWith('.') ? resolve(root, name) : require.resolve(name);
  const reactPackage = dirname(require.resolve('react/package.json'));
  const result = { ...preset, ...settings, rootDir: candidate, moduleNameMapper: {
    // The trusted native preset and the candidate renderer must share React's dispatcher.
    ...preset.moduleNameMapper, ...settings.moduleNameMapper,
    '^react$': require.resolve('react'), '^react/(.*)$': join(reactPackage, '$1'),
  } };
  for (const key of ['setupFiles', 'setupFilesAfterEnv']) {
    if (preset[key] || settings[key]) result[key] = [...(preset[key] ?? []), ...(settings[key] ?? [])].map(fromBase);
  }
  const transforms = { ...preset.transform, ...settings.transform };
  result.transform = Object.fromEntries(Object.entries(transforms).map(([pattern, value]) => {
    const [name, options] = Array.isArray(value) ? value : [value, {}];
    if (name === 'babel-jest') return [pattern, [fromBase(name), { ...options, configFile: join(root, 'babel.config.cjs'), babelrc: false }]];
    return [pattern, [fromBase(name), options]];
  }));
  return result;
}

const control = /(?:^|\/)(?:tsconfig[^/]*\.json|(?:vitest|jest|vite|babel)[^/]*\.config\.[^/]+|babel\.config\.[^/]+|\.babelrc(?:\.[^/]+)?)$/;
export function isTypedGateInput(file) {
  return control.test(file) || /(?:^|\/)package(?:-lock)?\.json$/.test(file);
}
const git = (cwd, ...args) => execFileSync('git', ['--no-replace-objects', ...args], { cwd, encoding: 'utf8' });
function controls(root, ref) {
  assert.match(ref, /^[0-9a-f]{40}$/);
  const result = new Map();
  for (const row of git(root, 'ls-tree', '-rz', ref).split('\0').filter(Boolean)) {
    const tab = row.indexOf('\t'), path = row.slice(tab + 1);
    const [mode, type, blob] = row.slice(0, tab).split(' ');
    const manifest = /(?:^|\/)package\.json$/.test(path);
    if (!manifest && !control.test(path)) continue;
    assert.ok(type === 'blob' && mode === '100644', 'Expected regular verdict input ' + path);
    if (manifest) {
      const scripts = JSON.parse(git(root, 'cat-file', 'blob', blob)).scripts ?? {};
      if (Object.keys(scripts).length) result.set(path, scripts);
    } else result.set(path, blob);
  }
  return result;
}
export function requireTypedControls(root, base, tree) {
  const previous = controls(root, base), current = controls(root, tree);
  if (current.get('package.json')?.train !== previous.get('package.json')?.train && trainEntryAdoption(root, base, tree))
    previous.set('package.json', { ...previous.get('package.json'), train: 'node scripts/train.mjs --publish' });
  for (const file of new Set([...previous.keys(), ...current.keys()])) {
    assert.ok(isDeepStrictEqual(previous.get(file), current.get(file)),
      'Typed or unit control requires explicit trusted adoption: ' + file);
  }
}
export function typedControlDigest(root, base) {
  const hash = createHash('sha256');
  for (const [file, value] of controls(root, base)) hash.update(JSON.stringify([file, value]) + '\n');
  for (const file of ['package-lock.json', 'scripts/gates/typed-tools.mjs', 'scripts/gates/type-project.mjs',
    'scripts', 'packages/policy', 'packages/style-policy', 'tests/android', 'tests/simulator',
    'tests/scenarios', '.github/workflows', 'tests/browser', 'playwright.config.ts', 'packages/tokens'])
    hash.update(git(root, 'rev-parse', base + ':' + file));
  return hash.digest('hex');
}

export function runTrustedNode(file, args = [], cwd = process.cwd()) {
  const result = spawnSync(process.execPath, [file, ...args], { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error(file + ' failed (' + (result.signal ?? result.status) + ')');
}
export function buildTokens(candidate, check = false) {
  candidate = realpathSync(candidate);
  // The generator reads inputs relative to itself. Use the base modules with
  // the proposed token data, then return the generated package to the snapshot.
  const scratch = mkdtempSync(join(tmpdir(), 'thestral-token-build-'));
  const tokens = join(candidate, 'packages/tokens');
  try {
    const list = cwd => execFileSync('git', ['ls-files', '-z', '--', 'packages/tokens'],
      { cwd, encoding: 'utf8' }).split('\0').filter(Boolean);
    const modules = new Set(list(trustedRoot).filter(file => file.endsWith('.mjs')));
    for (const file of list(candidate)) {
      const source = join(candidate, file);
      const dest = join(scratch, file.slice('packages/tokens/'.length));
      assert.equal(realpathSync(source), resolve(source), 'Redirected token build input');
      assert.ok(lstatSync(source).isFile());
      if (file.endsWith('.mjs')) {
        assert.ok(modules.delete(file), 'New token build module needs trusted adoption: ' + file);
        assert.ok(readFileSync(source).equals(readFileSync(join(trustedRoot, file))), 'Changed token build module needs trusted adoption: ' + file);
      }
      mkdirSync(dirname(dest), { recursive: true });
      cpSync(file.endsWith('.mjs') ? join(trustedRoot, file) : source, dest);
    }
    assert.equal(modules.size, 0, 'Missing trusted token build module');
    if (check) cpSync(join(tokens, 'dist'), join(scratch, 'dist'), { recursive: true });
    runTrustedNode(join(scratch, 'build.mjs'), check ? ['--check'] : [], scratch);
    if (!check) cpSync(join(scratch, 'dist'), join(tokens, 'dist'), { recursive: true });
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}
export function buildTypedInputs(candidate = process.cwd()) {
  const at = file => join(trustedRoot, file);
  buildTokens(candidate);
  for (const name of ['web', 'native']) {
    runTrustedNode(at('scripts/gates/type-project.mjs'), ['packages/' + name + '/tsconfig.json'], candidate);
    if (name === 'web') runTrustedNode(at('scripts/copy-styles.mjs'), [], join(candidate, 'packages/web'));
  }
}
