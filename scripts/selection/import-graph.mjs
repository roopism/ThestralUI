import { posix } from 'node:path';
import { builtinModules } from 'node:module';
import ts from 'typescript';
import { fixtureRegistry, registeredNativeSlugs } from './native-tier-two.mjs';

const source = /\.[cm]?[jt]sx?$/;
export const production = /^packages\/(?:web|native)\/src\/.+\.[cm]?[jt]sx?$/;
export const unit = /^(?:tests\/(?:[^/]+|.+\/.+)|packages\/(?:native|web)\/tests?\/.+)\.test\.[jt]sx?$/;
export const nativeUnit = /^(?:(?:tests\/native\/|packages\/native\/tests?\/).+\.test\.[cm]?[jt]sx?|tests\/[^/]+\/native\.test\.cjs)$/;
// The default Playwright project and the portable scenario project have separate roots.
export const browser = /^tests\/(?:browser\/.+|[a-z0-9-]+\/[^/]+)\.spec\.[cm]?[jt]sx?$/;
const modulePath = file => '/' + file;

export function includesGraphInput(path) {
  return (source.test(path) && /^(packages\/(?:web|native)\/(?:src|tests?)\/|scripts\/scenarios\/|catalog\/|tests\/)/.test(path))
    || /^(?:packages\/[^/]+\/)?(?:package|tsconfig)\.json$/.test(path)
    || /^manifests\/families\/[^/]+\.json$/.test(path)
    || /^docs\/components\/[^/]+\.(?:md|scenarios\.yaml)$/.test(path)
    // Family manifests can list a catalog stylesheet alongside their story.
    // Presence is verified here. Editing CSS still requires Tier 2.
    || /^catalog\/[a-z0-9-]+\/.+\.css$/.test(path)
    || /^packages\/(?:web|native)\/src\/.+\.css$/.test(path)
    || path === 'packages/policy/quality/api-depth/families.json'
    || path === 'tests/packaging/bundle-baseline.json';
}

export function reach(graph, seeds) {
  const seen = new Set(seeds);
  for (const file of seen) for (const target of graph.get(file) ?? []) seen.add(target);
  return seen;
}

function packageEntries(files) {
  const entries = new Map();
  const shared = new Set();
  const external = new Set(builtinModules);
  for (const [path, text] of files) {
    if (!/(^|\/)package\.json$/.test(path)) continue;
    const pkg = JSON.parse(text);
    for (const section of ['dependencies', 'optionalDependencies', 'devDependencies', 'peerDependencies'])
      for (const name of Object.keys(pkg[section] ?? {})) external.add(name);
    if (!/^packages\/(?:native|web)\/package\.json$/.test(path)) {
      if (pkg.name) shared.add(pkg.name);
      continue;
    }
    const folder = posix.dirname(path);
    const configPath = folder + '/tsconfig.json';
    const config = ts.parseConfigFileTextToJson(configPath, files.get(configPath) ?? '{}').config;
    const { outDir, rootDir } = config.compilerOptions ?? {};
    if (outDir !== 'dist' || rootDir !== 'src') throw Error('Unsupported source layout in ' + configPath);
    for (const [subpath, conditions] of Object.entries(pkg.exports ?? {})) {
      const name = pkg.name + (subpath === '.' ? '' : subpath.slice(1));
      const output = typeof conditions === 'string' ? conditions : conditions.default;
      if (!output?.startsWith('./dist/')) throw Error('Unknown package export ' + name);
      if (!source.test(output)) { shared.add(name); continue; }
      if (typeof conditions === 'object' && Object.keys(conditions).some(key => !['default', 'types'].includes(key)))
        throw Error('Platform-conditioned package export ' + name);
      const base = folder + '/src/' + output.slice('./dist/'.length).replace(/\.[cm]?js$/, '');
      const matched = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs']
        .map(ext => base + ext).filter(file => files.has(file));
      if (matched.length !== 1) throw Error('Ambiguous source for ' + name);
      entries.set(name, matched[0]);
    }
  }
  return { entries, external, shared };
}

export function references(ast, { workspace = false } = {}) {
  const imports = [], visits = [], constants = new Map();
  let dynamic = false, storyTitle;
  function walk(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier)
      imports.push(node.moduleSpecifier.text);
    if (ts.isExternalModuleReference(node) && ts.isStringLiteralLike(node.expression)) imports.push(node.expression.text);
    if (ts.isImportTypeNode(node)) {
      const literal = node.argument.literal;
      if (literal && ts.isStringLiteralLike(literal)) imports.push(literal.text);
      else dynamic = true;
    }
    // Bundler macros and computed paths cannot be resolved against a single input.
    if (ts.isPropertyAccessExpression(node) && ts.isMetaProperty(node.expression) &&
        !(workspace && ['url', 'main'].includes(node.name.text))) dynamic = true;
    if (workspace && ts.isIdentifier(node) && node.text === 'require' &&
        !(ts.isCallExpression(node.parent) && node.parent.expression === node)) dynamic = true;
    if (workspace && ts.isPropertyAccessExpression(node) && node.name.text === 'require') dynamic = true;
    if (workspace && ts.isElementAccessExpression(node) &&
        (ts.isMetaProperty(node.expression) || node.argumentExpression?.text === 'require')) dynamic = true;
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword
        || (ts.isIdentifier(node.expression) && node.expression.text === 'require')) {
        const argument = node.arguments[0];
        if (argument && ts.isStringLiteralLike(argument)) imports.push(argument.text);
        else dynamic = true;
      }
      if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'goto')
        visits.push(node.arguments[0]);
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer
      && (node.parent.flags & ts.NodeFlags.Const)) {
      // A shadowed identifier could have a different URL in another scope.
      constants.set(node.name.text, constants.has(node.name.text) ? undefined : node.initializer);
    }
    if (ts.isPropertyAssignment(node) && node.name.getText() === 'title' && ts.isStringLiteralLike(node.initializer))
      storyTitle ??= node.initializer.text;
    ts.forEachChild(node, walk);
  }
  walk(ast);
  function prefix(node, seen = new Set()) {
    if (!node) return '';
    if (ts.isStringLiteralLike(node)) return node.text;
    if (ts.isTemplateExpression(node)) return node.head.text;
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken)
      return prefix(node.left, seen);
    if (ts.isIdentifier(node) && !seen.has(node.text)) {
      seen.add(node.text);
      return prefix(constants.get(node.text), seen);
    }
    return '';
  }
  return { imports, dynamic, storyTitle, routes: visits.map(node => prefix(node)) };
}

export function buildImportGraph(files) {
  const { entries, external, shared } = packageEntries(files);
  const forward = new Map(), reverse = new Map(), opaque = new Set(), stories = new Map(), inputs = new Map();
  const config = ts.parseConfigFileTextToJson('tsconfig.json', files.get('tsconfig.json') ?? '{}').config;
  if (config.extends || config.references) throw Error('Unclassified root TypeScript configuration');
  const options = { moduleResolution: ts.ModuleResolutionKind.Bundler, allowJs: true,
    paths: config.compilerOptions?.paths, baseUrl: posix.resolve('/', config.compilerOptions?.baseUrl ?? '.') };
  const host = { fileExists: path => files.has(path.slice(1)), readFile: path => files.get(path.slice(1)),
    getCurrentDirectory: () => '/' };
  const resolverCache = ts.createModuleResolutionCache('/', name => name, options);
  const nativeScreens = new Map(), fixtureImports = new Map();
  function edge(from, to, ref) {
    if (from === fixtureRegistry)
      for (const slug of fixtureImports.get(ref) ?? []) nativeScreens.get(slug).add(to);
    forward.get(from).add(to);
    if (!reverse.has(to)) reverse.set(to, new Set());
    reverse.get(to).add(from);
  }
  for (const [file, body] of files) {
    if (!source.test(file)) continue;
    const ast = ts.createSourceFile(file, body, ts.ScriptTarget.Latest, true);
    if (file === fixtureRegistry) {
      // Resolve each registered fixture's imports with the same staged graph as other consumers.
      registeredNativeSlugs(body, (slug, descriptor) => {
        if (!nativeScreens.has(slug)) nativeScreens.set(slug, new Set());
        for (const ref of references(descriptor).imports) {
          if (!fixtureImports.has(ref)) fixtureImports.set(ref, new Set());
          fixtureImports.get(ref).add(slug);
        }
      });
    }
    const refs = references(ast);
    if (refs.dynamic || ast.parseDiagnostics.length || ast.referencedFiles.length) opaque.add(file);
    inputs.set(file, refs);
    forward.set(file, new Set());
    if (file.includes('.stories.') && refs.storyTitle) {
      const slug = refs.storyTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      if (!stories.has(slug)) stories.set(slug, []);
      stories.get(slug).push(file);
    }
  }
  for (const [file, { imports, routes }] of inputs) {
    for (const ref of imports) {
      if (entries.has(ref)) { edge(file, entries.get(ref), ref); continue; }
      const result = ts.resolveModuleName(ref, modulePath(file), options, host, resolverCache).resolvedModule;
      if (result && files.has(result.resolvedFileName.slice(1))) {
        edge(file, result.resolvedFileName.slice(1), ref);
        continue;
      }
      const pkg = ref.startsWith('@') ? ref.split('/').slice(0, 2).join('/') : ref.split('/')[0];
      if (!shared.has(pkg) && !shared.has(ref) && !external.has(pkg) && !ref.startsWith('node:'))
        opaque.add(file);
      if (ref.startsWith('@ui-lazy-dev/') && !shared.has(ref) && !shared.has(pkg)) opaque.add(file);
    }
    for (const route of routes) {
      const slug = /[?&]id=([\w-]+?)--/.exec(route)?.[1];
      const matches = stories.get(slug);
      if (matches?.length) for (const story of matches) edge(file, story);
      else opaque.add(file);
    }
  }
  return { forward, reverse, opaque, entries, nativeScreens };
}
