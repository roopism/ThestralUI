import assert from 'node:assert/strict';
import { readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import ts from 'typescript';
import { entryName, specifier } from '../binding-entry.mjs';

export function familyBindings(family) {
  return family.exports ?? [...(family.api ?? []), ...(family.nativeApi ?? [])];
}

export function specFilename(id) {
  return (
    id
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + '.md'
  );
}

// A symlinked dependency can make the checker print its absolute package entry instead
// of its public specifier. Collapse subpaths only when TypeScript resolves both to the same file.
export function portableType(text, importingFile) {
  return text.replace(/import\("([^"]+)"\)/g, (_, raw) => {
    const resolveType = (spec) =>
      ts.resolveModuleName(
        spec,
        importingFile,
        {
          moduleResolution: ts.ModuleResolutionKind.Bundler,
        },
        ts.sys,
      ).resolvedModule;
    let id = raw.replaceAll('\\', '/').replace(/^.*\/node_modules\//, '');
    if (id.startsWith('.')) {
      const peer = resolveType(raw)?.packageId;
      if (peer) {
        const path = peer.subModuleName.replace(/\.d\.([cm]?)ts$/, '.$1js');
        id = peer.name + '/' + path;
      }
    }
    const name = id
      .split('/')
      .slice(0, id.startsWith('@') ? 2 : 1)
      .join('/');
    if (id !== name && !id.startsWith('.')) {
      const entry = resolveType(name)?.resolvedFileName;
      if (entry && entry === resolveType(id)?.resolvedFileName) return 'import("' + name + '")';
    }
    return 'import("' + id + '")';
  });
}

// Attributes that every element of a platform accepts are declared by the platform's
// own type packages. They are part of the type, but they are not this library's contract.
const hostSource =
  /\/node_modules\/(?:@types\/react(?:-dom)?|typescript\/lib|react-native|@react-native\/[^/]+)\//;
// React Aria mirrors the global DOM events and attributes in these two interfaces.
const mirroredSource = /\/node_modules\/@react-types\/shared\//;
const mirroredHost = new Set(['GlobalDOMEvents', 'GlobalDOMAttributes']);
const alwaysDocumented = new Set(['ref', 'children', 'className', 'style']);

export function hostAttribute(name, prop) {
  const sources = prop?.declarations ?? [];
  if (!sources.length || alwaysDocumented.has(name)) return false;
  return sources.every((node) => {
    const file = node.getSourceFile().fileName.replaceAll('\\', '/');
    return (
      hostSource.test(file) ||
      (mirroredSource.test(file) && mirroredHost.has(node.parent?.name?.text))
    );
  });
}

function refTarget(checker, value, declaration) {
  const type = checker.getNonNullableType(value);
  for (const part of type.isUnion() ? type.types : [type]) {
    const current = part.getProperty('current') ?? part.getCallSignatures()[0]?.parameters[0];
    if (current)
      return checker.getNonNullableType(checker.getTypeOfSymbolAtLocation(current, declaration));
  }
}

// Start at the type entry points in the installed tarballs. The type checker resolves
// aliases, inherited host attributes, intersections and discriminated unions.
export function readDeclaredApi(consumer, families, details = new Map(), { scoped = false, universe = families } = {}) {
  const expected = families.flatMap(familyBindings);
  const requested = new Set(expected);
  const known = new Set(universe.flatMap(familyBindings));
  const packages = new Set([...known].map((key) => specifier(key).split('/').slice(0, 2).join('/')));
  const entries = [];
  for (const pkg of packages) {
    const dir = join(realpathSync(consumer), 'node_modules', pkg);
    assert.equal(realpathSync(dir), dir, 'Expected installed archive for ' + pkg);
    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    assert.equal(manifest.name, pkg);
    for (const [subpath, condition] of Object.entries(manifest.exports)) {
      if (!condition.types) continue;
      const file = realpathSync(resolve(dir, condition.types));
      const local = relative(dir, file);
      assert.ok(
        !local.startsWith('..') && !isAbsolute(local),
        'Declaration outside installed package',
      );
      entries.push([entryName(pkg, subpath), file]);
    }
  }
  const program = ts.createProgram(
    entries.map(([, file]) => file),
    {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.ReactJSX,
      strict: true,
      skipLibCheck: true,
      types: [],
    },
  );
  const checker = program.getTypeChecker();
  const surfaces = new Map();
  for (const [prefix, file] of entries) {
    const module = checker.getSymbolAtLocation(program.getSourceFile(file));
    assert.ok(module, 'Missing packed module ' + file);
    for (const binding of checker.getExportsOfModule(module)) {
      const symbol =
        binding.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(binding) : binding;
      if (!(symbol.flags & ts.SymbolFlags.Value)) continue;
      const key = prefix + ':' + binding.name;
      // TypeScript prints literal unions in the order their members are first resolved.
      // Read the published bindings in the same order for full and scoped tables.
      if (scoped && !known.has(key)) continue;
      const selected = !scoped || requested.has(key);
      const declaration = symbol.valueDeclaration ?? symbol.declarations[0];
      const type = checker.getTypeOfSymbolAtLocation(symbol, declaration);
      const signatures = type.getCallSignatures();
      if (selected) assert.ok(signatures.length, 'Unrecognized public value ' + key);
      const fields = new Map();
      const metadata = new Map();
      let shapes = 0;
      if (selected) details.set(key, metadata);
      const print = (value) =>
        portableType(
          checker.typeToString(value, declaration, ts.TypeFormatFlags.NoTruncation),
          declaration.getSourceFile().fileName,
        );
      const remember = (name, value, prop) => {
        if (!fields.has(name)) fields.set(name, new Set());
        fields.get(name).add(print(value));
        const record = metadata.get(name) ?? {
          defaults: new Set(),
          refs: new Set(),
          optional: false,
          occurrences: 0,
          host: true,
        };
        // One library-owned declaration in any shape makes the property part of the contract.
        record.host &&= hostAttribute(name, prop);
        for (const tag of prop?.getJsDocTags(checker) ?? []) {
          if (tag.name === 'default' || tag.name === 'defaultValue') {
            const text = ts.displayPartsToString(tag.text).trim();
            if (text) record.defaults.add(text);
          }
        }
        record.occurrences++;
        record.optional ||=
          !prop ||
          Boolean(prop?.flags & ts.SymbolFlags.Optional) ||
          Boolean(prop?.valueDeclaration?.questionToken || prop?.valueDeclaration?.initializer);
        if (/^(?:ref|.*Ref)$/.test(name)) {
          const target = refTarget(checker, value, declaration);
          if (target) record.refs.add(print(target));
        }
        metadata.set(name, record);
      };
      for (const sig of signatures) {
        if (/^[a-z]/.test(binding.name)) {
          shapes++;
          for (const param of sig.parameters)
            remember(param.name, checker.getTypeOfSymbolAtLocation(param, declaration), param);
          continue;
        }
        const first = sig.parameters[0];
        if (!first) {
          shapes++;
          continue;
        }
        const props = checker.getNonNullableType(
          checker.getTypeOfSymbolAtLocation(first, declaration),
        );
        if (selected) assert.ok(!(props.flags & ts.TypeFlags.Any), 'Unresolved props for ' + key);
        for (const variant of props.isUnion() ? props.types : [props]) {
          shapes++;
          for (const prop of checker.getPropertiesOfType(variant)) {
            remember(prop.name, checker.getTypeOfSymbolAtLocation(prop, declaration), prop);
          }
          for (const index of checker.getIndexInfosOfType(variant)) {
            remember('[' + checker.typeToString(index.keyType, declaration) + ']', index.type);
          }
        }
      }
      if (!selected) continue;
      for (const record of metadata.values()) record.conditional = record.occurrences < shapes;
      assert.ok(!surfaces.has(key), 'Duplicate published binding ' + key);
      surfaces.set(
        key,
        new Map(
          [...fields]
            .sort(([a], [b]) => a.localeCompare(b, 'en'))
            .map(([name, types]) => [name, [...types].join(' | ')]),
        ),
      );
    }
  }
  assert.deepEqual(
    [...surfaces.keys()].sort(),
    [...expected].sort(),
    'Inventory differs from packed exports',
  );
  return surfaces;
}
