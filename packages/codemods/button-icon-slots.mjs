import ts from 'typescript';

function importedButton(file, checker) {
  const buttons = new Set();
  const namespaces = new Set();
  for (const declaration of file.statements) {
    if (!ts.isImportDeclaration(declaration) ||
        declaration.moduleSpecifier.text !== '@ui-lazy-dev/ui-web' ||
        declaration.importClause?.isTypeOnly) continue;
    const names = declaration.importClause?.namedBindings;
    if (!names) continue;
    if (ts.isNamespaceImport(names)) namespaces.add(checker.getSymbolAtLocation(names.name));
    else for (const binding of names.elements) {
      if (!binding.isTypeOnly && (binding.propertyName ?? binding.name).text === 'Button') {
        buttons.add(checker.getSymbolAtLocation(binding.name));
      }
    }
  }
  return (tag) => ts.isIdentifier(tag) ? buttons.has(checker.getSymbolAtLocation(tag))
    : ts.isPropertyAccessExpression(tag) && ts.isIdentifier(tag.expression) &&
      tag.name.text === 'Button' && namespaces.has(checker.getSymbolAtLocation(tag.expression));
}

function booleanFlag(attribute) {
  if (!ts.isJsxAttribute(attribute)) return false;
  const value = attribute.initializer;
  return !value || (ts.isJsxExpression(value) && value.expression?.kind === ts.SyntaxKind.TrueKeyword) ||
    (attribute.name.text === 'aria-hidden' && ts.isStringLiteral(value) && value.text === 'true');
}

function graphic(node) {
  if (!ts.isJsxElement(node)) return;
  const opening = node.openingElement;
  if (!ts.isIdentifier(opening.tagName) || opening.tagName.text !== 'span') return;
  const attributes = opening.attributes.properties;
  if (attributes.length !== 2 || !attributes.every(booleanFlag)) return;
  const flags = new Set(attributes.map((property) => property.name.text));
  if (!flags.has('aria-hidden') || !flags.has('inert')) return;
  const content = node.children.filter((child) => !ts.isJsxText(child) || child.text.trim());
  if (content.length === 1 && ts.isJsxSelfClosingElement(content[0])) return content[0];
}

function slotEdits(node, file) {
  const open = node.openingElement;
  // A spread can already set either slot or children. Preserve its caller-defined behavior.
  if (open.attributes.properties.some((p) => !ts.isJsxAttribute(p) ||
    ['startIcon', 'endIcon', 'children'].includes(p.name.text))) return [];
  const children = node.children.filter((child) => !ts.isJsxText(child) || child.text.trim());
  // Removing a wrapper between separate JSX text nodes can change whitespace compaction.
  if (children.length !== node.children.length) return [];
  const label = children.findIndex(ts.isJsxText);
  if (label === -1 || label > 1 || children.length - label > 2 || children.length < 2) return [];
  const edges = [];
  if (label === 1) edges.push(['startIcon', children[0]]);
  if (label < children.length - 1) edges.push(['endIcon', children.at(-1)]);
  const slots = [];
  const edits = [];
  for (const [name, wrapper] of edges) {
    const icon = graphic(wrapper);
    if (!icon) return [];
    slots.push(' ' + name + '={' + icon.getText(file) + '}');
    edits.push({ start: wrapper.getStart(file), end: wrapper.end, text: '' });
  }
  edits.push({ start: open.end - 1, end: open.end - 1, text: slots.join('') });
  return edits;
}

export function migrateButtonIcons(source, filename = 'consumer.tsx') {
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true,
    filename.endsWith('.jsx') ? ts.ScriptKind.JSX : ts.ScriptKind.TSX);
  if (file.parseDiagnostics.length) {
    const message = ts.flattenDiagnosticMessageText(file.parseDiagnostics[0].messageText, '\n');
    throw new Error(filename + ' has invalid JSX: ' + message);
  }
  // Bind the file in isolation. Imported aliases and locally shadowed names have distinct symbols.
  const options = { jsx: ts.JsxEmit.Preserve, allowJs: true, noResolve: true, noLib: true };
  const host = ts.createCompilerHost(options);
  host.getSourceFile = (name) => name === filename ? file : undefined;
  const program = ts.createProgram([filename], options, host);
  const matches = importedButton(file, program.getTypeChecker());
  const edits = [];
  function visit(node) {
    if (ts.isJsxElement(node) && matches(node.openingElement.tagName)) {
      const changes = slotEdits(node, file);
      if (changes.length) {
        edits.push(...changes);
        return;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
  }
  return source;
}
