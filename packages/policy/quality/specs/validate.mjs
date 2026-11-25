import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { apiColumns, currentApiTable, hostLabel, renderApiRows } from './tables.mjs';
import { isNativeBinding, specifier } from '../binding-entry.mjs';
import { familyBindings, readDeclaredApi, specFilename } from './declarations.mjs';

import { readContract } from './contract.mjs';

const statuses = ['draft', 'experimental', 'stable', 'deprecated'];
const platforms = ['web', 'native'];
const inactive = ['planned', 'unsupported', 'equivalent', 'excluded'];
const platformStatuses = new Set([...statuses, ...inactive, 'supported', 'exported']);
const isString = (v) => typeof v === 'string' && v.trim().length > 0;
const unwrap = (cell) => {
  const code = /^(`+)([\s\S]+?)\1$/.exec(cell);
  if (!code || code[2].includes(code[1])) return cell;
  return code[2].trim();
};
const listEqual = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
function readMetadata(text, family, bindings, report) {
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(text);
  if (!match) {
    report('frontmatter', 'Begin with JSON object frontmatter between --- lines.');
    return { body: text };
  }
  const body = text.slice(match[0].length);
  let meta;
  try {
    meta = JSON.parse(match[1]);
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) throw Error('Expected mapping');
  } catch (error) {
    report('frontmatter', error.message);
    return { body };
  }
  if (meta.family !== family.id) report('family', 'Expected inventory family ' + family.id);
  if (!statuses.includes(meta.status)) report('status', 'Unknown spec status');
  if (!isString(meta.owner) || (family.owner && meta.owner !== family.owner))
    report('owner', 'Use the owner recorded in the family inventory.');
  if (
    typeof meta.since !== 'string' ||
    !/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*)?(?:\+[\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*)?$/.test(
      meta.since,
    )
  )
    report('since', 'Expected the first semantic release version.');
  if (!listEqual(Object.keys(meta.platforms ?? {}).sort(), ['native', 'web']))
    report('platforms', 'Declare both web and native status.');
  const records = bindings.map((key) => ({
    platform: isNativeBinding(key) ? 'native' : 'web',
    name: key.split(':')[1],
    from: specifier(key),
  }));
  for (const platform of platforms) {
    const status = meta.platforms?.[platform];
    const published = records.some((record) => record.platform === platform);
    if (!platformStatuses.has(status) || published === inactive.includes(status))
      report('platforms', 'Status for ' + platform + ' must agree with its exports.');
  }
  const exportKey = (value) => JSON.stringify([value?.platform, value?.name, value?.from]);
  if (
    !Array.isArray(meta.exports) ||
    !listEqual(meta.exports.map(exportKey).sort(), records.map(exportKey).sort())
  )
    report('exports', 'List each published name, platform and exact import path.');
  const serverBindings = [];
  for (const binding of Array.isArray(meta.exports) ? meta.exports : []) {
    if (binding?.platform !== 'web') continue;
    if (binding.rendering === 'server-safe') serverBindings.push(binding);
    else if (binding.rendering !== 'client-only' && (meta.status === 'stable' || binding.rendering !== undefined))
      report('rendering', 'Classify ' + binding.name + ' as server-safe or client-only.');
  }
  if (
    !Array.isArray(meta.reference) ||
    !meta.reference.length ||
    !meta.reference.every(
      (url) => typeof url === 'string' && URL.canParse(url) && new URL(url).protocol === 'https:',
    )
  )
    report('reference', 'Provide HTTPS reference-library links.');
  return { body, status: meta.status, nativeStatus: meta.platforms?.native, serverBindings };
}

// Count a public binding only when the server page actually uses its imported symbol.
function serverFixtureBindings(root) {
  const path = join(root, 'tests/packaging/fixture/app/foundations/page.js');
  const used = new Set();
  if (!existsSync(path)) return used;
  const program = ts.createProgram([path], {
    allowJs: true, jsx: ts.JsxEmit.Preserve, noResolve: true, noLib: true, types: [],
  });
  const source = program.getSourceFile(path);
  const checker = program.getTypeChecker();
  const imports = new Map();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const names = statement.importClause?.namedBindings;
    if (!names || !ts.isNamedImports(names)) continue;
    for (const item of names.elements) {
      const name = (item.propertyName ?? item.name).text;
      imports.set(checker.getSymbolAtLocation(item.name), statement.moduleSpecifier.text + '#' + name);
    }
  }
  function visit(node) {
    const target = ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)
      ? node.tagName : ts.isCallExpression(node) ? node.expression : undefined;
    if (target && ts.isIdentifier(target)) {
      const key = imports.get(checker.getSymbolAtLocation(target));
      if (key) used.add(key);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return used;
}

function table(body, header, report) {
  const rows = body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|'))
    .map((line) =>
      line
        .replace(/^\||\|$/g, '')
        .split(/(?<!\\)\|/)
        .map((s) => unwrap(s.trim().replace(/\\\|/g, '|'))),
    );
  if (
    !listEqual(rows.shift() ?? [], header) ||
    !(rows[0]?.length === header.length && rows[0].every((c) => /^:?-{3,}:?$/.test(c)))
  ) {
    report('table', 'Expected columns ' + header.join(', '));
    return [];
  }
  const data = rows.slice(1);
  for (const row of data)
    if (row.length !== header.length || row.some((cell) => !cell.trim()))
      report('table', 'Fill all columns in row ' + (row[0] || '(unnamed)'));
  return data.filter((row) => row.length === header.length);
}

function propertyRows(body, bindings, declarations, report, details) {
  const seen = new Map(bindings.map((key) => [key, new Set()]));
  const expectedCount = bindings.reduce((sum, key) => sum + declarations.get(key).size, 0);
  const rows = expectedCount || body.includes('|') ? table(body, apiColumns, report) : [];
  for (const [binding, prop, type] of rows) {
    // The generated comparison below verifies the count in a host summary row.
    if (prop === hostLabel && seen.has(binding)) continue;
    if (!seen.has(binding) || !declarations.get(binding).has(prop)) {
      report('prop-extra', binding + '.' + prop + ' is absent from declarations for this family.');
      continue;
    }
    if (seen.get(binding).has(prop))
      report('prop-duplicate', binding + '.' + prop + ' appears twice.');
    seen.get(binding).add(prop);
    if (type !== declarations.get(binding).get(prop))
      report('prop-type', binding + '.' + prop + ' has changed declaration type.');
  }
  for (const binding of bindings) {
    for (const prop of declarations.get(binding).keys()) {
      if (!seen.get(binding).has(prop) && !details.get(binding)?.get(prop)?.host)
        report('prop-missing', binding + '.' + prop + ' is undocumented.');
    }
  }
}

function tokenPaths(tokens, parts = [], out = new Set()) {
  for (const [key, value] of Object.entries(tokens)) {
    if (key.startsWith('$') || !value || typeof value !== 'object') continue;
    const path = [...parts, key];
    if (Object.hasOwn(value, '$value')) out.add(path.join('.'));
    else tokenPaths(value, path, out);
  }
  return out;
}

function verifyTokens(body, tokens, report) {
  const withoutDefaults = body.replace(/\[[^\]\n]*\]/g, '');
  if (
    /(?:#[\da-f]{3,8}\b|(?:^|[^\w.])-?(?:\d+(?:\.\d*)?|\.\d+)\s*(?:px|ms)\b)/i.test(withoutDefaults)
  )
    report('token-literal', 'Put resolved px, hex and ms defaults inside brackets.');
  const textPaths = withoutDefaults
    .replace(/\]\([^)]*\)/g, ']')
    .matchAll(/`([\w-]+(?:\.[\w-]+)+)`/g);
  for (const [, path] of textPaths)
    if (!tokens.has(path)) report('token-unknown', 'Unknown token ' + path);
  if (!body.includes('|')) return;
  for (const [, value] of table(body, ['Part or state', 'Token'], report)) {
    const refs = value.replace(/\[[^\]\n]*\]/g, '').match(/[\w-]+(?:\.[\w-]+)+/g) ?? [];
    if (!refs.length || refs.some((path) => !tokens.has(path)))
      report('token-unknown', 'Use declared token paths for ' + value);
  }
}

function testRanges(target, cache) {
  if (cache.has(target)) return cache.get(target);
  const source = readFileSync(target, 'utf8');
  const ranges = [];
  if (/\.ya?ml$/.test(target)) {
    if (/^---[ \t]*$[\s\S]*^- (?:assertVisible|assertNotVisible|runFlow)\b/m.test(source))
      ranges.push([1, source.split('\n').length]);
  } else {
    const tree = ts.createSourceFile(target, source, ts.ScriptTarget.Latest, true);
    function visit(node) {
      if (ts.isCallExpression(node)) {
        const callee = node.expression.getText(tree);
        if (/^(?:test|it)(?:\.concurrent|\.only|\.serial)?(?:\.each\([\s\S]*\))?$/.test(callee)) {
          const first = tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1;
          const last = tree.getLineAndCharacterOfPosition(node.end).line + 1;
          ranges.push([first, last]);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(tree);
  }
  cache.set(target, ranges);
  return ranges;
}

function localTests(text, file, root, cache) {
  return [...text.matchAll(/\[[^\]\n]+\]\(([^\s)]+)\)/g)].map((match) => {
    const [href, anchor] = match[1].split('#');
    if (!href || isAbsolute(href) || /^[a-z][a-z\d+.-]*:/i.test(href)) return null;
    const target = resolve(dirname(file), href);
    if (!existsSync(target) || !statSync(target).isFile()) return null;
    const repoPath = relative(root, realpathSync(target));
    if (
      !/^(?:tests\/|packages\/[^/]+\/tests?\/)/.test(repoPath) ||
      !/(?:\.(?:test|spec|visual)\.[cm]?[jt]sx?$|^tests\/simulator\/[^/]+\.ya?ml$)/.test(repoPath)
    )
      return null;
    const ranges = testRanges(target, cache);
    if (!anchor) return ranges.length ? repoPath : null;
    const lines = /^L(\d+)(?:-L?(\d+))?$/.exec(anchor);
    return lines &&
      ranges.some(
        ([lo, hi]) =>
          lo <= Number(lines[1]) &&
          Number(lines[1]) <= Number(lines[2] ?? lines[1]) &&
          Number(lines[2] ?? lines[1]) <= hi,
      )
      ? repoPath
      : null;
  });
}

function bindingTests(body, file, root, cache, report) {
  const tests = [];
  for (const match of body.matchAll(/\[[^\]\n]+\]\(([^\s)]+)\)/g)) {
    const href = match[1].split('#')[0];
    // Bindings can also cite a catalog story or their neutral scenarios.
    if (/\.stories\.[cm]?[jt]sx?$|\.scenarios\.yaml$/.test(href)) {
      if (!existsSync(resolve(dirname(file), href)))
        report('test-link', 'Missing reference ' + href);
      continue;
    }
    const [test] = localTests(match[0], file, root, cache);
    if (test) tests.push(test);
    else report('test-link', 'Link to an executed test or a line inside its case: ' + match[1]);
  }
  return tests;
}

export function auditComponentSpecs({
  root = process.cwd(),
  consumer,
  families,
  declarations,
  selectedIds,
  details = new Map(),
}) {
  root = realpathSync(root);
  const published = families.filter((family) => familyBindings(family).length);
  const rows = selectedIds ? published.filter(row => selectedIds.includes(row.id)) : published;
  if (selectedIds && new Set(rows.map(row => row.id)).size !== selectedIds.length)
    throw Error('Scoped spec selection contains unregistered or duplicate families');
  declarations ??= readDeclaredApi(consumer, rows, details, { scoped: selectedIds !== undefined, universe: published });
  const directory = join(root, 'docs/components');
  const tokens = tokenPaths(
    JSON.parse(readFileSync(join(root, 'packages/tokens/tokens.json'), 'utf8')),
  );
  if (existsSync(join(root, 'packages/tokens/modes/system.resolver.json'))) {
    const fromConsumer = createRequire(join(consumer ? resolve(consumer) : root, 'package.json'));
    const { enterprise } = fromConsumer('@ui-lazy-dev/tokens/brands/enterprise');
    for (const path of Object.keys(enterprise.types)) tokens.add(path);
  }
  const stats = Object.fromEntries(statuses.map((status) => [status, 0]));
  const issues = [];
  let complete = 0;
  const testCache = new Map();
  let serverFixture;
  const files = new Set(published.map((f) => specFilename(f.id)));
  if (files.size !== published.length) throw Error('Family IDs must have unique spec filenames');
  for (const entry of existsSync(directory) ? readdirSync(directory) : []) {
    if (entry.endsWith('.md') && entry !== '_template.md' && !files.has(entry))
      issues.push({
        family: entry,
        code: 'spec-extra',
        message: 'Spec does not belong to an exported family.',
      });
  }
  for (const family of rows) {
    const bindings = familyBindings(family);
    const file = join(directory, specFilename(family.id));
    const start = issues.length;
    const report = (code, message) => issues.push({ family: family.id, code, message });
    if (!existsSync(file)) {
      report('spec-missing', 'Missing ' + relative(root, file));
      continue;
    }
    const text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    const { body, status, nativeStatus, serverBindings = [] } = readMetadata(text, family, bindings, report);
    for (const { name, from } of serverBindings) {
      serverFixture ??= serverFixtureBindings(root);
      if (!serverFixture.has(from + '#' + name))
        report('server-fixture', 'Exercise the declared server-safe export ' + name + ' from ' + from + ' on the packed foundation route.');
    }
    if (statuses.includes(status)) stats[status]++;
    const sections = readContract(body, file, status, table, report);
    if (sections.has('API')) {
      propertyRows(sections.get('API'), bindings, declarations, report, details);
      const current = currentApiTable(text);
      if (
        current !== renderApiRows(bindings, declarations, details) &&
        current !== renderApiRows(bindings, declarations, details, { host: true })
      )
        report('api-generated', 'Refresh the API table from this packed release.');
    }
    if (sections.has('Tokens')) verifyTokens(sections.get('Tokens'), tokens, report);
    const tests = bindingTests(
      sections.get('React web/Tests') ?? '',
      file,
      root,
      testCache,
      report,
    );
    const nativeTests = bindingTests(
      sections.get('React Native/Tests') ?? '',
      file,
      root,
      testCache,
      report,
    );
    if (status === 'stable') {
      const story = family.story && existsSync(join(root, family.story));
      const unit = tests.some((path) => path.includes('.test.'));
      const browser = tests.some((path) => /^tests\/[^/]+\/[^/]+\.spec\.ts$/.test(path));
      const visual = tests.some((path) => /^tests\/[^/]+\/[^/]+\.visual\.ts$/.test(path));
      if (!story || !unit || !browser || !visual)
        report(
          'stable-coverage',
          'Stable families require a registered story and linked unit, browser and visual tests.',
        );
      if (
        nativeStatus === 'stable' &&
        !nativeTests.some((path) => path.startsWith('tests/simulator/'))
      )
        report('stable-coverage', 'Native bindings require linked simulator coverage.');
      if (issues.length === start) complete++;
    }
  }
  return {
    total: rows.length,
    stats,
    complete,
    failingFamilies: new Set(issues.map((x) => x.family)).size,
    failureCount: issues.length,
    issues,
  };
}
