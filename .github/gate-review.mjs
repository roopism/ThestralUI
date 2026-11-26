import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

// One-time adoption of the ordered train command. The two blobs differ by one
// script. Subsequent changes remain subject to the normal script-map check.
const before = '100644 blob 5f2454b6466a9a73c44b6a7ad4c6d4536e1770c6\tpackage.json';
const after = '100644 blob f675cdc70b11bd84325d9545c382fea2559926a8\tpackage.json';
export function trainEntryAdoption(root, base, tree, now = Date.now()) {
  if (now >= Date.UTC(2026, 11, 31)) return false;
  const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { cwd: root, encoding: 'utf8' }).trimEnd();
  return git('ls-tree', base, '--', 'package.json') === before &&
    git('ls-tree', tree, '--', 'package.json') === after &&
    git('diff', '--no-renames', '--name-only', '-z', base, tree) === 'package.json\0';
}

const depthRegistry = 'packages/policy/quality/api-depth/families.json';

// CODEOWNERS is both the GitHub review map and the path check's source of truth.
export function gatePaths(codeowners) {
  const paths = [];
  for (const raw of codeowners.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line === '/' + depthRegistry) {
      paths.push({ path: depthRegistry, directory: false, owned: false });
      continue;
    }
    const match = /^\/([\w.-]+(?:\/[\w.-]+)*)(\/?)\s+@roopism$/.exec(line);
    if (!match) throw Error('Unsupported gate CODEOWNERS rule: ' + JSON.stringify(line));
    paths.push({ path: match[1], directory: Boolean(match[2]), owned: true });
  }
  if (!paths.some(rule => rule.path === '.github' && rule.directory))
    throw Error('The review workflow and CODEOWNERS must be owned.');
  return paths;
}

const sizeBaseline = 'tests/packaging/bundle-baseline.json';
const generated = new Set([sizeBaseline, ...['browser', 'unit', 'visual'].map(s => 'tests/acceptance/' + s + '-matrix.json')]);

function preservesRegistrations(path, old, next) {
  if (!old || !next) return false;
  return Object.entries(old).every(([key, value]) => {
    const current = next[key];
    if (path === sizeBaseline) return Number.isSafeInteger(current) && current > 0 && current <= value;
    return Array.isArray(value)
      ? Array.isArray(current) && value.every(entry => current.includes(entry))
      : isDeepStrictEqual(value, current);
  });
}

// A gate PR may update the registrations belonging to an approved judge change. Keep
// product source, exports, attachments and other family metadata on the product branch.
function onlyFamilyChecks(before, after) {
  if (!before || !after) return false;
  const otherFields = ({ cases, budgets, ...rest }) => rest;
  return isDeepStrictEqual(otherFields(before), otherFields(after));
}

function gateIdentity({ headBranch, headRepository, repository }) {
  return (headBranch === 'feat/gates' || /^gates\/[a-z0-9][a-z0-9-]*$/.test(headBranch)) && headRepository === repository;
}

export function checkProposal(files, owners, identity, revisions, validateDepth, budgetAdoption = false, commandAdoption = false) {
  const { headBranch, headRepository, repository } = identity;
  if (!headBranch || !headRepository || !repository) throw Error('Missing GitHub branch identity.');
  const gateBranch = gateIdentity(identity);
  const isOwned = file => owners.findLast(({ path, directory }) =>
    file === path || (directory && file.startsWith(path + '/')))?.owned === true;
  const modern = /^(?:gates|docs|family)\//.test(headBranch);
  if (modern) {
    const gateCode = file => (commandAdoption && headBranch === 'gates/train-command' && files.length === 1 && file === 'package.json') || /^(?:scripts|\.github|\.githooks|packages\/(?:policy|style-policy)|tests\/(?:android|simulator))(?:\/|$)/.test(file);
    if (gateBranch && !files.every(gateCode)) throw Error('A gates/ topic accepts only gate code.');
    if (!gateBranch && files.some(file => file !== depthRegistry && gateCode(file)))
      throw Error('Propose these gate changes separately on a gates/ topic.');
  }
  const ownedChange = files.some(isOwned);
  const invalid = files.filter(file => {
    if (file === depthRegistry) {
      if (gateBranch) return !ownedChange;
      if (isOwned(file) || !validateDepth) return true;
      validateDepth();
      return false;
    }
    if (generated.has(file)) {
      if (gateBranch) return !ownedChange;
      if (file === sizeBaseline && budgetAdoption) return false;
      return !preservesRegistrations(file, ...revisions(file));
    }
    if (gateBranch && ownedChange && /^manifests\/families\/[a-z0-9-]+\.json$/.test(file))
      return !onlyFamilyChecks(...revisions(file));
    // Replacing the parent of an owned path must not evade review. The parent itself
    // can be unowned, so a gate proposal must also touch a directly owned entry.
    if (!isOwned(file) && owners.some(({ path }) => path.startsWith(file + '/')))
      return !gateBranch || !ownedChange;
    return gateBranch !== isOwned(file);
  });
  if (invalid.length) {
    const message = gateBranch
      ? 'feat/gates accepts only gate paths. Separate product changes and accompany registration changes with an owner-covered gate change.'
      : 'Propose these gate changes separately on the repository’s feat/gates branch.';
    throw Error([message, ...invalid.map(file => JSON.stringify(file))].join('\n'));
  }
}

// The workflow extracts only this judge from the enterprise commit. Resolve its
// small, fixed dependency set from the same commit, independently of the PR checkout.
function trustedRegistryTools(git, base, budgetsOnly = false) {
  const dir = mkdtempSync(join(tmpdir(), 'uld-reviewed-registry-'));
  try {
    const files = budgetsOnly ? ['reviewed-bundle-budgets.mjs'] : ['depth-registry.mjs', 'family-manifest-input.mjs', 'product-registrations.mjs'];
    for (const name of files) {
      const path = 'scripts/manifests/' + name;
      const entry = /^100644 blob ([a-f0-9]{40})\t/.exec(git(['ls-tree', base, '--', path]));
      if (!entry) throw Error('Missing trusted registry tool: ' + path);
      writeFileSync(join(dir, name), git(['cat-file', 'blob', entry[1]]));
    }
    const require = createRequire(import.meta.url);
    if (budgetsOnly) return require(join(dir, 'reviewed-bundle-budgets.mjs'));
    return { ...require(join(dir, 'depth-registry.mjs')), ...require(join(dir, 'product-registrations.mjs')) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function checkRevision(root, base, head, identity) {
  for (const sha of [base, head]) {
    if (!/^[a-f0-9]{40}$/.test(sha)) throw Error('Expected an exact Git commit.');
  }
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 128 << 20 });
  const owners = gatePaths(git(['show', base + ':.github/CODEOWNERS']));
  // Rename endpoints are checked independently. NUL-delimiting preserves literal filenames.
  const ancestor = git(['merge-base', base, head]).trim();
  const paths = git(['diff', '--name-only', '--no-renames', '--ignore-submodules=none', '-z', ancestor, head, '--'])
    .split('\0').filter(Boolean);
  const revisions = path => [ancestor, head].map(revision => {
    // Read only regular Git blobs. Symlinks, directories, submodules and absent files
    // cannot stand in for a JSON registration.
    const entry = git(['ls-tree', '-z', revision, '--', path]);
    if (!/^100(?:644|755) blob /.test(entry)) return null;
    return JSON.parse(git(['show', revision + ':' + path]));
  });
  // Use the enterprise revision's manifest schema and serializer. Candidate files supply JSON only.
  function validateDepth() {
    const { renderDepthRegistry, checkFamilyRegistration, preserveRegistrations } = trustedRegistryTools(git, base);
    const files = git(['ls-tree', '-z', head + ':manifests/families']).split('\0').filter(Boolean);
    const families = files.map(entry => {
      const match = /^100644 blob ([a-f0-9]{40})\t([a-z0-9-]+\.json)$/.exec(entry);
      if (!match) throw Error('Invalid family manifest entry for ' + depthRegistry);
      const row = JSON.parse(git(['cat-file', 'blob', match[1]]));
      checkFamilyRegistration(null, row, 'manifests/families/' + match[2]);
      return row;
    }).sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
    const [previous, current] = revisions(depthRegistry);
    const entry = git(['ls-tree', head, '--', depthRegistry]);
    const shared = JSON.parse(git(['show', ancestor + ':manifests/shared.json']));
    if (!previous || !current || !entry.startsWith('100644 blob ') ||
        git(['show', head + ':' + depthRegistry]) !== renderDepthRegistry(families, shared))
      throw Error('Expected the exact generated ' + depthRegistry);
    const prior = new Map(previous.families.map(row => [row.id, row]));
    const existing = current.families.filter(row => prior.has(row.id));
    if (!isDeepStrictEqual(existing.map(row => row.id), [...prior.keys()]) || current.revision !== previous.revision)
      throw Error('Existing family registrations or revision changed in ' + depthRegistry);
    for (const row of existing) preserveRegistrations(prior.get(row.id), row, depthRegistry + ': ' + row.id);
  }
  // Changing a family declaration without regenerating its registry must fail in either direction.
  if (!gateIdentity(identity) && !paths.includes(depthRegistry)) {
    const depthInput = row => row?.depth && [row.id, row.order, row.inventory?.api, row.inventory?.nativeApi, row.depth];
    for (const path of paths.filter(file => /^manifests\/families\/[a-z0-9-]+\.json$/.test(file))) {
      const [before, after] = revisions(path);
      if (!isDeepStrictEqual(depthInput(before), depthInput(after))) {
        validateDepth();
        break;
      }
    }
  }
  let budgetAdoption = false;
  const familyManifest = /^manifests\/families\/[a-z0-9-]+\.json$/;
  if (!gateIdentity(identity) && paths.some(path => path === sizeBaseline || path === 'packages/web/package.json' || familyManifest.test(path))) {
    const limits = revisions(sizeBaseline);
    // A minimal repository fixture may have no budget registry. It receives no budget exception.
    if (limits[0] && limits[1]) {
      const { budgetCheckpoints, verifyBudgetAdoption } = trustedRegistryTools(git, base, true);
      const families = budgetCheckpoints.map(({ slug }) => revisions('manifests/families/' + slug + '.json'));
      const packages = revisions('packages/web/package.json');
      const states = [0, 1].map(index => ({
        families: families.map(pair => pair[index]).filter(Boolean),
        limits: limits[index],
        exports: packages[index]?.exports ?? {},
      }));
      const sourceHash = path => {
        const entry = /^100644 blob ([a-f0-9]{40})\t/.exec(git(['ls-tree', head, '--', path]));
        return entry && createHash('sha256').update(git(['cat-file', 'blob', entry[1]])).digest('hex');
      };
      budgetAdoption = verifyBudgetAdoption(states[0], states[1], sourceHash);
    }
  }
  const commandAdoption = identity.headBranch === 'gates/train-command' && paths.length === 1 &&
    paths[0] === 'package.json' && trainEntryAdoption(root, ancestor, head);
  checkProposal(paths, owners, identity, revisions, validateDepth, budgetAdoption, commandAdoption);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  checkRevision(process.cwd(), process.argv[2], process.argv[3], {
    headBranch: process.env.HEAD_BRANCH,
    headRepository: process.env.HEAD_REPOSITORY,
    repository: process.env.GITHUB_REPOSITORY,
  });
}
