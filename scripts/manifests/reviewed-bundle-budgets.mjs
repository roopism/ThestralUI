import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';

const web = '@ui-lazy-dev/ui-web/';
const initial = { primitives: 1135, document: 223, 'primitives.css': 862, 'document#Heading': 143 };

// Each step covers specific previously published imports. Dedicated new subpaths still use the
// ordinary initial packed-budget check. Only the first adoption compares the reviewed source.
export const budgetCheckpoints = [
  {
    id: 'Icon button',
    slug: 'icon-button',
    limits: {
      primitives: 1513,
      'primitives.css': 962,
    },
    sources: {
      'packages/web/src/icon-button/binding.tsx':
        'd2e3383c241002c5ef0ab2696c445cae24669c1212eef67b0ee5b459690f972e',
      'packages/web/src/icon-button/index.ts':
        '182ae946031bbdf270d989dd0726851aeb39e928de554c7c9325f9167b39188a',
      'packages/web/src/icon-button/styles.css':
        '6d07c68c30adaf19414b4bd85e07bd7b0268d806a8c3c8823589ec3f05368fed',
    },
  },
  {
    id: 'Separator',
    slug: 'separator',
    limits: {
      document: 382,
    },
    sources: {
      'packages/web/src/separator/aria-binding.tsx':
        '81490fcec691029aa8cdd39d6f19027f870e640dbcf357d34d1baa767394e4ef',
      'packages/web/src/separator/binding.tsx':
        'c97f06a72a6efa42d829e87288a9248a814f2754ad0ae59ea7050ce4d15a6303',
      'packages/web/src/separator/server-binding.tsx':
        'c84a1b3c525b6b4ca457e3d8a4ee030c1151810e88015fd290a70baa68f0ba4c',
      'packages/web/src/separator/index.ts':
        'aa1ed7b71abecf9c87e77432a0e5221bbe709bbbb5b042fd9fc5c70e0012dda5',
      'packages/web/src/separator/styles.css':
        '93d0df19c6495de5748543e8c40eb6686fc146671588a9de6e20ff83f6fda4aa',
    },
  },
  {
    id: 'Button group',
    slug: 'button-group',
    limits: {
      primitives: 1805,
      'primitives.css': 1153,
    },
    sources: {
      'packages/web/src/button-group/binding.tsx':
        '73e4ed88179954f282cb7f25243ae64c3f0aeeb6197491ab6c7ab38d673fe735',
      'packages/web/src/button-group/index.ts':
        'c81896d815a18d3bca3e3d0003b97b0c78c8e9abcb37f15f35e8ed799cff4908',
      'packages/web/src/button-group/styles.css':
        '6e969c67698e15b988ae8b970bd9016a672af54d418d53ca9260cbdc13cde50e',
    },
  },
  {
    id: 'Heading',
    slug: 'heading',
    limits: {
      document: 750,
      'document#Heading': 552,
    },
    sources: {
      'packages/web/src/heading/aria-binding.tsx':
        '9f092bb328c269fc88d62403e001bbf24f09e1b56071a0e9711ac3473e2e6f36',
      'packages/web/src/heading/server-binding.tsx':
        '1cd389a862158f3cc42fae3b99635d768803ff398760dcec269282ea505a14de',
      'packages/web/src/heading/appearance.ts':
        'dba0b315d5100d6bb839c07bead41ccf1dea530b904cf45f297a992c75390cfb',
      'packages/web/src/heading/index.ts': '4e4e0d2d99c18b27376710776bca9909c892202cb0c8d53b3bd50b5788616569',
      'packages/web/src/heading/styles.css':
        '8399134c47d48f6465ff00c4d23f77015b43548f3e09472c7cabbb2e8df7d6b0',
    },
  },
];

function checkedSchedule() {
  const slugs = new Set();
  for (const { slug, sources, limits } of budgetCheckpoints) {
    assert.ok(
      !slugs.has(slug) && Object.keys(sources).length && Object.keys(limits).length,
      'Invalid reviewed budget checkpoint',
    );
    slugs.add(slug);
    for (const [path, digest] of Object.entries(sources)) {
      assert.ok(
        path.startsWith('packages/web/src/' + slug + '/') && /^[a-f0-9]{64}$/.test(digest),
        'Invalid reviewed web source',
      );
    }
    for (const [name, size] of Object.entries(limits)) {
      assert.ok(
        Object.hasOwn(initial, name) && Number.isSafeInteger(size) && size > 0,
        'Invalid reviewed legacy import',
      );
    }
  }
}
checkedSchedule();

export function bundleStage(families, packedExports) {
  const ordered = [];
  let stage = 0,
    missing = false;
  for (const { id, slug } of budgetCheckpoints) {
    const paths = ['./' + slug, './' + slug + '.css'];
    const owners = families.filter((row) => row.id === id);
    assert.ok(owners.length <= 1, 'Duplicate canonical family: ' + id);
    const rows = (owners[0]?.entries ?? []).filter((row) => row.pkg === 'web' && paths.includes(row.path));
    if (!rows.length) {
      missing = true;
      continue;
    }
    assert.ok(!missing, 'Earlier budget checkpoint is absent before ' + id);
    assert.deepEqual(
      rows.map((row) => row.path),
      paths,
      'Incomplete, duplicated or reordered public entry: ' + id,
    );
    const target = { types: './dist/' + slug + '/index.d.ts', default: './dist/' + slug + '/index.js' };
    assert.ok(
      isDeepStrictEqual(rows[0].target, target) && rows[1].target === './dist/' + slug + '.css',
      'Invalid canonical target: ' + id,
    );
    if (packedExports) {
      for (const row of rows)
        assert.deepEqual(packedExports[row.path], row.target, 'Wrong published entry: ' + row.path);
    }
    ordered.push(...paths);
    stage++;
  }
  if (packedExports) {
    const all = new Set(budgetCheckpoints.flatMap(({ slug }) => ['./' + slug, './' + slug + '.css']));
    assert.deepEqual(
      Object.keys(packedExports).filter((path) => all.has(path)),
      ordered,
      'Missing, reordered or unregistered published family route',
    );
  }
  return stage;
}

function expectedReferences(stage) {
  return Object.assign({}, initial, ...budgetCheckpoints.slice(0, stage).map((step) => step.limits));
}

export function effectiveBundleBudgets(families, budgets) {
  const stage = bundleStage(families);
  const effective = { ...budgets };
  // Synthetic manifest fixtures may use none of these incumbents. Never create new coverage here.
  for (const [name, value] of Object.entries(expectedReferences(stage))) {
    if (!Object.hasOwn(budgets, web + name) && stage === 0) continue;
    assert.equal(budgets[web + name], initial[name], 'Existing budget needs independent review: ' + name);
    effective[web + name] = value;
  }
  return effective;
}

function transition(before, after) {
  assert.ok(
    after === before || after === before + 1,
    'One reviewed budget checkpoint may advance per product revision',
  );
  return after === before ? undefined : budgetCheckpoints[before];
}

// Compare trusted Git objects before permitting a product change to a registered legacy budget.
// Other incumbents keep the usual additive-or-tighter rule. No candidate code is evaluated.
export function verifyBudgetAdoption(previous, current, sourceHash) {
  const before = bundleStage(previous.families, previous.exports);
  const after = bundleStage(current.families, current.exports);
  const step = transition(before, after);
  if (!step) return false;
  for (const [name, value] of Object.entries(expectedReferences(before)))
    assert.equal(previous.limits[web + name], value, 'Wrong incumbent starting budget: ' + name);
  for (const [name, value] of Object.entries(expectedReferences(after)))
    assert.equal(current.limits[web + name], value, 'Wrong budget for the new checkpoint: ' + name);
  for (const [name, value] of Object.entries(previous.limits)) {
    if (Object.hasOwn(step.limits, name.slice(web.length)) && name.startsWith(web)) continue;
    const next = current.limits[name];
    assert.ok(
      Number.isSafeInteger(next) && next > 0 && next <= value,
      'Unrelated incumbent changed: ' + name,
    );
  }
  verifyReviewedSources(step, current.families, sourceHash);
  return true;
}

function verifyReviewedSources(step, families, sourceHash) {
  const manifest = families.find((row) => row.id === step.id);
  for (const [path, digest] of Object.entries(step.sources)) {
    const group = path.endsWith('.css') ? 'style' : 'source';
    assert.equal(
      manifest.files?.[group]?.filter((file) => file === path).length,
      1,
      'Unregistered first-adoption source: ' + path,
    );
    assert.equal(sourceHash(path), digest, 'Unreviewed source at first adoption: ' + path);
  }
}

// Check the controlled source before paying for a full local build. The gate snapshot contains
// the actual staged files; an existing release undergoing ordinary maintenance has no new step.
export function verifyFirstAdoptionSources(previous, current, sourceHash) {
  const step = transition(bundleStage(previous), bundleStage(current));
  if (step) verifyReviewedSources(step, current, sourceHash);
}

export const incumbentEntries = Object.keys(initial).map((name) => web + name);

export function adoptedBundleLimits(previousFamilies, currentFamilies) {
  const step = transition(bundleStage(previousFamilies), bundleStage(currentFamilies));
  return Object.keys(step?.limits ?? {}).map((name) => web + name);
}

export function checkPackedBudgetAdoption(previousFamilies, currentFamilies, measurements) {
  const step = transition(bundleStage(previousFamilies), bundleStage(currentFamilies));
  if (!step) return;
  for (const [name, bytes] of Object.entries(step.limits)) {
    const measured = measurements.filter((row) => row.entry === web + name);
    assert.equal(measured.length, 1, 'Missing or duplicated adopted import: ' + name);
    assert.equal(measured[0].gzip, bytes, 'Unreviewed packed size at first adoption: ' + name);
  }
}
