import ts from 'typescript';

// Compare syntax without source locations, comments or original quote style.
function syntax(node) {
  if (!node) return null;
  if (ts.isParenthesizedExpression(node)) return syntax(node.expression);
  const children = [];
  ts.forEachChild(node, child => { children.push(syntax(child)); });
  return children.length ? [node.kind, ...children] : [node.kind, node.text ?? ''];
}

function functionFrame(node) {
  const parent = node.parent;
  if (node.name) return ['function', node.kind, syntax(node.name)];
  if (ts.isVariableDeclaration(parent) || ts.isPropertyAssignment(parent)) return ['binding', syntax(parent.name)];
  if (ts.isCallExpression(parent)) {
    const label = parent.arguments[0];
    return ['callback', syntax(parent.expression), parent.arguments.indexOf(node),
      label && ts.isStringLiteralLike(label) ? label.text : ''];
  }
  return ['function expression', node.kind, parent.kind];
}

function loopHeader(node) {
  if (ts.isForStatement(node)) return [node.kind, syntax(node.initializer), syntax(node.condition), syntax(node.incrementor)];
  if (ts.isForOfStatement(node) || ts.isForInStatement(node)) return [node.kind, syntax(node.initializer), syntax(node.expression), !!node.awaitModifier];
  return [node.kind, syntax(node.expression)];
}

function assertions(path, text) {
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  if (file.parseDiagnostics.length) throw Error('Cannot inspect assertion contexts in ' + path);
  const counts = new Map();
  function visit(node, frames) {
    if (ts.isCallExpression(node)) {
      const call = node.expression.getText(file);
      if (/^(?:assert(?:\.|$)|expect(?:\.|\())/.test(call) && !/^expect(?:\.(?:soft|poll))?$/.test(call)) {
        const upper = /\.toBeLessThan(?:OrEqual)?$/.test(call) && node.arguments.length === 1 && ts.isNumericLiteral(node.arguments[0]);
        const key = JSON.stringify([frames, syntax(upper ? node.expression : node)]);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    ts.forEachChild(node, child => {
      let frame;
      if (ts.isFunctionLike(node) && child === node.body) frame = functionFrame(node);
      if (ts.isIterationStatement(node, false) && child === node.statement) frame = ['loop', ...loopHeader(node)];
      if (ts.isTryStatement(node)) {
        if (child === node.tryBlock) frame = ['try', !!node.catchClause, !!node.finallyBlock];
        if (child === node.catchClause) frame = ['catch'];
        if (child === node.finallyBlock) frame = ['finally'];
      }
      visit(child, frame ? [...frames, frame] : frames);
    });
  }
  visit(file, []);
  return counts;
}

export function lostAssertionContext(path, before, after) {
  const previous = assertions(path, before), current = assertions(path, after);
  for (const [key, count] of previous) {
    if ((current.get(key) ?? 0) < count) return true;
  }
  return false;
}
