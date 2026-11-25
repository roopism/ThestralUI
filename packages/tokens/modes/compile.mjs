// Store a base and the axis combinations that change each semantic value.
// Optional brands have their own payload shared by the platform runtimes.
export function flattenTokens(groups, prefix = '', result = {}) {
  for (const [key, value] of Object.entries(groups)) {
    const path = prefix ? prefix + '.' + key : key;
    if (value && typeof value === 'object') flattenTokens(value, path, result);
    else result[path] = value;
  }
  return result;
}

function combinations(axes, names) {
  let result = [{}];
  for (const name of names)
    result = result.flatMap(mode => axes[name].map(value => ({ ...mode, [name]: value })));
  return result;
}

export function compileBrand(system, brand) {
  const { axes, defaults, resolveModes } = system;
  const names = ['scheme', 'density', 'motion'];
  const baseSet = resolveModes({ brand });
  const base = flattenTokens(baseSet.values);
  const types = flattenTokens(baseSet.types);
  const samples = combinations(axes, names).map(mode => ({
    mode, values: flattenTokens(resolveModes({ ...mode, brand }).values),
  }));
  const rules = new Map();
  for (const [path, defaultValue] of Object.entries(base)) {
    // Factor out an axis only when changing it alone never changes this token.
    const varying = names.filter(axis => samples.some(sample => samples.some(other =>
      sample.values[path] !== other.values[path] &&
      names.every(name => name === axis || sample.mode[name] === other.mode[name]))));
    for (const when of combinations(axes, varying)) {
      const sample = samples.find(({mode}) => varying.every(axis => mode[axis] === when[axis]));
      if (sample.values[path] === defaultValue) continue;
      const key = JSON.stringify(when);
      if (!rules.has(key)) rules.set(key, { when, tokens: {} });
      rules.get(key).tokens[path] = sample.values[path];
    }
  }
  return { brand, defaults: { ...defaults, brand }, base, types, rules: [...rules.values()] };
}

export function cssName(path) {
  const [group, ...parts] = path.split('.');
  const legacy = ['color', 'size', 'motion', 'space', 'density', 'type', 'shape', 'elevation'];
  const name = (legacy.includes(group) && parts.length === 1 ? parts : [group, ...parts]).join('-');
  return '--uld-' + name.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase());
}
export function cssValue(type, value) {
  if (typeof value === 'string' && value.startsWith('{')) return 'var(' + cssName(value.slice(1, -1)) + ')';
  return String(value) + (type === 'dimension' ? 'px' : type === 'duration' ? 'ms' : '');
}
const marker = (axis, value) => '--uld-if-' + axis + '-' + value;
const allScopes = ':where([data-uld-theme], [data-uld-scheme], [data-uld-density], [data-uld-motion], [data-uld-mode], [data-uld-brand])';
export const forcedColors = {
  canvas: 'Canvas', surface: 'Canvas', text: 'CanvasText', muted: 'CanvasText', border: 'ButtonText',
  accent: 'Highlight', onAccent: 'HighlightText', focus: 'Highlight', selected: 'Highlight',
  disabled: 'GrayText', danger: 'CanvasText', success: 'CanvasText', warning: 'CanvasText',
};

// A standalone brand can be the first stylesheet loaded on the page.
export function tokenLayer(css) {
  return '@layer uld.reset;\n@layer uld.tokens {\n' + css.trimEnd() +
    '\n}\n@layer uld.components, uld.utilities;\n';
}

export function axisStyles(system) {
  const { axes, defaults } = system;
  const rules = [];
  const markers = (axis, selected) => axes[axis].map(value =>
    '  ' + marker(axis, value) + ': ' + (value === selected ? ' ' : 'initial') + ';');
  for (const axis of ['scheme', 'density', 'motion']) {
    rules.push(':root {', ...markers(axis, defaults[axis]), '}');
    if (axis === 'motion') rules.push('@media (prefers-reduced-motion: reduce) {',
      '  :root {', ...markers(axis, 'reduced'), '  }', '}');
    for (const value of axes[axis]) {
      const scope = '[data-uld-' + axis + '="' + value + '"]';
      const legacy = axis === 'scheme' && value !== 'high-contrast'
        ? ', [data-uld-theme="' + value + '"]:not([data-uld-scheme])' : '';
      rules.push(scope + legacy + ' {', ...markers(axis, value));
      if (axis === 'scheme') rules.push('  color-scheme: ' + (value === 'dark' ? 'dark' : 'light') + ';');
      rules.push('}');
    }
  }
  rules.push('@media (forced-colors: active) {', '  :root {',
    ...Object.entries(forcedColors).map(([key, value]) => '    --uld-forced-' + key + ': ' + value + ';'), '  }', '}');
  return rules.join('\n') + '\n';
}

// CSS checks both sides of var() fallbacks for cycles. Select a conditional alias
// with the cascade so two valid schemes may use the same tokens in opposite directions.
function aliasSelectors(when, defaults) {
  let selectors = [{ selector: '', queries: [], media: '' }];
  for (const [axis, value] of Object.entries(when)) {
    const attr = '[data-uld-' + axis;
    const own = attr + '="' + value + '"]';
    const unset = axis === 'scheme' ? ':not([data-uld-scheme], [data-uld-theme])' : ':not(' + attr + '])';
    const selected = axis === 'scheme' && value !== 'high-contrast'
      ? ':is(' + own + ', [data-uld-theme="' + value + '"]:not([data-uld-scheme]))' : own;
    const options = [
      { selector: selected }, { selector: unset, query: 'style(' + marker(axis, value) + ')' },
    ];
    if (axis === 'motion')
      options.push({ selector: ':root' + unset, media: '(prefers-reduced-motion: ' + (value === 'reduced' ? 'reduce' : 'no-preference') + ')' });
    else if (defaults[axis] === value) options.push({ selector: ':root' + unset });
    selectors = selectors.flatMap(previous => options.map(option => ({
      selector: previous.selector + ':where(' + option.selector + ')',
      queries: option.query ? [...previous.queries, option.query] : previous.queries,
      media: option.media || previous.media,
    })));
  }
  return selectors;
}

export function brandStyles(compiled, defaultBrand = 'enterprise') {
  const { brand, base, types, rules } = compiled;
  const aliasPaths = new Set([base, ...rules.map(rule => rule.tokens)]
    .flatMap(patch => Object.keys(patch).filter(path =>
      typeof patch[path] === 'string' && patch[path].startsWith('{'))));
  const self = '[data-uld-brand="' + brand + '"]';
  const start = brand === defaultBrand ? ':root:not([data-uld-brand]), ' + self : self;
  const css = ['@scope (' + start + ') to ([data-uld-brand]:not(' + self + ')) {', '  :scope, ' + allScopes + ' {'];
  for (const [path, value] of Object.entries(base)) {
    const property = cssName(path);
    let expression = cssValue(types[path], value);
    if (aliasPaths.has(path)) {
      css.push('    ' + property + '-source: ' + expression + ';');
      expression = 'var(' + property + '-source)';
    }
    for (const [index, rule] of rules.entries()) {
      if (aliasPaths.has(path) || !Object.hasOwn(rule.tokens, path)) continue;
      const flags = Object.entries(rule.when).map(([axis, value]) => 'var(' + marker(axis, value) + ')').join(' ');
      const choice = property + '-choice-' + index;
      css.push('    ' + choice + ': ' + flags + ' ' + cssValue(types[path], rule.tokens[path]) + ';');
      expression = 'var(' + choice + ', ' + expression + ')';
    }
    const role = path.startsWith('color.') && path.slice(6);
    if (role && Object.hasOwn(forcedColors, role)) expression = 'var(--uld-forced-' + role + ', ' + expression + ')';
    if (path === 'size.control' || path === 'density.compactTarget') {
      css.push('    ' + property + '-preferred: ' + expression + ';');
      expression = 'var(' + property + '-preferred)';
    }
    css.push('    ' + property + ': ' + expression + ';');
  }
  css.push('  }');
  for (const rule of rules) {
    const declarations = Object.entries(rule.tokens).filter(([path]) => aliasPaths.has(path))
      .map(([path, value]) => cssName(path) + '-source: ' + cssValue(types[path], value) + ';');
    if (!declarations.length) continue;
    for (const { selector, queries, media } of aliasSelectors(rule.when, compiled.defaults)) {
      if (media) css.push('  @media ' + media + ' {');
      if (queries.length) css.push('  @container ' + queries.join(' and ') + ' {');
      css.push('  :is(:scope, ' + allScopes + ')' + selector + ' { ' + declarations.join(' ') + ' }');
      if (queries.length) css.push('  }');
      if (media) css.push('  }');
    }
  }
  css.push('  @media (any-pointer: coarse) {', '    :scope, ' + allScopes + ' {',
    '      --uld-control: max(var(--uld-control-preferred), var(--uld-coarse-target));',
    '      --uld-compact-target: max(var(--uld-compact-target-preferred), var(--uld-coarse-target));',
    '    }', '  }', '}');
  return css.join('\n') + '\n';
}

// Recompute contextual aliases at nested axis boundaries so they inherit the
// selected child's semantic tokens even when its scheme differs from its parent.
export function contextPatchStyles(context, types) {
  const self = '[data-uld-mode="' + context.name + '"]';
  // A context replaces the brand declaration on this scope. Removing the old
  // value from the cascade also removes its dependencies from the alias graph.
  const scope = ':is(:scope, ' + allScopes + ')';
  const lines = ['@scope (' + self + ') to ([data-uld-mode]:not(' + self + ')) {', '  ' + scope + scope + ' {'];
  for (const [path, value] of Object.entries(context.tokens)) {
    const property = cssName(path);
    let expression = cssValue(types[path], value);
    const role = path.split('.')[1];
    if (path.startsWith('color.') && Object.hasOwn(forcedColors, role))
      expression = 'var(--uld-forced-' + role + ', ' + expression + ')';
    if (path === 'size.control' || path === 'density.compactTarget') {
      // The brand's public target already enforces the coarse pointer minimum.
      lines.push('    ' + property + '-preferred: ' + expression + ';');
    } else lines.push('    ' + property + ': ' + expression + ';');
  }
  lines.push('  }', '}');
  return lines.join('\n') + '\n';
}
