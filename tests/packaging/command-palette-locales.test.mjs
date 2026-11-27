import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';

for (const [group, path] of [
  ['source', 'packages/web/src/_shared/messages/locale.ts'],
  ['source', 'packages/messages/locale.ts'],
  ['source', 'packages/messages/renderer.mjs'],
  ['nativeSource', 'packages/native/src/_shared/messages/locale.ts'],
]) {
  test('shared ' + group + ' registers ' + path, () => {
    const { files } = JSON.parse(readFileSync('manifests/shared.json', 'utf8'));
    assert.ok(files[group].includes(path), path);
  });
}

test('the English palette entry excludes every other command catalog from its initial imports', async () => {
  // The qualification snapshot already built these packages before the unit roster.
  if (process.env.UI_GATE_SNAPSHOT !== '1') execFileSync('npm', ['run', 'build:packages'], { stdio: 'inherit' });
  const result = await build({
    stdin: { contents: "export { CommandPalette } from '@ui-lazy-dev/ui-web/workflows'", resolveDir: process.cwd() },
    bundle: true, splitting: true, format: 'esm', platform: 'browser', charset: 'utf8',
    external: ['react', 'react-dom'], outdir: 'out', write: false, metafile: true,
  });
  const outputs = new Map(Object.entries(result.metafile.outputs).map(([path, output]) => [resolve(path), output]));
  const initial = new Set();
  function visit(path) {
    if (initial.has(path)) return;
    initial.add(path);
    for (const item of outputs.get(path).imports) {
      if (!item.external && item.kind !== 'dynamic-import') visit(resolve(item.path));
    }
  }
  const entry = [...outputs].find(([, output]) => output.entryPoint === '<stdin>');
  assert.ok(entry, 'Missing consumer entry');
  visit(entry[0]);
  const initialCode = result.outputFiles.filter(file => initial.has(file.path)).map(file => file.text).join('\n');
  const read = path => JSON.parse(readFileSync('packages/messages/' + path, 'utf8'));
  const locales = Object.keys(read('locales.json'));
  const english = read('locales/en.json');
  const keys = ['commandPalette.search', 'commandPalette.empty', 'commandPalette.close'];
  for (const key of keys) assert.ok(initialCode.includes(english[key]), 'English entry lacks ' + key);
  const seenChunks = new Set();
  for (const locale of locales.filter(locale => locale !== 'en')) {
    const messages = read('locales/' + locale + '.json');
    const search = messages['commandPalette.search'];
    for (const key of keys) {
      if (messages[key] !== english[key]) assert.ok(!initialCode.includes(messages[key]), locale + ' ' + key + ' in the English entry');
    }
    const chunks = result.outputFiles.filter(file => file.text.includes(search));
    assert.equal(chunks.length, 1, locale + ' requires one catalog chunk');
    for (const key of keys) assert.ok(chunks[0].text.includes(messages[key]), locale + ' chunk lacks ' + key);
    assert.ok(!seenChunks.has(chunks[0].path), locale + ' shares a chunk with another language');
    seenChunks.add(chunks[0].path);
  }
});
