import assert from 'node:assert/strict';

// Keep the current registry's compact public binding lists.
export function renderDepthRegistry(families, shared) {
  const rows = families.filter((f) => f.depth).map(({ id, inventory, depth }) => {
    const { representative, ...contract } = depth;
    const bindings = [...inventory.api, ...(inventory.nativeApi ?? [])];
    assert.ok(bindings.includes(representative), 'Representative is outside its family: ' + id);
    return { id, representative, exports: bindings, ...contract };
  });
  return (JSON.stringify({ revision: shared.depthRevision, families: rows }, null, 2) + '\n').replace(
    /^( {6}"exports": )\[\n((?: {8}"[^"\n]+"[,]?\n)+) {6}\](,?)/gm,
    (original, prefix, values, suffix) => {
      const inline = prefix + '[' + values.trim().split(/,\s*\n\s*/).join(', ') + ']' + suffix;
      return inline.length <= 100 ? inline : original;
    },
  );
}
