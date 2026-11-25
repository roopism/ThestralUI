import ts from 'typescript';

// Resolve local symbols without loading a dependency or executing the inspected file.
export function nativeProvenance(file, tokenPaths) {
  const compiler = { noLib: true, noResolve: true, types: [], jsx: ts.JsxEmit.Preserve };
  const host = ts.createCompilerHost(compiler);
  host.getSourceFile = name => name === file.fileName ? file : undefined;
  const checker = ts.createProgram([file.fileName], compiler, host).getTypeChecker();
  function declaration(node) {
    const symbol = ts.isShorthandPropertyAssignment(node.parent)
      ? checker.getShorthandAssignmentValueSymbol(node.parent)
      : checker.getSymbolAtLocation(node);
    return symbol?.declarations?.[0];
  }
  const known = new Set(tokenPaths ?? []);
  const modified = new Set();
  function markWrite(node) {
    if (!node) return;
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node) ||
        ts.isAsExpression(node) || ts.isParenthesizedExpression(node) || ts.isNonNullExpression(node))
      return markWrite(node.expression);
    if (!ts.isIdentifier(node)) return;
    const decl = declaration(node);
    if (!decl || modified.has(decl)) return;
    modified.add(decl);
    if (ts.isVariableDeclaration(decl)) markWrite(decl.initializer);
    if (ts.isBindingElement(decl)) {
      const owner = decl.parent.parent;
      if (ts.isVariableDeclaration(owner)) markWrite(owner.initializer);
      else if (ts.isParameter(owner)) modified.add(owner);
    }
  }
  function inspectWrites(node) {
    if (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) markWrite(node.left);
    if (ts.isDeleteExpression(node) || ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
        [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator))) {
      markWrite(node.expression ?? node.operand);
    }
    if (ts.isCallExpression(node) && ['Object.assign','Object.defineProperty','Object.defineProperties','Reflect.set','Reflect.deleteProperty'].includes(node.expression.getText(file)) &&
        node.arguments.length) markWrite(node.arguments[0]);
    ts.forEachChild(node, inspectWrites);
  }
  function imported(node, library, name) {
    if (!node || !ts.isIdentifier(node)) return false;
    const decl = declaration(node);
    return Boolean(decl && ts.isImportSpecifier(decl) && (decl.propertyName ?? decl.name).text === name &&
      decl.parent.parent.parent.moduleSpecifier.text === library && !modified.has(decl));
  }
  const exported = node => node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword);
  function parameter(node) {
    if (ts.isParameter(node) && ts.isFunctionDeclaration(node.parent) && exported(node.parent) && !modified.has(node)) return node;
  }
  function publicField(param, name) {
    if (!param?.type || !ts.isTypeReferenceNode(param.type)) return;
    const model = declaration(param.type.typeName);
    if (!model || !ts.isInterfaceDeclaration(model) || !exported(model)) return;
    return model.members.find(member => ts.isPropertySignature(member) && member.name.getText(file) === name)?.type;
  }
  function binding(node) {
    if (modified.has(node)) return;
    if (!ts.isBindingElement(node) || node.dotDotDotToken || node.initializer || !ts.isObjectBindingPattern(node.parent)) return;
    const owner = node.parent.parent;
    const input = parameter(owner) || (ts.isVariableDeclaration(owner) && (owner.parent.flags & ts.NodeFlags.Const) &&
      owner.initializer && ts.isIdentifier(owner.initializer) && parameter(declaration(owner.initializer) ?? file));
    if (input) return publicField(input, (node.propertyName ?? node.name).getText(file));
  }
  function field(node) {
    if (ts.isIdentifier(node)) { const decl = declaration(node); if (decl) return binding(decl); }
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
      const decl = declaration(node.expression);
      if (decl) return publicField(parameter(decl), node.name.text);
    }
  }
  function rnStyle(type) {
    const arg = type?.typeArguments?.[0];
    return Boolean(type && ts.isTypeReferenceNode(type) && imported(type.typeName,'react-native','StyleProp') &&
      type.typeArguments?.length === 1 && arg && ts.isTypeReferenceNode(arg) &&
      (imported(arg.typeName,'react-native','TextStyle') || imported(arg.typeName,'react-native','ViewStyle')));
  }
  function builtin(type, name) {
    return Boolean(type && ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName) &&
      type.typeName.text === name && !declaration(type.typeName));
  }
  function publicStyle(node) {
    if (rnStyle(field(node))) return true;
    if (!ts.isPropertyAccessExpression(node) && !ts.isElementAccessExpression(node)) return false;
    const partial = field(node.expression), map = partial?.typeArguments?.[0];
    if (!builtin(partial,'Partial') || !builtin(map,'Record') || !rnStyle(map.typeArguments?.[1])) return false;
    const key = map.typeArguments?.[0];
    if (!key || !ts.isTypeReferenceNode(key)) return false;
    const set = declaration(key.typeName);
    if (!set || !ts.isTypeAliasDeclaration(set) || !ts.isUnionTypeNode(set.type) ||
        !set.type.types.every(t => ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal))) return false;
    if (ts.isPropertyAccessExpression(node)) return set.type.types.some(t => t.literal.text === node.name.text);
    const value = node.argumentExpression;
    const arg = value && ts.isIdentifier(value) && declaration(value);
    return Boolean(arg && ts.isParameter(arg) && !modified.has(arg) && arg.type && ts.isTypeReferenceNode(arg.type) &&
      declaration(arg.type.typeName) === set);
  }
  // A writable object passed to an opaque function can be mutated even if the
  // assignment is outside this source. Capture the precise public field or
  // token branch, including aliases and nested argument objects.
  function escape(node, seen = new Set()) {
    if (!node || seen.has(node)) return;
    seen.add(node);
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) ||
        ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node) || ts.isSpreadElement(node)) {
      return escape(node.expression, seen);
    }
    if (ts.isObjectLiteralExpression(node)) {
      for (const prop of node.properties) {
        if (ts.isShorthandPropertyAssignment(prop)) escape(prop.name, seen);
        else if (ts.isPropertyAssignment(prop)) escape(prop.initializer, seen);
        else if (ts.isSpreadAssignment(prop)) escape(prop.expression, seen);
      }
      return;
    }
    if (ts.isArrayLiteralExpression(node)) {
      for (const element of node.elements) escape(element, seen);
      return;
    }
    if (ts.isConditionalExpression(node)) {
      escape(node.whenTrue, seen);
      escape(node.whenFalse, seen);
      return;
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
      escape(node.left, seen);
      escape(node.right, seen);
      return;
    }
    const t = field(node);
    const map = t?.typeArguments?.[0];
    if (rnStyle(t) || (builtin(t, 'Partial') && builtin(map, 'Record') && rnStyle(map.typeArguments?.[1])) ||
        (t && ts.isTypeReferenceNode(t) && imported(t.typeName, '@ui-lazy-dev/tokens/modes', 'ResolvedTokens'))) {
      return markWrite(node);
    }
    if (ts.isIdentifier(node)) {
      const d = declaration(node);
      if (!d) return;
      if (parameter(d) || imported(node, '@ui-lazy-dev/tokens', 'tokens')) return markWrite(node);
      if (ts.isVariableDeclaration(d)) escape(d.initializer, seen);
      return;
    }
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      // Property access on the whole parameter may just read an unrelated scalar.
      // React Native style props and ResolvedTokens were handled above.
      const base = node.expression;
      if (ts.isIdentifier(base) && parameter(declaration(base) ?? file)) return;
      if (tokenLeaf(node)) return; // A known token leaf is a scalar.
      escape(base, seen);
    }
  }
  function inspectEscapes(node) {
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      for (const arg of node.arguments ?? []) escape(arg);
      if (ts.isPropertyAccessExpression(node.expression)) escape(node.expression.expression);
    }
    ts.forEachChild(node, inspectEscapes);
  }
  function tokenLeaf(node, keys = [], seen = new Set()) {
    if (ts.isParenthesizedExpression(node)) return tokenLeaf(node.expression,keys,seen);
    const type = field(node);
    if (type && ts.isTypeReferenceNode(type) && imported(type.typeName,'@ui-lazy-dev/tokens/modes','ResolvedTokens')) {
      if (keys[0] === 'color') return keys.length === 2 && known.has('light.' + keys[1]) && known.has('dark.' + keys[1]);
      return keys.length === 2 && !['palette','dark','light'].includes(keys[0]) && known.has(keys.join('.'));
    }
    if (ts.isPropertyAccessExpression(node)) return tokenLeaf(node.expression,[node.name.text,...keys],seen);
    if (ts.isConditionalExpression(node)) return tokenLeaf(node.whenTrue,keys,seen) && tokenLeaf(node.whenFalse,keys,seen);
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)
      return tokenLeaf(node.left,keys,seen) && tokenLeaf(node.right,keys,seen);
    if (!ts.isIdentifier(node)) return false;
    if (imported(node,'@ui-lazy-dev/tokens','tokens')) return known.has(keys.join('.'));
    const decl = declaration(node);
    if (!decl || modified.has(decl) || seen.has(decl) || !ts.isVariableDeclaration(decl) ||
        !(decl.parent.flags & ts.NodeFlags.Const) || !decl.initializer) return false;
    return tokenLeaf(decl.initializer,keys,new Set([...seen,decl]));
  }
  function constant(node) {
    const decl = declaration(node);
    if (decl && !modified.has(decl) && ts.isVariableDeclaration(decl) && (decl.parent.flags & ts.NodeFlags.Const))
      return decl.initializer;
  }
  // React Native ignores absent style array entries. 'undefined' is an identifier
  // and a local binding with that spelling may point to an arbitrary style object.
  function absentStyle(node) {
    if (node.kind === ts.SyntaxKind.NullKeyword || node.kind === ts.SyntaxKind.FalseKeyword) return true;
    if (!ts.isIdentifier(node) || node.text !== 'undefined') return false;
    const symbol = checker.getSymbolAtLocation(node);
    return Boolean(symbol && checker.isUndefinedSymbol(symbol));
  }
  inspectWrites(file);
  inspectEscapes(file);
  return { publicStyle, tokenLeaf, constant, absentStyle, importedTokens: node => imported(node,'@ui-lazy-dev/tokens','tokens') };
}
