import ts from 'typescript';
import { inspectRendering } from './rendering.mjs';
import { dirname, resolve } from 'node:path';
const foundationFamilies = new Set([
  '_shared/primitives', 'adaptive-grid', 'badge', 'box', 'button', 'button-group', 'icon',
  'icon-button', 'inline', 'labeled-field', 'live-status-and-inline-alert', 'modal-dialog',
  'progress', 'scroll-area', 'separator', 'skeleton', 'spinner', 'stack', 'surface', 'text',
]);

function layer(path) {
  if (path.startsWith('packages/tokens/') || path === 'packages/web/src/safe-url.ts' || path.startsWith('packages/web/src/_shared/safe-url/')) return 0;
  if (
    /^packages\/(web|native)\/src\/(index|dialog|form-field|forms|navigation|primitives)\.[jt]sx?$/.test(
      path,
    )
  )
    return 1;
  // A foundation's local modules share its layer. Their own imports and cycles
  // are still checked, including imports reached through another foundation.
  const leaf = /^packages\/(web|native)\/src\/(.+)\/([^/]+)\.[jt]sx?$/.exec(path);
  if (leaf && (leaf[3] === 'aria-binding' || foundationFamilies.has(leaf[2]))) return 1;
  if (path.startsWith('packages/web/src/') || path.startsWith('packages/native/src/')) return 2;
  return 3;
}
export function inspectArchitecture(ctx) {
  const { files, program, config, rel, emit, options } = ctx;
  const graph = new Map();
  const registered = ctx.registeredEntries;
  for (const path of files) {
    const source = program.getSourceFile(path),
      file = rel(path),
      edges = [];
    graph.set(file, edges);
    const native = file.startsWith('packages/native/'),
      web = file.startsWith('packages/web/'),
      library = /^packages\/(web|native|tokens)\//.test(file);
    const prod = !/^(catalog|tests?)\//.test(file);
    function checkSymbol(symbol, source) {
      const n = symbol.propertyName?.text ?? symbol.name.text;
      const marked =
        source === 'react-native'
          ? {
              Pressable: 'button',
              TextInput: 'input',
              TouchableOpacity: 'button',
              Modal: 'dialog',
            }[n]
          : undefined;
      if (prod && marked)
        emit(
          file,
          symbol,
          '(exports)',
          'primitive-reexport',
          marked,
          n,
          'Re-export the shared native component instead of exposing a raw host interaction.',
        );
    }
    function check(node, spec, typeOnly) {
      const resolved = ts.resolveModuleName(spec, path, options, ts.sys).resolvedModule;
      const local =
        resolved && !resolved.isExternalLibraryImport ? rel(resolved.resolvedFileName) : undefined;
      const physical = local ?? (spec.startsWith('.') ? rel(resolve(dirname(path), spec)) : spec);
      const fail = (rule, fix) => emit(file, node, '(imports)', rule, 'module', spec, fix);
      if (
        prod &&
        /(^|\/)(catalog|tests?|__tests__|__fixtures__|test-utils|\.storybook)(\/|$)|\.stories\.[jt]sx?$/.test(
          physical,
        )
      )
        fail(
          'test-import',
          'Move the dependency to production source and import the public contract.',
        );
      const scope = spec.match(/^(@ui-lazy-dev\/[^/]+)(.*)$/);
      if (scope) {
        const publicEntries = config.publicEntries[scope[1]] ?? [];
        const subpath = scope[2] || '/';
        if (!publicEntries.includes(subpath) && !registered.has(spec))
          fail('private-import', 'Import an explicitly exported package entry point.');
      }
      if (
        local &&
        /^packages\/[^/]+\//.test(local) &&
        !file.startsWith(local.split('/').slice(0, 2).join('/') + '/') &&
        spec.startsWith('.')
      )
        fail(
          'private-import',
          'Use the workspace public package entry instead of a private relative path.',
        );
      const nativeModule =
        spec.startsWith('@react-native/') ||
        /^(react-native|@ui-lazy-dev\/ui-native)(\/|$)/.test(spec) ||
        physical.startsWith('packages/native/');
      const webModule =
        /^(react-dom|react-aria-components|@ui-lazy-dev\/ui-web|next)(\/|$)/.test(spec) ||
        physical.startsWith('packages/web/');
      if (
        (web && nativeModule) ||
        (native && webModule) ||
        (config.mode === 'consumer' && nativeModule)
      )
        fail('platform', 'Use dependencies from the current renderer or the shared token package.');
      if (
        library &&
        (/^(next(\/|$)|@supabase\/|@\/|@elevate\/)/.test(spec) ||
          /^(src\/)?(server|app|infrastructure|application)\//.test(physical))
      )
        fail(
          'product-import',
          'Move product routing, authorization and data access to the consuming application.',
        );
      if (
        library &&
        prod &&
        ((local && layer(file) < layer(local)) ||
          (registered.has(spec) && layer(file) < (foundationFamilies.has(registered.get(spec)) ? 1 : 2)) ||
          (layer(file) === 0 && /^@ui-lazy-dev\/ui-/.test(spec)) ||
          (layer(file) < 2 &&
            /^@ui-lazy-dev\/ui-web\/(workflows|collections|motion|patterns)/.test(spec)))
      )
        fail(
          'layer',
          'Move the shared dependency into the lower layer or inject it through a prop.',
        );
      if (!typeOnly && local && files.has(ctx.abs(local))) edges.push({ file: local, node });
    }
    function visit(n) {
      if (
        (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) &&
        n.moduleSpecifier &&
        ts.isStringLiteralLike(n.moduleSpecifier)
      ) {
        const only = ts.isImportDeclaration(n)
          ? n.importClause?.isTypeOnly ||
            (!n.importClause?.name &&
              n.importClause?.namedBindings &&
              ts.isNamedImports(n.importClause.namedBindings) &&
              n.importClause.namedBindings.elements.length > 0 &&
              n.importClause.namedBindings.elements.every((e) => e.isTypeOnly))
          : n.isTypeOnly ||
            (n.exportClause &&
              ts.isNamedExports(n.exportClause) &&
              n.exportClause.elements.length > 0 &&
              n.exportClause.elements.every((e) => e.isTypeOnly));
        check(n.moduleSpecifier, n.moduleSpecifier.text, only);
        if (
          !only &&
          ts.isExportDeclaration(n) &&
          n.exportClause &&
          ts.isNamedExports(n.exportClause)
        )
          for (const sym of n.exportClause.elements) checkSymbol(sym, n.moduleSpecifier.text);
      }
      if (
        ts.isCallExpression(n) &&
        (n.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(n.expression) && n.expression.text === 'require')) &&
        n.arguments[0] &&
        ts.isStringLiteralLike(n.arguments[0])
      )
        check(n.arguments[0], n.arguments[0].text, false);
      if (
        library &&
        ts.isCallExpression(n) &&
        ((ts.isIdentifier(n.expression) &&
          ['fetch', 'XMLHttpRequest', 'WebSocket'].includes(n.expression.text)) ||
          (ts.isPropertyAccessExpression(n.expression) &&
            ['window', 'globalThis'].includes(n.expression.expression.getText()) &&
            n.expression.name.text === 'fetch'))
      )
        emit(
          file,
          n,
          '(request)',
          'product-import',
          'network',
          n.expression.getText(),
          'Pass data or an application-owned callback into the library.',
        );
      ts.forEachChild(n, visit);
    }
    visit(source);
  }
  inspectRendering(ctx, graph);
  const visited = new Set(),
    stack = new Set();
  function walk(file) {
    if (visited.has(file)) return;
    visited.add(file);
    stack.add(file);
    for (const edge of graph.get(file) ?? []) {
      if (stack.has(edge.file))
        emit(
          file,
          edge.node,
          '(imports)',
          'cycle',
          'module',
          edge.file,
          'Break the runtime import cycle. Extract a lower-level contract or use an explicit type-only import.',
        );
      else walk(edge.file);
    }
    stack.delete(file);
  }
  for (const file of graph.keys()) walk(file);
}
