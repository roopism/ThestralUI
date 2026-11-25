import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { stagedDiff, treeFiles } from '../../selection/staged-tree.mjs';
import { lostAssertionContext } from './control-context.mjs';
import { losesAnonymousEntry } from './data-entries.mjs';

const pinned = new Set(JSON.parse(readFileSync(new URL('./immutable-paths.json', import.meta.url))));
const approvalLine = /^\s*(?:[-+*]\s+)?Owner\s+(?:authorizes|permits)\b/i;
const testsAndGates = /^(?:scripts|tests|packages\/(?:policy|style-policy))\/|(?:^|\/)(?:__tests__|tests?|scenarios)\/|\.(?:spec|test)\./;
const registeredData = /^(?:manifests|\.github|\.githooks)\/|\.scenarios\.ya?ml$|(?:budget|threshold|ceiling|eslint|prettier|roster)/i;

function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
}

export function reviewPolicy(root, base, candidate) {
  const { parent, tree, changes } = stagedDiff(root, { parent: base, tree: candidate });
  const issues = [];

  // Pickaxe first narrows a large reformat to files whose changed lines mention
  // the owner. Scan actual added and removed lines from immutable Git blobs.
  const flags = ['--no-ext-diff', '--no-textconv', '--no-color', '--text', '--no-renames'];
  const paths = git(root, 'diff', ...flags, '-G[Oo][Ww][Nn][Ee][Rr]', '--name-only', '-z', parent, tree).split('\0').filter(Boolean);
  for (const path of paths) {
    const patch = git(root, 'diff', ...flags, '--unified=0', parent, tree, '--', ':(literal)' + path);
    if (patch.split('\n').some(line => /^[+-]/.test(line) && approvalLine.test(line.slice(1))))
      issues.push(path + ' changes an owner approval line before signed decisions are available');
  }

  const owned = git(root, 'show', parent + ':.github/CODEOWNERS').split('\n')
    .filter(line => line.startsWith('/')).map(line => line.split(/\s/)[0].slice(1));
  const sources = new Set();
  const registrations = new Set();
  for (const { path, status } of changes) {
    if (pinned.has(path) && status !== 'A') issues.push(path + ' is pinned pending owner-controlled signing');
    const protectedSource = testsAndGates.test(path) || owned.some(entry => entry.endsWith('/') ? path.startsWith(entry) : entry === path);
    if (status === 'M' && /\.[cm]?[jt]sx?$/.test(path) && protectedSource) sources.add(path);
    if (status === 'M' && /\.(?:json|ya?ml)$/.test(path) && path !== 'package-lock.json' &&
        !/baseline|exceptions/i.test(path) && (protectedSource || registeredData.test(path))) registrations.add(path);
  }
  if (sources.size) {
    const before = treeFiles(root, parent, path => sources.has(path));
    const after = treeFiles(root, tree, path => sources.has(path));
    for (const path of sources) {
      if (/\b(?:assert|expect)\b/.test(before.get(path)) && lostAssertionContext(path, before.get(path), after.get(path)))
        issues.push(path + ' removed an assertion context');
    }
  }
  if (registrations.size) {
    const before = treeFiles(root, parent, path => registrations.has(path));
    const after = treeFiles(root, tree, path => registrations.has(path));
    for (const path of registrations) {
      if (losesAnonymousEntry(path, before.get(path), after.get(path))) issues.push(path + ' changed an anonymous entry');
    }
  }
  return issues;
}

if (import.meta.main) {
  const [root, base, tree] = process.argv.slice(2);
  if (!root || !base || !tree) throw Error('Expected the repository, base and candidate tree');
  const issues = reviewPolicy(root, base, tree);
  for (const issue of issues) console.error(issue);
  if (issues.length) process.exitCode = 1;
}
