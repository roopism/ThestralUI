import assert from 'node:assert/strict';
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';

const order = ['uld.reset', 'uld.tokens', 'uld.components', 'uld.utilities'];

function publishedSheets(folder) {
  const manifest = JSON.parse(readFileSync(join(folder, 'package.json'), 'utf8'));
  const entries = Object.entries(manifest.exports).filter(([key]) => key.endsWith('.css'));
  assert.ok(entries.length, 'Missing public stylesheets in ' + folder);
  return new Map(entries.map(([key, target]) => {
    assert.match(target, /^\.\/dist\/(?:[a-z0-9][a-z0-9-]*\/)*[a-z0-9][a-z0-9-]*\.css$/, 'Invalid public stylesheet target ' + key);
    const file = resolve(realpathSync(folder), target);
    assert.ok(lstatSync(file).isFile() && realpathSync(file) === file, 'Expected a regular package stylesheet: ' + file);
    return [key, file];
  }));
}

function checkPackages(root) {
  const published = Object.fromEntries(['web', 'tokens'].map(pkg => [pkg, publishedSheets(join(root, pkg))]));
  function collect(file, pkg, ordered, ancestors) {
    assert.ok(!ancestors.includes(file), 'Cyclic public stylesheet import: ' + [...ancestors, file].join(' -> '));
    const sheet = postcss.parse(readFileSync(file, 'utf8'), { from: file });
    sheet.walkAtRules('import', rule => assert.equal(rule.parent, sheet, file + ' contains a nested import'));
    let acceptsImports = true;
    for (const rule of sheet.nodes) {
      if (rule.type === 'comment') continue;
      assert.equal(rule.type, 'atrule', file + ' has an unlayered selector');
      if (rule.name === 'import') {
        assert.ok(acceptsImports && pkg === 'web', file + ' has an unsupported import');
        const parsed = /^(['"])(@ui-lazy-dev\/tokens\/(?:styles|text)\.css|\.\/[a-z0-9][a-z0-9-]*\.css)\1$/.exec(rule.params);
        assert.ok(parsed, file + ' has an unsupported import: ' + rule.params);
        const path = parsed[2];
        const tokenRoot = path.startsWith('@ui-lazy-dev/tokens/');
        if (path === '@ui-lazy-dev/tokens/text.css') {
          const exact = pkg => resolve(realpathSync(root), pkg, 'dist/text.css');
          assert.ok(file === exact('web') && published.web.get('./text.css') === file &&
            published.tokens.get('./text.css') === exact('tokens'), 'Only the published Text sheet imports its optional typography tokens');
        }
        const target = tokenRoot ? published.tokens.get('./' + path.split('/').pop()) : published.web.get(path);
        assert.ok(target && (tokenRoot || target === resolve(dirname(file), path)), file + ' must import an exported sibling: ' + path);
        collect(target, tokenRoot ? 'tokens' : 'web', ordered, [...ancestors, file]);
        continue;
      }
      assert.equal(rule.name, 'layer', file + ' contains an unlayered at-rule');
      if (rule.nodes) {
        assert.ok(order.includes(rule.params), file + ' has an unknown layer ' + rule.params);
        acceptsImports = false;
      }
      for (const name of rule.params.split(',').map(part => part.trim())) {
        assert.ok(order.includes(name), file + ' has an unknown layer ' + name);
        ordered.add(name);
      }
      if (rule.nodes && pkg === 'tokens') assert.equal(rule.params, 'uld.tokens');
    }
  }
  for (const [pkg, sheets] of Object.entries(published)) {
    for (const [entry, file] of sheets) {
      const ordered = new Set();
      collect(file, pkg, ordered, []);
      assert.deepEqual([...ordered], order, pkg + '/' + entry);
    }
  }
}

function checkImportControls(t) {
  const root = mkdtempSync(join(tmpdir(), 'uld-style-exports-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const header = '@layer ' + order.join(', ') + ';\n';
  const sheet = (pkg, name) => join(root, pkg, 'dist', name + '.css');
  function manifest(pkg, exports) { writeFileSync(join(root, pkg, 'package.json'), JSON.stringify({ exports })); }
  for (const pkg of ['tokens', 'web']) mkdirSync(join(root, pkg, 'dist'), { recursive: true });
  const validExports = { './suite.css': './dist/suite.css', './family.css': './dist/family.css' };
  manifest('web', validExports);
  manifest('tokens', { './styles.css': './dist/styles.css' });
  writeFileSync(sheet('tokens', 'styles'), header + '@layer uld.tokens { :root { --ink: black } }');
  const umbrella = sheet('web', 'suite'), family = sheet('web', 'family');
  const validFamily = header + '@layer uld.components { .family { color: var(--ink) } }';
  writeFileSync(family, validFamily);
  writeFileSync(umbrella, header + '@import "@ui-lazy-dev/tokens/styles.css"; @import "./family.css";');
  checkPackages(root);
  for (const source of ['not-public.css', '../tokens/dist/styles.css', 'https://example.com/base.css', './family.css?other', './family.css" screen and "x']) {
    writeFileSync(umbrella, header + '@import "' + source + '";');
    assert.throws(() => checkPackages(root), /unsupported import|exported sibling/);
  }
  writeFileSync(umbrella, header + '@import "./missing.css";');
  assert.throws(() => checkPackages(root), /exported sibling/);
  writeFileSync(umbrella, header + '@layer uld.components {.x {}} @import "./family.css";');
  assert.throws(() => checkPackages(root), /unsupported import/);
  writeFileSync(umbrella, header + '@import "./family.css";');
  const invalidFamilyRules = [
    [header + '.x {}', /unlayered selector/],
    [header + '@layer foreign {}', /unknown layer/],
    [header + '@import "./suite.css";', /Cyclic/],
    [header + '@layer uld.components { @import "https://example.com/base.css"; }', /nested import/],
    ['@layer uld.tokens, uld.reset, uld.components, uld.utilities;', /web\/\.\/family\.css/],
  ];
  for (const [contents, error] of invalidFamilyRules) {
    writeFileSync(family, contents);
    assert.throws(() => checkPackages(root), error);
  }
  writeFileSync(family, validFamily);
  manifest('web', { './suite.css': './dist/suite.css', './family.css': './dist/foreign.css' });
  writeFileSync(sheet('web', 'foreign'), validFamily);
  assert.throws(() => checkPackages(root), /exported sibling/);
  const optional = '@import "@ui-lazy-dev/tokens/text.css";';
  const tokenExports = { './styles.css': './dist/styles.css', './text.css': './dist/text.css' };
  manifest('tokens', tokenExports);
  writeFileSync(sheet('tokens', 'text'), header + '@layer uld.tokens { :root { --type-size: 1rem } }');
  manifest('web', { ...validExports, './text.css': './dist/text.css' });
  writeFileSync(sheet('web', 'text'), header + optional);
  checkPackages(root);
  writeFileSync(umbrella, header + optional);
  assert.throws(() => checkPackages(root), /Only the published Text sheet/);
  writeFileSync(umbrella, header);
  manifest('tokens', { ...tokenExports, './text.css': './dist/styles.css' });
  assert.throws(() => checkPackages(root), /Only the published Text sheet/);
  manifest('tokens', tokenExports);
  manifest('web', { ...validExports, './text.css': './dist/family.css' });
  writeFileSync(family, header + optional);
  assert.throws(() => checkPackages(root), /Only the published Text sheet/);
  writeFileSync(family, validFamily);
  manifest('web', validExports);
  rmSync(family);
  symlinkSync(sheet('web', 'foreign'), family);
  assert.throws(() => checkPackages(root), /regular package stylesheet/);
}

test('every published web and token stylesheet places its rules inside the public cascade layers', t => {
  checkPackages(fileURLToPath(new URL('../../packages/', import.meta.url)));
  checkImportControls(t);
});
