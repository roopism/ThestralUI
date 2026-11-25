import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import postcss from 'postcss';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const read = path => readFileSync(path, 'utf8');
const json = path => JSON.parse(read(path));
const modes = ['caption', 'body', 'heading', 'display'];
const selectors = ['label', '', 'headline', 'display'];

function ownedTextStyles(root) {
  const pkg = json(join(root, 'packages/web/package.json'));
  const file = join(root, 'packages/web/src/text/styles.css');
  if (!existsSync(file)) {
    assert.equal(pkg.exports['./text.css'], undefined);
    assert.equal(pkg.exports['./text'], undefined);
    return false;
  }
  assert.equal(pkg.exports['./text.css'], './dist/text.css');
  const sheet = postcss.parse(read(file));
  assert.equal(sheet.nodes[0].type, 'comment');
  assert.equal(sheet.nodes[0].text, '@uld-css-chunk text');
  assert.equal(sheet.nodes[1].type, 'atrule');
  assert.equal(sheet.nodes[1].name, 'import');
  assert.equal(sheet.nodes[1].params, "'@ui-lazy-dev/tokens/styles.css'");
  assert.equal(sheet.nodes[2].type, 'atrule');
  assert.equal(sheet.nodes[2].name, 'import');
  assert.equal(sheet.nodes[2].params, "'@ui-lazy-dev/tokens/text.css'");
  const expected = new Map(modes.map((mode, index) => [
    selectors[index] ? `[data-uld-text-variant='${selectors[index]}']` : '[data-uld-text-variant]',
    ['font-size', `var(--uld-text-size, var(--uld-text-${mode}-size))`],
  ]));
  expected.set("[data-uld-text-variant='code']", ['font-family', 'monospace']);
  const checked = new Set();
  sheet.walkDecls(decl => {
    // The token package defines each relative companion. The application owns the outer override.
    assert.doesNotMatch(decl.prop, /^--uld-text-(?:(?:caption|body|heading|display)-)?size$/);
    const role = expected.get(decl.parent.selector);
    if (!role || decl.prop !== role[0]) return;
    assert.ok(!checked.has(decl.parent.selector), 'A variant may not replace its enrolled declaration twice');
    assert.equal(decl.parent.parent, sheet, 'Typography belongs to its standalone family root');
    assert.equal(decl.important, undefined);
    assert.equal(decl.value, role[1]);
    checked.add(decl.parent.selector);
  });
  assert.equal(checked.size, expected.size, 'Every enrolled variant has its actual fallback');
  return true;
}

test('Text preserves the caller override and derives all four relative font sizes from published dimensions', async () => {
  if (!ownedTextStyles(root)) return;
  const source = join(root, 'packages/tokens');
  const sandbox = mkdtempSync(join(tmpdir(), 'uld-typography-'));
  try {
    cpSync(source, sandbox, {recursive: true, filter: path => path !== join(source, 'dist') && path !== join(source, 'node_modules')});
    const domain = join(sandbox, 'domains/type.json');
    const tokens = json(domain);
    // Distinct values catch swapped roles and numbers copied from today's theme.
    const sizes = [19, 23, 37, 61];
    for (const [index, role] of modes.entries()) {
      const token = tokens.type[role + 'Size'];
      assert.equal(token.$type, 'dimension');
      assert.equal(token.$value.unit, 'px');
      token.$value.value = sizes[index];
    }
    writeFileSync(domain, JSON.stringify(tokens));
    execFileSync(process.execPath, ['build.mjs', '--write-source'], {cwd: sandbox, stdio:'pipe'});
    const pkg = json(join(sandbox, 'package.json'));
    assert.equal(pkg.name, '@ui-lazy-dev/tokens');
    const [archive] = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json'], {cwd:sandbox, encoding:'utf8'}));
    const shipped = new Set(archive.files.map(file => './' + file.path));
    function entry(specifier) {
      const entry = pkg.exports[specifier];
      const target = typeof entry === 'string' ? entry : entry?.default;
      assert.ok(shipped.has(target), 'Missing packed token entry ' + specifier);
      return join(sandbox, target);
    }
    assert.deepEqual(json(entry('./tokens.json')).type, tokens.type);
    const defaults = postcss.parse(read(entry('./styles.css')));
    const optional = postcss.parse(read(entry('./text.css')));
    const rootScope = sheet => sheet.nodes.flatMap(node => node.nodes ?? []).find(node => node.selector === ':root, [data-uld-theme="light"]');
    const scope = rootScope(defaults);
    const relative = rootScope(optional);
    assert.ok(relative, 'The public optional typography sheet supplies unbranded relative units');
    assert.ok(scope, 'The published token sheet supplies font sizes to an unbranded page');
    for (const [index, role] of modes.entries()) {
      const declarations = prop => scope.nodes.filter(node => node.prop === prop).map(node => node.value);
      assert.deepEqual(declarations('--uld-' + role + '-size'), [sizes[index] + 'px']);
      const name = '--uld-text-' + role + '-size';
      assert.deepEqual(declarations(name), [], 'The base sheet keeps the optional role out');
      assert.deepEqual(relative.nodes.filter(node => node.prop === name).map(node => node.value), [sizes[index] / 16 + 'rem']);
    }
    const {createBrandCSS, createContextCSS} = await import(pathToFileURL(entry('./theme-css')));
    const {registerBrand} = await import(pathToFileURL(entry('./modes')));
    const brand = registerBrand('type-proof', {
      base: {'type.displaySize': 43, 'type.headingSize': '{type.displaySize}'},
      density: {compact: {'type.displaySize': 51}},
    });
    const brandSheet = postcss.parse(createBrandCSS(brand));
    const brandScope = brandSheet.nodes.flatMap(n => n.nodes ?? []).find(n => n.name === 'scope');
    assert.equal(brandScope?.params, '([data-uld-brand="type-proof"]) to ([data-uld-brand]:not([data-uld-brand="type-proof"]))');
    // Follow CSS variable dependencies without coupling the test to private compiler names.
    const declarations = new Map();
    brandScope.walkDecls(decl => declarations.set(decl.prop, decl.value));
    function sources(property, seen = new Set()) {
      if (seen.has(property) || !declarations.has(property)) return [];
      seen.add(property);
      const value = declarations.get(property);
      const variables = [...value.matchAll(/var\(\s*(--[\w-]+)/g)].map(match => match[1]);
      return [value, ...variables.flatMap(name => sources(name, seen))];
    }
    const display = sources('--uld-text-display-size');
    assert.ok(display.some(value => value.includes('2.6875rem')), 'Brand supplies the 43px default in rem');
    assert.ok(display.some(value => value.includes('--uld-if-density-compact') && value.includes('3.1875rem')),
      'Compact density owns the 51px variant');
    assert.ok(sources('--uld-text-heading-size').some(value => value.includes('var(--uld-text-display-size)')),
      'A typography alias follows its relative target through a nested brand');
    const context = {name:'reading', overrides:['type.bodySize'], tokens:{'type.bodySize':47}};
    const contextSheet = postcss.parse(createContextCSS(context));
    const contextScope = contextSheet.nodes.flatMap(n => n.nodes ?? []).find(n => n.name === 'scope');
    assert.equal(contextScope?.params, '([data-uld-mode="reading"]) to ([data-uld-mode]:not([data-uld-mode="reading"]))');
    const overrides = [];
    contextScope.walkDecls('--uld-text-body-size', decl => overrides.push(decl.value));
    assert.deepEqual(overrides, ['2.9375rem']);
  } finally {
    rmSync(sandbox, {recursive:true, force:true});
  }
});
