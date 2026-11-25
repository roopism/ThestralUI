import { entryName, specifier } from '../binding-entry.mjs';
export { specifier } from '../binding-entry.mjs';
import assert from 'node:assert/strict';
import { readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative, resolve, sep } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

function names(rows, key) {
  const values = rows.map(key);
  assert.equal(new Set(values).size, values.length, 'Duplicate inventory item');
  return values;
}
function same(expected, actual, label) {
  let issue = [
    ...expected.filter((x) => !actual.includes(x)).map((x) => 'missing ' + x),
    ...actual.filter((x) => !expected.includes(x)).map((x) => 'unexpected ' + x),
  ];
  assert.equal(issue.length, 0, label + ' — ' + issue.join(', '));
}
function ids(families) {
  return names(
    families.flatMap((f) => f.exports),
    (x) => x,
  );
}
export function verifyFamilies(reviewed, observed) {
  same(
    names(reviewed, (f) => f.id),
    names(observed, (f) => f.id),
    'Family contracts',
  );
  ids(reviewed);
  ids(observed);
  for (const row of reviewed) {
    assert.ok(
      row.exports.length && (row.oracle || row.next)?.trim(),
      'Missing obligation for ' + row.id,
    );
    same(row.exports, observed.find((f) => f.id === row.id).exports, row.id);
  }
}
export function verifyTypes(consumer, families, cases, { scoped = false } = {}) {
  const root = resolve(consumer);
  const require = createRequire(join(root, 'package.json'));
  const ts = require('typescript');
  const expected = ids(families);
  for (const key of Object.keys(cases))
    assert.ok(expected.includes(key), 'Unknown type case ' + key);
  for (const family of families) {
    for (const binding of family.exports) {
      const rule = cases[binding];
      assert.ok(
        rule?.accept?.length && rule?.reject?.length,
        'Missing reviewed positive/negative consumers for ' + binding,
      );
    }
  }
  const files = new Map(),
    entries = new Map(),
    specifiers = new Set();
  for (const pkg of new Set(
    expected.map((key) => specifier(key).split('/').slice(0, 2).join('/')),
  )) {
    const dir = join(root, 'node_modules', pkg);
    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    assert.equal(manifest.name, pkg, 'Wrong installed package');
    for (const [entry, exp] of Object.entries(manifest.exports)) {
      if (typeof exp === 'string' && /\.(css|json)$/.test(entry)) continue;
      assert.equal(
        typeof exp?.types,
        'string',
        'Public declarations required for ' + pkg + ' ' + entry,
      );
      const source = entry === '.' ? pkg : pkg + '/' + entry.slice(2);
      entries.set(source, { prefix: entryName(pkg, entry), dir: realpathSync(dir) });
      specifiers.add(source);
    }
  }
  const imports = [...specifiers].map(
    (s, i) => 'import * as M' + i + ' from ' + JSON.stringify(s) + ';',
  );
  const index = join(root, '__depth_index.ts');
  files.set(index, imports.join('\n'));
  for (const binding of expected) {
    const name = binding.split(':')[1],
      source = specifier(binding),
      rule = cases[binding];
    const lines = [
      'import { ' + name + ' as Subject } from ' + JSON.stringify(source) + ';',
      'type Assert<T extends true>=T;',
      'type IsAny<T>=0 extends (1 & T)?true:false;',
      'type Args=Parameters<typeof Subject>;',
      'type FirstArgument<T extends readonly unknown[]> = T[0];',
      'type Props=NonNullable<FirstArgument<Args>>;',
      'type TypedSubject=Assert<IsAny<typeof Subject> extends false?true:false>;',
      'type TypedArgs=Assert<IsAny<Props> extends false?true:false>;',
      'type TypedResult=Assert<IsAny<ReturnType<typeof Subject>> extends false?true:false>;',
    ];
    if (rule) {
      if (rule.prelude) lines.push(...rule.prelude);
      const probe = (example) =>
        rule.mode === 'call'
          ? 'Subject(' + example + ');'
          : '(' + example + ') satisfies Partial<Props>;';
      for (const example of rule.accept) lines.push(probe(example));
      for (const example of rule.reject)
        lines.push('// @ts-expect-error rejected consumer input', probe(example));
      for (const jsx of rule.jsx || []) lines.push(jsx + ';');
      for (const jsx of rule.rejectJsx || [])
        lines.push('// @ts-expect-error required component props', jsx + ';');
    }
    files.set(
      join(root, '__depth_' + binding.replace(':', '_').replace('.', 'web') + '.tsx'),
      lines.join('\n'),
    );
  }
  const options = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    types: [],
    noUncheckedIndexedAccess: true,
  };
  const host = ts.createCompilerHost(options);
  const { fileExists, readFile, getSourceFile } = host;
  host.fileExists = (path) => files.has(path) || fileExists(path);
  host.readFile = (path) => files.get(path) ?? readFile(path);
  host.getSourceFile = (path, lang, ...rest) =>
    files.has(path)
      ? ts.createSourceFile(
          path,
          files.get(path),
          lang,
          true,
          path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
        )
      : getSourceFile(path, lang, ...rest);
  const program = ts.createProgram([...files.keys()], options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length)
    throw Error(
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCurrentDirectory: () => root,
        getCanonicalFileName: (p) => p,
        getNewLine: () => '\n',
      }),
    );
  const checker = program.getTypeChecker(),
    actual = [];
  for (const decl of program.getSourceFile(index).statements) {
    const source = decl.moduleSpecifier.text,
      entry = entries.get(source);
    const module = checker.getSymbolAtLocation(decl.moduleSpecifier);
    assert.ok(module, 'Unresolved declaration for ' + source);
    const location = realpathSync(module.valueDeclaration.fileName);
    const path = relative(entry.dir, location);
    assert.ok(
      path && path !== '..' && !path.startsWith('..' + sep) && /\.d\.[cm]?ts$/.test(path),
      'Expected installed declarations for ' + source,
    );
    for (const symbol of checker.getExportsOfModule(module)) {
      const owner = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
      if (owner.flags & ts.SymbolFlags.Value) actual.push(entry.prefix + ':' + symbol.name);
    }
  }
  const owned = scoped ? actual.filter(key => expected.includes(key)) : actual;
  same(expected, owned, 'Public value ownership');
  return {
    families: families.length,
    bindings: owned.length,
    reviewedConsumers: Object.keys(cases).length,
  };
}

export class ObservationMismatch extends Error {}
export function compare(actual, expected, label) {
  assert.ok(typeof label === 'string' && label.trim(), 'Every observation needs a description');
  if (!isDeepStrictEqual(actual, expected)) throw new ObservationMismatch(label);
}
export async function verifyRuntime(families, probes, resolvePublic) {
  const expected = ids(families);
  same(expected, Object.keys(probes), 'Export-specific runtime verification');
  const records = [];
  for (const key of expected) {
    const actual = await resolvePublic(key);
    assert.ok(actual != null, 'Unavailable runtime value ' + key);
    const probe = probes[key];
    assert.equal(typeof probe, 'function', 'Missing runtime probe ' + key);
    // React renders this mutation as an empty component. Helpers return an empty result.
    const absent = () => null;
    try {
      await probe(actual);
    } catch (error) {
      throw Error('Runtime contract failed for ' + key + ': ' + error.message, { cause: error });
    }
    let detected = false;
    try {
      await probe(absent);
    } catch (error) {
      if (!(error instanceof ObservationMismatch))
        throw Error('Unverified mutation for ' + key + ': ' + error.message, { cause: error });
      detected = true;
    }
    assert.ok(detected, 'Probe for ' + key + ' failed to distinguish its own missing export');
    records.push(key);
  }
  return records;
}
