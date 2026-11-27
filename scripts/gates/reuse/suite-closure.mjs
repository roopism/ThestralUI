// Review the module portion of a suite closure against immutable Git blobs.
// A static edge is positive evidence. A missing edge cannot rule out a data or subprocess read.
import { buildImportGraph, includesGraphInput, reach, references } from '../../selection/import-graph.mjs';
import { treeFiles } from '../../selection/staged-tree.mjs';
import ts from 'typescript';

const policy = 'packages/policy/quality/';
const gates = 'scripts/gates/';
const browserMatrix = policy + 'browser-matrix.mjs';
const browser = ['playwright.config.ts', browserMatrix];
const catalog = ['.storybook/main.ts', '.storybook/preview.ts'];
const unit = [gates + 'fast-typed.mjs', 'scripts/unit-matrix.mjs', 'scripts/check-api.mjs',
  'scripts/inventory.mjs', ...['artifacts', 'version', 'inventory'].map(tool => 'scripts/verify-' + tool + '.mjs')];
const suites = {
  'Trusted gate tests': [gates + 'test-roster.json'],
  'Typed and unit rosters': unit,
  'Browser and visual rosters': [gates + 'fast-typed.mjs', ...browser, 'tests/browser/motion.visual.config.ts'],
  'Catalog build': catalog,
  'Packed component specifications': [policy + 'check-staged.mjs'],
  'Packed consumers min': ['scripts/verify-consumers.mjs'],
  'Packed consumers max': ['scripts/verify-consumers.mjs'],
  'Packed bundle limits': [policy + 'check-staged.mjs', policy + 'size-ceiling.mjs'],
  'Portable web scenarios': [...catalog, browserMatrix, 'tests/scenarios/web/playwright.config.ts'],
  'Mac browser behavior': [...catalog, ...browser, policy + 'api-depth/evidence.mjs'],
  'Mac visual comparisons': [...catalog, ...browser, 'tests/browser/motion.visual.config.ts'],
  'Scoped styles': [...catalog, 'tests/browser/quality-style-scope.mjs'],
  'Native package consumer': ['scripts/verify-native-consumer.mjs'],
  'Linux browser behavior': [...catalog, ...browser, gates + 'linux-vm.mjs', gates + 'linux-browser-suites.mjs'],
  'iPhone Simulator': ['scripts/verify-ios-simulator.mjs', gates + 'reuse/device-run.mjs'],
  'Android standard and low-end': ['scripts/verify-android-emulator.mjs', gates + 'reuse/device-run.mjs'],
};

const source = /\.[cm]?[jt]sx?$/;
const runtime = /^(?:node:)?(?:fs(?:\/promises)?|child_process|worker_threads|module|vm)$/;

export function moduleInputs(files, graph, roots) {
  const paths = [...reach(graph.forward, roots)].sort();
  const unresolved = [];
  for (const path of paths) {
    if (!files.has(path)) { unresolved.push('missing ' + path); continue; }
    if (!source.test(path)) continue;
    if (graph.opaque.has(path)) unresolved.push('unresolved module or route in ' + path);
    const ast = ts.createSourceFile(path, files.get(path), ts.ScriptTarget.Latest, true);
    const refs = references(ast, { workspace: true });
    if (refs.dynamic || ast.parseDiagnostics.length || ast.typeReferenceDirectives.length)
      unresolved.push('unresolved source input in ' + path);
    for (const name of new Set(refs.imports.filter(ref => runtime.test(ref))))
      unresolved.push(path + ' uses ' + name);
  }
  return { paths, unresolved };
}

export function suiteModuleInputs(root, revision) {
  const files = treeFiles(root, revision, path => includesGraphInput(path) || source.test(path) || path.endsWith('.json'));
  const graph = buildImportGraph(files);
  const listed = [...files.keys()];
  const gateTests = listed.filter(file => /^scripts\/gates\/tests\/[^/]+\.test\.mjs$/.test(file));
  const matrix = JSON.parse(files.get('tests/acceptance/suite-inputs.json'));
  const result = {};
  for (const [name, config] of [...Object.entries(matrix.groups), ['Trusted gate tests', { reusable: true }]]) {
    if (config.reusable !== true) { result[name] = { fresh: true }; continue; }
    if (!Object.hasOwn(suites, name)) { result[name] = { fresh: true, unresolved: ['unknown suite'] }; continue; }
    const roots = [...suites[name]];
    if (roots.includes(catalog[0])) roots.push(...listed.filter(file => /^catalog\/.+\.stories\.tsx$/.test(file)));
    if (name === 'Typed and unit rosters' || name === 'Trusted gate tests') roots.push(...gateTests);
    if (roots.includes(browserMatrix)) roots.push(...listed.filter(file => /\.(?:spec|visual)\.[cm]?[jt]sx?$/.test(file)));
    result[name] = moduleInputs(files, graph, roots);
  }
  return result;
}

if (import.meta.main) {
  const [root, revision] = process.argv.slice(2);
  if (!root || !/^[a-f0-9]{40}$/.test(revision)) throw Error('Expected a repository and a full revision');
  console.log(JSON.stringify(suiteModuleInputs(root, revision), null, 2));
}
