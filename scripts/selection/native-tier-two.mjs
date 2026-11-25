import ts from 'typescript';
import { isDeepStrictEqual } from 'node:util';
import { runtimeWorkspaces } from '../package-workspaces.mjs';
import { verificationOutputs } from '../manifests/generate.mjs';
import { checkFamilyRegistration } from '../manifests/product-registrations.mjs';
import { treeFiles } from './staged-tree.mjs';

// The only native exclusions specified by the frozen goal, §5. A family cannot exempt itself.
const exclusions = new Map([
  ['breadcrumb', 'Breadcrumb'],
  ['keyboard-shortcut-label', 'Keyboard shortcut label'],
  ['tooltip', 'Tooltip'],
]);
const manifestPath = /^manifests\/families\/([a-z0-9-]+)\.json$/;
const packagePath = /^packages\/([^/]+)\/package\.json$/;
export const fixtureRegistry = 'catalog/native/scenarios/fixtures.cjs';
const sharedManifest = 'manifests/shared.json';

export function registeredNativeSlugs(source, visitFixture) {
  const syntax = ts.createSourceFile(fixtureRegistry, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const statement = syntax.statements[0];
  const assignment = statement && ts.isExpressionStatement(statement) && statement.expression;
  if (syntax.parseDiagnostics.length || syntax.statements.length !== 1 || !assignment ||
      !ts.isBinaryExpression(assignment) || assignment.left.getText(syntax) !== 'module.exports' ||
      assignment.operatorToken.kind !== ts.SyntaxKind.EqualsToken || !ts.isObjectLiteralExpression(assignment.right))
    throw Error('Unrecognized native fixture registry');
  const slugs = new Set();
  for (const property of assignment.right.properties) {
    if (!ts.isPropertyAssignment(property) || !ts.isStringLiteral(property.name) ||
        !ts.isObjectLiteralExpression(property.initializer) || !/^[a-z0-9-]+\.[a-z0-9-]+$/.test(property.name.text))
      throw Error('Unclassified native fixture entry');
    const slug = property.name.text.split('.')[0];
    slugs.add(slug);
    visitFixture?.(slug, property.initializer, property.name.text);
  }
  return slugs;
}

function mobileExcluded(row, slug, registered) {
  return row?.id === exclusions.get(slug) && exclusions.has(slug) && !registered.has(slug) &&
    ['planned', 'excluded'].includes(row.inventory.native) &&
    !row.inventory.nativeApi?.length && !row.inventory.nativeStory && !row.inventory.nativeTest &&
    !row.files.nativeSource?.length && !row.files.nativeUnit?.length && !row.cases?.native?.length &&
    !row.depth?.evidence?.native && !row.rootExports?.some(entry => entry.pkg !== 'web') &&
    !row.entries?.some(entry => entry.pkg !== 'web') &&
    !row.budgets?.some(entry => !/^@ui-lazy-dev\/ui-web(?:[#/]|$)/.test(entry.name));
}

function snapshot(root, tree, changed) {
  // Reading by Git object ID also rejects symlinks and gitlinks, including newly added web assets.
  const files = treeFiles(root, tree, path => changed.has(path) || manifestPath.test(path) ||
    packagePath.test(path) || path === fixtureRegistry || path === sharedManifest);
  const packages = new Map(), families = [], excluded = new Set(), webFixtures = new Set();
  const registered = registeredNativeSlugs(files.get(fixtureRegistry));
  for (const [path, body] of files) {
    if (packagePath.test(path)) {
      const manifest = JSON.parse(body);
      if (packages.has(manifest.name)) throw Error('Duplicate workspace identity');
      packages.set(manifest.name, { manifest });
    }
    const slug = manifestPath.exec(path)?.[1];
    if (!slug) continue;
    const family = JSON.parse(body);
    checkFamilyRegistration(null, family, path);
    families.push(family);
    if (!mobileExcluded(family, slug, registered)) continue;
    excluded.add(slug);
    for (const key of ['unit', 'browser', 'visual', 'story', 'scenario'])
      for (const entry of family.files[key] ?? []) webFixtures.add(entry);
  }
  const nativeDependencies = runtimeWorkspaces(packages, ['@ui-lazy-dev/ui-native']);
  if (nativeDependencies.has('@ui-lazy-dev/ui-web')) throw Error('Native consumes the web package');
  const ownedWeb = new Set(families.flatMap(family => [...(family.files?.source ?? []), ...(family.files?.style ?? [])]));
  return { files, excluded, webFixtures, ownedWeb, outputs: verificationOutputs({
    families: families.sort((a, b) => a.order - b.order), shared: JSON.parse(files.get(sharedManifest)),
  }) };
}

function webOnlyPath(path, before, after) {
  if (after.outputs.has(path))
    return [before, after].every(side => side.files.get(path) === side.outputs.get(path));
  if (path === 'packages/web/package.json') {
    const old = JSON.parse(before.files.get(path)), next = JSON.parse(after.files.get(path));
    delete old.exports; delete next.exports;
    return old.name === '@ui-lazy-dev/ui-web' && isDeepStrictEqual(old, next);
  }
  if (/^packages\/web\/src\//.test(path)) return after.ownedWeb.has(path) && /\.(?:[jt]sx?|css)$/.test(path);
  if (/^tests\/packaging\/fixture\/app\/.+\.(?:[jt]sx?|css)$/.test(path))
    return true;
  const slug = (manifestPath.exec(path) ?? /^docs\/components\/([a-z0-9-]+)\.(?:md|scenarios\.yaml)$/.exec(path) ??
    /^(?:tests|catalog)\/([a-z0-9-]+)(?:\/|\.stories\.)/.exec(path))?.[1];
  if (!slug || !before.excluded.has(slug) || !after.excluded.has(slug)) return false;
  if (manifestPath.test(path) || path === 'docs/components/' + slug + '.md') return true;
  if (path.startsWith('catalog/' + slug + '/')) return /\.(?:[jt]sx?|css)$/.test(path);
  const owner = path.replace(/-snapshots\/[^/]+\.png$/, '');
  return after.webFixtures.has(owner) || before.webFixtures.has(owner);
}

// Ordinary Tier 2 retains every shared check. Only a completely explained web diff may omit iOS.
// The caller fails closed for errors, deletions, type changes, unknown files and all full/PR runs.
export function isVerifiedWebChange(root, { parent, tree, changes }) {
  if (!changes.length || changes.some(change => !['M', 'A'].includes(change.status))) return false;
  const paths = new Set(changes.map(change => change.path));
  if ([...paths].some(path => !/^(?:packages\/web\/|catalog\/(?!native\/|modes\/)|docs\/(?:components\/|component-inventory\.mjs$)|manifests\/families\/|tests\/|packages\/policy\/quality\/api-depth\/families\.json$)/.test(path))) return false;
  const before = snapshot(root, parent, paths), after = snapshot(root, tree, paths);
  return [...paths].every(path => webOnlyPath(path, before, after));
}
