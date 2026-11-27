import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import * as css from 'css-tree';
import ts from 'typescript';

const slugPattern = '[a-z][a-z0-9]*(?:-[a-z0-9]+)*';
const familySheet = new RegExp('^packages/web/src/(' + slugPattern + ')/styles\\.css$');
const singleVar = /^var\(\s*(--uld-[a-z0-9-]+)\s*,\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[A-Za-z]+|%)?)\s*\)$/;

// This permission covers direct dimension defaults. Colors, times, CSS expressions,
// shorthands, and unrelated uses retain the normal style judge.
function compatible(property, token) {
  if (/^(?:(?:row-|column-)?gap|(?:padding|margin)(?:-(?:block|inline)(?:-(?:start|end))?)?)$/.test(property))
    return token.startsWith('space.') || (property.endsWith('gap') && token === 'size.gap');
  if (/^(?:min-|max-)?(?:inline-size|block-size|width|height)$/.test(property))
    return token === 'size.control' || /^density\.(?:compactTarget|coarseTarget|largeTarget)$/.test(token);
  if (property === '--uld-control') return /^density\.(?:compactTarget|coarseTarget|largeTarget)$/.test(token);
  if (property === 'outline-width') return token === 'density.focusWidth';
  if (property === 'outline-offset') return token === 'density.focusOffset';
  if (/^border(?:-(?:start|end)-(?:start|end))?-radius$/.test(property))
    return token === 'size.radius' || /^shape\.radius(?:Sm|Md|Lg)$/.test(token);
  if (property === 'font-size') return /^type\.(?:captionSize|bodySize|headingSize|displaySize)$/.test(token);
  return false;
}

function localText(root, subpath) {
  const path = resolve(root, subpath);
  return existsSync(path) && realpathSync(path) === path ? readFileSync(path, 'utf8') : '';
}

function namesInTokenSection(spec) {
  const section = /^### Tokens\s*\n([\s\S]*?)(?=^#{1,3} |(?![\s\S]))/m.exec(spec)?.[1] ?? '';
  return new Set([...section.matchAll(/`([a-zA-Z]+\.[a-zA-Z0-9]+)`/g)].map(match => match[1]));
}

// Canonical barrels may re-export named runtime bindings from their own registered
// family files. A declaration-only, type-only, missing or foreign module cannot
// vouch for a new standalone CSS allowance.
function runtimeExport(root, registered, file, wanted, visit, visited = new Set()) {
  if (!registered.includes(file) || visited.has(file + ':' + wanted)) return false;
  visited.add(file + ':' + wanted);
  const text = localText(root, file);
  const ast = ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,
    file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  for (const node of ast.statements) {
    if (node.modifiers?.some(m => m.kind === ts.SyntaxKind.DeclareKeyword)) continue;
    if (node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) &&
        (ts.isFunctionDeclaration(node) && node.body || ts.isClassDeclaration(node)) &&
        node.name?.text === wanted) { visit(node); return true; }
    if (ts.isVariableStatement(node) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) &&
        node.declarationList.declarations.some(d => ts.isIdentifier(d.name) && d.name.text === wanted && d.initializer)) {
      visit(node.declarationList.declarations.find(d => ts.isIdentifier(d.name) && d.name.text === wanted).initializer);
      return true;
    }
    if (!ts.isExportDeclaration(node) || node.isTypeOnly || !node.moduleSpecifier ||
        !ts.isStringLiteral(node.moduleSpecifier) || !/^\.\/[a-z][a-z0-9-]*\.js$/.test(node.moduleSpecifier.text) ||
        !node.exportClause || !ts.isNamedExports(node.exportClause)) continue;
    const item = node.exportClause.elements.find(e => !e.isTypeOnly && e.name.text === wanted);
    if (!item) continue;
    const stem = file.slice(0,file.lastIndexOf('/') + 1) + node.moduleSpecifier.text.slice(2,-3);
    if (['.ts','.tsx'].some(ext => runtimeExport(root,registered,stem + ext,item.propertyName?.text ?? wanted,visit,visited))) return true;
  }
  return false;
}

function sourceChecker(file) {
  const options = { noLib: true, noResolve: true, types: [], jsx: ts.JsxEmit.Preserve };
  const host = ts.createCompilerHost(options);
  host.getSourceFile = name => name === file.fileName ? file : undefined;
  return ts.createProgram([file.fileName], options, host).getTypeChecker();
}

function imported(checker, identifier, name, path) {
  const decl = checker.getSymbolAtLocation(identifier)?.declarations?.[0];
  return Boolean(decl && ts.isImportSpecifier(decl) && !decl.isTypeOnly && !decl.parent.parent.isTypeOnly &&
    (decl.propertyName ?? decl.name).text === name && decl.parent.parent.parent.moduleSpecifier.text === path);
}

// Inline passes the original props to layout. The layout div appends className
// through classes(). Both reviewed layout variants preserve that return path.
const inlineForwarders = [
  ['packages/web/src/inline/binding', ['9fc6b607869bbbbada442888ac11fe2298fd05ee97c00c6a92665edec1fe3dfc']],
  ['packages/web/src/_shared/primitives/binding', [
    '191604d2f3454637ec1edf072f4aacd233bebde29945c7445b4ea574a8d67588',
    '6f945bfb01820673cec35520d07a35c7e8c70f0e5e0437bd0673b46f6af87563',
  ]],
];
function classHost(tag, root, checker) {
  if (!ts.isIdentifier(tag)) return false;
  if (/^[a-z]/.test(tag.text)) return true;
  return imported(checker, tag, 'Inline', '../inline/binding.js') && inlineForwarders.every(([stem, digests]) =>
    !['.ts', '.d.ts', '.js', '.jsx'].some(ext => existsSync(resolve(root, stem + ext))) &&
    digests.includes(createHash('sha256').update(localText(root, stem + '.tsx')).digest('hex')));
}

function methodReceiver(call, name) {
  if (call && ts.isCallExpression(call) && !call.questionDotToken && call.arguments.length === 1 &&
      ts.isPropertyAccessExpression(call.expression) && !call.expression.questionDotToken &&
      call.expression.name.text === name) return call.expression.expression;
}

// With children=1, Children.toArray yields [1] and isValidElement(1) is false.
// Prove the callback returns true on that path without running candidate code.
function contentPredicate(guard, props, checker) {
  if (!ts.isCallExpression(guard) || !ts.isIdentifier(guard.expression) || guard.arguments.length !== 1) return;
  const arg = guard.arguments[0];
  if (!ts.isPropertyAccessExpression(arg) || arg.name.text !== 'children' || !ts.isIdentifier(arg.expression) ||
      checker.getSymbolAtLocation(arg.expression)?.valueDeclaration?.name !== props) return;
  const predicate = checker.getSymbolAtLocation(guard.expression)?.valueDeclaration;
  if (!predicate || !ts.isFunctionDeclaration(predicate) || predicate.parent !== guard.getSourceFile() ||
      predicate.modifiers?.length || predicate.asteriskToken || predicate.parameters.length !== 1 ||
      predicate.body?.statements.length !== 1) return;
  const statement = predicate.body.statements[0];
  if (!ts.isReturnStatement(statement)) return;
  const some = statement.expression, array = methodReceiver(some, 'some'), children = methodReceiver(array, 'toArray');
  const refersTo = (node, parameter) => ts.isIdentifier(node) && checker.getSymbolAtLocation(node)?.valueDeclaration === parameter;
  if (!children || !imported(checker, children, 'Children', 'react') || !refersTo(array.arguments[0], predicate.parameters[0])) return;
  const callback = some.arguments[0];
  if (!ts.isArrowFunction(callback) || callback.modifiers?.length || callback.parameters.length !== 1 ||
      !ts.isBlock(callback.body)) return;
  const item = callback.parameters[0];
  if (!ts.isIdentifier(item.name) || item.dotDotDotToken || !ts.isIdentifier(predicate.parameters[0].name) ||
      predicate.parameters[0].dotDotDotToken) return;
  const steps = callback.body.statements;
  for (const step of steps.slice(0,-1)) {
    if (!ts.isIfStatement(step) || step.elseStatement || !ts.isCallExpression(step.expression)) return;
    const check = step.expression;
    if (!imported(checker, check.expression, 'isValidElement', 'react') ||
        check.arguments.length !== 1 || !refersTo(check.arguments[0], item)) return;
  }
  const last = steps.at(-1);
  if (!last || !ts.isReturnStatement(last) || !last.expression) return;
  const result = last.expression;
  const test = ts.isBinaryExpression(result) && result.operatorToken.kind === ts.SyntaxKind.BarBarToken ? result.left : result;
  if (ts.isBinaryExpression(test) && test.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken &&
      ts.isTypeOfExpression(test.left) && refersTo(test.left.expression, item) &&
      ts.isStringLiteral(test.right) && test.right.text === 'string') return predicate;
}

// A public component may delegate its returned host to a private function in the
// same module. Only follow a direct call with the original props. Any other use
// of the callee name (including shadowing or reassignment) makes it ambiguous.
function returnedHost(binding, root) {
  if (!ts.isFunctionDeclaration(binding) || binding.asteriskToken || !binding.body || binding.parameters.length !== 1) return;
  const statements = binding.body.statements;
  const last = statements.at(-1);
  if (!last || !ts.isReturnStatement(last) || !statements.slice(0,-1).every(ts.isVariableStatement)) return;
  const props = binding.parameters[0]?.name;
  const resultExpr = last.expression;
  if (!resultExpr || !props || !ts.isIdentifier(props) || binding.parameters[0].dotDotDotToken) return;
  const guarded = ts.isConditionalExpression(resultExpr);
  if (guarded && resultExpr.whenFalse.kind !== ts.SyntaxKind.NullKeyword) return;
  const call = guarded ? resultExpr.whenTrue : resultExpr;
  if (!ts.isCallExpression(call) || !ts.isIdentifier(call.expression) ||
      !call.arguments[0] || !ts.isIdentifier(call.arguments[0]) || call.arguments[0].text !== props.text) return;
  const file = binding.getSourceFile(), name = call.expression.text;
  const checker = sourceChecker(file);
  const helper = checker.getSymbolAtLocation(call.expression)?.valueDeclaration;
  if (!helper || !ts.isFunctionDeclaration(helper) || helper.parent !== file || !helper.body ||
      helper.modifiers?.length || helper.asteriskToken) return;
  // The public call must keep its input and the helper's early-return flags intact.
  function writes(node) {
    if (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) return true;
    if (ts.isDeleteExpression(node) || ts.isPostfixUnaryExpression(node) ||
        (ts.isPrefixUnaryExpression(node) && [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator))) return true;
    return ts.forEachChild(node, writes);
  }
  if (writes(binding) || writes(helper)) return;
  // The reviewed Button Group preparer reads options and returns host attributes.
  // An opaque initializer or extra argument can mutate props before renderGroup runs.
  const prepared = new Set();
  let preparer;
  function preparedArgument(expr) {
    if (ts.isIdentifier(expr)) return prepared.has(checker.getSymbolAtLocation(expr));
    if (!ts.isCallExpression(expr) || expr.questionDotToken || !ts.isIdentifier(expr.expression) ||
        expr.arguments.length !== 1 || !ts.isIdentifier(expr.arguments[0]) ||
        checker.getSymbolAtLocation(expr.arguments[0])?.valueDeclaration !== binding.parameters[0]) return false;
    const fn = checker.getSymbolAtLocation(expr.expression)?.valueDeclaration;
    if (!fn || !ts.isFunctionDeclaration(fn) || fn.parent !== file || createHash('sha256').update(fn.getText()).digest('hex') !==
        '18ef9593a3c0b0bbcc399f96334d67ceedbb6d939586c8c1c45cf52ce88820a9') return false;
    preparer = fn;
    return true;
  }
  for (const statement of statements.slice(0, -1)) {
    if (!(statement.declarationList.flags & ts.NodeFlags.Const)) return;
    for (const decl of statement.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer || !preparedArgument(decl.initializer)) return;
      prepared.add(checker.getSymbolAtLocation(decl.name));
    }
  }
  if (!call.arguments.slice(1).every(preparedArgument)) return;
  const predicate = guarded && contentPredicate(resultExpr.condition, props, checker);
  if (guarded && !predicate) return;
  function ambiguous(node) {
    if (ts.isIdentifier(node)) {
      if (preparer && node !== preparer.name && checker.getSymbolAtLocation(node)?.valueDeclaration === preparer &&
          !(ts.isCallExpression(node.parent) && node === node.parent.expression) && !ts.isTypeQueryNode(node.parent)) return true;
      if (((node.text === name && node !== helper.name) ||
           (predicate && node.text === predicate.name.text && node !== predicate.name)) &&
          !(ts.isCallExpression(node.parent) && node === node.parent.expression)) return true;
      if (node.text === 'Boolean' && !ts.isCallExpression(node.parent)) return true;
    }
    return ts.forEachChild(node, ambiguous);
  }
  if (ambiguous(file)) return;
  const body = helper.body.statements, result = body.at(-1);
  if (!result || !ts.isReturnStatement(result) || !result.expression) return;
  const locals = new Map(), falseFlags = new Set();
  const input = helper.parameters[0]?.name;
  const flags = new Set(input && ts.isObjectBindingPattern(input) ? input.elements
    .filter(e => !e.initializer && !e.dotDotDotToken && ts.isIdentifier(e.name)).map(e => e.name.text) : []);
  for (const stmt of body.slice(0,-1)) {
    if (ts.isIfStatement(stmt) && !stmt.elseStatement && ts.isIdentifier(stmt.expression) &&
        flags.has(stmt.expression.text) && ts.isReturnStatement(stmt.thenStatement)) {
      falseFlags.add(stmt.expression.text);
      continue;
    }
    if (!ts.isVariableStatement(stmt) || !(stmt.declarationList.flags & ts.NodeFlags.Const)) return;
    for (const decl of stmt.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer) return;
      locals.set(decl.name.text, decl.initializer);
    }
  }
  const host = ts.isJsxElement(result.expression) ? result.expression.openingElement : result.expression;
  if (!ts.isJsxOpeningElement(host) && !ts.isJsxSelfClosingElement(host)) return;
  if (classHost(host.tagName, root, checker)) return { host, locals, falseFlags };
}

// Inspect the value of the final className attribute. Conditions, discarded JSX,
// opaque calls and props that a subsequent spread could replace prove no class.
function returnedClasses(binding, root, add) {
  const result = returnedHost(binding, root);
  if (!result) return;
  const props = result.host.attributes.properties;
  const attr = props.findLast(p => ts.isJsxSpreadAttribute(p) || p.name.text === 'className');
  if (!attr || !ts.isJsxAttribute(attr) || !attr.initializer) return;
  const method = (expr, name) => ts.isCallExpression(expr) && ts.isPropertyAccessExpression(expr.expression) &&
    expr.expression.name.text === name && expr.arguments.length === 1;
  function collect(node, seen = new Set()) {
    if (ts.isStringLiteralLike(node)) add(node.text);
    else if (ts.isConditionalExpression(node) && ts.isIdentifier(node.condition) &&
             result.falseFlags.has(node.condition.text)) {
      collect(node.whenFalse, seen);
    } else if (ts.isIdentifier(node) && result.locals.has(node.text) && !seen.has(node.text)) {
      collect(result.locals.get(node.text), new Set([...seen, node.text]));
    } else if (method(node, 'join') && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === ' ') {
      const filter = node.expression.expression;
      if (method(filter, 'filter') && ts.isIdentifier(filter.arguments[0]) && filter.arguments[0].text === 'Boolean' &&
          ts.isArrayLiteralExpression(filter.expression.expression))
        for (const part of filter.expression.expression.elements) collect(part, seen);
    }
  }
  if (ts.isStringLiteral(attr.initializer)) collect(attr.initializer);
  else if (ts.isJsxExpression(attr.initializer) && attr.initializer.expression) collect(attr.initializer.expression);
}

// Check markers on the exported binding, including a local class expression passed
// to JSX or a property on the props object passed directly to a returned renderer.
// A comment, unused string, or unrelated module cannot create a family marker.
function bindingMarkers(binding, slug, markers, parts, root) {
  const locals = new Map(), classes = new Set(['uld-' + slug, 'uld-' + slug + '-root']);
  const attribute = 'data-uld-' + slug;
  returnedClasses(binding, root, text => {
    for (const value of text.split(/\s+/)) if (classes.has(value)) markers.add('.' + value);
  });
  const each = (node, visitor) => { visitor(node); ts.forEachChild(node, child => each(child,visitor)); };
  each(binding, node => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer)
      locals.set(node.name.text,node.initializer);
  });
  function classExpression(node, found, seen = new Set()) {
    if (ts.isStringLiteralLike(node)) {
      for (const value of node.text.split(/\s+/)) if (classes.has(value)) found.add('.' + value);
    } else if (ts.isIdentifier(node) && locals.has(node.text) && !seen.has(node.text)) {
      classExpression(locals.get(node.text),found,new Set([...seen,node.text]));
    } else ts.forEachChild(node, child => classExpression(child,found,seen));
  }
  each(binding, node => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const found = new Set();
      let part;
      for (const prop of node.attributes.properties) if (ts.isJsxAttribute(prop)) {
        if (prop.name.text === attribute && (!prop.initializer || ts.isStringLiteralLike(prop.initializer))) found.add('[' + attribute);
        if (prop.name.text === 'className' && prop.initializer) classExpression(prop.initializer,found);
        if (prop.name.text === 'data-part' && prop.initializer && ts.isStringLiteralLike(prop.initializer)) part = prop.initializer.text;
      }
      for (const marker of found) {
        markers.add(marker);
        if (part) {
          if (!parts.has(part)) parts.set(part,new Set());
          parts.get(part).add(marker);
        }
      }
    }
    if (ts.isReturnStatement(node) && node.expression && ts.isCallExpression(node.expression))
      for (const arg of node.expression.arguments) if (ts.isObjectLiteralExpression(arg))
        for (const prop of arg.properties) if (ts.isPropertyAssignment(prop) && prop.name.text === attribute &&
          (ts.isStringLiteralLike(prop.initializer) || prop.initializer.kind === ts.SyntaxKind.TrueKeyword))
          markers.add('[' + attribute);
  });
}

// Cross-check both generated package routes and their owning registry row. A slug
// in an arbitrary path, stylesheet comment, or document is insufficient.
export function registeredFallback(root, path, tokens) {
  const slug = familySheet.exec(path)?.[1];
  if (!slug) return;
  root = realpathSync(root);
  const manifest = JSON.parse(localText(root, 'manifests/families/' + slug + '.json') || '{}');
  const pkg = JSON.parse(localText(root, 'packages/web/package.json') || '{}');
  const tokenPackage = JSON.parse(localText(root, 'packages/tokens/package.json') || '{}');
  if (tokenPackage.name !== '@ui-lazy-dev/tokens' || tokenPackage.exports?.['./tokens.json'] !== './tokens.json' ||
      tokenPackage.exports?.['./styles.css'] !== './dist/styles.css') return;
  if (pkg.name !== '@ui-lazy-dev/ui-web' || typeof manifest.id !== 'string' || manifest.id.toLowerCase().replace(/[^a-z0-9]+/g, '-') !== slug ||
      !manifest.files?.style?.includes(path)) return;
  const owned = (manifest.entries ?? []).filter(row => row.pkg === 'web');
  const sheet = './' + slug + '.css', entry = './' + slug;
  const styleRows = owned.filter(row => row.path === sheet);
  const jsRows = owned.filter(row => row.path === entry);
  if (styleRows.length !== 1 || styleRows[0].target !== './dist/' + slug + '.css' ||
      pkg.exports?.[sheet] !== styleRows[0].target || jsRows.length !== 1) return;
  const target = jsRows[0].target, published = pkg.exports[entry];
  const prefix = slug + ':';
  const exported = (manifest.inventory?.api ?? []).filter(name => typeof name === 'string' && name.startsWith(prefix)).map(name => name.slice(prefix.length));
  const markers = new Set(), parts = new Map();
  if (!['index','binding'].some(name => target?.default === './dist/' + slug + '/' + name + '.js' &&
      target.types === './dist/' + slug + '/' + name + '.d.ts' && published?.default === target.default &&
      published?.types === target.types && ['ts','tsx'].some(ext => {
        const path = 'packages/web/src/' + slug + '/' + name + '.' + ext;
        let found = false;
        for (const name of exported) if (runtimeExport(root,manifest.files.source ?? [],path,name,
          node => bindingMarkers(node,slug,markers,parts,root))) found = true;
        return found;
      }))) return;
  const documented = namesInTokenSection(localText(root, 'docs/components/' + slug + '.md'));
  const dimensions = new Map();
  for (const [domain, leaves] of Object.entries(tokens)) for (const [name, token] of Object.entries(leaves)) {
    if (domain === 'palette' || token.$type !== 'dimension' || token.$value?.unit !== 'px' ||
        !Number.isFinite(token.$value.value)) continue;
    const variable = '--uld-' + name.replace(/[A-Z]/g, c => '-' + c.toLowerCase());
    const key = domain + '.' + name;
    const role = documented.has(key) ? { key, value: String(token.$value.value) + 'px' } : undefined;
    // A variable corresponding to more than one published role is ambiguous here.
    dimensions.set(variable, dimensions.has(variable) ? undefined : role);
  }
  return { slug, dimensions, markers, parts };
}

// Every branch must positively name this family's element in the target compound;
// an ancestor, :not(), :has(), sibling, or one agreeable member of :is() is insufficient.
function targetRequires(selector, predicate) {
  const target = list => list.type === 'SelectorList' && list.children.toArray().every(branch => {
    const parts = branch.children.toArray();
    const terminal = parts.slice(parts.findLastIndex(p => p.type === 'Combinator') + 1);
    if (terminal.some(p => p.type === 'PseudoElementSelector' || p.type === 'NestingSelector')) return false;
    return terminal.some(p => predicate(p) || (p.type === 'PseudoClassSelector' &&
      ['where','is'].includes(p.name) && p.children?.first && target(p.children.first)));
  });
  try { return target(css.parse(selector, { context:'selectorList' })); }
  catch { return false; }
}

function ownedTarget(selector, family) {
  if (selector.includes('\\')) return false;
  const markerIn = set => node => (node.type === 'ClassSelector' && set.has('.' + node.name)) ||
    (node.type === 'AttributeSelector' && !node.matcher && set.has('[' + node.name.name));
  if (!targetRequires(selector,markerIn(family.markers))) return false;
  // A universal part name (for example, "label") may also occur in a nested
  // component. Require the literal part and its own co-located host marker.
  if (!selector.includes('data-part')) return true;
  let verified = true;
  const partName = node => node.type === 'AttributeSelector' && node.name.name === 'data-part' &&
    node.matcher === '=' && !node.flags && (node.value?.value ?? node.value?.name);
  css.walk(css.parse(selector,{context:'selectorList'}), node => {
    if (node.type !== 'AttributeSelector' || node.name.name !== 'data-part') return;
    const part = partName(node), hosts = family.parts.get(part);
    if (!hosts || !targetRequires(selector,markerIn(hosts)) ||
        !targetRequires(selector,target => partName(target) === part)) verified = false;
  });
  return verified;
}

function controlVariant(decl, family) {
  const matchesSize = (node,size) => node.type === 'AttributeSelector' &&
    node.name.name === 'data-size' && node.matcher === '=' && !node.flags &&
    (node.value?.value ?? node.value?.name) === size;
  // A coarse floor cannot replace a documented larger explicit setting.
  const excludesLarge = node => {
    if (node.type !== 'PseudoClassSelector' || node.name !== 'not') return false;
    return node.children?.first?.children?.toArray().some(branch =>
      branch.children.size === 1 && matchesSize(branch.children.first,'lg'));
  };
  for (let ancestor = decl.parent.parent; ancestor?.type !== 'root'; ancestor = ancestor.parent) {
    if (ancestor?.type === 'atrule' && ancestor.name === 'media' &&
        /^\((?:any-)?pointer\s*:\s*coarse\)$/.test(ancestor.params)) {
      if (family.dimensions.get('--uld-large-target') && !targetRequires(decl.parent.selector,excludesLarge)) return 'unverified';
      return 'density.coarseTarget';
    }
  }
  for (const [size, key] of [['sm','density.compactTarget'],['lg','density.largeTarget']]) {
    if (targetRequires(decl.parent.selector, node => matchesSize(node,size))) return key;
  }
}

// When multiple published tokens could legitimately implement a property,
// decline the inference. An explicit design contract or reviewed rule must
// distinguish two different spacings used for the same purpose.
function roleAgrees(decl, family, role) {
  if (decl.prop === '--uld-control') return controlVariant(decl,family) === role.key;
  if (/^(?:min-|max-)?(?:inline-size|block-size|width|height)$/.test(decl.prop))
    return role.key === (controlVariant(decl,family) ?? 'size.control');
  const candidates = [...family.dimensions.values()].filter(item => item && compatible(decl.prop,item.key));
  return candidates.length === 1 && candidates[0].key === role.key;
}

// The package builder splits by textual chunk headers. Require each such header to
// be a genuine top-level comment before granting anything in this family sheet.
export function familyDefaults(sheet, source, family) {
  if (!family) return () => undefined;
  const raw = [...source.matchAll(/^\/\* @uld-css-chunk ([\w-]+)(?:\.(\d+))? \*\/\n/gm)];
  const real = new Set(sheet.nodes.filter(n => n.type === 'comment').map(n => n.source.start.offset));
  const own = raw.filter(header => header[1] === family.slug && !header[2]);
  if (raw[0]?.index !== 0 || raw.some(header => !real.has(header.index)) || own.length !== 1) return () => undefined;
  const start = own[0].index, end = raw[raw.indexOf(own[0]) + 1]?.index ?? source.length;
  return decl => {
    const value = singleVar.exec(decl.value.trim());
    if (!value) return;
    const role = family.dimensions.get(value[1]);
    if (decl.source.start.offset <= start || decl.source.start.offset >= end) return;
    if (![...family.dimensions.values()].some(item => item && compatible(decl.prop,item.key))) return;
    if (!role || !compatible(decl.prop,role.key) || value[2] !== role.value || decl.important ||
        decl.parent.type !== 'rule' || !ownedTarget(decl.parent.selector, family) ||
        !roleAgrees(decl, family, role)) return false;
    for (let parent = decl.parent.parent; parent !== sheet; parent = parent.parent) {
      if (parent?.type !== 'atrule' || !['media','supports','container'].includes(parent.name)) return false;
    }
    return true;
  };
}
