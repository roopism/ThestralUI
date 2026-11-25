import { specifier } from '../../packages/policy/quality/binding-entry.mjs';
import { simulatorForPaths, simulatorRequired } from '../../packages/policy/quality/simulator-scope.mjs';
import {
  browser, buildImportGraph, includesGraphInput, nativeUnit, production, reach, unit,
} from './import-graph.mjs';
import { fixtureRegistry } from './native-tier-two.mjs';
import { stagedDiff, treeFiles } from './staged-tree.mjs';
import { familyChanges, familyManifest, familyStyle } from './manifest-changes.mjs';

const registry = 'packages/policy/quality/api-depth/families.json';
const budgets = 'tests/packaging/bundle-baseline.json';
const sort = items => [...new Set(items)].sort();

function describeChange({ status, path }) {
  if (!['M', 'A'].includes(status)) return 'Deleted, moved or type-changed input: ' + path;
  if (path.startsWith('packages/tokens/')) return 'Shared tokens: ' + path;
  if (familyStyle.test(path) || familyManifest.test(path)) return;
  if (/\.(?:css|s[ac]ss|less)$/.test(path)) return 'Stylesheet and compiled CSS budget: ' + path;
  if (/^(?:\.githooks|\.github|scripts|packages\/(?:policy|style-policy)|tests\/scenarios)\//.test(path))
    return 'Verification tooling: ' + path;
  if (!includesGraphInput(path) || /(?:^|\/)(?:package|tsconfig)\.json$|^manifests\//.test(path))
    return 'Shared configuration or unclassified path: ' + path;
}

// A manifest supplies family ownership for collocated tests, stories and neutral
// contracts. Until manifests exist the public entry is the conservative boundary.
function familyInputs(files, graph) {
  const rows = JSON.parse(files.get(registry)).families;
  const manifests = new Map();
  for (const [path, body] of files) {
    if (!path.startsWith('manifests/families/')) continue;
    const manifest = JSON.parse(body);
    if (!manifest.depth) continue;
    if (manifests.has(manifest.id)) throw Error('Duplicate manifest for ' + manifest.id);
    manifests.set(manifest.id, { slug: path.split('/').pop().slice(0, -5), ...manifest.files });
  }
  if (manifests.size && manifests.size !== rows.length) throw Error('Incomplete manifest coverage');
  return rows.map(row => {
    const entries = sort(row.exports.map(specifier));
    const entryFiles = entries.map(name => {
      const file = graph.entries.get(name);
      if (!file) throw Error('Unregistered source for ' + name);
      return file;
    });
    const mapping = manifests.get(row.id);
    if (!manifests.size) return { id: row.id, entries, sources: entryFiles, attachments: [], scenarios: [], nativeScenarios: [] };
    if (!mapping) throw Error('Missing manifest for ' + row.id);
    const fixture = 'tests/' + mapping.slug + '/web-fixtures.tsx';
    const sources = [...mapping.source, ...mapping.nativeSource].filter(path => production.test(path));
    if (!sources.length) throw Error('No component source for ' + row.id);
    const attachments = [
      ...mapping.unit, ...mapping.nativeUnit, ...mapping.browser, ...mapping.story,
      ...mapping.scenario, ...(mapping.style ?? []), 'docs/components/' + mapping.slug + '.md',
      'manifests/families/' + mapping.slug + '.json',
      ...(mapping.scenario.length && files.has(fixture) ? [fixture] : []),
    ];
    for (const path of [...sources, ...attachments])
      if (!files.has(path)) throw Error('Missing staged family input ' + path);
    return { id: row.id, entries, sources, attachments, scenarios: mapping.scenario,
      nativeScenarios: mapping.nativeUnit.length ? mapping.scenario : [] };
  });
}

// A helper inherits a web fixture's owner only when its callers stay inside
// the same family directory and the registered fixtures have known imports.
function fixtureHelperOwners(path, families, graph, ambiguous) {
  const directory = /^tests\/[a-z0-9-]+\//.exec(path)?.[0];
  if (!directory) return [];
  const fixture = directory + 'web-fixtures.tsx';
  const callers = reach(graph.reverse, [path]);
  if (!callers.has(fixture)) return [];
  const dependencies = reach(graph.forward, [fixture]);
  if ([...callers].some(file => !file.startsWith(directory) || !dependencies.has(file) ||
    nativeUnit.test(file) || /\.native\.[cm]?[jt]sx?$/.test(file))) return [];
  if (families.some(family => family.attachments.some(file =>
    file.endsWith('/web-fixtures.tsx') && ambiguous.has(file)))) return [];
  return families.filter(family => family.attachments.includes(fixture));
}

function affected(files, changes, cssEntries) {
  const graph = buildImportGraph(files);
  const families = familyInputs(files, graph);
  const publicFiles = new Set(graph.entries.values());
  for (const file of graph.opaque)
    if (production.test(file)) throw Error('Unresolved production dependency in ' + file);

  const ambiguous = reach(graph.reverse, graph.opaque);
  const sourceRoots = new Set();
  for (const { path } of changes) {
    if (production.test(path)) {
      sourceRoots.add(path);
      continue;
    }
    let owners = families.filter(family => family.attachments.includes(path));
    if (!owners.length) owners = fixtureHelperOwners(path, families, graph, ambiguous);
    const sources = owners.flatMap(family => family.sources);
    if (!sources.length && (unit.test(path) || nativeUnit.test(path) || browser.test(path)))
      sources.push(...[...reach(graph.forward, [path])].filter(file => production.test(file)));
    if (!sources.length || graph.opaque.has(path)) throw Error('Cannot assign staged input to a family: ' + path);
    for (const file of sources) sourceRoots.add(file);
  }
  for (const file of sourceRoots) {
    const users = reach(graph.reverse, [file]);
    if (![...users].some(path => publicFiles.has(path))) throw Error('No public entry reaches ' + file);
    if (!families.some(family => family.sources.some(path => users.has(path))))
      throw Error('No registered family reaches ' + file);
  }
  const users = reach(graph.reverse, sourceRoots);
  const nativeFixtureFiles = new Set();
  for (const [slug, screens] of graph.nativeScreens) {
    if (graph.opaque.has(fixtureRegistry) || [...screens].some(path => users.has(path) || ambiguous.has(path))) {
      const document = 'docs/components/' + slug + '.scenarios.yaml';
      if (!files.has(document)) throw Error('Missing native scenario document ' + document);
      nativeFixtureFiles.add(document);
    }
  }
  const selected = families.filter(family => family.sources.some(path => users.has(path)) ||
    family.scenarios.some(path => nativeFixtureFiles.has(path)));
  const entries = new Set(selected.flatMap(family => family.entries));
  for (const name of cssEntries) entries.add(name);
  for (const [entry, file] of graph.entries)
    if (users.has(file)) entries.add(entry);
  const candidates = reach(graph.reverse, [...sourceRoots, ...selected.flatMap(family => family.sources)]);
  for (const family of selected) for (const file of family.attachments) candidates.add(file);
  const unitTests = [], nativeUnitTests = [], browserTests = [], sharedTests = [];
  for (const file of graph.forward.keys()) {
    const target = nativeUnit.test(file) ? nativeUnitTests : unit.test(file) ? unitTests : browser.test(file) ? browserTests : null;
    if (!target) continue;
    if (candidates.has(file)) target.push(file);
    else if (ambiguous.has(file) || ![...reach(graph.forward, [file])].some(path => production.test(path))) {
      target.push(file);
      sharedTests.push(file);
    }
  }
  if (!unitTests.length || !browserTests.length) throw Error('Missing unit or Chromium coverage for the selection');
  const baseline = Object.keys(JSON.parse(files.get(budgets)));
  const budgetEntries = baseline.filter(name => entries.has(name.split('#')[0]));
  for (const entry of entries)
    if (entry.startsWith('@ui-lazy-dev/ui-web') && !budgetEntries.includes(entry))
      throw Error('No bundle baseline for ' + entry);
  const reasons = changes.map(({ path }) => path + ' → staged family ownership and transitive imports');
  if (sharedTests.length) reasons.push('Include tests with unresolved or shared fixtures: ' + sort(sharedTests).join(', '));
  return {
    tier: 1, families: sort(selected.map(family => family.id)),
    packages: sort([...entries].map(name => name.split('/').slice(0, 2).join('/'))),
    unitTests: sort(unitTests), nativeUnitTests: sort(nativeUnitTests),
    browserTests: sort(browserTests), browserProjects: ['chromium'],
    scenarioFiles: sort([...selected.flatMap(family => family.scenarios), ...nativeFixtureFiles]),
    nativeFixtureAffected: nativeFixtureFiles.size > 0,
    nativeScenarioChanged: selected.some(family => changes.some(({ path }) => family.nativeScenarios.includes(path))),
    budgetEntries: sort(budgetEntries), reasons,
  };
}

export function selectStaged(root = process.cwd(), revisions) {
  let tree, changed = [];
  try {
    const staged = stagedDiff(root, revisions);
    tree = staged.tree;
    changed = staged.changes.map(change => change.path);
    const reasons = staged.changes.map(describeChange).filter(Boolean);
    if (!changed.length) reasons.push('No staged change to classify');
    if (reasons.length) return { tier: 2, tree, changed, simulator: true, reasons };
    const files = treeFiles(root, revisions?.graphTree ?? tree, includesGraphInput);
    let scope = { css: [], native: false };
    if (changed.some(path => familyManifest.test(path) || familyStyle.test(path))) {
      const old = treeFiles(root, staged.parent, path =>
        familyManifest.test(path) || path.endsWith('.css') || path === 'packages/web/package.json');
      scope = familyChanges(old, files, staged.changes);
    }
    const { nativeScenarioChanged, ...selection } = affected(files, staged.changes, scope.css);
    const devicePath = revisions?.tree ? simulatorForPaths(changed) : simulatorRequired(root, tree);
    const simulator = devicePath || scope.native || nativeScenarioChanged || selection.nativeFixtureAffected || changed.some(path => nativeUnit.test(path));
    return { tree, changed, simulator, ...selection };
  } catch (error) {
    return { tier: 2, tree, changed, simulator: true, reasons: ['Full suite required: ' + error.message] };
  }
}

if (import.meta.main)
  console.log(JSON.stringify(selectStaged(), null, 2));
