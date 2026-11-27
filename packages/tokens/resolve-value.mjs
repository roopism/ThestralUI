// Resolve aliases after all selected sets are merged. Both renderers consume
// the same numeric dimensions, millisecond durations and sRGB colors.
export function resolveValue(lookup, path, expectedType, seen = new Set()) {
  const token = lookup(path);
  if (!token || seen.has(path)) throw Error('Missing or cyclic token: ' + path);
  const type = token.$type;
  if (expectedType && expectedType !== type) throw Error('Alias type mismatch: ' + path);
  const value = token.$value;
  if (typeof value === 'string' && /^\{[^{}]+\}$/.test(value)) {
    seen.add(path);
    return resolveValue(lookup, value.slice(1, -1), type, seen);
  }
  if (type === 'color' && value?.colorSpace === 'srgb' &&
    Array.isArray(value.components) && value.components.length === 3) {
    const channels = [...value.components];
    if (value.alpha !== undefined && value.alpha !== 1) channels.push(value.alpha);
    if (channels.every(n => Number.isFinite(n) && n >= 0 && n <= 1))
      return '#' + channels.map(n => Math.round(n * 255).toString(16).padStart(2, '0')).join('');
  }
  if (type === 'dimension' && value?.unit === 'px' && Number.isFinite(value.value)) return value.value;
  if (type === 'duration' && value?.unit === 'ms' && Number.isFinite(value.value) && value.value >= 0)
    return value.value;
  if (type === 'number' && Number.isFinite(value)) return value;
  // A font family is a single native family name. Web sheets keep their own stacks.
  if (type === 'fontFamily' && nativeOnlyToken(token, path) && typeof value === 'string' && /\S/.test(value)) return value;
  throw Error('Unsupported token: ' + path);
}

// A token marked for the native channel compiles into the native entry only:
// never into tokens.json, the web token object, the modes or any sheet.
// Themes and the source palette are shared with web sheets and cannot opt out.
export const platformsKey = 'ui-lazy-dev.platforms';
export function nativeOnlyToken(token, path) {
  const platforms = token?.$extensions?.[platformsKey];
  if (platforms === undefined) return false;
  if (!Array.isArray(platforms) || platforms.length !== 1 || platforms[0] !== 'native' ||
    ['palette', 'light', 'dark', 'highContrast'].includes(path.split('.')[0]))
    throw Error('Unsupported token platform channel: ' + path);
  return true;
}
