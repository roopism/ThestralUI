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
  const ast = ts.createSourceFile(file,text,ts.ScriptTarget.Latest,false,
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

// Check markers on the exported binding, including a local class expression passed
// to JSX or a property on the props object passed directly to a returned renderer.
// A comment, unused string, or unrelated module cannot create a family marker.
function bindingMarkers(binding, slug, markers, parts) {
  const locals = new Map(), classes = new Set(['uld-' + slug, 'uld-' + slug + '-root']);
  const attribute = 'data-uld-' + slug;
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
          node => bindingMarkers(node,slug,markers,parts))) found = true;
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
