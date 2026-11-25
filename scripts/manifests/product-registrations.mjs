import { familyManifestInput } from './family-manifest-input.mjs';
import { isDeepStrictEqual } from 'node:util';

function reject(path) {
  throw Object.assign(new Error('gate/product-registration: ' + path), { code: 'gate/product-registration' });
}

const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const safeFile = /^(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*$/;
const symbol = /^(?:type )?[A-Za-z_$][\w$]*(?: as [A-Za-z_$][\w$]*)?$/;

// Arrays are ordered registrations. An old row must survive as one unchanged row,
// even when two rows have similar names or the generator sorts new entries between them.
export function preserveRegistrations(before, after, path) {
  if (Array.isArray(before)) {
    if (!Array.isArray(after)) reject(path);
    let index = 0;
    for (const row of after) {
      if (index < before.length && isDeepStrictEqual(row, before[index])) index++;
    }
    if (index !== before.length) reject(path);
    return;
  }
  if (record(before)) {
    if (!record(after)) reject(path);
    for (const [key, value] of Object.entries(before)) {
      if (!Object.hasOwn(after, key)) reject(path + '.' + key);
      preserveRegistrations(value, after[key], path + '.' + key);
    }
    return;
  }
  if (!isDeepStrictEqual(before, after)) reject(path);
}

// These fields become import specifiers and JavaScript identifiers in the generated barrel.
export function checkRootExport(row) {
  if (
    !['web', 'native'].includes(row.pkg) ||
    typeof row.from !== 'string' ||
    !row.from.startsWith('./') ||
    !safeFile.test(row.from.slice(2)) ||
    !Array.isArray(row.names) ||
    !row.names.length ||
    !row.names.every((name) => typeof name === 'string' && symbol.test(name))
  )
    reject('rootExports');
}

export function checkFamilyRegistration(before, after, path) {
  const slug = /^manifests\/families\/([a-z0-9-]+)\.json$/.exec(path)?.[1];
  if (!slug || !familyManifestInput(slug, after)) reject(path);
  if (before) preserveRegistrations(before, after, path);
  for (const attachments of Object.values(after.files ?? {})) {
    if (
      !Array.isArray(attachments) ||
      attachments.some((file) => typeof file !== 'string' || !safeFile.test(file))
    )
      reject(path + '.files');
  }
  for (const cases of Object.values(after.cases ?? {})) {
    if (
      !Array.isArray(cases) ||
      cases.some(
        (id) =>
          typeof id !== 'string' ||
          !id.includes(' | ') ||
          !/^[A-Za-z0-9_]/.test(id) ||
          !safeFile.test(id.split(' | ')[0]),
      )
    )
      reject(path + '.cases');
  }
  for (const row of after.rootExports ?? []) checkRootExport(row);
  for (const row of after.entries ?? []) {
    const target = typeof row.target === 'string' ? [row.target] : Object.values(row.target ?? {});
    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.pkg) ||
      !(row.path === '.' || (row.path?.startsWith('./') && safeFile.test(row.path.slice(2)))) ||
      !target.length ||
      target.some(
        (file) => typeof file !== 'string' || !file.startsWith('./') || !safeFile.test(file.slice(2)),
      )
    )
      reject(path + '.entries');
  }
  for (const budget of after.budgets ?? []) {
    if (!Number.isSafeInteger(budget.bytes) || budget.bytes < 1 || typeof budget.name !== 'string')
      reject(path + '.budgets');
  }
}

// Initial limits for new entries come from the packed bytes of this revision. An existing
// entry remains subject to the incumbent's limits and promotion rules.
export function checkInitialBudgets(previous, current, measurements) {
  const measured = new Map(measurements.map((row) => [row.entry, row.gzip]));
  for (const [name, bytes] of Object.entries(current)) {
    if (!Object.hasOwn(previous, name) && measured.get(name) !== bytes) reject('initial budget for ' + name);
  }
}

export function checkPublicBudgets(previous, current, limits) {
  const known = new Set(previous.families.flatMap((row) => row.exports));
  for (const row of current.families) {
    for (const binding of row.exports) {
      if (known.has(binding) || /^native(?:\/|:)/.test(binding)) continue;
      const [entry, name] = binding.split(':');
      const pkg = '@ui-lazy-dev/ui-web' + (entry === '.' ? '' : '/' + entry);
      if (!Object.hasOwn(limits, pkg) || !Object.hasOwn(limits, pkg + '#' + name))
        reject('missing public import budget: ' + binding);
    }
  }
}

export function preserveTestFiles(registered, changed) {
  for (const path of changed) if (registered.has(path)) reject('existing test: ' + path);
}

// Each browser marker is written after its complete project matrix has passed.
// The other receipts are written after the original subprocess exits successfully.
export function checkProductSuiteReceipt(suites) {
  const required = [
    'complete web scenario matrix', 'complete browser matrix and family behavior', 'complete visual matrix',
    'node tests/browser/quality-style-scope.mjs', 'node tests/browser/quality-perf.mjs',
    'node scripts/verify-consumers.mjs release/evidence min',
    'node scripts/verify-consumers.mjs release/evidence max',
    'node scripts/verify-native-consumer.mjs release/evidence',
  ];
  for (const suite of required) {
    if (!suites.includes(suite)) reject('missing original suite: ' + suite);
  }
}
