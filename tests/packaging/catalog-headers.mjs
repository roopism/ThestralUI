import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));

// These static deployment routes use literal paths or one anonymous regular expression.
export function catalogHeaders(pathname) {
  const headers = {};
  for (const route of config.headers) {
    const matches = route.source.startsWith('/(')
      ? new RegExp('^' + route.source + '$').test(pathname)
      : pathname === route.source;
    if (!matches) continue;
    for (const { key, value } of route.headers) {
      const name = key.toLowerCase();
      if (Object.hasOwn(headers, name)) throw Error('Overlapping catalog header ' + name);
      headers[name] = value;
    }
  }
  return headers;
}
