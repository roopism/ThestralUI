#!/usr/bin/env node
import {
  readFileSync,
  readdirSync,
  cpSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  appendFileSync,
  realpathSync,
} from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import postcss from 'postcss';
import ts from 'typescript';
import {registeredFallback} from './family-fallback.mjs';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { checkBaseline, inspectSource, validateTokens } from './policy.mjs';

function read(path) {
  return readFileSync(path, 'utf8');
}
function config(name, suffix) {
  return JSON.parse(read(new URL('./profiles/' + name + suffix, import.meta.url)));
}
function contents(root, path, files) {
  for (const dirent of readdirSync(join(root, path), { withFileTypes: true })) {
    const child = join(path, dirent.name);
    if (dirent.isSymbolicLink())
      throw new Error('Unexpected symbolic link in style policy sources: ' + child);
    if (dirent.isDirectory()) contents(root, child, files);
    else if (/\.(?:css|tsx?|jsx?|svg)$/i.test(child)) files.set(child, read(join(root, child)));
  }
}
export function scanProject(root, profileName) {
  if (!['elevate', 'library'].includes(profileName))
    throw new Error('Use --profile elevate or --profile library.');
  const profile = config(profileName, '.json');
  const tokens = JSON.parse(read(join(root, profile.tokenFile)));
  const tokenErrors = validateTokens(tokens);
  if (tokenErrors.length) throw new Error(tokenErrors.join('\n'));
  const tokenPaths = Object.entries(tokens)
    .filter(([name]) => name !== 'palette')
    .flatMap(([group, leaves]) => Object.keys(leaves).map((key) => group + '.' + key));
  // A standalone sheet may repeat a published dimension while its theme is loading.
  // Preserve the declared CSS unit. Relative and absolute lengths need different roots.
  const dimensions = new Map();
  for (const [domain, entries] of Object.entries(tokens)) {
    if (domain === 'palette') continue;
    for (const [name, token] of Object.entries(entries)) {
      if (token.$type !== 'dimension' || typeof token.$value?.value !== 'number') continue;
      const property = '--uld-' + name.replace(/[A-Z]/g, c => '-' + c.toLowerCase());
      const value = String(token.$value.value) + token.$value.unit;
      dimensions.set(property, dimensions.has(property) && dimensions.get(property) !== value ? null : value);
    }
  }
  const vars = new Set();
  for (const [group, leaves] of Object.entries(tokens))
    if (group !== 'palette')
      for (const key of Object.keys(leaves))
        vars.add('--uld-' + key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()));
  const files = new Map();
  for (const dir of profile.paths) contents(root, dir, files);
  for (const path of profile.required)
    if (!files.has(path)) throw new Error('Missing style-policy adoption target: ' + path);
  for (const [path, source] of files) {
    if (path.endsWith('.css'))
      postcss.parse(source).walkDecls((decl) => {
        if (decl.prop.startsWith('--')) vars.add(decl.prop);
      });
  }
  const variables = [...vars];
  const findings = [];
  for (const [path, source] of files) {
    const scopes = path.startsWith('catalog/')
      ? [...profile.scopes, ...(profile.catalogScopes ?? [])]
      : profile.scopes;
    try {
      const standalone = profile.standaloneStyles?.[path];
      findings.push(...inspectSource(path, source, {
        scopes, variables, tokenPaths, scopeBoundary: standalone?.scopeBoundary,
        familyFallback: profileName === 'library' && !standalone ? registeredFallback(root, path, tokens) : undefined,
        dimensionFallbacks: standalone?.publishedDimensions === true ? dimensions : undefined,
      }));
    } catch (error) {
      throw new Error(path + ': ' + error.message, { cause: error });
    }
  }
  return { count: files.size, findings };
}

export function baselineRows(groups, transitions, readSource) {
  const seen = new Set();
  for (const { path, previousSha256, currentSha256, previousGroups } of transitions) {
    if (!/^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+$/.test(path) ||
        ![previousSha256, currentSha256].every(hash => /^[a-f0-9]{64}$/.test(hash)) ||
        previousSha256 === currentSha256 || seen.has(path) ||
        !Array.isArray(previousGroups) || !groups.some(group => group.path === path))
      throw Error('Invalid style baseline transition for ' + path);
    seen.add(path);
    const digest = createHash('sha256').update(readSource(path)).digest('hex');
    // The current baseline applies to the reviewed new source and subsequent edits.
    // Only the exact previously reviewed source can use its original allowances.
    if (digest === previousSha256) {
      groups = groups.filter(group => group.path !== path)
        .concat(previousGroups.map(group => ({ ...group, path })));
    }
  }
  return groups.flatMap(({ path, owner, reason, expires, entries }) =>
    entries.map(([id, rule, count]) => ({ path, owner, reason, expires, id, rule, count })),
  );
}

// Only a rendering function called directly by a public binding can own its private host allowance.
function usesPrivateHost(source, family, exports) {
  const file = ts.createSourceFile('binding.tsx', source.toString(), ts.ScriptTarget.Latest, true);
  const options = { noLib: true, noResolve: true, types: [], jsx: ts.JsxEmit.Preserve };
  const host = ts.createCompilerHost(options);
  host.getSourceFile = name => name === file.fileName ? file : undefined;
  const checker = ts.createProgram([file.fileName], options, host).getTypeChecker();
  const publicName = family.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join('');
  if (!exports?.includes('native/' + family + ':' + publicName)) return false;
  const binding = file.statements.find(s => ts.isFunctionDeclaration(s) && s.name?.text === publicName &&
    s.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword));
  return binding?.body?.statements.some(s => {
    const expression = ts.isReturnStatement(s) && s.expression;
    if (!expression || !ts.isCallExpression(expression) || !ts.isIdentifier(expression.expression)) return false;
    const declaration = checker.getSymbolAtLocation(expression.expression)?.declarations?.[0];
    return Boolean(declaration && ts.isImportSpecifier(declaration) && !declaration.isTypeOnly &&
      !declaration.parent.parent.isTypeOnly && declaration.parent.parent.parent.moduleSpecifier.text === './host.js');
  }) ?? false;
}

// A newly audited binding does not exist in the previous release. Accept that
// state only with its exact pre-adoption family manifest; once registered the
// source, its entry and the normal complete allowance set must all agree.
export function enrolledGroups(groups, additions, readSource) {
  const enrolled = new Set();
  for (const { path, previousManifestSha256 } of additions) {
    const match = /^packages\/(native|web)\/src\/([a-z0-9-]+)\/(binding\.tsx|host\.tsx|styles\.css)$/.exec(path);
    if (!match || (match[3] === 'host.tsx' && match[1] !== 'native') || (match[3] === 'styles.css' && match[1] !== 'web') || !/^[a-f0-9]{64}$/.test(previousManifestSha256) || enrolled.has(path) ||
        !groups.some(group => group.path === path)) {
      throw Error('Invalid new family style binding: ' + path);
    }
    enrolled.add(path);
    const [, platform, family, filename] = match;
    const stylesheet = filename === 'styles.css';
    const privateHost = filename === 'host.tsx';
    const bytes = readSource('manifests/families/' + family + '.json');
    const manifest = JSON.parse(bytes);
    const fileGroup = stylesheet ? 'style' : platform === 'native' ? 'nativeSource' : 'source';
    const listedSource = manifest.files?.[fileGroup]?.includes(path);
    const publicPath = './' + family + (stylesheet ? '.css' : '');
    const entry = manifest.entries?.find(item => item.pkg === platform && item.path === publicPath);
    const published = stylesheet || privateHost ? JSON.parse(readSource('packages/' + platform + '/package.json')).exports?.[publicPath] : undefined;
    try {
      readSource(path);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const digest = createHash('sha256').update(bytes).digest('hex');
      if (listedSource || entry || published !== undefined || digest !== previousManifestSha256) {
        throw Error('Missing registered family style binding: ' + path);
      }
      groups = groups.filter(group => group.path !== path);
      continue;
    }
    if (privateHost) {
      const binding = 'packages/native/src/' + family + '/binding.tsx';
      const output = './dist/' + family + '/binding';
      if (!manifest.files?.nativeSource?.includes(binding) ||
          [entry?.target, published].some(route => !route || Object.keys(route).length !== 2 || route.default !== output + '.js' || route?.types !== output + '.d.ts') ||
          !usesPrivateHost(readSource(binding), family, manifest.inventory?.nativeApi)) {
        throw Error('Unbound native family style host: ' + path);
      }
    }
    if (!listedSource || !entry || (stylesheet && (entry.target !== './dist/' + family + '.css' || published !== entry.target)))
      throw Error('Unregistered family style binding: ' + path);
  }
  return groups;
}

export function profileBaseline(profile, root = process.cwd()) {
  const settings = config(profile, '.json');
  const readSource = path => readFileSync(join(root, path));
  const groups = enrolledGroups(config(profile, '.baseline.json'), settings.baselineAdditions ?? [], readSource);
  return baselineRows(groups, settings.baselineTransitions ?? [], readSource);
}

/** A real-source canary in a disposable copy. Never mutate the caller's working tree. */
export function proveProject(root, name) {
  const source = config(name, '.json');
  const dir = mkdtempSync(join(tmpdir(), 'ui-style-proof-'));
  try {
    const manifests = (source.baselineAdditions ?? []).map(({ path }) =>
      'manifests/families/' + path.split('/')[3] + '.json');
    const familyInputs = name === 'library' ? ['packages/web/package.json', 'packages/native/package.json', 'packages/tokens/package.json', 'manifests/families', 'docs/components'] : manifests;
    for (const path of [...source.paths, source.tokenFile, ...familyInputs]) {
      const target = join(dir, path);
      mkdirSync(dirname(target), { recursive: true });
      cpSync(join(root, path), target, { recursive: true });
    }
    const file = name === 'library' ? 'packages/web/src/application-shell/binding.tsx' : 'src/components/admin.tsx';
    appendFileSync(
      join(dir, file),
      '\nexport function StyleRegressionCanary(){return <aside style={{borderRadius:"97px"}}/>}\n',
    );
    const errors = checkBaseline(scanProject(dir, name).findings, profileBaseline(name, dir));
    if (
      errors.length !== 1 ||
      !errors[0].startsWith(file + ':') ||
      !errors[0].includes('style/token [borderRadius]')
    )
      throw new Error('Expected one semantic token failure in ' + file + ': ' + errors.join('\n'));
    return errors[0];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try {
    const { values } = parseArgs({
      options: {
        root: { type: 'string', default: '.' },
        profile: { type: 'string' },
        json: { type: 'boolean' },
        prove: { type: 'boolean' },
      },
    });
    const { count, findings } = scanProject(resolve(values.root), values.profile);
    const errors = checkBaseline(findings, profileBaseline(values.profile, resolve(values.root)));
    if (values.json) console.log(JSON.stringify({ files: count, findings, errors }, null, 2));
    else if (errors.length) console.error(errors.join('\n'));
    else
      console.log(
        'Style policy passed for ' +
          count +
          ' sources (' +
          findings.length +
          ' dated, exact existing occurrences).',
      );
    if (errors.length) process.exitCode = 1;
    else if (values.prove)
      console.log(
        'Mutation correctly rejected: ' + proveProject(resolve(values.root), values.profile),
      );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
