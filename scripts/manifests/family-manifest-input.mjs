// The generator enumerates this directory. Its product-data exemption covers
// the fields read by the family, package and case registries.
const text = (value) => typeof value === 'string';
const listOf = (check) => (value) => Array.isArray(value) && value.every(check);
const texts = listOf(text);
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const fields = (shape) => (value) =>
  record(value) &&
  Object.entries(value).every(([key, item]) => Object.hasOwn(shape, key) && shape[key](item));
const order = Number.isSafeInteger;
const textOrList = (value) => text(value) || texts(value);
const samples = (value) => Array.isArray(value) && value.length > 0 && value.every(record);
const consumerTypes = (value) =>
  record(value) &&
  Object.entries(value).every(
    ([name, examples]) =>
      /^[.\w/-]+:[A-Za-z_$][\w$]*$/.test(name) &&
      record(examples) &&
      Object.keys(examples).length === 2 &&
      samples(examples.accept) &&
      samples(examples.reject),
  );
const target = fields({ types: text, default: text });
const assertions = (value) =>
  record(value) && Object.entries(value).every(([key, item]) => key.includes(' | ') && text(item));

// The size bands of goal section 9. A band names its frozen-goal limit; it never carries one.
const band = (value) => ['primitives', 'simple', 'inputs', 'overlays', 'heavy', 'datetime'].includes(value);

const manifest = fields({
  id: text,
  order,
  band,
  behaviorAnchor: text,
  inventory: fields({
    layer: text,
    owner: text,
    refs: texts,
    api: texts,
    nativeApi: texts,
    web: text,
    native: text,
    story: text,
    test: text,
    nativeStory: text,
    nativeTest: text,
    ownership: text,
    note: text,
  }),
  depth: fields({
    representative: text,
    expectation: text,
    oracle: text,
    assertions,
    consumerTypes,
    evidence: fields({
      unit: textOrList,
      native: textOrList,
      browser: textOrList,
      packed: textOrList,
      'packed-priority': textOrList,
    }),
  }),
  files: fields({
    source: texts,
    nativeSource: texts,
    unit: texts,
    nativeUnit: texts,
    browser: texts,
    visual: texts,
    story: texts,
    scenario: texts,
    style: texts,
  }),
  cases: fields({
    vitest: texts,
    native: texts,
    nativeAndroid: texts,
    node: texts,
    browser: texts,
    visual: texts,
  }),
  entries: listOf(fields({ pkg: text, path: text, target: (value) => text(value) || target(value), order })),
  budgets: listOf(fields({ name: text, bytes: (value) => Number.isSafeInteger(value) && value >= 0, order })),
  rootExports: listOf(fields({ pkg: text, from: text, names: texts, order })),
});

export function familyManifestInput(slug, data) {
  return (
    manifest(data) &&
    Object.hasOwn(data, 'inventory') &&
    typeof data.id === 'string' &&
    data.id.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-') === slug
  );
}
