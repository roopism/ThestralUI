import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import { loadManifests } from './manifests/generate.mjs';
import { pathToFileURL } from 'node:url';
import { brotliCompressSync, constants } from 'node:zlib';
import { packedEntrySize } from './gates/family-styles.mjs';
import { build } from 'esbuild';
import { readJson, root, saveJson } from './verify-artifacts.mjs';
import { assertCoverage, enforceBudget } from './verify-policy.mjs';

// Map each JavaScript subpath to a representative independent import.
const policies = {
  '@ui-lazy-dev/tokens': {
    '.': 'tokens', './styles.css': null, './tokens.json': null,
    './modes': 'createTheme', './modes.css': null, './theme-css': 'createBrandCSS',
    './brands/enterprise': 'enterprise', './brands/enterprise.css': null,
    './brands/expressive': 'expressive', './brands/expressive.css': null,
  },
  '@ui-lazy-dev/ui-web': {
    '.': 'Button',
    './dialog': 'Dialog',
    './styles.css': null,
    './forms': 'Checkbox',
    './navigation': 'Tabs',
    './modes': 'ModeProvider',
    './primitives': 'Stack',
    './document': 'Heading',
    './primitives.css': null,
    './collections': 'DataTable',
    './collections.css': null,
    './workflows': 'AppShell',
    './workflows.css': null,
    './motion': 'animateSharedElement',
    './motion.css': null,
    './avatar': 'Avatar',
    './color': 'ColorPicker',
    './entry-fields': 'CodeField',
    './controls.css': null,
    './patterns': 'EmptyState',
  },
};
const baseline = readJson(join(root, 'tests/packaging/bundle-baseline.json'));
// Entries read only by native renderers. Like the ui-native package, they are outside the
// web budgets, and every web entry of the same package must exclude their output.
const nativeEntries = { '@ui-lazy-dev/tokens': { entry: './native', output: /\/dist\/native\.js$/ } };
const webEntry = (name, entry) => nativeEntries[name]?.entry !== entry;

// The original representative imports stay mandatory. Every additional public subpath is measured
// independently, along with each named import registered for it by the owning family.
export function registeredBundleImports(families, shared, names, limits) {
  const result = new Map();
  function add(pkg, entry, symbol) {
    if (!result.has(pkg)) result.set(pkg, new Map());
    const entries = result.get(pkg);
    if (!entries.has(entry)) entries.set(entry, new Set());
    if (symbol) entries.get(entry).add(symbol);
  }
  for (const [pkg, entries] of Object.entries(policies))
    for (const [entry, symbol] of Object.entries(entries)) add(pkg, entry, symbol);
  const separate = new Set(['native', 'policy', 'style-policy', 'codemods']);
  for (const row of [shared, ...families]) {
    for (const { pkg, path } of row.entries ?? []) {
      if (separate.has(pkg)) continue;
      const name = names.get(pkg);
      assert.ok(name, 'Unregistered workspace ' + pkg);
      if (webEntry(name, path)) add(name, path);
    }
  }
  for (const label of Object.keys(limits)) {
    const match = /^(@[^/]+\/[^/#]+)(\/[^#]+)?(?:#([A-Za-z_$][\w$]*))?$/.exec(label);
    assert.ok(match, 'Invalid public budget registration ' + label);
    const [, name, subpath, symbol] = match, entry = subpath ? '.' + subpath : '.';
    assert.ok(result.get(name)?.has(entry), 'Budget has no registered public entry: ' + label);
    add(name, entry, symbol);
  }
  return result;
}

export function bundleImports() {
  const { families, shared } = loadManifests(root);
  const packages = new Map();
  for (const row of [shared, ...families]) {
    for (const { pkg } of row.entries ?? []) {
      if (!packages.has(pkg)) packages.set(pkg, readJson(join(root, 'packages', pkg, 'package.json')).name);
    }
  }
  return registeredBundleImports(families, shared, packages, baseline);
}

export { packedGzipSize } from './gates/family-styles.mjs';

export function buildPackedImport(cwd, name, entry, symbol) {
  const css = entry.endsWith('.css');
  const all = entry.endsWith('.json') ? '{ default }' : '*';
  const selection = symbol ? '{ ' + symbol + ' }' : all;
  const contents = css
    ? '@import ' + JSON.stringify(name) + ';'
    : 'export ' + selection + ' from ' + JSON.stringify(name) + ';';
  return build({
    absWorkingDir: cwd,
    bundle: true,
    write: false,
    minify: true,
    treeShaking: true,
    platform: 'browser',
    target: 'es2022',
    format: 'esm',
    metafile: true,
    external: ['react', 'react-dom'],
    define: { 'process.env.NODE_ENV': '"production"' },
    stdin: { contents, resolveDir: cwd, loader: css ? 'css' : 'js' },
  });
}

export async function measureBundles(cwd, { diagnostics = false, selectedEntries } = {}) {
  const results = [];
  for (const [pkg, entries] of bundleImports()) {
    const manifest = readJson(join(cwd, 'node_modules', pkg, 'package.json'));
    if (!diagnostics) assertCoverage(Object.keys(manifest.exports).filter(entry => webEntry(pkg, entry)), [...entries.keys()]);
    for (const [entry, symbols] of entries) {
      if (diagnostics && !Object.hasOwn(manifest.exports, entry)) continue;
      const name = pkg + (entry === '.' ? '' : entry.slice(1));
      for (const symbol of [null, ...symbols]) {
        const label = name + (symbol ? '#' + symbol : '');
        if (selectedEntries && !selectedEntries.includes(label)) continue;
        const result = await buildPackedImport(cwd, name, entry, symbol);
        assert.equal(result.outputFiles.length, 1, 'Additional assets require a budget: ' + name);
        const bytes = result.outputFiles[0].contents;
        const measurement = packedEntrySize(label, result.outputFiles[0]);
        const { gzip } = measurement;
        const brotli = brotliCompressSync(bytes, {
          params: { [constants.BROTLI_PARAM_QUALITY]: 9 },
        }).length;
        const reference = baseline[label];
        if (!diagnostics) assert.ok(reference > 0, 'Missing release size baseline: ' + label);
        const ceiling = reference + Math.max(48, Math.ceil(reference * 0.1));
        if (!diagnostics) enforceBudget(label, gzip, ceiling);
        // Inspect emitted bytes. Tree-shaken inputs may still appear in the parsed dependency graph.
        const included = Object.values(result.metafile.outputs)
          .flatMap((output) => Object.entries(output.inputs))
          .filter(([, details]) => details.bytesInOutput > 0)
          .map(([path]) => path);
        if (entry === '.' || entry === './styles.css') {
          assert.ok(!included.some(path => /\/dist\/(?:modes(?:\/|\.)|brands\/)/.test(path)),
            'Optional modes or brand assets leaked into ' + name);
        }
        if (nativeEntries[pkg]) {
          assert.ok(!included.some(path => nativeEntries[pkg].output.test(path)),
            'Native-only tokens leaked into the web entry ' + name);
        }
        if (pkg === '@ui-lazy-dev/tokens' && !entry.startsWith('./brands/expressive')) {
          assert.ok(!included.some(path => /\/brands\/expressive[./]/.test(path)),
            'The optional expressive brand leaked into ' + name);
        }
        if (pkg.endsWith('ui-web') && entry === '.') {
          assert.ok(
            !included.some((path) =>
              /react-aria|react-stately|dist\/motion|dist\/collections/.test(path),
            ),
            'Optional family leaked into the default entry',
          );
        }
        results.push({
          ...measurement,
          minified: bytes.length,
          brotli,
          referenceGzip: reference,
          deltaGzip: gzip - reference,
          gzipCeiling: ceiling,
        });
      }
    }
  }
  if (!diagnostics)
    assertCoverage(
      results.map((result) => result.entry),
      selectedEntries ?? Object.keys(baseline),
    );
  return results;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const results = await measureBundles(resolve(process.argv[2] || '.'), {
    diagnostics: process.argv.includes('--measure'),
  });
  if (process.argv[3] && process.argv[3] !== '--measure')
    saveJson(resolve(process.argv[3]), results);
  console.table(results);
}
