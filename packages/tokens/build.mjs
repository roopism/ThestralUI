import { cssName, forcedColors, tokenLayer } from './modes/compile.mjs';
import { modeOutputs } from './modes/outputs.mjs';
import { resolveValue } from './resolve-value.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { nativeOnlyToken } from './resolve-value.mjs';

const domainNames = ['color', 'space', 'density', 'shape', 'motion', 'type', 'elevation', 'layer', 'chart'];
// Preserve the order published by v0.2 consumers, including the three legacy size aliases.
const groupsInPublicOrder = ['palette', 'light', 'dark', 'size', 'motion', 'space', 'density', 'type', 'shape', 'elevation'];
// Native-only leaves stay out of tokens.json, the web token object, the modes and every sheet.
const native = new Map();
const source = new Map();
for (const domain of domainNames) {
  const path = new URL('./domains/' + domain + '.json', import.meta.url);
  // JSON numbers can have distinct published spellings, such as 1 and 1.0.
  const domainSource = JSON.parse(await readFile(path, 'utf8'), (_key, value, context) =>
    typeof value === 'number' ? JSON.rawJSON(context.source) : value,
  );
  for (const [group, leaves] of Object.entries(domainSource)) {
    for (const [name, token] of Object.entries(leaves)) {
      const channel = nativeOnlyToken(token, group + '.' + name) ? native : source;
      if (!channel.has(group)) channel.set(group, {});
      const target = channel.get(group);
      if (Object.hasOwn(target, name) || Object.hasOwn(source.get(group) ?? {}, name) || Object.hasOwn(native.get(group) ?? {}, name))
        throw Error('Duplicate token: ' + group + '.' + name);
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
// A native token may alias any token. A web token may not alias a native-only token.
const nativeRaw = JSON.parse(JSON.stringify(Object.fromEntries([...native].sort(([a], [b]) => a < b ? -1 : 1))));
const nativePath = path => Object.hasOwn(nativeRaw[path.split('.')[0]] ?? {}, path.split('.').slice(1).join('.'));
const anyAt = path => nativePath(path) ? path.split('.').reduce((group, key) => group?.[key], nativeRaw) : tokenAt(path);
for (const [name, leaves] of Object.entries(tokens)) for (const [key, token] of Object.entries(leaves)) {
  if (nativeOnlyToken(token, name + '.' + key)) throw Error('Native-only token in the web token object: ' + name + '.' + key);
  if (token.$type === 'fontFamily') throw Error('A font family token is native-only: ' + name + '.' + key);
  for (let target = token.$value, seen = 0; typeof target === 'string' && /^\{[^{}]+\}$/.test(target) && seen < 64; seen++) {
    if (nativePath(target.slice(1, -1))) throw Error('A web token cannot alias the native-only token ' + target + ': ' + name + '.' + key);
    target = tokenAt(target.slice(1, -1))?.$value;
  }
}
// A scaled native dimension is a web dimension times a web number, such as a type size times
// the body leading. The native theme recomputes it for every resolved brand, scheme, density,
// motion and context, so it follows the same source as the web sheet.
const scaleKey = 'ui-lazy-dev.scale';
const scaled = {};
for (const [name, leaves] of Object.entries(nativeRaw)) for (const [key, token] of Object.entries(leaves)) {
  const scale = token.$extensions?.[scaleKey];
  if (scale === undefined) continue;
  const base = /^\{([^{}]+)\}$/.exec(token.$value)?.[1], factor = /^\{([^{}]+)\}$/.exec(scale)?.[1];
  if (token.$type !== 'dimension' || tokenAt(base ?? '')?.$type !== 'dimension' || tokenAt(factor ?? '')?.$type !== 'number')
    throw Error('A scaled native token multiplies a web dimension alias by a web number: ' + name + '.' + key);
  scaled[name + '.' + key] = [base, factor];
}
const product = (size, factor) => Math.round(size * factor * 100) / 100;
const nativeGroups = Object.fromEntries(Object.entries(nativeRaw).map(([name, leaves]) => [name,
  Object.fromEntries(Object.keys(leaves).sort().map(key => {
    const path = name + '.' + key;
    const value = resolveValue(anyAt, path);
    return [key, scaled[path] ? product(value, resolve(scaled[path][1])) : value];
  }))]));
// Fail when a native-only token reaches any web output, under any published spelling:
// a sheet variable (leaf or path), a flat mode path or a nested token object member.
const kebab = text => text.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase());
const literal = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const leaks = Object.entries(nativeGroups).flatMap(([name, leaves]) => Object.keys(leaves).map(key => {
  const variables = ['--uld-' + kebab(key), cssName(name + '.' + key), '--uld-' + kebab(name + '-' + key)];
  return { path: name + '.' + key, sheet: new RegExp('(?:' + variables.map(literal).join('|') + ')(?![\\w-])'),
    script: new RegExp(literal('"' + name + '.' + key + '"') + '|' + literal('"' + name + '"') +
      '\\s*:\\s*\\{[^{}]*' + literal('"' + key + '"') + '\\s*:') };
}));
function assertWebOutput(file, contents) {
  for (const { path, sheet, script } of leaks)
    if ((file.endsWith('.css') ? sheet : script).test(contents))
      throw Error('Native-only token ' + path + ' leaked into the web output ' + file);
}
// The native entry is the only output that carries native-only tokens.
const nativeManifest = JSON.stringify(nativeGroups, null, 2);
const nativeShape = '{ ' + Object.entries(nativeGroups).map(([name, leaves]) => JSON.stringify(name) + ': { ' +
  Object.entries(leaves).map(([key, value]) => JSON.stringify(key) + ': ' + typeof value).join('; ') + ' }').join('; ') + ' }';
const nativeOutputs = {
  'native.js': [
    "import { createTheme } from './modes/index.js';",
    'export const nativeTokens = ' + nativeManifest + ';',
    'const scaled = ' + JSON.stringify(scaled) + ';',
    'const at = (tokens, path) => path.split(\'.\').reduce((node, key) => node?.[key], tokens);',
    '// Add the native-only tokens to a resolved mode, recomputing each scaled dimension from it.',
    'export function withNativeTokens(tokens) {',
    '  const result = { ...tokens };',
    '  for (const [group, leaves] of Object.entries(nativeTokens)) result[group] = { ...leaves };',
    '  for (const [path, [size, factor]] of Object.entries(scaled)) {',
    '    const [group, key] = path.split(\'.\');',
    '    result[group][key] = Math.round(at(tokens, size) * at(tokens, factor) * 100) / 100;',
    '  }',
    '  return result;',
    '}',
    'export function createNativeTheme(options) {',
    '  const theme = createTheme(options);',
    '  return Object.freeze({ resolve(selection) { const { mode, tokens } = theme.resolve(selection); return { mode, tokens: withNativeTokens(tokens) }; } });',
    '}',
    '',
  ].join('\n'),
  'native.d.ts': [
    "import type { BrandDefinition, ContextDefinition, Mode, ModeSelection, ResolvedTokens } from './modes/index.js';",
    'export declare const nativeTokens: ' + nativeManifest + ';',
    'export type NativeResolvedTokens = ResolvedTokens & ' + nativeShape + ';',
    'export declare function withNativeTokens(tokens: ResolvedTokens): NativeResolvedTokens;',
    'export declare function createNativeTheme(options?: { brands?: readonly BrandDefinition[]; modes?: readonly ContextDefinition[] }): {',
    '  resolve(selection?: ModeSelection): { mode: Mode; tokens: NativeResolvedTokens };',
    '};',
    '',
  ].join('\n'),
};
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
  assertWebOutput(file, contents);
  const path = new URL(file, dir);
  if (process.argv.includes('--check')) {
    if ((await readFile(path, 'utf8')) !== contents)
      throw new Error('Stale token artifact: ' + file);
  } else {
    await mkdir(new URL('./', path), { recursive: true });
    await writeFile(path, contents);
  }
}
for (const [file, contents] of Object.entries(nativeOutputs)) {
  const path = new URL(file, dir);
  if (process.argv.includes('--check')) {
    if ((await readFile(path, 'utf8')) !== contents) throw new Error('Stale token artifact: ' + file);
  } else await writeFile(path, contents);
}
