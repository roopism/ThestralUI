import { cssName, forcedColors, tokenLayer } from './modes/compile.mjs';
import { modeOutputs } from './modes/outputs.mjs';
import { resolveValue } from './resolve-value.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const domainNames = ['color', 'space', 'density', 'shape', 'motion', 'type', 'elevation', 'layer', 'chart'];
// Preserve the order published by v0.2 consumers, including the three legacy size aliases.
const groupsInPublicOrder = ['palette', 'light', 'dark', 'size', 'motion', 'space', 'density', 'type', 'shape', 'elevation'];
const source = new Map();
for (const domain of domainNames) {
  const path = new URL('./domains/' + domain + '.json', import.meta.url);
  // JSON numbers can have distinct published spellings, such as 1 and 1.0.
  const domainSource = JSON.parse(await readFile(path, 'utf8'), (_key, value, context) =>
    typeof value === 'number' ? JSON.rawJSON(context.source) : value,
  );
  for (const [group, leaves] of Object.entries(domainSource)) {
    if (!source.has(group)) source.set(group, {});
    const target = source.get(group);
    for (const [name, token] of Object.entries(leaves)) {
      if (Object.hasOwn(target, name)) throw Error('Duplicate token: ' + group + '.' + name);
      target[name] = token;
    }
  }
}
const rawGroups = Object.fromEntries(
  [...new Set([...groupsInPublicOrder, ...source.keys()])]
    .filter(name => source.has(name))
    .map(name => [name, source.get(name)]),
);
const rawPath = new URL('./tokens.json', import.meta.url);
const rawJson = JSON.stringify(rawGroups, null, 2) + '\n';
const tokens = JSON.parse(rawJson);
if (process.argv.includes('--write-source')) await writeFile(rawPath, rawJson);
else if (await readFile(rawPath, 'utf8') !== rawJson)
  throw Error('Stale public tokens.json. Run node packages/tokens/build.mjs --write-source.');

const tokenAt = path => path.split('.').reduce((group, key) => group?.[key], tokens);
const resolve = path => resolveValue(tokenAt, path);
function group(name) {
  return Object.fromEntries(
    Object.keys(tokens[name]).map((key) => [key, resolve(name + '.' + key)]),
  );
}
const groups = Object.fromEntries(
  Object.keys(tokens)
    .filter((key) => key !== 'palette')
    .map((key) => [key, group(key)]),
);
const { light, dark } = groups;
if (Object.keys(light).sort().join() !== Object.keys(dark).sort().join())
  throw new Error('Theme roles differ');
function variables(name, values) {
  return Object.keys(values).sort()
    .map((key) => {
      const value = values[key];
      const token = tokens[name][key];
      const unit =
        token.$type === 'dimension' || token.$type === 'duration' ? token.$value.unit : '';
      const cssName = key.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase());
      return '  --uld-' + cssName + ': ' + value + unit + ';';
    })
    .join('\n');
}
const dir = new URL('./dist/', import.meta.url);
await mkdir(dir, { recursive: true });
const manifest = JSON.stringify(groups, null, 2);
const base = Object.keys(groups)
  .filter((name) => name !== 'light' && name !== 'dark')
  .sort()
  .concat('light')
  .map((name) => variables(name, groups[name]))
  .join('\n');
const styles = tokenLayer([
  ':root, [data-uld-theme="light"] {',
  base,
  '}',
  '[data-uld-theme="dark"] {',
  variables('dark', dark),
  '}',
  '@media (forced-colors: active) {',
  '  :root, [data-uld-theme] {',
  ...Object.keys(forcedColors).sort().map(role =>
    '    ' + cssName('color.' + role) + ': ' + forcedColors[role] + ';'),
  '  }',
  '}',
].join('\n'));
const outputs = {
  'index.js': 'export const tokens = ' + manifest + ';\n',
  'index.d.ts': 'export declare const tokens: ' + manifest + ';\n',
  'styles.css': styles,
  ...modeOutputs(),
};
for (const [file, contents] of Object.entries(outputs)) {
  const path = new URL(file, dir);
  if (process.argv.includes('--check')) {
    if ((await readFile(path, 'utf8')) !== contents)
      throw new Error('Stale token artifact: ' + file);
  } else {
    await mkdir(new URL('./', path), { recursive: true });
    await writeFile(path, contents);
  }
}
