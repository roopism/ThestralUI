import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { familyBindings, readDeclaredApi, specFilename } from './declarations.mjs';

export const apiColumns = ['Export', 'Prop', 'Type', 'Default', 'Ownership', 'Ref target'];
export const hostLabel = 'Host attributes';

function code(value) {
  const cell = String(value).replace(/\s+/g, ' ').trim().replaceAll('|', '\\|');
  // Markdown inline-code delimiters must be longer than any backtick run in a type.
  const fence = '`'.repeat(
    1 + Math.max(0, ...Array.from(cell.matchAll(/`+/g), (match) => match[0].length)),
  );
  const pad = cell.includes('`') ? ' ' : '';
  return fence + pad + cell + pad + fence;
}

function ownership(prop, ref, props) {
  if (ref) return 'Caller reference';
  if (/^on[A-Z]/.test(prop)) return 'Caller callback';
  if (/^default[A-Z]/.test(prop)) return 'Uncontrolled initial value';
  const stem = /^is[A-Z]/.test(prop) ? prop.slice(2) : prop[0].toUpperCase() + prop.slice(1);
  if (props.has('default' + stem)) return 'Controlled value';
  if (prop === 'children') return 'Caller content';
  return 'Caller input';
}

// By default a table lists the library's own contract and counts the platform's
// standard attributes in one row. `host: true` renders every attribute, which is the
// earlier format and stays valid until all specs are regenerated.
export function renderApiRows(bindings, declarations, details, { host = false } = {}) {
  const lines = [
    '| ' + apiColumns.join(' | ') + ' |',
    '| ' + apiColumns.map(() => '---').join(' | ') + ' |',
  ];
  for (const key of bindings) {
    let inherited = 0;
    for (const [prop, type] of declarations.get(key)) {
      const info = details.get(key)?.get(prop);
      assert.ok(info, 'Missing declaration metadata for ' + key + '.' + prop);
      if (info.host && !host) {
        inherited++;
        continue;
      }
      const refs = [...info.refs];
      const value = info.defaults.size
        ? [...info.defaults].map(code).join(' or ')
        : info.optional
          ? 'Unspecified'
          : info.conditional
            ? 'Required in matching shape'
            : 'Required';
      lines.push(
        '| ' +
          [
            code(key),
            code(prop),
            code(type),
            value,
            ownership(prop, refs.length, declarations.get(key)),
            refs.length ? refs.map(code).join(' or ') : '—',
          ].join(' | ') +
          ' |',
      );
    }
    if (inherited)
      lines.push(
        '| ' +
          [
            code(key),
            hostLabel,
            inherited + ' standard platform attribute' + (inherited === 1 ? '' : 's') + ', not listed',
            'Unspecified',
            'Caller input',
            '—',
          ].join(' | ') +
          ' |',
      );
  }
  return lines.join('\n');
}

function tableRange(text) {
  const section = /^(### API[ \t]*\n)([\s\S]*?)(?=^#{2,4} |(?![\s\S]))/m.exec(text);
  if (!section) return;
  const table = /^\|[ \t]*Export[ \t]*\|.*(?:\n\|[^\n]*)*(?:\n<!-- declaration-rows -->)?/m.exec(
    section[2],
  );
  if (!table) return;
  const start = section.index + section[1].length + table.index;
  return [start, start + table[0].length];
}

export function currentApiTable(text) {
  const range = tableRange(text);
  return range ? text.slice(...range) : '';
}

export function replaceApiTable(text, table) {
  const range = tableRange(text);
  assert.ok(range, 'Spec requires a table starting with Export in the API section');
  return text.slice(0, range[0]) + table + text.slice(range[1]);
}

export function syncApiTables(root, consumer, families, write) {
  families = families.filter((family) => familyBindings(family).length);
  const details = new Map();
  const declarations = readDeclaredApi(consumer, families, details);
  const changed = [];
  for (const family of families) {
    const filename = specFilename(family.id);
    const path = join(root, 'docs/components', filename);
    const text = readFileSync(path, 'utf8');
    const next = replaceApiTable(
      text,
      renderApiRows(familyBindings(family), declarations, details),
    );
    if (next !== text) {
      changed.push(filename);
      if (write) writeFileSync(path, next);
    }
  }
  return changed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, consumer] = process.argv.slice(2);
  assert.ok(
    ['--check', '--write'].includes(mode) && consumer,
    'Usage: tables.mjs --check|--write <installed-packed-consumer>',
  );
  const root = process.cwd();
  const { families } = await import(pathToFileURL(join(root, 'docs/component-inventory.mjs')));
  const changed = syncApiTables(root, consumer, families, mode === '--write');
  console.log(mode, changed.length, 'generated API table(s)', ...changed);
  if (mode === '--check' && changed.length) process.exitCode = 1;
}
