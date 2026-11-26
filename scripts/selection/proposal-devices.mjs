import { deviceInputs, pathClass, skipReasons } from './device-inputs.mjs';
import { scopeFailures, observedReason, retainedObservations } from './device-observations.mjs';
import { deviceScope } from './local-device.mjs';
import { stagedDiff } from './staged-tree.mjs';

const full = { iphone: true, families: null };
// Keep every device stage active while the scope selector is under review.
export const requireFullDevices = true;

export function classifyDevicePath(map, records, learned, path, status) {
  if (learned.has(path)) return 'prior daily full failure';
  const baseline = map.classes.get(path) ?? pathClass(path);
  if (!skipReasons.has(baseline)) return baseline;
  for (const record of records) {
    const reason = observedReason(record.platforms, path, status);
    if (reason) return reason;
  }
  return map.opaque ? 'unproven: ' + map.opaque : baseline;
}

export function proposalDevices(root, base, tree, forceFull = false, cited) {
  const { changes } = stagedDiff(root, { parent: base, tree });
  const paths = changes.map(change => ({ ...change, classification: pathClass(change.path) }));
  const demotions = [], evidence = [];
  if (!changes.length) return { full: forceFull, run: true, reason: forceFull ? 'Full run requested' : 'No proposal delta',
    paths, evidence, demotions };
  let missing;
  try {
    const before = deviceInputs(root, base), after = deviceInputs(root, tree);
    const prior = retainedObservations(root, before.key);
    const next = before.key === after.key ? prior : retainedObservations(root, after.key);
    const { paths: learned, missingProof, suspended } = scopeFailures(root);
    const all = [...new Set([...before.classes.keys(), ...after.classes.keys()])].sort();
    for (const path of all) {
      if (!before.classes.has(path) || !after.classes.has(path)) continue;
      const from = classifyDevicePath(before, prior, learned, path, 'M'), to = classifyDevicePath(after, next, learned, path, 'M');
      if (!skipReasons.has(from) && skipReasons.has(to)) demotions.push({ path, from, to,
        reason: 'Previously covered input is outside the proposed device closure' });
    }
    // All observations still inform coverage, including newer and suspended records.
    const usable = (records, revision) => {
      const suspendedTrees = new Set(records.filter(record => suspended.has(record.id)).map(record => record.tree));
      return records.filter(record =>
        !missingProof && !suspendedTrees.has(record.tree) && (!cited || cited.has(record.id)) &&
        !stagedDiff(root, { parent: record.tree, tree: revision }).changes.some(change =>
          records.some(seen => observedReason(seen.platforms, change.path, change.status))));
    };
    const left = usable(prior, base), right = usable(next, tree);
    for (const id of new Set([...left,...right].map(record => record.id))) evidence.push(id);
    for (const row of paths) {
      const from = classifyDevicePath(before, prior, learned, row.path, row.status);
      const to = classifyDevicePath(after, next, learned, row.path, row.status);
      row.classification = !skipReasons.has(from) ? from : to;
    }
    if (!left.length || !right.length) missing = 'No complete full-run device observation for these inputs';
  } catch (cause) {
    missing = 'Device map unavailable: ' + cause.message;
    for (const row of paths) if (skipReasons.has(row.classification)) row.classification = missing;
  }
  const required = paths.find(row => !skipReasons.has(row.classification));
  const run = forceFull || Boolean(required || missing);
  const reason = forceFull ? 'Full run requested' :
    required ? required.path + ' — ' + required.classification : missing ??
    'No phone dependency in either tree. Changed paths: ' + [...new Set(paths.map(row => row.classification))].join(', ');
  return { full: forceFull, run, reason, paths, evidence, demotions };
}

export function replayProposalDevices(root, base, tree, forceFull, recordedPlan) {
  return proposalDevices(root, base, tree, forceFull, new Set(recordedPlan?.evidence));
}

export function proposalScope(root, base, tree, plan) {
  if (!plan.run) return { iphone: false, families: [] };
  // Preserve the registered affected-family selection only for ordinary native source edits.
  if (!plan.full && plan.paths.length && plan.paths.every(row =>
    row.status === 'M' && /^packages\/native\/src\//.test(row.path))) {
    const scope = deviceScope(root, base, tree);
    if (scope.iphone) return scope;
  }
  return full;
}
