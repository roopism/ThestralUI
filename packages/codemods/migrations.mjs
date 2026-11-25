import { migrateButtonIcons } from './button-icon-slots.mjs';

// Only exact, reviewed diagnostics belong here. The first migration is additive.
export const migrations = [
  {
    from: '0.2.0',
    to: '0.3.0-rc.1',
    entry: 'web/index',
    id: 'button-icon-slots',
    diagnostics: [],
    transform: migrateButtonIcons,
  },
];

export function checkMigration({ entry, from, to, diagnostic }, records = migrations) {
  const matches = records.filter((record) => record.entry === entry &&
    record.from === from && record.to === to && record.diagnostics.includes(diagnostic));
  if (matches.length !== 1) {
    throw new Error(entry + ': ' + diagnostic +
      ' needs one scoped codemod or a "no automatic migration" note explaining the manual edit.');
  }
  const [record] = matches;
  if (typeof record.transform === 'function' && record.id) return;
  if (typeof record.manual === 'string' && /^no automatic migration:\s*\S/i.test(record.manual)) return;
  throw new Error(entry + ': supply an executable codemod or a "no automatic migration" note with instructions.');
}
