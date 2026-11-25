import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { readDeclaredApi } from '../quality/specs/declarations.mjs';
import { renderApiRows, replaceApiTable } from '../quality/specs/tables.mjs';
import { auditComponentSpecs } from '../quality/specs/validate.mjs';

test('standard platform attributes are counted, and the library contract stays listed', (t) => {
  const consumer = mkdtempSync(join(tmpdir(), 'ui-spec-host-'));
  t.after(() => rmSync(consumer, { recursive: true, force: true }));
  const write = (name, manifest, file, source) => {
    const dir = join(consumer, 'node_modules', name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, ...manifest }));
    writeFileSync(join(dir, file), source);
  };
  write(
    '@types/react',
    { types: 'index.d.ts' },
    'index.d.ts',
    'export interface HTMLAttributes { title?: string; hidden?: boolean; className?: string; children?: unknown }',
  );
  write(
    '@react-types/shared',
    { types: 'index.d.ts' },
    'index.d.ts',
    [
      'export interface GlobalDOMEvents { onClick?(): void }',
      'export interface PressEvents { onPress?(): void }',
    ].join('\n'),
  );
  write(
    '@ui-lazy-dev/ui-web',
    { exports: { '.': { types: './entry.d.ts' } } },
    'entry.d.ts',
    [
      "import type { HTMLAttributes } from 'react';",
      "import type { GlobalDOMEvents, PressEvents } from '@react-types/shared';",
      "interface Own { tone?: 'primary'; title?: string }",
      'export declare function Notice(props: HTMLAttributes & GlobalDOMEvents & PressEvents & Own): string;',
    ].join('\n'),
  );
  const info = new Map();
  const declared = readDeclaredApi(consumer, [{ id: 'Notice', exports: ['.:Notice'] }], info);
  assert.deepEqual(
    Object.fromEntries([...info.get('.:Notice')].map(([name, record]) => [name, record.host])),
    {
      children: false,
      className: false,
      hidden: true,
      onClick: true,
      onPress: false,
      title: false,
      tone: false,
    },
  );
  // The declared surface is unchanged: every attribute is still read from the release.
  assert.equal(declared.get('.:Notice').size, 7);
  const table = renderApiRows(['.:Notice'], declared, info);
  assert.doesNotMatch(table, /`hidden`|`onClick`/);
  for (const prop of ['children', 'className', 'onPress', 'title', 'tone'])
    assert.match(table, new RegExp('`' + prop + '`'));
  assert.match(
    table,
    /\| `\.:Notice` \| Host attributes \| 2 standard platform attributes, not listed \|/,
  );
  const complete = renderApiRows(['.:Notice'], declared, info, { host: true });
  assert.match(complete, /`hidden`/);
  assert.doesNotMatch(complete, /Host attributes/);
});

test('a spec may omit standard platform attributes but never a library property', (t) => {
  const corpus = join(import.meta.dirname, 'fixtures');
  const support = JSON.parse(readFileSync(join(corpus, 'notice.json'), 'utf8'));
  const body = readFileSync(join(corpus, 'notice.md'), 'utf8');
  const root = mkdtempSync(join(tmpdir(), 'ui-spec-host-audit-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = (path, contents) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), contents);
  };
  for (const [path, contents] of Object.entries(support.files)) put(path, contents);
  const props = new Map([...Object.entries(support.declarations), ['hidden', 'boolean | undefined']]);
  const record = (host) => ({ optional: true, defaults: new Set(), refs: new Set(), host });
  const shapes = new Map([['.:Notice', props]]);
  const info = new Map([
    ['.:Notice', new Map([...props.keys()].map((prop) => [prop, record(prop === 'hidden')]))],
  ]);
  const codes = (table) => {
    put('docs/components/notice.md', replaceApiTable(body, table));
    return auditComponentSpecs({
      root,
      families: [support.family],
      declarations: shapes,
      details: info,
    }).issues.map((issue) => issue.code);
  };
  const short = renderApiRows(['.:Notice'], shapes, info);
  const complete = renderApiRows(['.:Notice'], shapes, info, { host: true });
  assert.match(short, /Host attributes \| 1 standard platform attribute, not listed/);
  assert.deepEqual(codes(short), []);
  assert.deepEqual(codes(complete), []);
  // A changed count, a wrong type on a listed platform attribute and a missing library
  // property are all still rejected.
  assert.deepEqual(codes(short.replace('| 1 standard', '| 3 standard')), ['api-generated']);
  assert.ok(
    codes(complete.replace('`hidden` | `boolean', '`hidden` | `string')).includes('prop-type'),
  );
  const withoutTitle = short
    .split('\n')
    .filter((line) => !line.includes('`title`'))
    .join('\n');
  assert.ok(codes(withoutTitle).includes('prop-missing'));
});

test('only verified scenario IDs in their states-matrix cell are neutral contract references', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'ui-spec-scenario-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const corpus = join(import.meta.dirname, 'fixtures');
  const support = JSON.parse(readFileSync(join(corpus, 'notice.json'), 'utf8'));
  const original = readFileSync(join(corpus, 'notice.md'), 'utf8')
    .replace('"family": "Notice"', '"family": "Data table"')
    .replace('[notice.read](notice.scenarios.yaml)', '[data-table.read](data-table.scenarios.yaml)');
  for (const [path, contents] of Object.entries(support.files)) {
    const dest = join(root, path.replace('notice.scenarios.yaml', 'data-table.scenarios.yaml'));
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, path.endsWith('.scenarios.yaml')
      ? JSON.stringify({ family: 'Data table', scenarios: [{ id: 'data-table.read' }] }) : contents);
  }
  const audit = (source) => {
    writeFileSync(join(root, 'docs/components/data-table.md'), source);
    return auditComponentSpecs({
      root,
      families: [{ ...support.family, id: 'Data table' }],
      declarations: new Map([['.:Notice', new Map(Object.entries(support.declarations))]]),
      details: new Map([['.:Notice', new Map([['title', { optional: true, defaults: new Set(), refs: new Set(), host: false }]])]]),
    }).issues;
  };
  const focused = issues => issues.filter(issue => ['state-scenario', 'contract-language'].includes(issue.code)).map(issue => issue.code);
  assert.deepEqual(focused(audit(original)), []);
  for (const change of [
    ['Readable content', 'Hook into data-row'],
    ['Readable content', '[data-table.read](data-table.scenarios.yaml)'],
    ['One presentation.', 'Inspect data-table to change its state.'],
  ]) assert.deepEqual(focused(audit(original.replace(...change))), ['contract-language']);
  assert.deepEqual(focused(audit(original.replace('data-table.read]', 'data-table.unknown]'))).sort(),
    ['contract-language', 'state-scenario']);
  assert.deepEqual(focused(audit(original.replace('](data-table.scenarios.yaml)', '](elsewhere.md)'))).sort(),
    ['contract-language', 'state-scenario']);
});
