import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { constants, closeSync, fstatSync, lstatSync, mkdirSync, openSync, readFileSync,
  readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { packageWorkspaces } from '../package-workspaces.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');

function objectPath(common, hash) {
  assert.match(hash, /^[0-9a-f]{64}$/);
  return join(common, 'uld-cache', 'objects', hash.slice(0, 2), hash.slice(2));
}

// Only the G8 caller supplies the expected digest. An object in the shared
// directory alone cannot turn a miss into a successful qualification.
export function readArtifact(common, expected) {
  const path = objectPath(common, expected);
  let fd;
  try {
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    if (!fstatSync(fd).isFile()) return null;
    const bytes = readFileSync(fd);
    return digest(bytes) === expected ? bytes : null;
  } catch (error) {
    if (['ENOENT', 'ENOTDIR', 'ELOOP'].includes(error.code)) return null;
    throw error;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

export function storeArtifact(common, bytes) {
  const hash = digest(bytes);
  const target = objectPath(common, hash);
  mkdirSync(dirname(target), { recursive: true });
  const temporary = target + '.' + randomUUID();
  try {
    writeFileSync(temporary, bytes, { flag: 'wx', mode: 0o444 });
    renameSync(temporary, target);
  } finally {
    rmSync(temporary, { force: true });
  }
  return hash;
}

// npm pack reads generated and untracked files too. Include actual paths,
// contents and permissions as well as the package tree and build inputs.
export function packedInputs(directory, manifest, toolInputs) {
  if (manifest.bundledDependencies || manifest.bundleDependencies) return null;
  const hash = createHash('sha256').update(JSON.stringify(['npm pack', toolInputs]) + '\n');
  function visit(path) {
    const stat = lstatSync(path);
    const name = relative(directory, path);
    if (stat.isDirectory()) {
      hash.update(JSON.stringify(['directory', name, stat.mode & 0o777]) + '\n');
      for (const child of readdirSync(path).sort()) {
        if (child === '.git' || child === 'node_modules') continue;
        if (!visit(join(path, child))) return false;
      }
      return true;
    }
    if (!stat.isFile()) return false;
    const bytes = readFileSync(path);
    hash.update(JSON.stringify(['file', name, stat.mode & 0o777, bytes.length]) + '\n').update(bytes);
    return true;
  }
  return visit(directory) ? hash.digest('hex') : null;
}

export function packBuildInputs(root) {
  const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, encoding: 'utf8' }).trim();
  return [run('git', ['ls-tree', 'HEAD', '--', 'packages', 'scripts', 'tsconfig.json', 'package.json',
    'package-lock.json', '.npmrc', '.nvmrc']), process.version, process.platform, process.arch, run('npm', ['--version'])];
}

// Bind the actual delivered archive to the same inputs the judge evaluated.
// Legacy verification paths produce no artifact rows.
export function verifiedPacks(root, selection, suites) {
  if (!suites.includes('node scripts/verify-artifacts.mjs')) return [];
  const directory = join(root, 'release/evidence');
  const report = JSON.parse(readFileSync(join(directory, 'provenance.json'), 'utf8'));
  if (!report.artifacts?.length) return [];
  assert.ok(Array.isArray(report.artifacts) && Array.isArray(report.packages));
  const packages = packageWorkspaces(root);
  const build = packBuildInputs(root);
  const seen = new Set();
  const approved = selection.resultCache?.packedArtifacts ?? [];
  return report.artifacts.map(row => {
    const { name, version, filename, sha256, inputs, hit } = row;
    assert.ok(!seen.has(name) && packages.has(name) && typeof hit === 'boolean');
    seen.add(name);
    const pkg = packages.get(name);
    assert.ok(filename.endsWith('.tgz') && basename(filename) === filename);
    assert.equal(version, pkg.manifest.version);
    assert.match(inputs, /^[0-9a-f]{64}$/);
    assert.equal(inputs, packedInputs(pkg.directory, pkg.manifest, build));
    assert.equal(sha256, digest(readFileSync(join(directory, filename))));
    assert.ok(report.packages.some(p => p.name === name && p.version === version && p.filename === filename && p.sha256 === sha256));
    const result = { name, version, filename, sha256, inputs, hit };
    if (!hit) return result;
    const source = approved.find(p => p.name === name && p.version === version && p.filename === filename &&
      p.inputs === inputs && p.sha256 === sha256);
    assert.ok(source && selection.resultCache.reasons.every(reason => reason === 'protected change'), 'Archive reuse needs a matching G8 source');
    return { ...result, source: source.source, sourceGate: source.sourceGate };
  });
}
