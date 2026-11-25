import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyFamilies, verifyTypes } from './api-depth.mjs';
import { consumerCases } from './consumer-cases.mjs';
import { reviewedFamilies, requiredDepth, validateRoutes, verifyExamples } from './evidence.mjs';
import { validatePacked } from './packed-probes.mjs';

export async function verifyPackedDepth(
  consumer,
  registryPath,
  target = requiredDepth,
  root = process.cwd(),
  selectedIds,
) {
  // Historical package comparisons can still supply their original inventory module.
  const inputs = typeof registryPath === 'string'
    ? { published: (await import(pathToFileURL(resolve(registryPath)).href)).families.filter(row => row.api?.length || row.nativeApi?.length) }
    : registryPath;
  const { published, registrations } = inputs;
  const all = reviewedFamilies(target, registrations);
  validateRoutes(all);
  verifyFamilies(
    all,
    published.map((row) => ({
      id: row.id,
      exports: [...(row.api ?? []), ...(row.nativeApi ?? [])],
    })),
  );
  const families = selectedIds ? all.filter(row => selectedIds.includes(row.id)) : all;
  if (selectedIds) assert.deepEqual(families.map(row => row.id).sort(), [...selectedIds].sort());
  const bindings = families.flatMap(row => row.exports);
  const scoped = selectedIds !== undefined;
  const cases = consumerCases(target, registrations);
  const selectedCases = scoped
    ? Object.fromEntries(Object.entries(cases).filter(([key]) => bindings.includes(key)))
    : cases;
  const examples = verifyExamples(families, published, root);
  const types = verifyTypes(consumer, families, selectedCases, { scoped });
  const verified = await validatePacked(
    consumer,
    families,
    bindings,
    target,
    { scoped },
  );
  return { target, ...types, packed: verified.length, ...examples };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [consumer, registryPath, target] = process.argv.slice(2);
  assert.ok(
    consumer && registryPath,
    'Pass the installed consumer directory and its component inventory',
  );
  console.log(await verifyPackedDepth(consumer, registryPath, target));
}
