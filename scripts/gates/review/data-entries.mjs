import { isDeepStrictEqual } from 'node:util';
import yaml from 'js-yaml';

const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
const limitKey = /budget|limit|allowance|threshold|ceiling|max(?:imum|[A-Z_-])/i;

// The incumbent already checks deletion, numeric limits and named rules. In an
// anonymous registration the nested selector and its options are its identity.
// Match each prior occurrence separately. Additional complete entries are fine.
function retains(old, next, anonymous = false, limit = false) {
  if (isDeepStrictEqual(old, next)) return true;
  if (Array.isArray(old)) {
    if (!Array.isArray(next)) return false;
    if (anonymous) return old.length === next.length &&
      old.every((value, index) => retains(value, next[index], true, limit));
    const available = next.slice();
    for (const entry of old) {
      if (!object(entry) && !Array.isArray(entry)) continue;
      const identified = object(entry) && typeof entry.id === 'string';
      const index = available.findIndex(candidate =>
        (!identified || candidate?.id === entry.id) && retains(entry, candidate, !identified, limit));
      if (index < 0) return false;
      available.splice(index, 1);
    }
    return true;
  }
  if (object(old)) {
    if (!object(next)) return false;
    if (anonymous && (Object.keys(next).length !== Object.keys(old).length ||
        Object.keys(next).some(key => !Object.hasOwn(old, key)))) return false;
    return Object.entries(old).every(([key, value]) =>
      retains(value, next[key], anonymous, limit || limitKey.test(key)));
  }
  return !anonymous || (limit && typeof old === 'number' && typeof next === 'number' && next <= old);
}

export function losesAnonymousEntry(path, before, after) {
  if (path.endsWith('.json')) return !retains(JSON.parse(before), JSON.parse(after));
  const previous = yaml.safeLoadAll(before), current = yaml.safeLoadAll(after);
  return previous.some((document, index) => !retains(document, current[index]));
}
