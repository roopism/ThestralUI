// A binding ID contains the public entry and export. Native root IDs predate
// subpaths and keep the native:Name spelling used by existing consumers.
export function isNativeBinding(binding) {
  return /^native(?:\/|:)/.test(binding);
}

export function specifier(binding) {
  const [entry, name] = binding.split(':');
  if (!entry || !name) throw Error('Invalid registry binding ' + binding);
  if (isNativeBinding(binding)) return '@ui-lazy-dev/ui-native' + entry.slice('native'.length);
  return '@ui-lazy-dev/ui-web' + (entry === '.' ? '' : '/' + entry);
}

export function entryName(pkg, subpath) {
  if (pkg === '@ui-lazy-dev/ui-native') return 'native' + (subpath === '.' ? '' : subpath.slice(1));
  return subpath === '.' ? '.' : subpath.slice(2);
}
