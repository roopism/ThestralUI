export function validateTokens(source) {
  const tokens = new Map();
  const errors = [];
  function collect(group, prefix = '', type) {
    for (const [key, child] of Object.entries(group)) {
      if (key.startsWith('$')) continue;
      const path = prefix ? prefix + '.' + key : key;
      if (!child || typeof child !== 'object') {
        errors.push('Invalid token at ' + path);
        continue;
      }
      const childType = child.$type ?? type;
      if ('$value' in child) tokens.set(path, { type: childType, value: child.$value });
      else collect(child, path, childType);
    }
  }
  collect(source);
  const resolved = new Set();
  function resolve(path, stack = new Set()) {
    if (resolved.has(path)) return;
    const token = tokens.get(path);
    if (!token) {
      errors.push('Missing alias ' + path);
      return;
    }
    if (stack.has(path)) {
      errors.push('Cyclic alias ' + [...stack, path].join(' -> '));
      return;
    }
    const { type, value } = token;
    const alias = typeof value === 'string' && /^\{([^{}]+)\}$/.exec(value);
    if (alias) {
      const target = tokens.get(alias[1]);
      if (target && type !== target.type) errors.push('Alias type mismatch at ' + path);
      resolve(alias[1], new Set([...stack, path]));
    } else {
      const good =
        (type === 'number' && Number.isFinite(value)) ||
        (type === 'duration' &&
          value?.unit === 'ms' &&
          Number.isFinite(value.value) &&
          value.value >= 0) ||
        (type === 'dimension' && value?.unit === 'px' && Number.isFinite(value.value)) ||
        (type === 'color' &&
          value?.colorSpace === 'srgb' &&
          value.alpha === 1 &&
          value.components?.length === 3 &&
          value.components.every((n) => Number.isFinite(n) && n >= 0 && n <= 1));
      if (!good) errors.push('Unsupported token type or value at ' + path);
    }
    resolved.add(path);
  }
  for (const key of tokens.keys()) resolve(key);
  const roles = (theme) =>
    [...tokens]
      .filter(([name]) => name.startsWith(theme + '.'))
      .map(([name, token]) => name.slice(theme.length + 1) + ':' + token.type)
      .sort();
  if (!roles('light').length || roles('light').join('|') !== roles('dark').join('|'))
    errors.push('Light and dark themes require identical, typed role sets.');
  return errors;
}
