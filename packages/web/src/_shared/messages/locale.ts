// Generated from packages/messages by renderer.mjs.
/** Keep a valid caller locale, including its requested numbering system. */
export function canonicalLocale(input?: string): string {
  try {
    return Intl.getCanonicalLocales(input)[0] ?? 'en';
  } catch {
    return 'en';
  }
}
