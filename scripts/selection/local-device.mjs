import { isVerifiedWebChange } from './native-tier-two.mjs';
import { stagedDiff } from './staged-tree.mjs';
import { selectStaged } from './select.mjs';

const full = { iphone: true, families: null };
export function deviceScope(root, parent, tree, release = false) {
  if (release) return full;
  const diff = stagedDiff(root, { parent, tree });
  if (!diff.changes.length) return full;
  if (diff.changes.some(({ path, status }) =>
    !['A', 'M'].includes(status) ||
    /^(?:packages\/native\/src\/index\.|packages\/(?:tokens|policy|style-policy)\/|scripts\/|tests\/(?:simulator|android|scenarios)\/|catalog\/native\/|manifests\/shared\.json)/.test(path))) return full;
  const scenarioChanged = diff.changes.some(({ path }) => /^docs\/components\/[^/]+\.scenarios\.yaml$/.test(path));
  let webOnly = false;
  try { webOnly = isVerifiedWebChange(root, diff); } catch { return full; }
  if (scenarioChanged) webOnly = false;
  const selection = selectStaged(root, { parent, tree });
  if (selection.tier !== 1) return webOnly ? { iphone: false, families: [] } : full;
  const families = [...new Set(selection.scenarioFiles.map(path => {
    const match = /^docs\/components\/([\w-]+)\.scenarios\.yaml$/.exec(path);
    if (!match) throw Error('Cannot identify native scenario family ' + path);
    return match[1];
  }))].sort();
  return webOnly && !selection.nativeFixtureAffected ? { iphone: false, families: [] } : { iphone: true, families };
}
