import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { assertTimingConfigChange } from '../timing/config-policy.mjs';
import { fixtureGit, isolateFixtureProcess } from './fixtures/hermetic-git.mjs';

isolateFixtureProcess();

const file = 'tests/android/timing-strategy.json';
const approved = {
  active: { 'android-low-end': 'paired-ab', 'mac-browser': 'absolute' },
  minPairs: 6, maxExtraPairs: 4, relativeThreshold: 0.1, absoluteThresholdMs: 2,
};

function repository(t) {
  const root = mkdtempSync(join(tmpdir(), 'uld-timing-policy-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (args, input) => fixtureGit(root, args, input);
  git(['init', '--template=', '--quiet']);
  function put(path, text, mode = '100644') {
    const oid = git(['hash-object', '-w', '--stdin'], text);
    git(['update-index', '--add', '--cacheinfo', [mode, oid, path].join(',')]);
  }
  function tree(settings, { mode, extra } = {}) {
    git(['read-tree', '--empty']);
    if (settings !== undefined) put(file, typeof settings === 'string' ? settings : JSON.stringify(settings), mode);
    for (const [path, text] of Object.entries(extra ?? {})) put(path, text);
    return git(['write-tree']);
  }
  const commit = tree => git(['-c', 'user.name=Timing test', '-c', 'user.email=timing@example.invalid', 'commit-tree', tree, '-m', 'Fixture base']);
  return { root, tree, commit, check: (base, candidate) => assertTimingConfigChange(root, base, candidate) };
}

test('timing settings require the exact approved first adoption and a regular committed file', t => {
  const { tree, commit, check } = repository(t);
  const absent = commit(tree());
  assert.doesNotThrow(() => check(absent, tree(approved)));
  assert.throws(() => check(absent, tree()), /missing/);
  assert.throws(() => check(absent, tree({ ...approved, minPairs: 7 })), /first adoption/);
  assert.throws(() => check(absent, tree({ ...approved, maxExtraPairs: 5 })), /first adoption/);
  assert.throws(() => check(absent, tree({ ...approved, active: { ...approved.active, 'android-low-end': 'absolute' } })), /first adoption/);
  assert.throws(() => check(absent, tree('elsewhere.json', { mode: '120000' })), /regular file/);
  assert.throws(() => check(commit(tree(approved)), tree()), /missing/);
});

test('timing settings reject malformed values, unknown keys and duplicate entries', t => {
  const { tree, commit, check } = repository(t);
  const base = commit(tree(approved));
  const invalid = [
    ['{', /invalid JSON/],
    [null, /settings and measured surfaces/],
    [{ ...approved, optional: true }, /settings and measured surfaces/],
    [{ ...approved, active: { 'android-low-end': 'paired-ab' } }, /settings and measured surfaces/],
    [{ ...approved, active: { ...approved.active, 'mac-browser': null } }, /strategy name/],
    [{ ...approved, minPairs: 6.5 }, /minPairs/],
    [{ ...approved, minPairs: Number.MAX_SAFE_INTEGER + 1 }, /minPairs/],
    [{ ...approved, maxExtraPairs: -1 }, /maxExtraPairs/],
    [{ ...approved, maxExtraPairs: '4' }, /maxExtraPairs/],
    [{ ...approved, relativeThreshold: -0.1 }, /relativeThreshold/],
    [{ ...approved, absoluteThresholdMs: null }, /absoluteThresholdMs/],
    [JSON.stringify(approved).replace('"absoluteThresholdMs":2', '"absoluteThresholdMs":1e400'), /finite/],
    [JSON.stringify(approved).replace('"minPairs":6', '"minPairs":6,"minPairs":6'), /duplicate/],
    [JSON.stringify(approved).replace('"mac-browser":"absolute"', '"mac-browser":"absolute","mac-browser":"absolute"'), /duplicate/],
  ];
  for (const [settings, diagnostic] of invalid) assert.throws(() => check(base, tree(settings)), diagnostic);
  assert.throws(() => check(commit(tree('{')), tree(approved)), /invalid JSON/);
});

test('timing pair counts and thresholds ratchet against the committed base', t => {
  const { root, tree, commit, check } = repository(t);
  const tightened = { ...approved, minPairs: 8, maxExtraPairs: 2, relativeThreshold: 0.05, absoluteThresholdMs: 1 };
  const base = commit(tree(approved));
  assert.doesNotThrow(() => check(base, tree(tightened)));
  const strictBase = commit(tree(tightened));
  mkdirSync(join(root, 'tests', 'android'), { recursive: true });
  writeFileSync(join(root, file), JSON.stringify(tightened));
  for (const name of ['minPairs', 'maxExtraPairs', 'relativeThreshold', 'absoluteThresholdMs']) {
    assert.throws(() => check(strictBase, tree({ ...tightened, [name]: approved[name] })), new RegExp(name));
  }
  assert.doesNotThrow(() => check(strictBase, tree({ ...tightened, maxExtraPairs: 0, relativeThreshold: 0, absoluteThresholdMs: 0 })));
});

test('unused timing strategies can be added while unsigned selector changes are refused', t => {
  const { tree, commit, check } = repository(t);
  const base = commit(tree(approved));
  const extra = {
    'scripts/gates/timing/experimental.mjs': 'export function measure() { throw Error("unavailable"); }',
    'docs/ui-lazy-dev-state.md': 'A proposed strategy was recorded for review.\n',
  };
  assert.doesNotThrow(() => check(base, tree(approved, { extra })));
  for (const surface of ['android-low-end', 'mac-browser']) {
    const switched = { ...approved, active: { ...approved.active, [surface]: 'experimental' } };
    assert.throws(() => check(base, tree(switched, { extra })), /owner-controlled signing channel/);
  }
});
