import assert from 'node:assert/strict';
import { globSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import postcss from 'postcss';

const manifest = JSON.parse(await readFile('package.json', 'utf8'));
const sheets = new Map(
  Object.keys(manifest.exports)
    .filter(entry => entry.endsWith('.css'))
    .map(entry => [basename(entry, '.css'), []]),
);

// Family source files own their rules. Numbered blocks retain the cascade of
// the original public entry, including its whitespace. The last newline of
// a numbered block separates source annotations and is omitted on assembly.
// An unnumbered block appends a family's new rules as written.
for (const file of globSync('src/**/*.css').sort()) {
  const source = await readFile(file, 'utf8');
  const headers = [...source.matchAll(/^\/\* @uld-css-chunk ([\w-]+)(?:\.(\d+))? \*\/\n/gm)];
  assert.equal(headers[0]?.index, 0, 'Declare the public stylesheet at the start of ' + file);
  for (const [index, header] of headers.entries()) {
    const [, sheet, sequence] = header;
    const blocks = sheets.get(sheet);
    assert.ok(blocks, 'Unknown public stylesheet in ' + file + ': ' + sheet);
    const position = sequence ? Number(sequence) : Infinity;
    assert.ok(!sequence || !blocks.some(block => block.position === position),
      'Duplicate cascade position ' + sheet + '.' + sequence);
    const css = source.slice(header.index + header[0].length, headers[index + 1]?.index);
    if (sequence) assert.ok(css.endsWith('\n'), 'Terminate the numbered block in ' + file);
    blocks.push({ position, css: sequence ? css.slice(0, -1) : '\n' + css.trimEnd() });
  }
}

for (const [sheet, blocks] of sheets) {
  assert.ok(blocks.length, 'No source rules for ' + sheet);
  blocks.sort((a, b) => a.position - b.position);
  const styles = postcss.parse(blocks.map(block => block.css).join(''), { from: undefined });
  const imports = [];
  const explicit = [];
  for (const rule of [...styles.nodes]) {
    if (rule.type !== 'atrule') continue;
    if (rule.name === 'import') imports.push(rule.remove().toString() + ';');
    if (rule.name === 'layer') {
      assert.ok(['uld.reset', 'uld.utilities'].includes(rule.params) && rule.nodes,
        'Declare reset or utility rules in their named layer. Component rules inherit uld.components.');
      explicit.push(rule.remove().toString());
    }
  }
  const importsTokens = imports.some(rule => /^@import ['"]@ui-lazy-dev\/tokens\/styles\.css['"];$/u.test(rule));
  const css = [
    ...(importsTokens ? [] : ['@layer uld.reset, uld.tokens, uld.components, uld.utilities;']),
    ...imports,
    ...explicit,
    '@layer uld.components {',
    styles.toString().trim(),
    '}',
    '',
  ].join('\n');
  await writeFile(join('dist', sheet + '.css'), css);
}
