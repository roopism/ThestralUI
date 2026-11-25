import { enterprise } from './brands/enterprise.js';

import { axes } from './axes.js';

function validatePatch(patch, types) {
  for (const [path, value] of Object.entries(patch)) {
    if (!Object.hasOwn(types, path)) throw Error('Unknown semantic token: ' + path);
    const type = types[path];
    if (typeof value === 'string' && /^\{[\w.-]+\}$/.test(value)) {
      if (types[value.slice(1, -1)] !== type) throw Error('Alias type mismatch: ' + path);
      continue;
    }
    if (type === 'color' && typeof value === 'string' && /^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(value)) continue;
    if (['duration','dimension','number'].includes(type) && Number.isFinite(value) && (type !== 'duration' || value >= 0)) continue;
    throw Error('Invalid ' + type + ' token value for ' + path);
  }
}

function named(id) {
  if (typeof id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(id)) throw Error('Invalid mode name: ' + id);
  return id;
}

export function registerBrand(name, overrides = {}, parent = enterprise) {
  named(name);
  const base = { ...parent.base, ...overrides.base };
  validatePatch(overrides.base ?? {}, parent.types);
  const rules = [...parent.rules];
  for (const key of Object.keys(overrides))
    if (key !== 'base' && !Object.hasOwn(axes, key)) throw Error('Unknown brand axis: ' + key);
  for (const key of Object.keys(axes)) {
    for (const [value, patch] of Object.entries(overrides[key] ?? {})) {
      if (!axes[key].includes(value)) throw Error('Unknown ' + key + ': ' + value);
      validatePatch(patch, parent.types);
      rules.push({ when: { [key]: value }, tokens: { ...patch } });
    }
  }
  return { brand: name, defaults: { ...parent.defaults, brand: name }, types: { ...parent.types }, base, rules };
}

function index(items, key) {
  const map = new Map();
  for (const item of items) {
    const name = named(item[key]);
    if (map.has(name)) throw Error('Duplicate mode registration: ' + name);
    map.set(name, item);
  }
  return map;
}

function nestedValues(flat) {
  const result = {};
  function valueAt(path, seen = new Set()) {
    const value = flat[path];
    if (typeof value !== 'string' || !value.startsWith('{')) return value;
    if (seen.has(path)) throw Error('Cyclic semantic alias: ' + path);
    seen.add(path);
    return valueAt(value.slice(1, -1), seen);
  }
  for (const path of Object.keys(flat)) {
    const parts = path.split('.');
    const name = parts.pop();
    let group = result;
    for (const part of parts) group = group[part] ??= {};
    group[name] = valueAt(path);
  }
  return result;
}

function validateBrand(brand) {
  const types = enterprise.types;
  validatePatch(brand.base, types);
  for (const [path, type] of Object.entries(types)) {
    if (!Object.hasOwn(brand.base, path) || brand.types[path] !== type)
      throw Error('Incomplete brand definition: ' + path);
  }
  for (const rule of brand.rules) {
    for (const [axis, selected] of Object.entries(rule.when))
      if (!Object.hasOwn(axes, axis) || !axes[axis].includes(selected))
        throw Error('Invalid brand rule: ' + axis + '=' + selected);
    validatePatch(rule.tokens, types);
  }
}

export function createTheme({ brands = [], modes = [] } = {}) {
  for (const brand of brands) validateBrand(brand);
  const brandIndex = index([enterprise, ...brands].map(brand => ({
    ...brand, defaults: { ...brand.defaults }, base: { ...brand.base }, rules: brand.rules.map(rule =>
      ({ when: { ...rule.when }, tokens: { ...rule.tokens } })),
  })), 'brand');
  const modeIndex = index(modes.map(mode => ({
    ...mode, tokens: { ...mode.tokens }, overrides: [...mode.overrides],
  })), 'name');
  for (const [name, context] of modeIndex) {
    if (name === 'default') throw Error('The default contextual mode is reserved');
    validatePatch(context.tokens, enterprise.types);
    const declared = new Set(context.overrides);
    if (declared.size !== context.overrides.length || declared.size !== Object.keys(context.tokens).length ||
      Object.keys(context.tokens).some(path => !declared.has(path))) throw Error('Contextual token declaration mismatch: ' + name);
  }
  function resolve(selection = {}) {
    const mode = { ...brandIndex.get('enterprise').defaults };
    for (const [axis, value] of Object.entries(selection)) {
      if (!Object.hasOwn(mode, axis)) throw Error('Unknown mode axis: ' + axis);
      if (value !== undefined) mode[axis] = value;
    }
    const brand = brandIndex.get(mode.brand);
    if (!brand) throw Error('Unregistered brand: ' + mode.brand);
    for (const [axis, values] of Object.entries(axes))
      if (!values.includes(mode[axis])) throw Error('Unknown ' + axis + ': ' + mode[axis]);
    const tokens = { ...brand.base };
    for (const rule of brand.rules)
      if (Object.entries(rule.when).every(([axis, value]) => mode[axis] === value)) Object.assign(tokens, rule.tokens);
    if (mode.mode !== 'default') {
      const context = modeIndex.get(mode.mode);
      if (!context) throw Error('Unregistered contextual mode: ' + mode.mode);
      Object.assign(tokens, context.tokens);
    }
    return { mode, tokens: nestedValues(tokens) };
  }
  // A later axis can introduce a cycle that is absent in the default scheme.
  // Concrete compiled brands need no additional resolution during registration.
  const hasAlias = patch => Object.values(patch).some(value =>
    typeof value === 'string' && value.startsWith('{'));
  for (const brand of brandIndex.values()) {
    const aliases = hasAlias(brand.base) || brand.rules.some(rule => hasAlias(rule.tokens));
    for (const mode of ['default', ...modeIndex.keys()]) {
      if (!aliases && !hasAlias(modeIndex.get(mode)?.tokens ?? {})) continue;
      for (const scheme of axes.scheme) for (const density of axes.density)
        for (const motion of axes.motion) resolve({ brand: brand.brand, mode, scheme, density, motion });
    }
  }
  return Object.freeze({ resolve });
}

export { enterprise };
export const defaultTheme = createTheme();
