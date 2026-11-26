// Renderers ship their own compiled files. Check both against the same locale implementation and catalog sources.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (file) => readFileSync(join(root, 'messages', file), 'utf8');
const option = process.argv[2];
assert.ok(option === '--check' || option === '--write', 'Pass --check or --write');
function output(file, body) {
  const target = join(root, file);
  const source = '// Generated from packages/messages by renderer.mjs.\n' + body;
  if (option === '--check') assert.equal(readFileSync(target, 'utf8'), source, 'Stale locale module ' + file);
  else {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, source);
  }
}
for (const renderer of ['web', 'native']) output(renderer + '/src/_shared/messages/locale.ts', read('locale.ts'));

const locales = Object.keys(JSON.parse(read('locales.json')));
const prefix = 'commandPalette.';
function labels(locale) {
  const messages = JSON.parse(read('locales/' + locale + '.json'));
  return Object.fromEntries(Object.entries(messages)
    .filter(([key]) => key.startsWith(prefix))
    .map(([key, text]) => [key.slice(prefix.length), text]));
}
const keys = Object.keys(labels('en')).sort();
const lines = ['export function commandLabels(locale: string) {', "  const [language, variant] = locale.split('-');", '  switch (language) {'];
for (const locale of locales) {
  const messages = labels(locale);
  assert.deepEqual(Object.keys(messages).sort(), keys, 'Incomplete command palette labels for ' + locale);
  lines.push("    case '" + locale.split('-')[0] + "':");
  if (locale === 'zh-Hans') lines.push("      if (['Hant', 'HK', 'MO', 'TW'].includes(variant)) break;");
  lines.push('      return ' + JSON.stringify(messages, null, 2).replaceAll('\n', '\n      ') + ';');
}
lines.push('  }', '}', '');
output('web/src/command-palette/messages.ts', lines.join('\n'));
