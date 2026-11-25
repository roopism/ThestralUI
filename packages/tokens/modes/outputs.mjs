import { readFileSync } from 'node:fs';
import { axisStyles, brandStyles, compileBrand, tokenLayer } from './compile.mjs';
import { readModeSystem } from './resolve.mjs';

const names = { scheme: 'Scheme', brand: 'Brand', density: 'Density', motion: 'MotionPreference', mode: 'ContextualMode' };
function shape(tree) {
  const fields = Object.entries(tree).map(([key, value]) => JSON.stringify(key) + ': ' +
    (typeof value === 'object' ? shape(value) : value === 'color' ? 'string' : 'number'));
  return '{ ' + fields.join('; ') + ' }';
}
function declarations(system, compiled) {
  const lines = ['export interface ConsumerBrands {}', 'export interface ConsumerModes {}'];
  for (const [axis, values] of Object.entries(system.axes)) {
    const extra = axis === 'brand' ? ' | keyof ConsumerBrands' : axis === 'mode' ? ' | keyof ConsumerModes' : '';
    lines.push('export type ' + names[axis] + ' = ' + values.map(value => JSON.stringify(value)).join(' | ') + extra + ';');
  }
  const fields = Object.entries(names).map(([axis, name]) => axis + ': ' + name).join('; ');
  lines.push('export interface Mode { ' + fields + ' }', 'export type ModeSelection = Partial<Mode>;',
    'export interface ResolvedTokens ' + shape(system.resolveModes().types), 'export interface TokenValues {');
  for (const [path, type] of Object.entries(compiled.types))
    lines.push('  ' + JSON.stringify(path) + ': ' + (type === 'color' ? 'string' : 'number') + ';');
  lines.push('}', 'export type SemanticToken = keyof TokenValues;',
    'export interface TokenKinds {',
    ...Object.entries(compiled.types).map(([path, type]) => '  ' + JSON.stringify(path) + ': ' + JSON.stringify(type) + ';'),
    '}', 'type CompatibleAlias<K extends SemanticToken> = { [P in SemanticToken]: TokenKinds[P] extends TokenKinds[K] ? P : never }[SemanticToken];',
    'type TokenInputs = { [K in SemanticToken]: (TokenKinds[K] extends "color" ? `#${string}` : number) | `{${CompatibleAlias<K>}}` };',
    'export type TokenPatch = Partial<TokenInputs>;',
    'export interface BrandDefinition { readonly brand: string; readonly defaults: Mode; readonly base: Readonly<TokenInputs>; readonly types: Readonly<Record<SemanticToken, string>>; readonly rules: ReadonlyArray<{ when: ModeSelection; tokens: TokenPatch }> }',
    'export interface BrandOverrides { base?: TokenPatch; scheme?: Partial<Record<Scheme, TokenPatch>>; density?: Partial<Record<Density, TokenPatch>>; motion?: Partial<Record<MotionPreference, TokenPatch>> }',
    'export interface ContextDefinition { name: string; overrides: readonly SemanticToken[]; tokens: TokenPatch }',
    'export interface ModeTheme { resolve(selection?: ModeSelection): { mode: Mode; tokens: ResolvedTokens } }',
    'export declare function registerBrand(name: string, overrides?: BrandOverrides, parent?: BrandDefinition): BrandDefinition;',
    'export declare function createTheme(options?: { brands?: readonly BrandDefinition[]; modes?: readonly ContextDefinition[] }): ModeTheme;',
    'export declare const enterprise: BrandDefinition;', 'export declare const defaultTheme: ModeTheme;', '');
  return lines.join('\n');
}

export function modeOutputs(system = readModeSystem()) {
  const outputs = { 'modes.css': tokenLayer(axisStyles(system)) };
  for (const name of system.axes.brand) {
    const brand = compileBrand(system, name);
    outputs['modes/brands/' + name + '.js'] = 'export const ' + name + ' = ' + JSON.stringify(brand) + ';\n';
    outputs['modes/brands/' + name + '.d.ts'] = "import type { BrandDefinition } from '../index.js';\nexport declare const " + name + ': BrandDefinition;\n';
    outputs['brands/' + name + '.css'] = tokenLayer(brandStyles(brand));
    if (name === system.defaults.brand) outputs['modes/index.d.ts'] = declarations(system, brand);
  }
  outputs['modes/compiler.js'] = readFileSync(new URL('./compile.mjs', import.meta.url), 'utf8');
  outputs['theme-css.js'] = [
    "import { createTheme, enterprise } from './modes/index.js';",
    "import { brandStyles, contextPatchStyles, tokenLayer } from './modes/compiler.js';",
    "export function createBrandCSS(brand) { if (brand !== enterprise) createTheme({brands:[brand]}); return tokenLayer(brandStyles(brand)); }",
    "export function createContextCSS(mode) { createTheme({modes:[mode]}); return tokenLayer(contextPatchStyles(mode, enterprise.types)); }",
    '',
  ].join('\n');
  outputs['theme-css.d.ts'] = [
    "import type { BrandDefinition, ContextDefinition } from './modes/index.js';",
    "export declare function createBrandCSS(brand: BrandDefinition): string;",
    "export declare function createContextCSS(mode: ContextDefinition): string;", '',
  ].join('\n');
  outputs['modes/index.js'] = readFileSync(new URL('./runtime.mjs', import.meta.url), 'utf8');
  outputs['modes/axes.js'] = 'export const axes = ' + JSON.stringify(Object.fromEntries(
    ['scheme', 'density', 'motion'].map(key => [key, system.axes[key]]))) + ';\n';
  return outputs;
}
