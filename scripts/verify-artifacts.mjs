import { packageWorkspaces } from './package-workspaces.mjs';
import { installSnapshotDependencies } from '../packages/policy/quality/snapshot-dependencies.mjs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verdictInputRoot } from './gates/verdict.mjs';
import { sha256 } from './verify-policy.mjs';
import { inspectArchive } from '../packages/policy/quality/integrity.mjs';
import { packBuildInputs, packedInputs, readArtifact, storeArtifact } from './build-cache/artifact-cache.mjs';

export const root = verdictInputRoot;
export const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
export const saveJson = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
export const command = (cwd, name, args, options = {}) =>
  execFileSync(name, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    ...options,
  }).trim();

function exportTargets(target) {
  if (target === null) return [];
  if (typeof target === 'string') return [target];
  return Object.values(target).flatMap(exportTargets);
}

export function buildArtifacts(destination, { builtSnapshot = false } = {}) {
  mkdirSync(destination, { recursive: true });
  const temporary = mkdtempSync(join(tmpdir(), 'ui-rebuild-'));
  try {
    const snapshot = join(temporary, 'source');
    for (const file of ['packages', 'scripts/copy-styles.mjs', 'scripts/workers', 'tsconfig.json', 'package.json', 'package-lock.json']) {
      const target = join(snapshot, file);
      mkdirSync(dirname(target), { recursive: true });
      cpSync(join(root, file), target, {
        recursive: true,
        filter: (path) => !['dist', 'node_modules'].includes(basename(path)),
      });
    }
    const runs = [];
    // An incumbent judge predating shared artifacts gives this snapshot no donor.
    const common = (builtSnapshot && process.env.ULD_ARTIFACT_COMMON) ||
      command(root, 'git', ['rev-parse', '--path-format=absolute', '--git-common-dir']);
    const sharedDependencies = join(common, 'uld-dependencies');
    const artifacts = [];
    let prior = [];
    let buildInputs;
    if (builtSnapshot) {
      assert.equal(process.env.UI_GATE_SNAPSHOT, '1', 'Expected an isolated gate build');
      command(root, 'git', ['diff', '--quiet', 'HEAD', '--']);
      const selection = readJson(join(root, '.git/gate-selection.json'));
      if (selection.resultCache?.reasons.every(reason => reason === 'protected change')) prior = selection.resultCache.packedArtifacts ?? [];
      buildInputs = packBuildInputs(root);
    }
    for (const label of ['first', 'second']) {
      if (label === 'second' && runs[0].length > 0 && artifacts.length === runs[0].length &&
          artifacts.every(item => item.hit)) break;
      const alreadyBuilt = label === 'first' && builtSnapshot;
      const cwd = alreadyBuilt ? root : join(temporary, label);
      if (!alreadyBuilt) {
        cpSync(snapshot, cwd, { recursive: true });
        installSnapshotDependencies(cwd, sharedDependencies, process.env);
        command(cwd, 'npm', ['run', 'build:packages'], {
          env: { ...process.env, ULD_ARTIFACT_COMMON: common },
        });
      }
      const packed = join(temporary, label + '-archives');
      mkdirSync(packed);
      const packages = [];
      for (const { directory: path, manifest } of packageWorkspaces(cwd).values()) {
        const inputs = alreadyBuilt ? packedInputs(path, manifest, buildInputs) : null;
        const source = inputs && prior.find(row => row.name === manifest.name && row.version === manifest.version &&
          row.inputs === inputs && typeof row.filename === 'string' && basename(row.filename) === row.filename &&
          /^[0-9a-f]{64}$/.test(row.sha256));
        const cached = source && readArtifact(common, source.sha256);
        if (cached) {
          const { name, version, filename, sha256 } = source;
          const target = join(destination, filename);
          writeFileSync(target, cached);
          assert.deepEqual(inspectArchive(target), [], 'Private content in ' + filename);
          packages.push({ name, version, filename, sha256 });
          artifacts.push({ name, version, filename, sha256, inputs, hit: true });
          continue;
        }
        const [artifact] = JSON.parse(
          command(path, 'npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', packed]),
        );
        const packedFiles = new Set(artifact.files.map((item) => './' + item.path));
        assert.ok(
          Object.keys(manifest.exports ?? {}).length || Object.keys(manifest.bin ?? {}).length,
          manifest.name + ' must expose a package entry or an executable',
        );
        for (const [entry, condition] of Object.entries(manifest.exports ?? {})) {
          const targets = exportTargets(condition);
          for (const target of targets) {
            assert.ok(packedFiles.has(target), manifest.name + ' missing ' + entry + ': ' + target);
          }
        }
        for (const target of Object.values(manifest.bin ?? {})) {
          assert.ok(
            packedFiles.has('./' + target.replace(/^\.\//, '')),
            manifest.name + ' missing executable ' + target,
          );
        }
        const data = readFileSync(join(packed, artifact.filename));
        packages.push({
          name: manifest.name,
          version: manifest.version,
          filename: artifact.filename,
          sha256: sha256(data),
        });
        if (label === 'first') {
          assert.deepEqual(inspectArchive(join(packed, artifact.filename)), [], 'Private content in ' + artifact.filename);
          writeFileSync(join(destination, artifact.filename), data);
          if (inputs) {
            const record = packages.at(-1);
            assert.equal(storeArtifact(common, data), record.sha256);
            artifacts.push({ ...record, inputs, hit: false });
          }
        }
      }
      runs.push(packages);
    }
    if (runs.length === 2) assert.deepEqual(runs[0], runs[1],
      'Independent clean output directories produced different packages');
    else assert.ok(artifacts.length === runs[0].length && artifacts.every(item => item.hit),
      'Each archive needs a reproducible build or an exact G8 match');
    const report = {
      revision: command(root, 'git', ['rev-parse', 'HEAD']),
      trackedTree: command(root, 'git', ['rev-parse', 'HEAD^{tree}']),
      workingTreeDirty: Boolean(command(root, 'git', ['status', '--porcelain'])),
      lockSha256: sha256(readFileSync(join(root, 'package-lock.json'))),
      node: process.version,
      npm: command(root, 'npm', ['--version']),
      packages: runs[0],
      ...(builtSnapshot && { artifacts }),
    };
    saveJson(join(destination, 'provenance.json'), report);
    return report;
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const prepared = process.argv[2] === '--built-snapshot';
  const destination = resolve((prepared ? process.argv[3] : process.argv[2]) || 'release/evidence');
  if (existsSync(join(destination, 'provenance.json')))
    rmSync(join(destination, 'provenance.json'));
  console.log(JSON.stringify(buildArtifacts(destination, { builtSnapshot: prepared }), null, 2));
}
