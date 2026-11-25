import { existsSync, realpathSync } from 'node:fs';
import { basename, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceRoot = fileURLToPath(new URL('../../', import.meta.url));
const verdictName = /^(?:verify-[\w-]+|unit-matrix)\.mjs$/;
const entry = process.argv[1] && existsSync(process.argv[1]) ? relative(sourceRoot, realpathSync(process.argv[1])) : '';
// Other subprocesses can inherit snapshot flags while running in a temporary consumer directory.
export const verdictInputRoot = process.env.UI_GATE_SNAPSHOT === '1' &&
  (entry === 'scripts/gates/local-run.mjs' || dirname(entry) === 'scripts' && verdictName.test(basename(entry)))
  ? process.cwd() : sourceRoot;

export function trustedVerdict(file) {
  if (!verdictName.test(file)) throw Error('Unknown verdict entry ' + file);
  return fileURLToPath(new URL('../' + file, import.meta.url));
}
