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
  throw Error('Unsupported token: ' + path);
}
