import ts from 'typescript';
import { nativeProvenance } from './native-provenance.mjs';
import { designProperty, inspectCss, literalIssue } from './css.mjs';

export function inspectScript(path, source, options, report) {
  const file = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  if (file.parseDiagnostics.length)
    throw new Error(ts.flattenDiagnosticMessageText(file.parseDiagnostics[0].messageText, '\n'));
  const definitions = new Map(),
    tokenNames = new Set(),
    sheets = new Set(),
    nativeNamespaces = new Set(),
    rawSources = new Set(),
    tokenNamespaces = new Set();
  function collect(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const named = node.importClause?.namedBindings;
      const library = node.moduleSpecifier.text;
      if (library === '@ui-lazy-dev/tokens/tokens.json') {
        if (node.importClause?.name) rawSources.add(node.importClause.name.text);
        if (named && ts.isNamespaceImport(named)) rawSources.add(named.name.text);
      }
      if (library === '@ui-lazy-dev/tokens' && named && ts.isNamespaceImport(named))
        tokenNamespaces.add(named.name.text);
      if (named && ts.isNamedImports(named))
        for (const spec of named.elements) {
          const name = (spec.propertyName ?? spec.name).text;
          if (library === '@ui-lazy-dev/tokens' && name === 'tokens')
            tokenNames.add(spec.name.text);
          if (library === 'react-native' && name === 'StyleSheet') sheets.add(spec.name.text);
        }
      if (library === 'react-native' && named && ts.isNamespaceImport(named))
        nativeNamespaces.add(named.name.text);
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const previous = definitions.has(node.name.text);
      definitions.set(node.name.text, previous ? null : node.initializer);
    }
    ts.forEachChild(node, collect);
  }
  collect(file);
  const native = path.startsWith('packages/native/src/') ? nativeProvenance(file, options.tokenPaths, options.nativeTokenPaths) : undefined;
  const initializer = node => native ? native.constant(node) : definitions.get(node.text);

  function unwrap(node) {
    while (
      ts.isAsExpression(node) ||
      ts.isSatisfiesExpression(node) ||
      ts.isParenthesizedExpression(node) ||
      ts.isNonNullExpression(node)
    )
      node = node.expression;
    return node;
  }
  const line = (node) => file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
  function owner(node) {
    for (let scope = node; scope; scope = scope.parent) {
      if (
        (ts.isFunctionDeclaration(scope) && scope.name) ||
        (ts.isVariableDeclaration(scope) &&
          (ts.isArrowFunction(scope.initializer ?? file) ||
            ts.isFunctionExpression(scope.initializer ?? file)))
      )
        return scope.name.getText(file);
    }
    return 'module';
  }
  function checkValue(key, expr, site, seen = new Set()) {
    // A component token belongs to its own family. Literal values reach literalIssue below.
    const foreign = options.componentTokens?.family(key);
    if (foreign && foreign !== options.componentTokens.owner && !ts.isStringLiteralLike(unwrap(expr)) && !ts.isNumericLiteral(unwrap(expr)))
      report('style/token', line(site), owner(site), key, expr.getText(file));
    if (!designProperty(key)) return;
    const value = unwrap(expr);
    if (native?.tokenLeaf(expr)) return;
    if (ts.isConditionalExpression(value)) {
      checkValue(key, value.whenTrue, site, seen);
      checkValue(key, value.whenFalse, site, seen);
      return;
    }
    if (ts.isStringLiteralLike(value) || ts.isNumericLiteral(value)) {
      if (literalIssue(key, value.text, options))
        report('style/token', line(site), owner(site), key, value.getText(file));
      return;
    }
    if (ts.isIdentifier(value) && initializer(value) && !seen.has(value.text)) {
      checkValue(key, initializer(value), site, new Set([...seen, value.text]));
      return;
    }
    let root = value;
    while (ts.isPropertyAccessExpression(root)) root = root.expression;
    if (ts.isIdentifier(root) && (native ? native.importedTokens(root) : tokenNames.has(root.text)) && root !== value) {
      const reference = value.getText(file).slice(root.getText(file).length + 1);
      if (options.tokenPaths && !options.tokenPaths.includes(reference))
        report('style/token', line(site), owner(site), key, value.getText(file));
      return;
    }
    report('style/runtime', line(site), owner(site), key, value.getText(file));
  }
  function inspectObject(expr, site, seen = new Set()) {
    const node = unwrap(expr);
    if (native?.absentStyle(node)) return;
    if (ts.isIdentifier(node) && initializer(node) && !seen.has(node.text)) {
      inspectObject(initializer(node), site, new Set([...seen, node.text]));
      return;
    }
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      !seen.has(node.expression.text)
    ) {
      const object = initializer(node.expression);
      const prop =
        object &&
        ts.isObjectLiteralExpression(object) &&
        object.properties.find(
          (item) => ts.isPropertyAssignment(item) && item.name.text === node.name.text,
        );
      if (prop) {
        inspectObject(prop.initializer, site, new Set([...seen, node.expression.text]));
        return;
      }
    }
    if (ts.isArrayLiteralExpression(node)) {
      node.elements.forEach((element) => inspectObject(element, site, seen));
      return;
    }
    if (ts.isConditionalExpression(node)) {
      inspectObject(node.whenTrue, site, seen);
      inspectObject(node.whenFalse, site, seen);
      return;
    }
    if (ts.isObjectLiteralExpression(node)) {
      for (const prop of node.properties) {
        if (ts.isSpreadAssignment(prop)) inspectObject(prop.expression, site, seen);
        else if (ts.isPropertyAssignment(prop)) {
          if (ts.isComputedPropertyName(prop.name))
            report(
              'style/runtime',
              line(site),
              owner(site),
              'computed property',
              prop.getText(file),
            );
          else checkValue(prop.name.text ?? prop.name.getText(file), prop.initializer, site);
        } else if (ts.isShorthandPropertyAssignment(prop))
          checkValue(prop.name.text, prop.name, site);
      }
      return;
    }
    if (native?.publicStyle(expr)) return;
    // An opaque style slot or theme-dependent computed object must be approved at its exact use.
    report('style/runtime', line(site), owner(site), 'style', node.getText(file));
  }
  function inspectEmbeddedStyle(node, site) {
    let value = unwrap(node);
    if (ts.isIdentifier(value) && definitions.get(value.text))
      value = unwrap(definitions.get(value.text));
    if (ts.isStringLiteralLike(value))
      inspectCss(value.text, options, report, line(value), owner(site));
    else report('style/runtime', line(site), owner(site), 'stylesheet', value.getText(file));
  }
  function isTokenSource(expr, seen = new Set()) {
    if (!expr) return false;
    const node = unwrap(expr);
    if (ts.isIdentifier(node)) {
      if (rawSources.has(node.text) || tokenNames.has(node.text)) return true;
      if (seen.has(node.text)) return false;
      seen.add(node.text);
      return isTokenSource(definitions.get(node.text), seen);
    }
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression))
      return tokenNamespaces.has(node.expression.text) && node.name.text === 'tokens';
    return ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require' &&
      node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0]) &&
      node.arguments[0].text === '@ui-lazy-dev/tokens/tokens.json';
  }
  function paletteAccess(node) {
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const key = ts.isPropertyAccessExpression(node) ? node.name :
        node.argumentExpression && ts.isStringLiteralLike(node.argumentExpression) ? node.argumentExpression : undefined;
      return key?.text === 'palette' && isTokenSource(node.expression);
    }
    if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent) &&
      ts.isVariableDeclaration(node.parent.parent))
      return (node.propertyName ?? node.name).getText(file).replace(/^['"]|['"]$/g, '') === 'palette' &&
        isTokenSource(node.parent.parent.initializer);
    if (ts.isImportSpecifier(node) && (node.propertyName ?? node.name).text === 'palette')
      return node.parent.parent.parent.moduleSpecifier.text === '@ui-lazy-dev/tokens/tokens.json';
    return false;
  }
  function visit(node) {
    if (options.component && paletteAccess(node))
      report('style/palette', line(node), owner(node), 'palette', node.getText(file));
    if (ts.isJsxAttribute(node) && node.initializer) {
      const key = node.name.getText(file);
      const expr = ts.isJsxExpression(node.initializer)
        ? node.initializer.expression
        : node.initializer;
      if (expr && key === 'style') inspectObject(expr, node);
      else if (
        expr &&
        [
          'fill',
          'stroke',
          'strokeWidth',
          'fontSize',
          'fontFamily',
          'stopColor',
          'floodColor',
        ].includes(key)
      )
        checkValue(key, expr, node);
    }
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(file) === 'style') {
      for (const child of node.children) {
        if (ts.isJsxExpression(child) && child.expression)
          inspectEmbeddedStyle(child.expression, child);
        else if (ts.isJsxText(child) && child.text.trim())
          inspectCss(child.text, options, report, line(child), owner(node));
      }
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const target = node.expression.expression.getText(file);
      const method = node.expression.name.text;
      if (
        method === 'create' &&
        (sheets.has(target) ||
          [...nativeNamespaces].some((namespace) => target === namespace + '.StyleSheet')) &&
        node.arguments[0]
      ) {
        const styles = unwrap(node.arguments[0]);
        if (ts.isObjectLiteralExpression(styles)) {
          styles.properties.forEach((p) => {
            if (ts.isPropertyAssignment(p)) inspectObject(p.initializer, p);
          });
        } else inspectObject(styles, node);
      }
      if (method === 'animate' && node.arguments[0]) {
        inspectObject(node.arguments[0], node);
        if (node.arguments[1]) {
          if (ts.isNumericLiteral(node.arguments[1]))
            checkValue('duration', node.arguments[1], node);
          else inspectObject(node.arguments[1], node);
        }
      }
      if (method === 'setProperty' && /\.style$/.test(target) && node.arguments.length >= 2) {
        const [property, value] = node.arguments;
        if (ts.isStringLiteralLike(property)) checkValue(property.text, value, node);
        else report('style/runtime', line(node), owner(node), 'setProperty', node.getText(file));
      }
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(node.left) &&
      /\.style$/.test(node.left.expression.getText(file))
    )
      checkValue(node.left.name.text, node.right, node);
    ts.forEachChild(node, visit);
  }
  visit(file);
}
