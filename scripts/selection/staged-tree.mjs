import { execFileSync } from 'node:child_process';

const options = { maxBuffer: 128 * 1024 * 1024 };
function git(root, args, extra = {}) {
  return execFileSync('git', args, { cwd: root, ...options, ...extra });
}

export function stagedDiff(root, revisions = {}) {
  const tree = revisions.tree ?? git(root, ['write-tree']).toString().trim();
  const parent = revisions.parent ?? git(root, ['rev-parse', '--verify', 'HEAD^{tree}']).toString().trim();
  const records = git(root, ['diff-tree', '--no-commit-id', '-r', '--no-renames',
    '--name-status', '-z', parent, tree]).toString().split('\0');
  records.pop();
  const changes = [];
  for (let i = 0; i < records.length; i += 2) changes.push({ status: records[i], path: records[i + 1] });
  return { tree, parent, changes };
}

// Read immutable Git blobs by object ID. A checkout, symlink or untracked file can
// never change what the selector sees after write-tree.
export function treeFiles(root, tree, include) {
  const entries = git(root, ['ls-tree', '-rz', tree]).toString().split('\0').filter(Boolean);
  const wanted = [];
  for (const line of entries) {
    const tab = line.indexOf('\t');
    const path = line.slice(tab + 1);
    if (!include(path)) continue;
    const [mode, kind, oid] = line.slice(0, tab).split(' ');
    if (kind !== 'blob' || !['100644', '100755'].includes(mode))
      throw Error('Unsupported Git entry ' + path);
    wanted.push({ path, oid });
  }
  const output = git(root, ['cat-file', '--batch'], {
    input: wanted.map(file => file.oid + '\n').join(''),
  });
  const files = new Map();
  let offset = 0;
  for (const { path, oid } of wanted) {
    const newline = output.indexOf(10, offset);
    const [object, kind, size] = output.toString('ascii', offset, newline).split(' ');
    if (object !== oid || kind !== 'blob') throw Error('Missing staged blob ' + path);
    const end = newline + 1 + Number(size);
    files.set(path, output.toString('utf8', newline + 1, end));
    offset = end + 1;
  }
  return files;
}
