import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { checkMigration } from '../packages/codemods/migrations.mjs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function compareDeclarations(previous, current) {
  const program = ts.createProgram([previous, current], {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.ReactJSX,
    strict: true, noEmit: true, skipLibCheck: true, types: [],
  });
  const checker = program.getTypeChecker();
  function exportsOf(path) {
    const file = program.getSourceFile(path);
    const module = file && checker.getSymbolAtLocation(file);
    if (!module) throw new Error('Missing declarations: ' + path);
    return new Map(checker.getExportsOfModule(module).map((item) => [
      item.name, item.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(item) : item,
    ]));
  }
  const errors = [];
  const candidate = exportsOf(current);
  for (const [name, before] of exportsOf(previous)) {
    const after = candidate.get(name);
    if (!after) { errors.push(name + ' was removed'); continue; }
    if (before.flags & ts.SymbolFlags.Value) {
      if (!(after.flags & ts.SymbolFlags.Value) || !checker.isTypeAssignableTo(
        checker.getTypeOfSymbolAtLocation(after, after.valueDeclaration ?? after.declarations[0]),
        checker.getTypeOfSymbolAtLocation(before, before.valueDeclaration ?? before.declarations[0]),
      )) errors.push(name + ' changed its callable or value contract');
    }
    if (before.flags & ts.SymbolFlags.Type) {
      if (!(after.flags & ts.SymbolFlags.Type) || !checker.isTypeAssignableTo(
        checker.getDeclaredTypeOfSymbol(before), checker.getDeclaredTypeOfSymbol(after),
      )) errors.push(name + ' no longer accepts prior inputs');
    }
  }
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const entries = [['tokens','index'], ['web','index'], ['web','dialog'], ['native','index']];
  for (const [pkg, entry] of entries) {
    const errors = compareDeclarations(resolve('tests/compat/0.2.0', pkg, entry + '.d.ts'),
      resolve('packages', pkg, 'dist', entry + '.d.ts'));
    for (const error of errors) {
      const surface = pkg + '/' + entry;
      try {
        const { version } = JSON.parse(readFileSync(resolve('packages', pkg, 'package.json'), 'utf8'));
        checkMigration({ entry: surface, from: '0.2.0', to: version, diagnostic: error });
        const [major, minor] = version.split('.').map(Number);
        if (!(major > 0 || minor > 2)) {
          throw new Error(surface + ': ' + error + ' requires a breaking release after 0.2.0');
        }
        console.log('Migration documented for ' + surface + ': ' + error);
      } catch (missing) {
        console.error(missing.message);
        process.exitCode = 1;
      }
    }
  }
}
