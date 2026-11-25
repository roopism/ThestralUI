const platformsKey = 'ui-lazy-dev.platforms';
const kebab = name => name.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase());
// The root sheet names a token by its leaf and the mode sheets by its full path.
export const webVariables = path => [...new Set(['--uld-' + kebab(path.split('.').pop()),
  '--uld-' + kebab(path.replace(/\./g, '-'))])];
const aliasOf = value => typeof value === 'string' && /^\{([^{}]+)\}$/.exec(value)?.[1];
function goodValue(type, value) {
  return (type === 'number' && Number.isFinite(value)) ||
    (type === 'duration' && value?.unit === 'ms' && Number.isFinite(value.value) && value.value >= 0) ||
    (type === 'dimension' && value?.unit === 'px' && Number.isFinite(value.value)) ||
    (type === 'color' && value?.colorSpace === 'srgb' && value.alpha === 1 && value.components?.length === 3 &&
      value.components.every((n) => Number.isFinite(n) && n >= 0 && n <= 1));
}

/**
 * Native-only tokens are declared in the token sources with the native platform
 * marker and published only by '@ui-lazy-dev/tokens/native'. They never enter the
 * web manifest, so web sources cannot read them and web sheets cannot declare them.
 */
export function nativeTokens(sources, web) {
  const tokens = new Map(), errors = [];
  for (const source of sources) for (const [group, leaves] of Object.entries(source ?? {})) {
    if (!leaves || typeof leaves !== 'object') continue;
    for (const [key, token] of Object.entries(leaves)) {
      if (!token || typeof token !== 'object' || token.$extensions?.[platformsKey] === undefined) continue;
      const path = group + '.' + key, platforms = token.$extensions[platformsKey];
      if (!Array.isArray(platforms) || platforms.length !== 1 || platforms[0] !== 'native' ||
          ['palette', 'light', 'dark'].includes(group) || !('$value' in token))
        errors.push('Unsupported native-only token at ' + path);
      else if (tokens.has(path) || web?.[group]?.[key]) errors.push('Duplicate native-only token at ' + path);
      else tokens.set(path, token);
    }
  }
  const webPaths = Object.entries(web ?? {}).filter(([group]) => group !== 'palette')
    .flatMap(([group, leaves]) => Object.keys(leaves).map(key => group + '.' + key));
  const typeAt = path => tokens.get(path)?.$type ?? path.split('.').reduce((node, key) => node?.[key], web)?.$type;
  for (const [path, { $type: type, $value: value, $extensions: extensions }] of tokens) {
    // A scaled token multiplies a web dimension alias by a web number in every mode.
    const scale = extensions['ui-lazy-dev.scale'];
    const webType = alias => alias && !tokens.has(alias) ? alias.split('.').reduce((node, key) => node?.[key], web)?.$type : undefined;
    if (scale !== undefined && (type !== 'dimension' || webType(aliasOf(value)) !== 'dimension' || webType(aliasOf(scale)) !== 'number'))
      errors.push('Unsupported scaled native-only token at ' + path);
    const target = aliasOf(value);
    if (target ? !typeAt(target) || typeAt(target) !== type
      : !(goodValue(type, value) || (type === 'fontFamily' && typeof value === 'string' && /\S/.test(value))))
      errors.push('Unsupported native-only token type or value at ' + path);
  }
  const shared = new Set(webPaths.flatMap(webVariables));
  for (const path of tokens.keys())
    if (webVariables(path).some(name => shared.has(name))) errors.push('Native-only token shares a web variable name at ' + path);
  for (const path of webPaths) {
    const target = aliasOf(path.split('.').reduce((node, key) => node?.[key], web)?.$value);
    if (target && tokens.has(target)) errors.push('A web token cannot alias the native-only token at ' + path);
  }
  return { errors, paths: [...tokens.keys()].sort(), variables: new Set([...tokens.keys()].flatMap(webVariables)) };
}

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
      // The web manifest never carries a native-only token. See nativeTokens().
      if (child.$extensions?.[platformsKey] !== undefined) errors.push('Native-only token in the web token manifest at ' + path);
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
