import ts from 'typescript';

const hosts = {
  button: 'button',
  input: 'input',
  textarea: 'input',
  select: 'selection',
  option: 'selection',
  a: 'link',
  dialog: 'dialog',
  summary: 'disclosure',
};
const roles = {
  button: 'button',
  link: 'link',
  textbox: 'input',
  combobox: 'selection',
  switch: 'selection',
  checkbox: 'selection',
  radio: 'selection',
  option: 'selection',
  menuitem: 'selection',
  tab: 'selection',
  slider: 'selection',
  treeitem: 'selection',
  dialog: 'dialog',
  alertdialog: 'dialog',
};
const shared = {
  Button: 'button',
  Trigger: 'button',
  IconButton: 'button',
  ToggleButton: 'selection',
  ButtonGroup: 'action group',
  FormField: 'field',
  Input: 'input',
  TextArea: 'input',
  TextField: 'input',
  PasswordField: 'input',
  CodeField: 'input',
  NumberField: 'input',
  SearchField: 'input',
  Select: 'selection',
  SelectValue: 'selection',
  ListBoxItem: 'selection',
  Checkbox: 'selection',
  Radio: 'selection',
  Switch: 'selection',
  Slider: 'selection',
  Tab: 'selection',
  MenuItem: 'selection',
  Tag: 'selection',
  Link: 'link',
  Dialog: 'dialog',
  OverlayDialog: 'dialog',
  AlertDialog: 'dialog',
  Disclosure: 'disclosure',
  ResourceCard: 'selection',
  RecordList: 'selection',
  Badge: 'badge',
  Status: 'notice',
  PanelHeader: 'panel header',
  DocumentPreview: 'document preview',
  EmptyState: 'empty state',
};
export const fixes = {
  button: 'Use Button from the public UI package or the approved flag-aware Button adapter.',
  input: 'Use Input/TextArea from the public forms entry or a named field adapter.',
  selection: 'Use the matching Checkbox, Radio, Select, MenuItem or list selection primitive.',
  link: 'Use Link from the public navigation entry or the approved routing adapter.',
  dialog: 'Use Dialog or AlertDialog from the public package.',
  disclosure: 'Use the shared Disclosure primitive.',
};
const native = {
  Pressable: 'button',
  TouchableOpacity: 'button',
  TouchableHighlight: 'button',
  TouchableWithoutFeedback: 'button',
  TextInput: 'input',
  Switch: 'selection',
  Modal: 'dialog',
};
function literalAttribute(initializer) {
  let value = initializer;
  if (value && ts.isJsxExpression(value)) value = value.expression;
  while (value && ts.isParenthesizedExpression(value)) value = value.expression;
  return value && ts.isStringLiteralLike(value) ? value.text : undefined;
}
const hostFamily = (name, attrs) => {
  if (name === 'input') {
    const type = literalAttribute(attrs.find((a) => a.name?.getText() === 'type')?.initializer);
    if (['radio', 'checkbox', 'range', 'color'].includes(type)) return 'selection';
    if (['button', 'image', 'submit', 'reset'].includes(type)) return 'button';
  }
  if (hosts[name]) return hosts[name];
  for (const attr of attrs) {
    if (!ts.isJsxAttribute(attr) && !ts.isPropertyAssignment(attr)) continue;
    const key = attr.name.text ?? attr.name.getText();
    const role = literalAttribute(attr.initializer);
    if (['role', 'accessibilityRole'].includes(key) && roles[role]) return roles[role];
    if (['onClick', 'onDoubleClick', 'onPress', 'onLongPress'].includes(key)) return 'button';
  }
};
function ownerName(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isFunctionDeclaration(parent) && parent.name) return parent.name.text;
    if (
      ts.isVariableDeclaration(parent) &&
      ts.isIdentifier(parent.name) &&
      /^[A-Z]/.test(parent.name.text)
    )
      return parent.name.text;
    if (ts.isMethodDeclaration(parent) && parent.name) return parent.name.getText();
  }
  return '(module)';
}
function declaredAtModuleScope(source, node, name) {
  const owner = source.statements.find(
    (statement) =>
      statement.name?.text === name ||
      (ts.isVariableStatement(statement) &&
        statement.declarationList.declarations.some((decl) => decl.name.getText() === name)),
  );
  if (!owner || node.pos < owner.pos || node.end > owner.end) return false;
  // A nested declaration with the same name shadows the approved module binding.
  for (let parent = node.parent; parent && parent !== owner; parent = parent.parent) {
    if (ts.isFunctionDeclaration(parent) && parent.name?.text === name) return false;
    if (
      ts.isVariableDeclaration(parent) &&
      parent.name.getText() === name &&
      parent.parent.parent !== owner
    )
      return false;
  }
  return true;
}
function specifier(decl) {
  for (let p = decl; p; p = p.parent)
    if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) return p.moduleSpecifier?.text;
}
export function inspectOwnership(context) {
  const { program, checker, rel, files, config, emit, usage } = context;
  const owns = (rules, file, symbol, family) =>
    rules.some(
      (r) =>
        r.file === file && r.symbol === symbol && (family === undefined || r.family === family),
    );
  const definitions = new Map(),
    wrappers = new Map(),
    usages = [];
  const resolverCache = ts.createModuleResolutionCache(context.abs('.'), (s) => s, context.options);
  function isLocal(pkg, decl) {
    if (pkg.startsWith('.')) return true;
    const target = ts.resolveModuleName(
      pkg,
      decl.getSourceFile().fileName,
      context.options,
      ts.sys,
      resolverCache,
    ).resolvedModule;
    return !!target && files.has(target.resolvedFileName);
  }
  function resolveSymbol(node, seen = new Set()) {
    if (!node) return;
    if (ts.isStringLiteralLike(node)) return { host: node.text };
    if (
      ts.isAsExpression(node) ||
      ts.isParenthesizedExpression(node) ||
      ts.isSatisfiesExpression(node)
    )
      return resolveSymbol(node.expression, seen);
    if (ts.isPropertyAccessExpression(node)) {
      const base = checker.getSymbolAtLocation(node.expression);
      const decl = base?.declarations?.[0];
      const pkg = decl && specifier(decl);
      if (pkg && !isLocal(pkg, decl)) return { pkg, name: node.name.text };
      if (pkg && isLocal(pkg, decl)) {
        const module = checker.getAliasedSymbol(base);
        const exported = checker.getExportsOfModule(module).find((s) => s.name === node.name.text);
        if (exported?.declarations?.[0]) return readDecl(exported.declarations[0], exported, seen);
      }
      node = node.name;
    }
    let symbol = checker.getSymbolAtLocation(node);
    if (!symbol || seen.has(symbol)) return;
    seen.add(symbol);
    const decl = symbol.declarations?.[0];
    if (!decl) return;
    if (ts.isImportSpecifier(decl) || ts.isExportSpecifier(decl)) {
      const pkg = specifier(decl);
      if (pkg && !isLocal(pkg, decl))
        return { pkg, name: decl.propertyName?.text ?? decl.name.text };
      const target = checker.getImmediateAliasedSymbol(symbol);
      if (target?.declarations?.[0]) return readDecl(target.declarations[0], target, seen);
    }
    return readDecl(decl, symbol, seen);
  }
  function readDecl(decl, sym, seen) {
    if (ts.isBindingElement(decl) && ts.isVariableDeclaration(decl.parent.parent)) {
      const base = decl.parent.parent.initializer;
      const imported = base && checker.getSymbolAtLocation(base)?.declarations?.[0];
      const pkg = imported && specifier(imported);
      if (pkg && !isLocal(pkg, decl))
        return { pkg, name: (decl.propertyName ?? decl.name).getText() };
    }
    if (ts.isImportSpecifier(decl) || ts.isExportSpecifier(decl)) {
      const pkg = specifier(decl);
      if (pkg && !isLocal(pkg, decl))
        return { pkg, name: decl.propertyName?.text ?? decl.name.text };
      const target = checker.getImmediateAliasedSymbol(sym);
      if (target?.declarations?.[0] && !seen.has(target)) {
        seen.add(target);
        return readDecl(target.declarations[0], target, seen);
      }
    }
    if (
      ts.isVariableDeclaration(decl) &&
      decl.initializer &&
      ts.isBinaryExpression(decl.initializer) &&
      [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken].includes(
        decl.initializer.operatorToken.kind,
      )
    )
      return (
        resolveSymbol(decl.initializer.right, seen) ?? resolveSymbol(decl.initializer.left, seen)
      );
    if (
      ts.isVariableDeclaration(decl) &&
      decl.initializer &&
      (ts.isIdentifier(decl.initializer) ||
        ts.isStringLiteralLike(decl.initializer) ||
        ts.isPropertyAccessExpression(decl.initializer))
    )
      return resolveSymbol(decl.initializer, seen);
    if (ts.isImportClause(decl)) {
      const pkg = specifier(decl);
      if (pkg && !isLocal(pkg, decl)) return { pkg, name: 'default' };
      const target = checker.getImmediateAliasedSymbol(sym);
      if (target?.declarations?.[0]) return readDecl(target.declarations[0], target, seen);
    }
    return { file: rel(decl.getSourceFile().fileName), name: decl.name?.getText() ?? sym.name };
  }
  const note = (file, node, symbol, family, status, kind) => {
    usage.push({
      file,
      line: node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line + 1,
      symbol,
      family,
      status,
    });
    if (status === 'raw' || status === 'substitute')
      emit(
        file,
        node,
        symbol,
        status === 'raw' ? 'primitive-owner' : 'local-substitute',
        family,
        kind,
        fixes[family] ?? 'Use the approved shared implementation.',
      );
  };
  function visit(file, node) {
    const opening = ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node);
    const call = ts.isCallExpression(node) && node.arguments.length > 0;
    let tag,
      attrs = [],
      origin;
    if (opening) {
      tag = node.tagName;
      attrs = node.attributes.properties.flatMap((attribute) => {
        if (!ts.isJsxSpreadAttribute(attribute)) return [attribute];
        const expression = attribute.expression;
        const decl = checker.getSymbolAtLocation(expression)?.valueDeclaration;
        const object = ts.isObjectLiteralExpression(expression) ? expression : decl?.initializer;
        return object && ts.isObjectLiteralExpression(object) ? [...object.properties] : [];
      });
    } else if (call) {
      const api = resolveSymbol(node.expression);
      if (
        (api?.pkg === 'react' && api.name === 'createElement') ||
        (['react/jsx-runtime', 'react/jsx-dev-runtime'].includes(api?.pkg) &&
          ['jsx', 'jsxs', 'jsxDEV'].includes(api?.name))
      ) {
        tag = node.arguments[0];
        if (node.arguments[1] && ts.isObjectLiteralExpression(node.arguments[1]))
          attrs = [...node.arguments[1].properties];
      }
    }
    if (tag) {
      if (opening && ts.isIdentifier(tag) && /^[a-z]/.test(tag.text)) origin = { host: tag.text };
      else origin = resolveSymbol(tag);
      if (origin) {
        const symbol = ownerName(node);
        const family = origin.host
          ? hostFamily(origin.host, attrs)
          : origin.pkg === 'react-native'
            ? (native[origin.name] ?? hostFamily(origin.name, attrs))
            : origin.pkg === 'next/link'
              ? 'link'
              : undefined;
        if (family) {
          if (
            !owns(config.owners, file, symbol, family) ||
            !declaredAtModuleScope(node.getSourceFile(), node, symbol)
          ) {
            note(file, node, symbol, family, 'raw', origin.host ?? origin.name);
            const key = file + '#' + symbol;
            if (!definitions.has(key)) definitions.set(key, new Set());
            definitions.get(key).add(family);
          }
        } else if (origin.pkg?.startsWith('@ui-lazy-dev/ui-') && shared[origin.name])
          note(file, node, symbol, shared[origin.name], 'adopted', origin.name);
        else if (origin.pkg === 'react-aria-components' && shared[origin.name]) {
          if (config.mode === 'library')
            note(file, node, symbol, shared[origin.name], 'adopted', origin.name);
          else note(file, node, symbol, shared[origin.name], 'substitute', origin.name);
        } else if (origin.file) usages.push({ file, node, symbol, origin });
      }
    }
    ts.forEachChild(node, (child) => visit(file, child));
  }
  for (const file of files) {
    const source = program.getSourceFile(file);
    visit(rel(file), source);
  }
  for (const item of usages) {
    const { file, node, symbol, origin } = item;
    const adapter = config.adapters.find((r) => r.file === origin.file && r.symbol === origin.name);
    const owner = config.owners.find((r) => r.file === origin.file && r.symbol === origin.name);
    if (adapter || owner) {
      note(
        file,
        node,
        symbol,
        (adapter ?? owner).family,
        adapter ? 'bridged' : 'adopted',
        origin.name,
      );
      continue;
    }
    const key = file + '#' + symbol;
    const dest = origin.file + '#' + origin.name;
    if (!wrappers.has(key)) wrappers.set(key, []);
    wrappers.get(key).push(dest);
  }
  // A significant local substitute can be wrapped or re-exported several times.
  function substitute(key, seen = new Set()) {
    if (seen.has(key)) return;
    seen.add(key);
    const symbol = key.split('#').at(-1);
    const raw = definitions.get(key);
    if (
      raw?.size === 1 &&
      (wrapperShape(key) || /Button|Input|Field|Dialog|Link|Toggle|Checkbox|Selector/.test(symbol))
    )
      return [...raw][0];
    if (wrapperShape(key))
      for (const dest of wrappers.get(key) ?? []) {
        const found = substitute(dest, seen);
        if (found) return found;
      }
  }
  function wrapperShape(key) {
    const [file, name] = key.split('#');
    const source = program.getSourceFile(context.abs(file));
    if (!source) return false;
    const decl = source.statements.find(
      (s) =>
        s.name?.getText() === name ||
        (ts.isVariableStatement(s) &&
          s.declarationList.declarations.some((d) => d.name.getText() === name)),
    );
    if (!decl) return false;
    let count = 0;
    const walk = (n) => {
      if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) count++;
      ts.forEachChild(n, walk);
    };
    walk(decl);
    return count === 1;
  }
  for (const { file, node, symbol, origin } of usages) {
    if (
      owns(config.adapters, origin.file, origin.name) ||
      owns(config.owners, origin.file, origin.name)
    )
      continue;
    const family = substitute(origin.file + '#' + origin.name);
    if (family) note(file, node, symbol, family, 'substitute', origin.name);
  }
}
