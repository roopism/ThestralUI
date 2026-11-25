// TypeScript reads options and extended configs from integration. Its source
// discovery and emitted output paths belong to the candidate.
import assert from 'node:assert/strict';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { trustedRoot } from './typed-tools.mjs';

export function compileProject(candidate, base, project) {
  assert.ok(['tsconfig.json', 'packages/web/tsconfig.json', 'packages/native/tsconfig.json'].includes(project));
  const diagnostics = [];
  const options = ts.getParsedCommandLineOfConfigFile(join(candidate, project), {}, {
    ...ts.sys,
    readFile(file) {
      const rel = relative(candidate, file);
      if (/(?:^|\/)tsconfig[^/]*\.json$/.test(rel)) {
        assert.ok(!rel.startsWith('..'), 'Extended compiler config must be inside the trusted project');
        return ts.sys.readFile(join(base, rel));
      }
      return ts.sys.readFile(file);
    },
    onUnRecoverableConfigFileDiagnostic(issue) { diagnostics.push(issue); },
  });
  if (options) {
    const program = ts.createProgram({ rootNames: options.fileNames, options: options.options, projectReferences: options.projectReferences });
    diagnostics.push(...options.errors, ...ts.getPreEmitDiagnostics(program));
    if (!diagnostics.length && !options.options.noEmit) diagnostics.push(...program.emit().diagnostics);
  }
  return diagnostics;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const errors = compileProject(process.cwd(), trustedRoot, process.argv[2]);
  if (errors.length) {
    console.error(ts.formatDiagnostics(errors, { getCanonicalFileName: file => file, getCurrentDirectory: process.cwd, getNewLine: () => '\n' }));
    process.exitCode = 1;
  }
}
