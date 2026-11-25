import assert from 'node:assert/strict';

// Test files are the smallest safe unit: serial suites and their hooks must stay together.
// Group related family files before balancing two shards within each engine.
export function browserShards(baseline, owners) {
  assert.equal(new Set(baseline.cases).size, baseline.cases.length, 'Repeated expected browser case');
  const shards = [];
  for (const project of baseline.projects) {
    const files = new Map();
    for (const name of baseline.cases) {
      const [engine, file, ...title] = name.split(' | ');
      if (engine !== project) continue;
      assert.ok(file && title.length, 'Malformed browser case ' + name);
      if (!files.has(file)) files.set(file, { names: [], owners: new Set() });
      const related = files.get(file);
      related.names.push(name);
      for (const owner of owners.get([file, ...title].join(' | ')) ?? []) related.owners.add(owner);
    }
    assert.ok(files.size, 'No files for required project ' + project);
    const families = new Map();
    for (const [file, { names, owners }] of files) {
      const key = JSON.stringify([...owners].sort());
      if (!families.has(key)) families.set(key, { files: [], cases: [] });
      families.get(key).files.push(file);
      families.get(key).cases.push(...names);
    }
    const buckets = Array.from({ length: Math.min(2, families.size) }, () => ({ project, files: [], cases: [] }));
    const groups = [...families.values()].sort((a, b) =>
      b.cases.length - a.cases.length || a.files[0].localeCompare(b.files[0]));
    for (const group of groups) {
      const bucket = buckets.reduce((a, b) => a.cases.length <= b.cases.length ? a : b);
      bucket.files.push(...group.files);
      bucket.cases.push(...group.cases);
    }
    for (const bucket of buckets) {
      bucket.files.sort();
      bucket.cases.sort();
      shards.push(bucket);
    }
  }
  assert.deepEqual(shards.flatMap(shard => shard.cases).sort(), baseline.cases, 'Unassigned browser case');
  return shards;
}

export function discoverShards(report, baseline, owners, cases) {
  assert.deepEqual(report.errors, [], 'Playwright discovery failed');
  const discovered = cases(report.suites).map(row => row.name).sort();
  assert.deepEqual(discovered, baseline.cases, 'Full browser discovery differs from the required matrix');
  return browserShards(baseline, owners);
}

export function browserCaseOwners(manifests, kind) {
  const result = new Map();
  for (const family of manifests) {
    for (const name of family.cases?.[kind] ?? []) {
      if (!result.has(name)) result.set(name, new Set());
      result.get(name).add(family.id);
    }
  }
  return result;
}
