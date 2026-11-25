import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { modeOutputs } from '../../packages/tokens/modes/outputs.mjs';
import test from 'node:test';
import { readModeSystem } from '../../packages/tokens/modes/resolve.mjs';

const system = readModeSystem();
const reading = JSON.parse(readFileSync(new URL('../../catalog/modes/reading.json', import.meta.url)));
const defaults = system.resolveModes();

function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}
function contrast(left, right) {
  const [lighter, darker] = [luminance(left), luminance(right)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

test('every mode retains the semantic schema, readable foregrounds and a coarse target', () => {
  let count = 0;
  for (const brand of system.axes.brand) for (const scheme of system.axes.scheme) {
    for (const density of system.axes.density) for (const motion of system.axes.motion) {
      for (const mode of ['default', reading.name]) {
        const result = system.resolveModes({ brand, scheme, density, motion, mode }, reading);
        assert.deepEqual(result.types, defaults.types);
        const { color, type } = result.values;
        const minimum = scheme === 'high-contrast' ? 7 : 4.5;
        for (const background of ['canvas', 'surface', 'selected']) {
          for (const text of ['text', 'muted', 'danger', 'success', 'warning'])
            assert.ok(contrast(color[text], color[background]) >= minimum,
              [brand, scheme, mode, text, background].join(' '));
        }
        assert.ok(contrast(color.accent, color.onAccent) >= minimum);
        for (const mark of ['border', 'focus']) for (const background of ['surface', 'canvas'])
          assert.ok(contrast(color[mark], color[background]) >= 3, [brand, scheme, mark, background].join(' '));
        assert.ok(result.values.density.coarseTarget >= 48);
        if (motion === 'reduced') {
          assert.equal(result.values.motion.pressScale, 1);
          assert.equal(result.values.motion.enterDuration, 0);
        }
        if (mode === reading.name) {
          assert.equal(type.bodySize, 18);
          assert.equal(color.surface, color.canvas);
        }
        count++;
      }
    }
  }
  assert.equal(count, 72);
});

test('brand and context overrides stay local and resolve aliases after the final axis', () => {
  assert.notEqual(system.resolveModes({ brand: 'expressive' }).values.color.accent, defaults.values.color.accent);
  const input = { brand: 'expressive', scheme: 'dark', mode: 'reading' };
  const first = system.resolveModes(input, reading);
  first.values.color.accent = 'consumer mutation';
  assert.notEqual(system.resolveModes(input, reading).values.color.accent, first.values.color.accent);
  assert.deepEqual(system.resolveModes(), defaults);
  assert.throws(() => system.resolveModes({ density: 'unregistered' }), /Unknown token mode/);
  assert.throws(() => system.resolveModes(input, { ...reading, overrides: ['type.bodySize'] }), /Undeclared/);
  const cyclic = { ...reading, overrides: ['color.surface'], tokens: {
    'color.surface': '{color.surface}',
  } };
  assert.throws(() => system.resolveModes(input, cyclic), /cyclic/);
  cyclic.tokens['color.surface'] = '{type.bodySize}';
  assert.throws(() => system.resolveModes(input, cyclic), /type mismatch/);
});

test('compiled consumer brands and contexts agree with every ordered resolver combination', async () => {
  const { createTheme, registerBrand } = await import('@ui-lazy-dev/tokens/modes');
  const { expressive } = await import('@ui-lazy-dev/tokens/brands/expressive');
  const theme = createTheme({ brands: [expressive], modes: [reading] });
  for (const brand of system.axes.brand) for (const scheme of system.axes.scheme)
    for (const density of system.axes.density) for (const motion of system.axes.motion)
      for (const mode of ['default', reading.name]) {
        const input = { brand, scheme, density, motion, mode };
        assert.deepEqual(theme.resolve(input).tokens, system.resolveModes(input, reading).values);
      }
  const overrides = { density: { compact: { 'space.spaceMd': 11 } },
    scheme: { dark: { 'space.spaceMd': 13, 'color.accent': '#c3d4e5' } } };
  const custom = registerBrand('partner', overrides);
  const partner = createTheme({ brands: [custom] });
  assert.equal(partner.resolve({ brand: 'partner', density: 'compact', scheme: 'dark' }).tokens.space.spaceMd, 11);
  assert.equal(partner.resolve({ brand: 'partner', scheme: 'dark' }).tokens.color.accent, '#c3d4e5');
  custom.base['color.text'] = '#123456';
  assert.notEqual(partner.resolve({ brand: 'partner' }).tokens.color.text, '#123456');
  assert.throws(() => registerBrand('partner', { base: { 'palette.green': '#234567' } }), /Unknown semantic token/);
  assert.throws(() => registerBrand('partner', { base: { 'type.bodySize': '#234567' } }), /Invalid dimension/);
  assert.throws(() => registerBrand('partner', { base: { 'color.accent': '{type.bodySize}' } }), /type mismatch/);
  assert.throws(() => partner.resolve({ scheme: 'invalid' }), /Unknown scheme/);
  const cyclic = registerBrand('cyclic', {
    scheme: { dark: { 'color.surface': '{color.canvas}' } },
    density: { compact: { 'color.canvas': '{color.surface}' } },
  });
  assert.throws(() => createTheme({ brands: [cyclic] }), /Cyclic semantic alias/);
  assert.throws(() => createTheme({ brands: [{ ...custom, base: {} }] }), /Incomplete brand/);
  assert.throws(() => createTheme({ modes: [{ ...reading, overrides: [...reading.overrides, reading.overrides[0]] }] }), /declaration mismatch/);
});

test('adding a registered brand ships its own styles without increasing default CSS', (t) => {
  const source = new URL('../../packages/tokens/modes/system.resolver.json', import.meta.url);
  const document = JSON.parse(readFileSync(source, 'utf8'));
  // The fixture points to the same source sets and introduces one additional brand.
  for (const set of Object.values(document.sets))
    for (const item of set.sources) item.$ref = new URL(item.$ref, source).href;
  for (const modifier of Object.values(document.modifiers))
    for (const sources of Object.values(modifier.contexts))
      for (const item of sources) item.$ref = new URL(item.$ref, source).href;
  document.modifiers.brand.contexts.partner = document.modifiers.brand.contexts.expressive;
  const dir = mkdtempSync(join(tmpdir(), 'theme-brand-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'system.resolver.json');
  writeFileSync(file, JSON.stringify(document));
  const previous = modeOutputs(system);
  const expanded = modeOutputs(readModeSystem(pathToFileURL(file)));
  for (const path of ['modes.css', 'brands/enterprise.css', 'brands/expressive.css'])
    assert.equal(expanded[path], previous[path], path);
  assert.match(expanded['brands/partner.css'], /data-uld-brand="partner"/);
});
