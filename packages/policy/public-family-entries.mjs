import { existsSync, readFileSync, readdirSync, realpathSync, lstatSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

function matchedModule(ctx, row, pkg, slug, target, published, names) {
  if (!target || !published) return false;
  if (![target, published].every(value => Object.keys(value).length === 2 &&
      Object.hasOwn(value, 'types') && Object.hasOwn(value, 'default'))) return false;
  if (published.default !== target.default || published.types !== target.types) return false;
  const registered = pkg === 'native' ? row.files?.nativeSource : row.files?.source;
  for (const module of ['index', 'binding']) {
    const stem = './dist/' + slug + '/' + module;
    if (target.default !== stem + '.js' || target.types !== stem + '.d.ts') continue;
    for (const extension of ['ts', 'tsx']) {
      const path = 'packages/' + pkg + '/src/' + slug + '/' + module + '.' + extension;
      if (!registered?.includes(path) || !ctx.files.has(ctx.abs(path))) continue;
      const source = ctx.program.getSourceFile(ctx.abs(path));
      const symbol = ctx.checker.getSymbolAtLocation(source);
      if (!symbol) continue;
      const exports = ctx.checker.getExportsOfModule(symbol);
      if (exports.some(item => names.includes(item.name))) return true;
    }
  }
  return false;
}

// The store's file name, owner, installed export target and source declaration
// must all agree. Consumer policies never inherit the library's registrations.
export function registeredFamilyEntries(ctx) {
  const allowed = new Map();
  if (ctx.config.mode !== 'library' || ctx.config.registeredFamilyEntries !== true) return allowed;
  const root = realpathSync(ctx.abs('.'));
  const isLocal = path => existsSync(ctx.abs(path)) && realpathSync(ctx.abs(path)) === resolve(root, path);
  const read = path => isLocal(path) ? readFileSync(ctx.abs(path), 'utf8') : undefined;
  const store = 'manifests/families';
  if (!isLocal(store)) return allowed;
  const packages = new Map();
  for (const pkg of ['web', 'native']) {
    const manifest = JSON.parse(read('packages/' + pkg + '/package.json') ?? '{}');
    if (manifest.name === '@ui-lazy-dev/ui-' + pkg) packages.set(pkg, manifest);
  }
  for (const file of readdirSync(ctx.abs(store), { withFileTypes: true })) {
    if (!file.isFile() || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.json$/.test(file.name)) continue;
    const slug = file.name.slice(0, -5);
    const row = JSON.parse(read(store + '/' + file.name));
    if (typeof row.id !== 'string' || row.id.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-') !== slug) continue;
    for (const { pkg, path, target } of row.entries ?? []) {
      const manifest = packages.get(pkg);
      if (!manifest || (path !== './' + slug && path !== './' + slug + '.css')) continue;
      const published = manifest.exports?.[path];
      const api = pkg === 'native' ? row.inventory?.nativeApi : row.inventory?.api;
      const prefix = (pkg === 'native' ? 'native/' : '') + slug + ':';
      const names = (api ?? []).filter(id => typeof id === 'string' && id.startsWith(prefix))
        .map(id => id.slice(prefix.length)).filter(name => /^[A-Za-z_$][\w$]*$/.test(name));
      if (!names.length) continue;
      if (path.endsWith('.css')) {
        const sheet = 'packages/web/src/' + slug + '/styles.css';
        if (pkg !== 'web' || target !== './dist/' + slug + '.css' || published !== target ||
            !row.files?.style?.includes(sheet)) continue;
        const entry = row.entries.find(item => item.pkg === pkg && item.path === './' + slug);
        if (!entry || !matchedModule(ctx, row, pkg, slug, entry.target, manifest.exports?.[entry.path], names)) continue;
        const chunk = '/* @uld-css-chunk ' + slug + ' */';
        if (!read(sheet)?.split(/\r?\n/).some(line => line.trim() === chunk)) continue;
      } else if (!matchedModule(ctx, row, pkg, slug, target, published, names)) continue;
      allowed.set(manifest.name + path.slice(1), { slug, row });
    }
  }
  return allowed;
}

// A reviewed raw host may be introduced with a new public family. Its rule
// becomes usable only after the manifest, package export and source all agree.
export function registeredFamilyOwners(ctx) {
  const active = [];
  for (const rule of ctx.config.registeredOwners ?? []) {
    const match = /^@ui-lazy-dev\/ui-web\/([a-z][a-z0-9]*(?:-[a-z0-9]+)*)$/.exec(rule.entry);
    const slug = match?.[1];
    const dir = 'packages/web/src/' + slug + '/';
    if (ctx.config.mode !== 'library' || ctx.config.registeredFamilyEntries !== true || !slug ||
        typeof rule.file !== 'string' || typeof rule.symbol !== 'string' || typeof rule.family !== 'string' ||
        !rule.file?.startsWith(dir) || !/^[a-z][a-z0-9-]*\.tsx$/.test(rule.file.slice(dir.length)) ||
        !/^[A-Za-z_$][\w$]*$/.test(rule.symbol) || !/^[a-z][a-z0-9-]*$/.test(rule.family))
      throw Error('A public-family host owner requires one exact web entry, colocated source, symbol and host family.');
    const row = ctx.registeredEntries.get(rule.entry)?.row;
    const source = ctx.program.getSourceFile(ctx.abs(rule.file));
    if (!row && !source) {
      const read = path => {
        const file = ctx.abs(path);
        const stat = lstatSync(file, {throwIfNoEntry:false});
        if (!stat) return {};
        if (!stat.isFile() || realpathSync(file) !== resolve(realpathSync(ctx.abs('.')), path))
          throw Error('Public family metadata must be a regular repository file: ' + path);
        return JSON.parse(readFileSync(file, 'utf8'));
      };
      const route = './' + slug;
      const manifest = read('manifests/families/' + slug + '.json');
      const published = read('packages/web/package.json');
      if (!manifest.entries?.some(entry => entry.pkg === 'web' && entry.path === route) &&
          !Object.hasOwn(published.exports ?? {}, route)) continue;
    }
    if (!row?.files?.source?.includes(rule.file) || !ctx.files.has(ctx.abs(rule.file)) ||
        !source?.statements.some(node => ts.isFunctionDeclaration(node) && node.name?.text === rule.symbol))
      throw Error('The registered host owner must be declared in its live public family: ' + rule.file + '#' + rule.symbol);
    active.push(rule);
  }
  return active;
}
