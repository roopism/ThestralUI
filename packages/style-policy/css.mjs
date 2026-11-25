import * as css from 'css-tree';
import postcss from 'postcss';
import {familyDefaults} from './family-fallback.mjs';

export const canonical = (key) => key.replace(/[A-Z]/g, (s) => '-' + s.toLowerCase());
const design =
  /^(?:--|(?:-webkit-)?(?:color|(?:stop|flood)-color|duration|delay|easing|fill|stroke|background|border|outline|box-shadow|text-shadow|shadow-|elevation|font|line-height|letter-spacing|word-spacing|gap|row-gap|column-gap|margin|padding|inset|top|right|bottom|left|width|height|min-|max-|inline-size|block-size|transform|translate|rotate|scale|opacity|animation|transition|scroll-padding|scroll-margin|accent-color|caret-color|text-decoration|z-index))/;
export const designProperty = (property) => design.test(canonical(property));
const systemColors =
  /^(?:transparent|currentcolor|canvas(?:text)?|highlight(?:text)?|button(?:text|face|border)|graytext|linktext|visitedtext|selecteditem(?:text)?|mark(?:text)?|field(?:text)?|accentcolor(?:text)?|activeText)$/i;
const colorFunctions = /^(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|device-cmyk)$/i;
const geometry =
  /^env\((?:safe-area-inset-(?:top|right|bottom|left)|keyboard-inset-height)(?:,\s*0(?:px)?)?\)$/i;

function selectorsAreScoped(ast, scopes, scopeRoot = false) {
  return ast.children.toArray().every((selector) => {
    let anchored = false;
    let descendant = false;
    for (const part of selector.children) {
      if (scopeRoot && part.type === 'PseudoClassSelector' && part.name === 'scope') anchored = true;
      if (part.type === 'ClassSelector' && scopes.some((scope) => part.name.startsWith(scope)))
        anchored = true;
      if (part.type === 'AttributeSelector' && part.name.name?.startsWith('data-uld-'))
        anchored = true;
      if (part.type === 'PseudoClassSelector' && ['is', 'where'].includes(part.name)) {
        const branches = part.children?.first;
        if (branches?.type === 'SelectorList' && selectorsAreScoped(branches, scopes, scopeRoot))
          anchored = true;
      }
      if (part.type === 'Combinator' && anchored) {
        if (part.name === ' ' || part.name === '>') descendant = true;
        else if (!descendant) anchored = false;
      }
    }
    return anchored;
  });
}

const colorNames = new Map();
function namedColor(name) {
  if (!colorNames.has(name)) colorNames.set(name, !!css.lexer.matchType('color', name).matched);
  return colorNames.get(name);
}

// Structural values carry no design scale: a circle radius, a full viewport extent
// and quarter-turn orientation. Any other radius, extent, angle or length is judged.
const radiusProperty = /^border(?:-(?:top|bottom|start|end)-(?:left|right|start|end))?-radius$/;
const viewportUnit = /^[sld]?v(?:h|w|b|i)$/i;
const quarterTurn = { deg: 90, grad: 100, turn: 0.25 };
function structuralDimension(prop, node, fn) {
  const value = Number(node.value), unit = node.unit.toLowerCase();
  if (value === 100 && viewportUnit.test(unit) && /(?:width|height|size)/.test(prop)) return true;
  const orientation = prop === 'rotate' || (/^(?:transform|rotate)$/.test(prop) && /^rotate[z]?$/i.test(fn?.name ?? ''));
  return orientation && unit in quarterTurn && Number.isInteger(value / quarterTurn[unit]);
}

// A family component token is --uld-<family>-<name>, declared in its own family's CSS.
// Its value may only reference global or same-family tokens, optionally with the
// exact published dimension as a fallback, combined by calc/min/max/clamp and zero.
export function componentValueIssue(value, options) {
  let ast;
  try {
    ast = css.parse(value, { context: 'value', parseValue: true });
  } catch {
    return true;
  }
  let invalid = false, references = 0;
  css.walk(ast, function (node) {
    if (node.type === 'Function' && node.name === 'var') {
      const args = node.children.toArray();
      references++;
      if (!options.variables.includes(args[0]?.name)) invalid = true;
      const comma = args.findIndex((part) => part.type === 'Operator' && part.value === ',');
      if (comma >= 0) {
        const fallback = args.slice(comma + 1).map(part => css.generate(part)).join('').trim();
        if (options.componentTokens?.published?.get(args[0]?.name) !== fallback) invalid = true;
      }
      return this.skip;
    }
    if (node.type === 'Function' && !/^(?:calc|min|max|clamp)$/i.test(node.name)) invalid = true;
    else if (['Dimension', 'Number', 'Percentage'].includes(node.type) && Number(node.value) !== 0) invalid = true;
    else if (!['Value', 'Function', 'Operator', 'WhiteSpace', 'Dimension', 'Number', 'Percentage', 'Parentheses'].includes(node.type))
      invalid = true;
  });
  return invalid || references === 0;
}

export function literalIssue(property, value, options) {
  const prop = canonical(property);
  const component = options.componentTokens?.family?.(prop);
  if (component) return component !== options.componentTokens.owner || componentValueIssue(value, options);
  if (!designProperty(prop)) return false;
  if (/^(?:inherit|initial|unset|revert|revert-layer|none|normal|auto|0)$/.test(value))
    return false;
  let ast;
  try {
    ast = css.parse(value, { context: 'value', parseValue: true });
  } catch {
    return true;
  }
  let invalid = false;
  css.walk(ast, function (node) {
    if (node.type === 'Function' && node.name === 'var') {
      const args = node.children.toArray();
      if (!options.variables.includes(args[0]?.name)) invalid = true;
      const comma = args.findIndex((part) => part.type === 'Operator' && part.value === ',');
      if (comma >= 0) {
        const fallback = args.slice(comma + 1).map(part => css.generate(part)).join('').trim();
        if (options.dimensionFallbacks?.get(args[0]?.name) !== fallback && literalIssue(prop, fallback, options))
          invalid = true;
      }
      return this.skip;
    }
    if (node.type === 'Function' && node.name === 'env') {
      if (!geometry.test(css.generate(node))) invalid = true;
      return this.skip;
    }
    if (node.type === 'Hash' || (node.type === 'Function' && colorFunctions.test(node.name)))
      invalid = true;
    if (node.type === 'Dimension' && Number(node.value) !== 0 && !structuralDimension(prop, node, this.function))
      invalid = true;
    if (
      node.type === 'Number' &&
      Number(node.value) !== 0 &&
      !(Number(node.value) === 1 && /opacity|scale|transform|line-height/.test(prop))
    )
      invalid = true;
    if (
      node.type === 'Percentage' &&
      Number(node.value) !== 0 &&
      !(Number(node.value) === 100 && /(?:width|height|size)/.test(prop)) &&
      !(Number(node.value) === 50 && radiusProperty.test(prop))
    )
      invalid = true;
    if (node.type === 'Identifier' && !systemColors.test(node.name) && namedColor(node.name))
      invalid = true;
    if (node.type === 'String' && /font/.test(prop)) invalid = true;
    if (
      node.type === 'Identifier' &&
      /^(?:font-family|font-weight|font-size|font)$/.test(prop) &&
      !/^(?:inherit|initial|normal|italic|oblique)$/.test(node.name)
    )
      invalid = true;
  });
  return invalid;
}

// A reviewed selector outside the normal component namespace may style only the
// declarations and enclosing scope that were approved with it.
function componentScopeContext(rule, context) {
  const ancestors = [];
  for (let parent = rule.parent; parent && parent.type !== 'root'; parent = parent.parent) {
    ancestors.unshift(parent.type === 'atrule' ? '@' + parent.name + ' ' + parent.params : parent.selector);
  }
  const declarations = rule.nodes.filter(node => node.type !== 'comment').map(node =>
    node.type === 'decl' ? [node.prop, node.value, Boolean(node.important)] : [node.type, node.toString()],
  );
  return JSON.stringify([context, ancestors, declarations]);
}

export function inspectCss(source, options, report, baseLine = 1, context = '') {
  const sheet = postcss.parse(source, { from: undefined });
  const familyDefault = familyDefaults(sheet, source, options.familyFallback);
  function verifiedScope(rule) {
    for (let owner = rule.parent; owner && owner.type !== 'root'; owner = owner.parent) {
      if (owner.type !== 'atrule') return false;
      if (owner.name === 'scope') return owner.params === options.scopeBoundary;
      if (!['layer', 'container', 'media', 'supports'].includes(owner.name)) return false;
    }
    return false;
  }
  sheet.walkRules((rule) => {
    if (rule.parent?.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) return;
    let scoped = false;
    try {
      scoped = selectorsAreScoped(
        css.parse(rule.selector, { context: 'selectorList' }),
        options.scopes,
        verifiedScope(rule),
      );
    } catch {}
    if (!scoped)
      report(
        'style/scope',
        baseLine + rule.source.start.line - 1,
        options.component ? componentScopeContext(rule, context) : context,
        'selector',
        rule.selector,
      );
  });
  sheet.walkDecls((decl) => {
    const palette = options.component && /var\(\s*--uld-palette(?:-|(?=[),]))/.test(decl.value);
    const verdict = familyDefault(decl);
    if (palette || verdict === false || (verdict !== true && literalIssue(decl.prop, decl.value, options))) {
      const selector = decl.parent.selector ?? '@' + (decl.parent.name ?? 'rule');
      report(
        palette ? 'style/palette' : 'style/token',
        baseLine + decl.source.start.line - 1,
        context + ' ' + selector,
        decl.prop,
        decl.value,
      );
    }
    // A web sheet may not declare a native-only token under any published spelling.
    // A declaration already reported above is not reported twice.
    else if (options.nativeVariables?.has(decl.prop))
      report('style/token', baseLine + decl.source.start.line - 1,
        context + ' ' + (decl.parent.selector ?? '@' + (decl.parent.name ?? 'rule')), decl.prop, decl.value);
  });
}
