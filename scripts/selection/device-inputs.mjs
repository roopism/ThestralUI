import { git } from './device-observations.mjs';
import { createHash } from 'node:crypto';
import { isBuiltin } from 'node:module';
import { posix as path } from 'node:path';
import ts from 'typescript';
import postcss from 'postcss';
import { references } from './import-graph.mjs';
import { treeFiles } from './staged-tree.mjs';

const cache = new Map();
const source = /\.[cm]?[jt]sx?$/;
const nativeBuild = /(?:^|\/)(?:Podfile|[^/]*\.podspec|[^/]*\.gradle(?:\.kts)?|gradlew(?:\.bat)?|CMakeLists\.txt|[^/]*\.(?:cmake|xcconfig|pbxproj))$/;
const workspace = file => /^packages\/[^/]+(?=\/|$)/.exec(file)?.[0];
const host = 'tests/simulator/host/package.json';
const deps = pkg => Object.assign({}, ...['dependencies', 'peerDependencies', 'optionalDependencies', 'devDependencies'].map(k => pkg[k]));
const config = /(?:^|\/)(?:\.env(?:\..*)?|\.(?:babelrc|eslintrc)(?:\..*)?|(?:tsconfig|jsconfig)[^/]*\.json|(?:babel|metro|vite|eslint|react-native)\.config\.[^/]+|app\.json|Podfile(?:\.lock)?|[^/]*\.podspec|[^/]*\.gradle(?:\.kts)?|gradle\.properties)$/;
export const skipReasons = new Set(['documentation', 'web package', 'web story', 'browser fixture']);

export function pathClass(file) {
  if (/[\u0000-\u001f\ufffd\\]/u.test(file)) return 'unknown';
  if (/(^|\/)(package\.json|[^/]*\.lock|bun\.lockb|(?:package|npm-shrinkwrap|pnpm)-lock\.(?:json|ya?ml)|npm-shrinkwrap\.json)$/.test(file))
    return 'package manifest or lockfile';
  if (config.test(file) || nativeBuild.test(file) || /(?:^|\/)(?:ios|android|gradle)\//.test(file)) return 'device build configuration';
  if (/\.scenarios\.ya?ml$/.test(file)) return 'shared scenario';
  if (file.startsWith('manifests/')) return 'shared manifest';
  if (/^packages\/(native|tokens)\//.test(file)) return 'native or token package';
  if (/^(?:tests\/(?:native|simulator|scenarios)\/|catalog\/(?:native|modes)\/)/.test(file)) return 'device harness';
  if (/^(?:scripts\/|\.githooks\/|\.github\/|packages\/(?:style-)?policy\/)/.test(file)) return 'gate or tooling';
  if (/^docs\/.+\.(?:md|txt|rst)$/.test(file) || file === 'README.md') return 'documentation';
  if (/^packages\/web\/.+\.(?:[cm]?[jt]sx?|css|md)$/.test(file)) return 'web package';
  if (/^catalog\/.+\.stories\.[jt]sx?$/.test(file)) return 'web story';
  if (/^tests\/browser\/.+\.(?:[cm]?[jt]sx?|css|png|json)$/.test(file)) return 'browser fixture';
  return 'unknown';
}

// Imports execute top-level code. Follow named function bodies when they are
// referenced, so an unrelated CLI in a shared harness module is not a build input.
function importedBody(file, body, used) {
  if (!used || used.has('*') || !file.endsWith('.mjs')) return body;
  const ast = ts.createSourceFile(file, body, ts.ScriptTarget.Latest, true);
  const live = new Set(used), functions = new Map();
  const statements = [];
  const names = node => {
    if (ts.isIdentifier(node)) live.add(node.text);
    ts.forEachChild(node, names);
  };
  for (const stmt of ast.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name && !stmt.modifiers?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword)) {
      functions.set(stmt.name.text, stmt);
      continue;
    }
    if (ts.isIfStatement(stmt) && ['import.meta.main',
      'process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href'].includes(stmt.expression.getText(ast))) continue;
    if (ts.isExportDeclaration(stmt) && !stmt.moduleSpecifier && stmt.exportClause?.elements) {
      for (const el of stmt.exportClause.elements) if (used.has(el.name.text)) live.add((el.propertyName ?? el.name).text);
      continue;
    }
    statements.push(stmt);
    if (!ts.isImportDeclaration(stmt)) names(stmt);
  }
  for (const name of live) if (functions.has(name)) {
    const stmt = functions.get(name);
    statements.push(stmt);
    names(stmt);
  }
  return statements.map(stmt => stmt.getText(ast)).join('\n');
}

export function deviceInputs(root, tree) {
  const cacheKey = /^[a-f0-9]{40}$/.test(tree) && root + '\0' + tree;
  if (cacheKey && cache.has(cacheKey)) return cache.get(cacheKey);
  // Read tracked blobs only, including files outside the workspace which may be
  // reached by relative imports. Unsupported Git modes invalidate the entire proof.
  const files = treeFiles(root, tree, () => true);
  const classes = new Map([...files.keys()].map(file => [file, pathClass(file)]));
  const queue = new Set(), visitedPackages = new Set(), packages = new Map(), names = new Map();
  const json = file => JSON.parse(files.get(file));
  const error = message => { throw Error(message); };
  function add(file) {
    if (!files.has(file)) error('unresolved device input ' + file);
    queue.add(file);
    if (skipReasons.has(classes.get(file))) classes.set(file, 'transitive device input');
  }
  function addPackage(dir) {
    if (visitedPackages.has(dir)) return;
    visitedPackages.add(dir);
    const pkg = packages.get(dir);
    if (!pkg) error('missing workspace ' + dir);
    for (const file of files.keys()) if (file.startsWith(dir + '/')) {
      add(file);
      if (dir !== 'packages/native' && dir !== 'packages/tokens') classes.set(file, 'native workspace dependency');
    }
    // A generator can live outside the workspace containing its generated output.
    for (const script of ['prebuild','build','postbuild','prepare','prepack']) {
      if (!pkg.scripts?.[script]) continue;
      for (const step of pkg.scripts[script].split(/\s+&&\s+/)) {
        const match = /^(?:node|tsc -p) ([\w./-]+)$/.exec(step);
        if (!match) error('unmodeled workspace build step in ' + dir);
        local(dir + '/package.json', match[1], true);
      }
    }
    addDependencies(deps(pkg));
  }
  function addDependencies(entries) {
    for (const [name, spec] of Object.entries(entries)) {
      if (/^(?:file:|link:|npm:|\.\.?\/)/.test(spec)) error('indirect dependency ' + name);
      if (names.has(name)) addPackage(names.get(name));
    }
  }
  function local(from, ref, exact = false) {
    if (!ref || /[?#*{}\[\]\\%]|^[a-z]+:|^\//i.test(ref)) error('unresolved input ' + ref + ' in ' + from);
    const target = path.join(path.dirname(from), ref);
    const stem = target.replace(/\.[cm]?jsx?$/, '');
    const variants = new Set([target]);
    if (!exact) for (const suffix of ['', '.native', '.ios', '.android'])
      for (const ext of ['js','jsx','ts','tsx','cjs','mjs','cts','mts','d.ts','json']) {
        variants.add(stem + suffix + '.' + ext);
        variants.add(target + '/index' + suffix + '.' + ext);
      }
    const hits = [...variants].filter(file => files.has(file));
    if (!hits.length) error('unresolved import ' + ref + ' in ' + from);
    for (const file of hits) {
      add(file);
      if (packages.has(workspace(file))) addPackage(workspace(file));
    }
  }
  const imported = new Map();
  let opaque;
  try {
    const project = json('package.json');
    if (JSON.stringify(project.workspaces) !== '["packages/*"]') error('unrecognized workspace layout');
    for (const file of files.keys()) if (nativeBuild.test(file))
      error('unmodeled native build inputs in ' + file);
    for (const file of files.keys()) if (/^packages\/[^/]+\/package\.json$/.test(file)) {
      const pkg = json(file), dir = workspace(file);
      if (!pkg.name || names.has(pkg.name)) error('ambiguous workspace ' + file);
      names.set(pkg.name, dir);
      packages.set(dir, pkg);
    }
    const external = { ...deps(project), ...deps(json(host)) };
    const locks = ['package-lock.json', 'tests/simulator/host/package-lock.json']
      .filter(file => files.has(file)).map(file => json(file).packages ?? {});
    addDependencies(deps(json(host)));
    for (const dir of ['packages/native','packages/tokens','packages/icons'])
      if (dir !== 'packages/icons' || packages.has(dir)) addPackage(dir);
    for (const file of files.keys()) if (config.test(file) ||
        /^(?:catalog\/(?:native|modes)\/|tests\/(?:native|android)\/|tests\/simulator\/(?!bootstrap\/)|scripts\/(?:scenarios\/|verify-(?:ios-simulator|android-emulator)\.mjs$))/.test(file)) add(file);
    const roots = new Set(queue);
    const processed = new Set();
    while (queue.size) {
      const file = queue.values().next().value;
      queue.delete(file);
      const signature = JSON.stringify([file, [...(imported.get(file) ?? [])].sort()]);
      if (processed.has(signature)) continue;
      processed.add(signature);
      const body = files.get(file);
      if (/(?:^|\/)tsconfig[^/]*\.json$/.test(file)) {
        const { config: cfg, error: invalid } = ts.parseConfigFileTextToJson(file, body);
        if (invalid || cfg.references || ['paths','rootDirs','baseUrl','plugins','moduleSuffixes','typeRoots'].some(k => cfg.compilerOptions?.[k]))
          error('unmodeled resolver in ' + file);
        if (cfg.extends) local(file, cfg.extends, true);
        for (const input of cfg.files ?? []) local(file, input, true);
        if (visitedPackages.has(workspace(file)) && (cfg.include ?? []).some(pattern =>
          pattern.startsWith('/') || pattern.split('/').includes('..'))) error('external compiler input pattern in ' + file);
      }
      if (file.endsWith('.json') && !file.endsWith('lock.json')) {
        JSON.parse(body, (key, value) => {
          if (key === '$ref' && !value.startsWith('#')) local(file, value, true);
          return value;
        });
      }
      if (file.endsWith('.css')) {
        const css = postcss.parse(body);
        css.walkAtRules('import', rule => {
          const ref = /^(?:url\(\s*)?(?:"([^"]+)"|'([^']+)'|([^\s)]+))/.exec(rule.params);
          if (!ref) error('unresolved CSS import in ' + file);
          local(file, ref[1] ?? ref[2] ?? ref[3], true);
        });
        css.walkDecls(decl => {
          for (const match of decl.value.matchAll(/url\(\s*(?:"([^"]+)"|'([^']+)'|([^)]*))\s*\)/gi))
            local(file, (match[1] ?? match[2] ?? match[3]).trim(), true);
          if (/\\|(?:image-set|var)\s*\([^)]*url/i.test(decl.value)) error('unresolved CSS URL in ' + file);
        });
      }
      if (!source.test(file)) continue;
      const live = importedBody(file, body, roots.has(file) ? undefined : imported.get(file));
      const ast = ts.createSourceFile(file, live, ts.ScriptTarget.Latest, true);
      function literalInputs(node) {
        if (ts.isNewExpression(node) && node.expression.getText(ast) === 'URL' &&
            node.arguments?.[1]?.getText(ast) === 'import.meta.url' && ts.isStringLiteralLike(node.arguments[0])) {
          const ref = node.arguments[0].text;
          if (ref.startsWith('.') && path.extname(ref)) local(file, ref, true);
        }
        if (ts.isCallExpression(node) && ['join','resolve'].includes(node.expression.getText(ast)) &&
            node.arguments.length > 1 && node.arguments.slice(1).every(ts.isStringLiteralLike)) {
          const target = path.join(...node.arguments.slice(1).map(arg => arg.text));
          if (skipReasons.has(classes.get(target))) add(target);
        }
        if (ts.isStringLiteralLike(node) && (ts.isCallExpression(node.parent) || ts.isNewExpression(node.parent)) &&
            /^(?:join|resolve|URL|readFile(?:Sync)?|stat(?:Sync)?|readdir(?:Sync)?|open(?:Sync)?|cp(?:Sync)?)$/.test(node.parent.expression.getText(ast)) && /^(?:tests|docs|catalog|packages|manifests|scripts)\/[\w.@/-]+$/.test(node.text)) {
          const prefix = node.text.replace(/\/$/, '');
          for (const name of files.keys()) if ((name === prefix || name.startsWith(prefix + '/')) && skipReasons.has(classes.get(name))) add(name);
        }
        ts.forEachChild(node, literalInputs);
      }
      literalInputs(ast);
      const { imports, dynamic } = references(ast, { workspace: true });
      if (dynamic || ast.parseDiagnostics.length || ast.typeReferenceDirectives.length ||
          /\b(?:glob|globSync|createRequire)\s*\(/.test(live)) error('unresolved source imports in ' + file);
      for (const {fileName} of ast.referencedFiles) local(file, fileName, true);
      for (const ref of imports) {
        const name = ref.startsWith('@') ? ref.split('/').slice(0, 2).join('/') : ref.split('/')[0];
        if (names.has(name)) {
          const dir = names.get(name);
          addPackage(dir);
          // Package-wide closure includes platform variants, generated exports and assets.
          const exports = packages.get(dir).exports;
          if (ref !== name) {
            const subpath = '.' + ref.slice(name.length);
            if (exports && !Object.hasOwn(exports, subpath)) error('unresolved workspace export ' + ref);
            if (!exports) local(dir + '/package.json', subpath);
          }
        } else if (ref.startsWith('.')) {
          const dest = path.join(path.dirname(file), ref);
          const importsOf = ast.statements.filter(n => ts.isImportDeclaration(n) && n.moduleSpecifier.text === ref);
          const wanted = imported.get(dest) ?? new Set();
          if (!importsOf.length || ast.statements.some(n => ts.isExportDeclaration(n) && n.moduleSpecifier?.text === ref)) wanted.add('*');
          const code = ast.statements.filter(n => !ts.isImportDeclaration(n)).map(n => n.getText(ast)).join('\n');
          for (const stmt of importsOf) {
            const bindings = stmt.importClause?.namedBindings;
            if (stmt.importClause?.name || (bindings && ts.isNamespaceImport(bindings))) wanted.add('*');
            else for (const el of bindings?.elements ?? []) if (code.includes(el.name.text)) wanted.add((el.propertyName ?? el.name).text);
          }
          imported.set(dest, wanted);
          // The packed Android entry is staged at the host root beside catalog/.
          if (file === 'tests/android/index.js' && ref.startsWith('./catalog/')) local('index.js', ref);
          else if (file === 'packages/tokens/modes/runtime.mjs' && ['./axes.js','./brands/enterprise.js'].includes(ref)) {
            add('packages/tokens/modes/outputs.mjs');
            add('packages/tokens/modes/system.resolver.json');
          } else local(file, ref);
        } else if (file === 'scripts/gates/device-metro.cjs' && ref === 'metro/private/Server') {
          const lock = 'tests/simulator/host/package-lock.json';
          if (!json(lock).packages['node_modules/metro']?.integrity) error('unlocked Metro recorder dependency');
          add(lock);
        } else if (!isBuiltin(ref)) {
          const declared = Object.hasOwn(external, name) || Object.hasOwn(deps(packages.get(workspace(file)) ?? {}), name);
          if (!declared || ref !== name || !locks.some(lock => lock['node_modules/' + name]?.integrity))
            error('unresolved import ' + ref + ' in ' + file);
        }
      }
    }
  } catch (cause) { opaque = cause.message; }
  const hash = createHash('sha256');
  // Include modes and raw object IDs (binary assets, config, generators, tools).
  // A baseline is portable across changes only in the explicitly skippable set.
  for (const record of git(root, 'ls-tree', '-rz', tree).split('\0').filter(Boolean)) {
    const file = record.slice(record.indexOf('\t') + 1);
    if (!skipReasons.has(classes.get(file))) hash.update(record + '\0');
  }
  const result = { classes, opaque, key: hash.digest('hex') };
  if (cacheKey) {
    if (cache.size >= 8) cache.delete(cache.keys().next().value);
    cache.set(cacheKey, result);
  }
  return result;
}
