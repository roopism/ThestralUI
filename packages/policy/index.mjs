import ts from 'typescript';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { inspectOwnership } from './ownership.mjs';
import { inspectArchitecture } from './architecture.mjs';
import { selectOwners } from './owner-transitions.mjs';
import { registeredFamilyEntries, registeredFamilyOwners } from './public-family-entries.mjs';

export function scan(root, input) {
  const config = { owners: [], adapters: [], publicEntries: {}, ...input };
  if (
    !['library', 'consumer'].includes(config.mode) ||
    !Array.isArray(config.include) ||
    !config.include.length
  )
    throw Error('Configure mode and source roots before running the UI gate.');
  const selected = selectOwners(root, config);
  config.owners = selected.owners;
  for (const rule of [...config.owners, ...config.adapters])
    if (!rule.file || !rule.symbol || !rule.family || /[?*]/.test(rule.file + rule.symbol))
      throw Error('Owner and adapter grants require an exact source file and symbol.');
  const files = new Set();
  const abs = (p) => resolve(root, p),
    rel = (p) => relative(root, p).replaceAll('\\', '/');
  function discover(path, includeRoot = path) {
    if (!existsSync(path)) return;
    if (!statSync(path).isDirectory()) {
      if (/\.[cm]?[jt]sx?$/.test(path) && !path.endsWith('.d.ts')) files.add(path);
      return;
    }
    for (const child of readdirSync(path, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      if (
        ['node_modules', '.git', '.next'].includes(child.name) ||
        (path === includeRoot && ['dist', 'release'].includes(child.name)) ||
        child.isSymbolicLink()
      )
        continue;
      discover(resolve(path, child.name), includeRoot);
    }
  }
  for (const dir of config.include) discover(abs(dir));
  if (!files.size) throw Error('The policy scope contains no source files.');
  for (const rule of [...config.owners, ...config.adapters])
    if (!files.has(abs(rule.file)))
      throw Error(
        'The declared owner or adapter is outside scanned production files: ' + rule.file,
      );
  let project = {};
  if (existsSync(abs('tsconfig.json'))) {
    const cfg = ts.readConfigFile(abs('tsconfig.json'), ts.sys.readFile);
    if (cfg.error) throw Error('Invalid tsconfig');
    project = ts.parseJsonConfigFileContent(cfg.config, ts.sys, root).options;
  }
  const options = {
    ...project,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    allowJs: true,
    noEmit: true,
    skipLibCheck: true,
    types: [],
  };
  const program = ts.createProgram([...files], options);
  const findings = [],
    usage = [],
    occurrences = new Map();
  function emit(file, node, symbol, rule, family, detail, fix) {
    // Include only the exact syntactic site, scope and occurrence. Whitespace-only edits keep a review valid.
    const printer = ts.createPrinter({ removeComments: true });
    const text = printer.printNode(ts.EmitHint.Unspecified, node, node.getSourceFile());
    const key = JSON.stringify([file, symbol, rule, family, detail, text]);
    const count = (occurrences.get(key) ?? 0) + 1;
    occurrences.set(key, count);
    const fingerprint = createHash('sha256')
      .update(key + '#' + count)
      .digest('hex');
    findings.push({
      fingerprint,
      file,
      line: node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line + 1,
      symbol,
      rule,
      family,
      detail,
      fix,
    });
  }
  const ctx = {
    config,
    files,
    program,
    options,
    checker: program.getTypeChecker(),
    rel,
    abs,
    emit,
    usage,
  };
  ctx.registeredEntries = registeredFamilyEntries(ctx);
  config.owners.push(...registeredFamilyOwners(ctx));
  inspectOwnership(ctx);
  inspectArchitecture(ctx);
  return { files: files.size, findings, usage, historicalExceptions: selected.retired };
}
export function review(findings, exceptions, today = new Date().toISOString().slice(0, 10)) {
  if (!Array.isArray(exceptions)) throw Error('Provide the reviewed exception array.');
  const errors = [],
    ids = new Map(findings.map((f) => [f.fingerprint, f])),
    accepted = new Set();
  for (const e of exceptions) {
    if (
      !/^[a-f\d]{64}$/.test(e.fingerprint) ||
      !e.owner?.trim() ||
      !e.reason?.trim() ||
      !/^\d{4}-\d{2}-\d{2}$/.test(e.expires) ||
      !Number.isFinite(Date.parse(e.expires)) ||
      new Date(e.expires).toISOString().slice(0, 10) !== e.expires
    ) {
      errors.push(
        'Invalid exception metadata. Supply an exact fingerprint, accountable owner, reason and ISO expiry date.',
      );
      continue;
    }
    if (e.expires > '2027-02-01') errors.push('Ownership exception exceeds its retirement date: ' + e.fingerprint);
    if (accepted.has(e.fingerprint))
      errors.push('Duplicate reviewed fingerprint: ' + e.fingerprint);
    if (e.expires <= today)
      errors.push(
        'Expired exception ' +
          e.fingerprint +
          ' owned by ' +
          e.owner +
          '. Replace the control or renew its review.',
      );
    if (!ids.has(e.fingerprint))
      errors.push('Stale exception ' + e.fingerprint + '. Remove it and review any changed site.');
    accepted.add(e.fingerprint);
  }
  for (const f of findings)
    if (!accepted.has(f.fingerprint))
      errors.push(
        f.file +
          ':' +
          f.line +
          ' [' +
          f.rule +
          '] ' +
          f.symbol +
          ' uses ' +
          f.detail +
          '. ' +
          f.fix +
          ' [' +
          f.fingerprint +
          ']',
      );
  return errors;
}
export function loadPolicy(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
export function adoption(usage) {
  const screens = new Map();
  for (const u of usage) {
    if (!screens.has(u.file)) screens.set(u.file, new Map());
    const families = screens.get(u.file);
    if (!families.has(u.family))
      families.set(u.family, { eligible: 0, adopted: 0, bridged: 0, raw: 0, substitute: 0 });
    const counts = families.get(u.family);
    counts.eligible++;
    counts[u.status]++;
  }
  return Object.fromEntries(
    [...screens].sort().map(([name, items]) => [name, Object.fromEntries([...items].sort())]),
  );
}
