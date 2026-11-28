import { readFileSync } from 'node:fs';
import { nativeOnlyToken, resolveValue } from '../resolve-value.mjs';

const defaultDocument = new URL('./system.resolver.json', import.meta.url);
const privateGroups = new Set(['palette', 'light', 'dark', 'highContrast']);
const read = url => JSON.parse(readFileSync(url, 'utf8'));

function collect(group, tokens, path = '', inheritedType) {
  const type = group.$type ?? inheritedType;
  if (Object.hasOwn(group, '$value')) {
    if (!path || !type) throw Error('A token requires a name and type: ' + path);
    // Native-only tokens belong to the native entry, not to any mode, brand or sheet.
    if (nativeOnlyToken(group, path)) return;
    tokens.set(path, { $type: type, $value: group.$value });
    return;
  }
  for (const [key, child] of Object.entries(group)) {
    if (key.startsWith('$')) continue;
    if (!child || typeof child !== 'object' || /[.{}]/.test(key) || ['__proto__', 'constructor', 'prototype'].includes(key))
      throw Error('Invalid token group or name: ' + key);
    collect(child, tokens, path ? path + '.' + key : key, type);
  }
}

export function readModeSystem(url = defaultDocument) {
  const document = read(url);
  if (document.version !== '2025.10') throw Error('Unsupported token resolver version: ' + document.version);
  const axes = Object.fromEntries(Object.entries(document.modifiers)
    .map(([name, modifier]) => [name, Object.keys(modifier.contexts)]));
  const defaults = Object.fromEntries(Object.entries(document.modifiers)
    .map(([name, modifier]) => [name, modifier.default]));
  const sources = new Map();
  function load(source) {
    if (!source.$ref) return source;
    const uri = new URL(source.$ref, url);
    if (uri.protocol !== 'file:' || uri.hash) throw Error('Expected a local token source: ' + source.$ref);
    if (!sources.has(uri.href)) sources.set(uri.href, read(uri));
    return sources.get(uri.href);
  }

  function resolveModes(inputs = {}, contextual) {
    const mode = { ...defaults, ...inputs };
    for (const [axis, value] of Object.entries(mode)) {
      if (axis === 'mode' && contextual && value === contextual.name) continue;
      if (!axes[axis]?.includes(value)) throw Error('Unknown token mode: ' + axis + '=' + value);
    }
    const tokens = new Map();
    for (const item of document.resolutionOrder) {
      const match = /^#\/(sets|modifiers)\/([^/]+)$/.exec(item.$ref);
      if (!match) throw Error('Unsupported token set reference: ' + item.$ref);
      const [, kind, name] = match;
      const entry = document[kind][name];
      if (!entry) throw Error('Missing token set: ' + item.$ref);
      if (kind === 'modifiers' && name === 'mode' && contextual && mode.mode === contextual.name) {
        const allowed = new Set(contextual.overrides);
        const entries = Object.entries(contextual.tokens);
        if (allowed.size !== entries.length) throw Error('Undeclared or unused contextual override');
        for (const [path, value] of entries) {
          const type = tokens.get(path)?.$type;
          if (!allowed.has(path) || !type || privateGroups.has(path.split('.')[0]))
            throw Error('Undeclared contextual token: ' + path);
          let raw = value;
          if (typeof value === 'number' && (type === 'dimension' || type === 'duration'))
            raw = { value, unit: type === 'duration' ? 'ms' : 'px' };
          if (type === 'color' && typeof value === 'string' && /^#[a-f\d]{6}([a-f\d]{2})?$/i.test(value)) {
            const channels = value.slice(1).match(/../g).map(byte => parseInt(byte,16) / 255);
            raw = { colorSpace: 'srgb', components: channels.slice(0,3), alpha: channels[3] ?? 1 };
          }
          tokens.set(path, { $type: type, $value: raw });
        }
        continue;
      }
      const selected = kind === 'sets' ? entry.sources : entry.contexts[mode[name]];
      for (const source of selected) collect(load(source), tokens);
    }
    const values = {};
    const types = {};
    for (const [path, token] of tokens) {
      const parts = path.split('.');
      if (privateGroups.has(parts[0])) continue;
      const key = parts.pop();
      let valueGroup = values;
      let typeGroup = types;
      for (const part of parts) {
        valueGroup = valueGroup[part] ??= {};
        typeGroup = typeGroup[part] ??= {};
      }
      valueGroup[key] = resolveValue(name => tokens.get(name), path);
      typeGroup[key] = token.$type;
    }
    return { mode, values, types };
  }
  return { axes, defaults, resolveModes };
}
