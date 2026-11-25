import assert from 'node:assert/strict';
import { effectiveBundleBudgets } from './reviewed-bundle-budgets.mjs';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import ts from 'typescript';
import { renderDepthRegistry } from './depth-registry.mjs';
import { checkFamilyRegistration, checkRootExport } from './product-registrations.mjs';

const json = (value) => JSON.stringify(value, null, 2) + '\n';
const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
const order = (a, b) => (a.order ?? Infinity) - (b.order ?? Infinity);
const sourceRoot = fileURLToPath(new URL('../../', import.meta.url));

export function loadManifests(root = sourceRoot) {
  const folder = join(root, 'manifests/families');
  const families = readdirSync(folder).filter((name) => name.endsWith('.json')).sort().map((name) => {
    const row = read(join(folder, name));
    assert.equal(name, row.id.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-') + '.json',
      'Manifest filename must match its family id: ' + name);
    checkFamilyRegistration(null, row, 'manifests/families/' + name);
    return row;
  }).sort(order);
  return { families, shared: read(join(root, 'manifests/shared.json')) };
}

function uniqueEntries(rows, key, value) {
  const entries = {};
  for (const row of rows.toSorted(order)) {
    const name = row[key];
    assert.ok(!Object.hasOwn(entries, name), 'Multiple manifests own ' + name);
    entries[name] = row[value];
  }
  return entries;
}

export function inventoryData(families, shared) {
  return {
    revision: shared.revision,
    references: shared.references,
    behaviorAnchors: Object.fromEntries(families.filter((f) => f.behaviorAnchor).map((f) => [f.id, f.behaviorAnchor])),
    families: families.map(({ id, inventory }) => {
      const { layer, owner, refs, api, web, native, story, test, ownership, ...extra } = inventory;
      return { id, layer, owner, refs, api, web, native, story, test, ...extra,
        maturity: web === 'supported' ? 'candidate' : web === 'exported' ? 'experimental' : web,
        platforms: { web, iOS: native, Android: native }, ownership };
    }),
  };
}

function inventoryModule(data) {
  const { families, ...metadata } = data;
  const lines = ['// Generated from manifests/families by scripts/manifests/generate.mjs.'];
  for (const [name, value] of Object.entries(metadata)) {
    lines.push('export const ' + name + ' = ' + JSON.stringify(value, null, 2) + ';');
  }
  // Legacy inventory callers see both fixture properties, even on a reference-only family.
  const rows = JSON.stringify(families, (_key, value) => value === undefined ? null : value, 2)
    .replace(/^(\s+"(?:story|test)": )null(,?)$/gm, '$1undefined$2');
  lines.push('export const families = ' + rows + ';', '');
  return lines.join('\n');
}

function rootIndex(source, declarations) {
  const ast = ts.createSourceFile('index.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const start = ast.statements.findIndex(ts.isExportDeclaration);
  if (start !== -1) {
    assert.ok(ast.statements.slice(start).every(ts.isExportDeclaration),
      'Move inline implementation before generated root re-exports.');
  }
  const body = (start === -1 ? source : source.slice(0, ast.statements[start].getStart(ast))).trimEnd();
  const names = new Set();
  const lines = declarations.toSorted(order).map((entry) => {
    checkRootExport(entry);
    for (const name of entry.names) {
      const exposed = name.replace(/^type /, '').split(' as ').at(-1);
      assert.ok(!names.has(exposed), 'Duplicate root re-export ' + exposed);
      names.add(exposed);
    }
    return "export { " + entry.names.join(', ') + " } from '" + entry.from + "';";
  });
  return [body, lines.join('\n')].filter(Boolean).join('\n\n') + '\n';
}

// Only the exports value is generated. Preserve all other bytes of the package manifest.
function packageManifest(source, entries) {
  const file = ts.parseJsonText('package.json', source);
  const object = file.statements[0].expression;
  const property = object.properties.find((item) => item.name?.text === 'exports');
  if (!property) return json({ ...JSON.parse(source), exports: entries });
  const start = property.getStart(file);
  const line = source.slice(source.lastIndexOf('\n', start - 1) + 1, start);
  const indent = line.match(/^\s*/)[0];
  const value = JSON.stringify(entries, null, 2).replaceAll('\n', '\n' + indent);
  return source.slice(0, property.initializer.getStart(file)) + value + source.slice(property.initializer.end);
}

export function verificationOutputs({ families, shared }) {
  const rows = [shared, ...families];
  const cases = (group) => [...new Set(rows.flatMap((row) => row.cases?.[group] ?? []))].sort();
  const outputs = new Map([
    ['docs/component-inventory.mjs', inventoryModule(inventoryData(families, shared))],
    ['packages/policy/quality/api-depth/families.json', renderDepthRegistry(families, shared)],
    ['tests/packaging/bundle-baseline.json', json(effectiveBundleBudgets(families, uniqueEntries(rows.flatMap((row) => row.budgets ?? []), 'name', 'bytes')))],
    ['tests/acceptance/unit-matrix.json', json({ schema: 1, vitest: cases('vitest'), native: cases('native'), node: cases('node') })],
  ]);
  for (const layer of ['browser', 'visual']) {
    const tests = cases(layer);
    const matrix = { projects: shared.projects, cases: shared.projects.flatMap((engine) => tests.map((name) => engine + ' | ' + name)).sort() };
    outputs.set('tests/acceptance/' + layer + '-matrix.json', json(matrix));
  }
  return outputs;
}

export function generate({ families, shared }, source = sourceRoot) {
  const rows = [shared, ...families];
  const outputs = verificationOutputs({ families, shared });
  const entries = rows.flatMap((row) => row.entries ?? []);
  const registered = new Set(entries.map((entry) => entry.pkg));
  // A newly added package must register its public entries before generation.
  for (const pkg of readdirSync(join(source, 'packages'), { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const path = 'packages/' + pkg.name + '/package.json';
    if (!existsSync(join(source, path))) continue;
    registered.delete(pkg.name);
    const content = readFileSync(join(source, path), 'utf8');
    const data = JSON.parse(content);
    const selected = entries.filter((entry) => entry.pkg === pkg.name);
    if (!selected.length) {
      assert.ok(!data.exports || !Object.keys(data.exports).length, 'No manifest owns exports of ' + pkg.name);
      continue;
    }
    outputs.set(path, packageManifest(content, uniqueEntries(selected, 'path', 'target')));
  }
  assert.equal(registered.size, 0, 'Missing package manifest for ' + [...registered].join(', '));
  for (const pkg of ['web', 'native']) {
    const path = 'packages/' + pkg + '/src/index.tsx';
    const original = readFileSync(join(source, path), 'utf8');
    const declarations = families.flatMap((row) => row.rootExports ?? []).filter((entry) => entry.pkg === pkg);
    outputs.set(path, rootIndex(original, declarations));
  }
  return outputs;
}

// During a worker commit the authoritative change can be just a family manifest.
// Validate hand-edited outputs and build the others inside the private checkout.
export function materializeCommitOutputs(root, changedPaths) {
  const changed = new Set(changedPaths);
  const outputs = generate(loadManifests(root), root);
  for (const [path, contents] of outputs) {
    if (changed.has(path)) {
      assert.ok(readFileSync(join(root, path), 'utf8') === contents,
        'Staged generated output differs from its family manifests: ' + path);
    }
  }
  for (const [path, contents] of outputs) {
    if (changed.has(path)) continue;
    const file = join(root, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, contents);
  }
}

async function main() {
  const { values } = parseArgs({ options: {
    source: { type: 'string', default: sourceRoot }, dest: { type: 'string' },
    check: { type: 'boolean' }, 'compare-legacy': { type: 'boolean' },
  } });
  const root = resolve(values.source);
  const data = loadManifests();
  for (const [name, result] of generate(data, root)) {
    if (values.dest) {
      const file = resolve(values.dest, name);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, result);
    }
    if (values.check || values['compare-legacy'] || !values.dest) {
      if (name === 'docs/component-inventory.mjs' && values['compare-legacy']) {
        const legacy = await import(pathToFileURL(resolve(root, name)));
        const generated = await import('data:text/javascript;base64,' + Buffer.from(result).toString('base64'));
        assert.deepEqual(Object.keys(generated), Object.keys(legacy), 'Inventory module exports changed');
        for (const key of Object.keys(generated)) {
          assert.deepEqual(generated[key], legacy[key], 'Inventory contract changed: ' + key);
          assert.equal(JSON.stringify(generated[key]), JSON.stringify(legacy[key]), 'Inventory order changed: ' + key);
        }
      } else if (readFileSync(join(root, name), 'utf8') !== result) {
        throw new Error('Generated output differs: ' + name);
      }
    }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
