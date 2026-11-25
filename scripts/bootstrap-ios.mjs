import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const usage =
  'node scripts/bootstrap-ios.mjs <prepare|qualify> [checkout [staged-tree [qa-directory qa-manifest-sha256]]]';
const [mode, checkoutInput = process.cwd(), treeInput, harnessInput, customPin] =
  process.argv.slice(2);
assert.ok(['prepare', 'qualify'].includes(mode) && process.argv.length <= 7, usage);
assert.equal(harnessInput === undefined, customPin === undefined, usage);
const checkout = realpathSync(checkoutInput);
const bundledHarness = fileURLToPath(
  new URL('../tests/simulator/bootstrap/harness/', import.meta.url),
);
const harness = realpathSync(harnessInput ?? bundledHarness);
const harnessPin = customPin ?? '44ef2264e37d5e68b665398ae19e2cc50844725c93d739f70c24738a69983484';
const tree = treeInput ?? git('write-tree');
assert.match(tree, /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/);
assert.match(harnessPin, /^[0-9a-f]{64}$/);
const runner = 'scripts/verify-ios-simulator.mjs';
const gallery = 'catalog/native/Gallery.tsx';
const flowPaths = ['tests/simulator/workspace.yaml', 'tests/simulator/appearance.yaml'];
const files = [
  runner,
  gallery,
  ...flowPaths,
  'tests/simulator/host/Podfile.lock',
  'tests/simulator/host/package.json',
  'tests/simulator/host/package-lock.json',
  'package.json',
  'package-lock.json',
].sort();
const labels = {
  'workspace-review': 'Review changes',
  'workspace-cancel': 'Keep editing',
  'workspace-save': 'Save changes',
  'workspace-finish': 'Finish save',
  'workspace-fail': 'Fail save',
};
const hash = (bytes, algorithm = 'sha256', encoding = 'hex') =>
  createHash(algorithm).update(bytes).digest(encoding);
const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
function git(...args) {
  return execFileSync('git', ['-C', checkout, ...args], { encoding: 'utf8' }).trim();
}
assert.equal(realpathSync(git('rev-parse', '--show-toplevel')), checkout, 'Pass the checkout root');
assert.equal(git('write-tree'), tree, 'Requested tree differs from staged Git contents');
const manifest = readFileSync(join(harness, 'manifest.json'));
assert.equal(hash(manifest), harnessPin, 'External harness manifest digest differs');
const pinned = JSON.parse(manifest);
assert.equal(pinned.format, 1);
assert.deepEqual(Object.keys(pinned.files).sort(), files);

const output = join(checkout, 'release', 'bootstrap-ios');
mkdirSync(output, { recursive: true });
const work = mkdtempSync(join(output, 'run-'));
const product = join(work, 'product');
const qa = join(work, 'qualification');
const archivesDir = join(work, 'archives');
const metadataPath = join(work, 'record.json');
const env = { ...process.env, CI: '1' };
for (const key of Object.keys(env))
  if (key.startsWith('GIT_') || key === 'NODE_OPTIONS') delete env[key];
function run(cwd, command, args, capture = false) {
  return execFileSync(command, args, {
    cwd,
    env,
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}
function writeJson(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
}
const record = {
  schema: 1,
  mode,
  tree,
  harnessManifestSha256: harnessPin,
  driverSha256: hash(readFileSync(process.argv[1])),
  node: process.version,
  productPackages: [],
  qualified: false,
  status: 'preparing',
};
function stageHarness() {
  for (const path of files) {
    const source = join(harness, path);
    assert.equal(realpathSync(source), join(harness, path));
    assert.ok(lstatSync(source).isFile());
    const destination = join(qa, path);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(source, destination);
    assert.equal(
      hash(readFileSync(destination)),
      pinned.files[path],
      'QA fixture changed: ' + path,
    );
  }
  run(qa, 'npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund']);
  const yaml = createRequire(join(qa, 'package.json'))('js-yaml');
  const seen = new Set();
  record.flows = [];
  for (const path of flowPaths) {
    const file = join(qa, path);
    const docs = yaml.safeLoadAll(readFileSync(file, 'utf8'));
    assert.equal(docs.length, 2);
    const commands = docs[1];
    const originals = structuredClone(commands);
    let adapted = 0;
    function selectors(node) {
      if (!node || typeof node !== 'object') return;
      if (Object.hasOwn(labels, node.id)) {
        const id = node.id;
        if (Object.hasOwn(node, 'text')) assert.equal(node.text, labels[id]);
        delete node.id;
        node.text = labels[id];
        seen.add(id);
        adapted++;
      }
      Object.values(node).forEach(selectors);
    }
    selectors(commands);
    assert.ok(adapted > 0, 'Expected public button selectors in ' + path);
    const render = docs
      .map((doc) => yaml.safeDump(doc, { lineWidth: -1, noRefs: true }))
      .join('---\n');
    writeFileSync(file, render);
    const replay = yaml.safeLoadAll(readFileSync(file, 'utf8'));
    assert.deepEqual(replay, docs, 'Executable semantics changed while serializing ' + path);
    const action = (step) => (typeof step === 'string' ? step : Object.keys(step)[0]);
    assert.deepEqual(replay[1].map(action), originals.map(action), 'Flow command order changed');
    record.flows.push({
      file: path,
      commands: commands.length,
      assertions: commands.map(action).filter((name) => name.startsWith('assert')).length,
      buttonSelectors: adapted,
      sourceSha256: pinned.files[path],
      adaptedSha256: hash(render),
    });
  }
  assert.deepEqual([...seen].sort(), Object.keys(labels).sort());
}
function buildArchives() {
  const tarball = join(work, 'staged.tar');
  git('archive', '--format=tar', '--output=' + tarball, tree);
  mkdirSync(product);
  run(product, 'tar', ['-xf', tarball]);
  rmSync(tarball);
  const sourcePaths = ['package-lock.json', 'package.json', 'packages/tokens', 'packages/native'];
  const listing = git('ls-tree', '--full-tree', '-r', tree, '--', ...sourcePaths);
  for (const entry of listing.split('\n')) {
    const [, id, path] = entry.match(/^100(?:644|755) blob ([0-9a-f]+)\t(.+)$/) ?? [];
    assert.ok(id && path, 'Unexpected product entry: ' + entry);
    const bytes = readFileSync(join(product, path));
    const blob = Buffer.concat([Buffer.from('blob ' + bytes.length + '\0'), bytes]);
    assert.equal(
      hash(blob, id.length === 40 ? 'sha1' : 'sha256'),
      id,
      'Product source changed: ' + path,
    );
  }
  record.lockSha256 = hash(readFileSync(join(product, 'package-lock.json')));
  record.npm = run(product, 'npm', ['--version'], true).trim();
  run(product, 'npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund']);
  mkdirSync(archivesDir);
  const fixtureEvidence = join(qa, 'release/evidence');
  mkdirSync(fixtureEvidence, { recursive: true });
  for (const [name, path] of [
    ['tokens', 'packages/tokens'],
    ['ui-native', 'packages/native'],
  ]) {
    const pkg = json(join(product, path, 'package.json'));
    assert.equal(pkg.name, '@ui-lazy-dev/' + name);
    run(product, 'npm', ['run', 'build', '--workspace', pkg.name]);
    const output = run(
      product,
      'npm',
      [
        'pack',
        '--ignore-scripts',
        '--workspace',
        pkg.name,
        '--json',
        '--pack-destination',
        archivesDir,
      ],
      true,
    );
    const [archive] = JSON.parse(output);
    assert.equal(archive.name, pkg.name);
    assert.equal(archive.version, pkg.version);
    assert.equal(basename(archive.filename), archive.filename);
    const pathToTar = join(archivesDir, archive.filename);
    const bytes = readFileSync(pathToTar);
    assert.equal('sha512-' + hash(bytes, 'sha512', 'base64'), archive.integrity);
    const packedManifest = JSON.parse(
      run(work, 'tar', ['-xOzf', pathToTar, 'package/package.json'], true),
    );
    assert.equal(packedManifest.name, pkg.name);
    assert.equal(packedManifest.version, pkg.version);
    const sha256 = hash(bytes);
    const stagedArchive = join(fixtureEvidence, archive.filename);
    copyFileSync(pathToTar, stagedArchive);
    assert.equal(hash(readFileSync(stagedArchive)), sha256);
    record.productPackages.push({
      name: pkg.name,
      version: pkg.version,
      filename: archive.filename,
      bytes: bytes.length,
      sha256,
      integrity: archive.integrity,
    });
    console.log(pkg.name + ' ' + sha256);
    if (name === 'ui-native') {
      const dest = join(qa, 'packages/native/package.json');
      mkdirSync(dirname(dest), { recursive: true });
      writeJson(dest, packedManifest);
    }
  }
  writeJson(join(fixtureEvidence, 'provenance.json'), { packages: record.productPackages });
}
console.log('Staged tree ' + tree + '\nBootstrap evidence ' + work);
try {
  stageHarness();
  buildArchives();
  assert.equal(git('write-tree'), tree, 'Index changed while building archives');
  record.status = 'prepared';
  writeJson(metadataPath, record);
  if (mode === 'qualify') {
    run(qa, process.execPath, [
      '--input-type=module',
      '-e',
      "import {qualify} from './scripts/verify-ios-simulator.mjs'; qualify();",
    ]);
    const result = json(join(qa, 'release/evidence/ios-simulator.json'));
    assert.equal(result.passed, true);
    assert.equal(result.testsPassed, 3);
    assert.equal(result.failed, 0);
    assert.equal(result.skipped, 0);
    assert.equal(result.tokensSha256, record.productPackages[0].sha256);
    assert.equal(result.nativeSha256, record.productPackages[1].sha256);
    assert.deepEqual(result.profiles, [
      ['workspace', 'light', 'large'],
      ['appearance', 'light', 'large'],
      ['appearance', 'dark', 'accessibility-extra-large'],
    ]);
    record.simulator = result;
    assert.equal(git('write-tree'), tree, 'Index changed during simulator qualification');
    record.qualified = true;
    record.status = 'passed';
  }
} catch (error) {
  record.status = 'failed';
  record.error = error.message;
  process.exitCode = 1;
  console.error(error.message);
} finally {
  if (existsSync(join(qa, 'test-results')))
    renameSync(join(qa, 'test-results'), join(work, 'test-results'));
  for (const path of [qa, product, join(work, 'staged.tar')])
    rmSync(path, { recursive: true, force: true });
  writeJson(metadataPath, record);
  console.log('Record ' + metadataPath + ' (' + record.status + ')');
}
