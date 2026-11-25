import assert from 'node:assert/strict';
import { lstatSync, mkdtempSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let profiles;
const files = new Map();

export function macCommand({ root, exclude, command, args }) {
  assert.ok(Array.isArray(exclude) && exclude.every(item => item === 'docs/**' || item === '*.md'),
    'Unsupported Mac sandbox exclusion');
  if (!exclude.length) return { command, args };
  const snapshot = realpathSync(root);
  const paths = [];
  if (exclude.includes('docs/**')) paths.push(join(snapshot, 'docs'));
  if (exclude.includes('*.md'))
    for (const entry of readdirSync(snapshot, { withFileTypes: true }))
      if (entry.name.endsWith('.md') && !entry.isDirectory()) paths.push(join(snapshot, entry.name));
  for (const path of paths) {
    const stat = lstatSync(path, { throwIfNoEntry: false });
    assert.ok(!stat || stat.isDirectory() || (stat.isFile() && stat.nlink === 1), 'Ambiguous exclusion ' + path);
  }
  if (!profiles) {
    profiles = mkdtempSync(join(tmpdir(), 'uld-reuse-profiles-'));
    process.once('exit', () => rmSync(profiles, { recursive: true, force: true }));
  }
  const rules = ['(version 1)', '(allow default)', '(deny file-write* (subpath ' + JSON.stringify(realpathSync(profiles)) + '))',
    ...paths.sort().map(path => '(deny file-read* file-write* (subpath ' + JSON.stringify(path) + '))')].join('\n') + '\n';
  if (!files.has(rules)) {
    const file = join(profiles, files.size + '.sb');
    writeFileSync(file, rules, { flag: 'wx', mode: 0o400 });
    files.set(rules, file);
  }
  return { command: '/usr/bin/sandbox-exec', args: ['-f', files.get(rules), command, ...args] };
}
