import assert from 'node:assert/strict';
import ts from 'typescript';
const print = ts.createPrinter({ removeComments: true });
const normalize = (text) => text.replace(/\s+/g, ' ').trim();
function namedTest(call, title) {
  if (!ts.isCallExpression(call)) return;
  const [titleNode, callback] = call.arguments;
  if (
    !titleNode ||
    !ts.isStringLiteralLike(titleNode) ||
    !callback ||
    !(ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))
  )
    return;
  const callee = call.expression;
  const direct = ts.isIdentifier(callee) && ['it', 'test'].includes(callee.text);
  const each =
    ts.isCallExpression(callee) &&
    ts.isPropertyAccessExpression(callee.expression) &&
    callee.expression.name.text === 'each';
  if (!direct && !each) return;
  const match = titleNode.text;
  if (match === title || (each && match.startsWith('$name ') && title.endsWith(match.slice(5))))
    return callback;
}
export function assertedBehavior(source, file, title) {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX),
    matches = [];
  function inspect(node) {
    const callback = namedTest(node, title);
    if (callback) matches.push(callback);
    else ts.forEachChild(node, inspect);
  }
  inspect(tree);
  assert.equal(matches.length, 1, 'No unique executed test body for ' + title);
  const assertions = [];
  function walk(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      /^to[A-Z]/.test(node.expression.name.text)
    ) {
      const code = normalize(print.printNode(ts.EmitHint.Unspecified, node, tree));
      if (code.includes('expect(')) assertions.push(code);
      return;
    }
    ts.forEachChild(node, walk);
  }
  walk(matches[0].body);
  return assertions;
}

// Compare tokens so quote choices, comments and line wrapping don't change the observation.
export function sameObservation(left, right) {
  const normalizeTokens = (source) => {
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.JSX, source);
    const tokens = [];
    for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan()) {
      tokens.push([
        kind,
        kind === ts.SyntaxKind.StringLiteral ? scanner.getTokenValue() : scanner.getTokenText(),
      ]);
    }
    return JSON.stringify(tokens);
  };
  return normalizeTokens(left) === normalizeTokens(right);
}

export function storyProps(source, name, module) {
  const tree = ts.createSourceFile(
    'story.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const imports = new Set();
  const props = new Set();
  for (const statement of tree.statements) {
    if (!ts.isImportDeclaration(statement) || statement.moduleSpecifier.text !== module) continue;
    for (const item of statement.importClause?.namedBindings?.elements ?? []) {
      if ((item.propertyName ?? item.name).text === name) imports.add(item.name.text);
    }
  }
  function visit(node) {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      imports.has(node.tagName.getText(tree))
    ) {
      for (const prop of node.attributes.properties) {
        if (ts.isJsxAttribute(prop)) props.add(prop.name.getText(tree));
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return props;
}
