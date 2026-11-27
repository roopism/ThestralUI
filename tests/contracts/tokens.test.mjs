import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tokens } from '../../packages/tokens/dist/index.js';

function brightness(hex) {
  const rgb = hex
    .slice(1)
    .match(/../g)
    .map((x) => parseInt(x, 16) / 255)
    .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a, b) {
  const values = [brightness(a), brightness(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
test('each theme resolves semantic text, emphasis and visible focus to contrasting colors', () => {
  for (const theme of [tokens.light, tokens.dark]) {
    for (const key of ['text', 'muted', 'danger', 'success', 'warning']) {
      assert.ok(contrast(theme[key], theme.surface) >= 4.5, key);
    }
    assert.ok(contrast(theme.onAccent, theme.accent) >= 4.5);
    assert.ok(contrast(theme.focus, theme.canvas) >= 3);
  }
  assert.ok(tokens.space.spaceLg > tokens.space.spaceSm);
  assert.ok(tokens.type.headingSize > tokens.type.bodySize);
  assert.ok(tokens.density.coarseTarget >= 44);
  const css = readFileSync(
    new URL('../../packages/tokens/dist/styles.css', import.meta.url),
    'utf8',
  );
  assert.match(css, /forced-colors:\s*active/);
});
test('token check rejects a stale generated artifact', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ui-tokens-'));
  try {
    const source = new URL('../../packages/tokens/', import.meta.url);
    for (const file of ['build.mjs', 'resolve-value.mjs', 'tokens.json', 'domains', 'modes'])
      cpSync(new URL(file, source), join(dir, file), { recursive: true });
    execFileSync(process.execPath, ['build.mjs'], { cwd: dir });
    execFileSync(process.execPath, ['build.mjs', '--check'], { cwd: dir });
    const raw = readFileSync(join(dir, 'tokens.json'), 'utf8');
    writeFileSync(join(dir, 'tokens.json'), '{}');
    assert.throws(() => execFileSync(process.execPath, ['build.mjs', '--check'], { cwd: dir, stdio: 'pipe' }));
    execFileSync(process.execPath, ['build.mjs', '--write-source'], { cwd: dir });
    assert.equal(readFileSync(join(dir, 'tokens.json'), 'utf8'), raw);
    const domainFile = join(dir, 'domains/shape.json');
    const domain = JSON.parse(readFileSync(domainFile, 'utf8'));
    domain.nativeProbe = { hairline: {
      $type: 'dimension', $value: { value: 1, unit: 'px' },
      $extensions: { 'ui-lazy-dev.platforms': ['native'] },
    } };
    const nativeDimension = (target, extra = {}) => ({
      $type: 'dimension', $value: '{' + target + '}',
      $extensions: { 'ui-lazy-dev.platforms': ['native'], ...extra },
    });
    domain.type = { nativeBody: nativeDimension('type.bodySize') };
    domain.nativeProbe.lineAlias = nativeDimension('nativeProbe.line');
    domain.nativeProbe.line = nativeDimension('type.bodySize', { 'ui-lazy-dev.scale': '{type.bodyLeading}' });
    domain.nativeProbe.modeAlias = nativeDimension('nativeProbe.modeSize');
    domain.nativeProbe.modeSize = nativeDimension('type.captionSize');
    domain.nativeProbe.sourceColor = {
      $type: 'color', $value: '{light.accent}', $extensions: { 'ui-lazy-dev.platforms': ['native'] },
    };
    writeFileSync(domainFile, JSON.stringify(domain));
    const lightFile = join(dir, 'modes/light.tokens.json');
    const light = JSON.parse(readFileSync(lightFile, 'utf8'));
    light.type = { ...light.type, captionSize: { $type: 'dimension', $value: { value: 17, unit: 'px' } } };
    writeFileSync(lightFile, JSON.stringify(light));
    execFileSync(process.execPath, ['build.mjs'], { cwd: dir });
    const { createNativeTheme, nativeTokens, withNativeTokens } = await import(pathToFileURL(join(dir, 'dist/native.js')));
    const { createTheme } = await import(pathToFileURL(join(dir, 'dist/modes/index.js')));
    const options = { modes: [{ name: 'large', overrides: ['type.bodySize'], tokens: { 'type.bodySize': 20 } }] };
    const selection = { mode: 'large' };
    const web = createTheme(options).resolve(selection).tokens;
    const theme = createNativeTheme(options);
    const selected = theme.resolve(selection).tokens;
    assert.deepEqual({
      type: selected.type,
      scaled: selected.nativeProbe.line,
      aliasOfScaled: selected.nativeProbe.lineAlias,
      defaultAlias: nativeTokens.nativeProbe.lineAlias,
    }, {
      type: { ...web.type, nativeBody: 20 },
      scaled: 30,
      aliasOfScaled: 30,
      defaultAlias: 24,
    });
    assert.equal(theme.resolve().tokens.type.nativeBody, 16);
    assert.equal(nativeTokens.nativeProbe.modeAlias, 17);
    assert.equal(theme.resolve({ scheme: 'dark' }).tokens.nativeProbe.modeAlias, 13);
    assert.equal(selected.nativeProbe.sourceColor, tokens.light.accent);
    assert.deepEqual(withNativeTokens(web), selected);
    assert.equal(Object.hasOwn(web.type, 'nativeBody'), false);
    for (const name of ['native.js', 'native.d.ts']) {
      const artifact = join(dir, 'dist', name);
      const content = readFileSync(artifact, 'utf8');
      assert.match(content, /"nativeProbe":\s*\{\s*"hairline": 1/);
      writeFileSync(artifact, 'stale');
      assert.throws(
        () => execFileSync(process.execPath, ['build.mjs', '--check'], { cwd: dir, stdio: 'pipe' }),
        error => error.stderr.toString().includes('Stale token artifact: ' + name),
      );
      writeFileSync(artifact, content);
    }
    execFileSync(process.execPath, ['build.mjs', '--check'], { cwd: dir });
    writeFileSync(join(dir, 'dist/styles.css'), 'stale');
    assert.throws(() =>
      execFileSync(process.execPath, ['build.mjs', '--check'], { cwd: dir, stdio: 'pipe' }),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
