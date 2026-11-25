import { readFileSync } from 'node:fs';
import { families as incumbentInventory } from '../../../../docs/component-inventory.mjs';
import { inventoryData, loadManifests } from '../../../../scripts/manifests/generate.mjs';
import { renderDepthRegistry } from '../../../../scripts/manifests/depth-registry.mjs';
import { preserveRegistrations } from '../../../../scripts/manifests/product-registrations.mjs';

const incumbent = JSON.parse(readFileSync(new URL('./families.json', import.meta.url))).families;
const published = row => row.api?.length || row.nativeApi?.length;

export function packedRegistrations(root) {
  const { families, shared } = loadManifests(root);
  const inventory = inventoryData(families, shared).families.filter(published);
  const registrations = JSON.parse(renderDepthRegistry(families, shared)).families;
  for (const row of incumbent) {
    preserveRegistrations(row, registrations.find(next => next.id === row.id), row.id);
  }
  for (const row of incumbentInventory.filter(published)) {
    const next = inventory.find(family => family.id === row.id);
    for (const key of ['api','nativeApi','story','test','nativeStory','nativeTest']) {
      if (row[key] !== undefined) preserveRegistrations(row[key], next?.[key], row.id + '.' + key);
    }
  }
  return { published: inventory, registrations };
}
