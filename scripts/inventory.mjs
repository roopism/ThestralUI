import { entryName } from '../packages/policy/quality/binding-entry.mjs';
import ts from 'typescript';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as registered from '../docs/component-inventory.mjs';
import { inventoryData, loadManifests } from './manifests/generate.mjs';

export function inventoryFromSources(root) {
  const { families, shared } = loadManifests(root);
  return inventoryData(families, shared);
}
const direct = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
const { families, revision, behaviorAnchors } = direct && process.env.UI_GATE_SNAPSHOT === '1'
  ? inventoryFromSources(process.cwd()) : registered;

export function auditInventory(rows, actual, exists = existsSync) {
  const owners = new Set(),
    ids = new Set();
  for (const row of rows) {
    assert.ok(row.id && !ids.has(row.id), 'Duplicate family');
    ids.add(row.id);
    assert.ok(
      row.owner?.trim() && row.refs?.length && row.layer && row.web && row.native,
      'Incomplete family: ' + row.id,
    );
    assert.ok(
      ['supported', 'exported', 'planned', 'equivalent', 'excluded'].includes(row.web),
      'Unknown web status for ' + row.id,
    );
    assert.ok(
      ['experimental', 'planned', 'equivalent', 'excluded'].includes(row.native),
      'Unknown native status for ' + row.id,
    );
    const maturity =
      row.web === 'supported' ? 'candidate' : row.web === 'exported' ? 'experimental' : row.web;
    assert.equal(row.maturity, maturity, 'Unexpected maturity for ' + row.id);
    assert.deepEqual(
      row.platforms,
      { web: row.web, iOS: row.native, Android: row.native },
      'Platform status mismatch for ' + row.id,
    );
    if (row.web === 'supported') {
      assert.ok(
        row.api.length && row.story && row.test,
        'Missing supported family evidence: ' + row.id,
      );
      assert.ok(exists(row.story) && exists(row.test), 'Missing evidence file for ' + row.id);
    } else if (['equivalent', 'excluded', 'planned'].includes(row.web))
      assert.ok(row.note, 'Explain ' + row.id);
    for (const binding of [...row.api, ...(row.nativeApi ?? [])]) {
      assert.ok(!owners.has(binding), 'Duplicate binding ' + binding);
      owners.add(binding);
      assert.ok(actual.includes(binding), 'Unexpected mapping: ' + binding);
    }
    if (row.native === 'experimental')
      assert.ok(
        row.nativeApi?.length && exists(row.nativeStory) && exists(row.nativeTest),
        'Missing native evidence for ' + row.id,
      );
  }
  for (const key of actual)
    assert.ok(
      owners.has(key),
      'Unmapped public export ' + key + '; register its owner, contract and example.',
    );
}
export function summarize(rows) {
  const components = rows.filter((row) => row.layer !== 'infrastructure');
  const supported = (row) => row.web === 'supported';
  return {
    families: rows.length,
    webSupported: rows.filter(supported).length,
    componentFamilies: components.length,
    webSupportedComponents: components.filter(supported).length,
    infrastructure: rows.length - components.length,
    webBindings: rows.reduce((n, x) => n + x.api.length, 0),
    nativeExperimental: rows.filter((x) => x.native === 'experimental').length,
  };
}
export function publicContracts() {
  const entries = [];
  for (const pkg of ['web', 'native']) {
    const manifest = JSON.parse(readFileSync('packages/' + pkg + '/package.json', 'utf8'));
    for (const [name, exp] of Object.entries(manifest.exports))
      if (exp.types)
        entries.push([
          entryName(manifest.name, name),
          resolve('packages/' + pkg, exp.types),
        ]);
  }
  const program = ts.createProgram(
    entries.map(([, path]) => path),
    {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      skipLibCheck: true,
      strict: true,
    },
  );
  const checker = program.getTypeChecker();
  const result = new Map();
  for (const [name, path] of entries) {
    const file = program.getSourceFile(path);
    assert.ok(file, 'Build public declarations first: ' + path);
    const symbol = checker.getSymbolAtLocation(file);
    assert.ok(symbol, 'Missing declared module ' + path);
    for (const binding of checker.getExportsOfModule(symbol)) {
      const exported =
        binding.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(binding) : binding;
      if (!(exported.flags & ts.SymbolFlags.Value)) continue;
      const declaration = exported.valueDeclaration ?? exported.declarations[0],
        type = checker.getTypeOfSymbolAtLocation(exported, declaration);
      assert.equal(type.flags & ts.TypeFlags.Any, 0, 'Untyped public value ' + binding.name);
      const signature = type.getCallSignatures()[0];
      assert.ok(signature, 'Expected a callable component or helper for ' + binding.name);
      const first = signature.parameters[0],
        props = first ? checker.getTypeOfSymbolAtLocation(first, declaration).getProperties() : [];
      const keys = props.map((p) => p.name);
      const state = keys.filter((k) =>
        /^(?:value|defaultValue|isSelected|defaultSelected|selectedKey|selectedKeys|defaultSelectedKey|defaultSelectedKeys|activeId|selectedId|defaultSize|isOpen|defaultOpen|expandedKeys|defaultExpandedKeys|busy|disabled|isDisabled|selected)$/.test(
          k,
        ),
      );
      const events = keys.filter((k) => /^on[A-Z]/.test(k) && !k.endsWith('Capture'));
      const slots = keys.filter((k) =>
        /^(?:children|slot|header|footer|actions|action|illustration|navigation|list|detail|content|render[A-Z].*)$/.test(
          k,
        ),
      );
      result.set(name + ':' + binding.name, {
        declaration: relative(process.cwd(), path),
        ref: keys.includes('ref'),
        state: state.sort(),
        events: events.sort(),
        slots: slots.sort(),
      });
    }
  }
  return result;
}
export function publicBindings() {
  return [...publicContracts().keys()];
}
const fileCache = new Map();
function source(path) {
  if (!fileCache.has(path))
    fileCache.set(
      path,
      ts.createSourceFile(
        path,
        readFileSync(path, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      ),
    );
  return fileCache.get(path);
}
function identifiers(path, follow, seen = new Set()) {
  const ids = new Set();
  if (seen.has(path)) return ids;
  seen.add(path);
  const file = source(path);
  function walk(node) {
    if (ts.isImportDeclaration(node)) {
      const spec = node.moduleSpecifier.text;
      if (follow && spec.startsWith('.')) {
        const base = resolve(dirname(path), spec);
        const child = [base, base + '.tsx', base + '.ts'].find(
          (f) => existsSync(f) && /\.[jt]sx?$/.test(f),
        );
        if (child) for (const id of identifiers(child, true, seen)) ids.add(id);
      }
      return;
    }
    if (ts.isIdentifier(node)) ids.add(node.text);
    ts.forEachChild(node, walk);
  }
  walk(file);
  return ids;
}
export function hasFamilyEvidence(row, kind) {
  const native = kind === 'nativeStory' || kind === 'nativeTest';
  const path = row[kind];
  if (!path || !existsSync(path)) return false;
  const isTest = kind.endsWith('Test') || kind === 'test';
  const code = ts.createPrinter({ removeComments: true }).printFile(source(path));
  if (isTest && !/\b(?:it|test)\s*\(/.test(code)) return false;
  if (!isTest && !native && !/export const /.test(code)) return false;
  const anchor = !native && isTest && behaviorAnchors[row.id];
  if (anchor) return code.replaceAll(/\s+/g, ' ').includes(anchor);
  const ids = identifiers(path, !isTest);
  return (native ? row.nativeApi : row.api).some((binding) => ids.has(binding.split(':')[1]));
}
export function familyReport(rows, types) {
  auditInventory(rows, [...types.keys()]);
  return rows.map((row) => {
    if (row.web === 'supported')
      for (const kind of ['story', 'test'])
        assert.ok(
          hasFamilyEvidence(row, kind),
          'Family-specific ' + kind + ' evidence missing for ' + row.id,
        );
    if (row.native === 'experimental')
      for (const kind of ['nativeStory', 'nativeTest'])
        assert.ok(
          hasFamilyEvidence(row, kind),
          'Family-specific ' + kind + ' evidence missing for ' + row.id,
        );
    return {
      family: row.id,
      owner: row.owner,
      layer: row.layer,
      maturity: row.maturity,
      platforms: row.platforms,
      ownership: row.ownership,
      bindings: Object.fromEntries(
        [...row.api, ...(row.nativeApi ?? [])].map((binding) => [binding, types.get(binding)]),
      ),
      story: row.story,
      test: row.test,
      nativeStory: row.nativeStory,
      nativeTest: row.nativeTest,
      note: row.note,
    };
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = familyReport(families, publicContracts());
  if (process.argv[2])
    writeFileSync(process.argv[2], JSON.stringify({ revision, families: report }, null, 2) + '\n');
  console.log(JSON.stringify(summarize(families)));
}
