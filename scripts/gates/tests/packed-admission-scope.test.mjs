import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { withRevisionSnapshot } from '../../../packages/policy/quality/staged-tree.mjs';
import { fixtureGit, isolateFixtureProcess } from './fixtures/hermetic-git.mjs';

isolateFixtureProcess();

test('one activity covers the packed checkout through cleanup on failure', async t => {
  const root = mkdtempSync(join(tmpdir(), 'uld-admission-scope-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  fixtureGit(root, ['init', '--quiet', '--template=']);
  const tree = fixtureGit(root, ['write-tree']);
  const activities = join(root, '.git/uld-locks/timing-activities');
  const claim = () => existsSync(activities) && readdirSync(activities).map(file =>
    JSON.parse(readFileSync(join(activities, file), 'utf8'))).find(row => row.state === 'active' && row.mode === 'activity')?.id;
  const observations = [];
  const module = new URL('../packed-admission.mjs?observe-snapshot', import.meta.url).href;
  const key = Symbol.for('test.packed-admission.snapshot');
  globalThis[key] = async (...args) => {
    observations.push(claim());
    try { return await withRevisionSnapshot(...args); }
    finally { observations.push(claim()); }
  };
  const hooks = registerHooks({ resolve(name, context, next) {
    if (context.parentURL !== module || !name.endsWith('/staged-tree.mjs')) return next(name, context);
    const code = 'export const withRevisionSnapshot = globalThis[Symbol.for("test.packed-admission.snapshot")]';
    return { url: 'data:text/javascript,' + encodeURIComponent(code), shortCircuit: true };
  } });
  t.after(() => { hooks.deregister(); delete globalThis[key]; });
  const { measureAdmission } = await import(module);
  const previous = process.env;
  process.env = { ...previous, ULD_ARTIFACT_COMMON: join(root, '.git') };
  delete process.env.ULD_TIMING_RESERVATION;
  t.after(() => { process.env = previous; });
  // An empty tree stops at dependency installation, after the real checkout.
  await assert.rejects(measureAdmission(root, tree, tree, []), /package-lock.json/);
  assert.ok(observations[0], 'the activity must already own checkout');
  assert.deepEqual(observations, [observations[0], observations[0]], 'the same activity must own cleanup');
  assert.ok(!claim(), 'failed admission releases the activity');
});
