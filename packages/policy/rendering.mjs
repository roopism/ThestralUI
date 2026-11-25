import ts from 'typescript';

const browserGlobals = new Set([
  'window', 'document', 'navigator', 'localStorage', 'sessionStorage',
  'requestAnimationFrame', 'cancelAnimationFrame', 'ResizeObserver', 'IntersectionObserver',
]);

function directive(source) {
  for (const statement of source.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) break;
    if (statement.expression.text === 'use client') return statement.expression;
  }
}

function runtimeImport(node) {
  if (ts.isImportDeclaration(node)) {
    const clause = node.importClause;
    if (!clause) return true;
    if (clause.isTypeOnly) return false;
    if (clause.name || !clause.namedBindings || ts.isNamespaceImport(clause.namedBindings)) return true;
    return clause.namedBindings.elements.some(item => !item.isTypeOnly);
  }
  return !node.isTypeOnly && (!node.exportClause || !ts.isNamedExports(node.exportClause) ||
    node.exportClause.elements.some(item => !item.isTypeOnly));
}

const serverHooks = new Set(['useId', 'useMemo', 'useCallback', 'useDebugValue']);

function importedFromReact(node) {
  const declaration = ts.findAncestor(node, ts.isImportDeclaration);
  return declaration?.moduleSpecifier.text === 'react';
}

function calledBinding(expression, checker, visited = new Set()) {
  if (ts.isPropertyAccessExpression(expression)) {
    const owner = checker.getSymbolAtLocation(expression.expression);
    return { name: expression.name.text, react: owner?.declarations?.some(importedFromReact) };
  }
  if (!ts.isIdentifier(expression)) return {};
  const symbol = checker.getSymbolAtLocation(expression);
  const declaration = symbol?.declarations?.[0];
  if (declaration && !visited.has(declaration)) {
    visited.add(declaration);
    if (ts.isImportSpecifier(declaration))
      return { name: (declaration.propertyName ?? declaration.name).text, react: importedFromReact(declaration) };
    if (ts.isVariableDeclaration(declaration) && declaration.initializer)
      return calledBinding(declaration.initializer, checker, visited);
    if (ts.isBindingElement(declaration) && ts.isVariableDeclaration(declaration.parent.parent)) {
      const initializer = declaration.parent.parent.initializer;
      const owner = initializer && checker.getSymbolAtLocation(initializer);
      return { name: (declaration.propertyName ?? declaration.name).getText(), react: owner?.declarations?.some(importedFromReact) };
    }
  }
  return { name: expression.text };
}

function needsClient(source, checker) {
  function inspect(node) {
    if (ts.isTypeNode(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) return false;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (!node.moduleSpecifier || !runtimeImport(node)) return false;
      const target = node.moduleSpecifier.text;
      return !target.startsWith('.') && target !== 'react' && !/^@ui-lazy-dev\/tokens(?:\/|$)/.test(target);
    }
    if (ts.isJsxAttribute(node) && /^on[A-Z]/.test(node.name.getText(source))) return true;
    if (ts.isIdentifier(node) && browserGlobals.has(node.text)) {
      const symbol = checker.getSymbolAtLocation(node);
      if (!symbol || symbol.declarations?.some(d => d.getSourceFile().fileName.endsWith('/lib.dom.d.ts'))) return true;
    }
    if (ts.isCallExpression(node)) {
      const { name, react } = calledBinding(node.expression, checker);
      if (name === 'createContext' || /^on[A-Z]/.test(name) ||
          (/^use[A-Z]/.test(name) && !(react && serverHooks.has(name)))) return true;
    }
    return Boolean(ts.forEachChild(node, inspectChild));
  }
  function inspectChild(node) {
    return inspect(node) || undefined;
  }
  return inspect(source);
}

export function inspectRendering(ctx, graph) {
  if (ctx.config.mode !== 'library') return;
  const modules = new Map();
  const client = new Set();
  for (const path of ctx.files) {
    const file = ctx.rel(path);
    if (!file.startsWith('packages/web/src/')) continue;
    const source = ctx.program.getSourceFile(path);
    modules.set(file, source);
    if (needsClient(source, ctx.checker)) client.add(file);
  }
  let before;
  do {
    before = client.size;
    for (const file of modules.keys())
      if (graph.get(file)?.some(edge => client.has(edge.file))) client.add(file);
  } while (client.size !== before);

  for (const [file, source] of modules) {
    const boundary = directive(source);
    if (!boundary) continue;
    const forwarded = (graph.get(file) ?? []).some(edge =>
      ts.isExportDeclaration(edge.node.parent) && modules.has(edge.file) && !client.has(edge.file));
    if (!client.has(file) || forwarded)
      ctx.emit(file, boundary, '(exports)', 'use-client', 'rendering', 'use client',
        'Keep static exports server-renderable. Place the client directive on the interactive binding.');
  }
}
