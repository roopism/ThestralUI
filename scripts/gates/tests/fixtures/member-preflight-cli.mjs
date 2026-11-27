import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixtureGit } from './hermetic-git.mjs';

const project = fileURLToPath(new URL('../../../../', import.meta.url));
const repository = 'roopism/ThestralUI';
const integration = 'feat/enterprise-ui';

// Use the real launcher, trusted member, snapshots and receipt writer. Give the
// disposable train a tiny offline build with the same four Typed output roots.
export function memberRepository(root) {
  for (const path of ['scripts', 'tests/android', 'tests/simulator', 'tests/browser/quality-perf-policy.mjs', 'packages/policy/quality',
    'catalog/native/scenarios/fixtures.cjs', '.github']) {
    cpSync(join(project, path), join(root, path), { recursive: true,
      filter: source => source !== join(project, 'scripts/gates/tests') });
  }
  const write = (path, value) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), value);
  };
  write('package.json', '{}');
  write('package-lock.json', '{}');
  write('.gitignore', 'node_modules/\ndist/\nrelease/\n');
  write('tests/acceptance/suite-inputs.json', JSON.stringify({ contractVersion: 1, groups: {
    'Typed and unit rosters': { mode: 'tree', reusable: true, exclude: [], envFacts: ['node'], extraInputs: [] },
  } }));
  write('scripts/gates/local-run.mjs', `
    import assert from 'node:assert/strict';
    import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
    import { join } from 'node:path';
    const lease = join(process.env.ULD_ARTIFACT_COMMON, 'uld-locks/timing-activities', process.env.ULD_TIMING_RESERVATION);
    const { state, mode, holder } = JSON.parse(readFileSync(lease));
    assert.deepEqual([state, mode, holder], ['active', 'activity', 'Prepare train members']);
    assert.equal(process.argv.at(-1), 'hook');
    for (const path of ['packages/tokens/dist', 'packages/web/dist', 'packages/native/dist', 'release/evidence']) {
      mkdirSync(path, { recursive: true });
      writeFileSync(join(path, 'output'), path);
    }
  `);
  fixtureGit(root, ['add', '.']);
}

export function offlineTrainEnv({ dir, server, base, context, members: [member] }) {
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  const script = (name, body) => writeFileSync(join(bin, name), '#!/bin/sh\nset -eu\n' + body, { mode: 0o700 });
  const { head, number, branch, soloCommit } = member;
  fixtureGit(server, ['fetch', '--quiet', context.root, soloCommit + ':refs/pull/' + number + '/merge']);
  const repo = { full_name: repository };
  const api = 'repos/' + repository;
  const responses = {
    [api]: { default_branch: integration },
    [api + '/branches/feat%2Fenterprise-ui']: { name: integration, protected: false },
    [api + '/rules/branches/feat%2Fenterprise-ui']: [],
    [api + '/git/ref/heads/' + integration]: { ref: 'refs/heads/' + integration, object: { sha: base } },
    [api + '/pulls/' + number]: { number, state: 'open', draft: false, merged: false, mergeable: true,
      mergeable_state: 'clean', base: { repo, ref: integration, sha: base }, head: { repo, ref: branch, sha: head }, merge_commit_sha: soloCommit },
    ['headRefOid,reviewDecision']: { headRefOid: head, reviewDecision: null },
    [api + '/commits/' + head + '/status']: { sha: head, total_count: 0 },
    [api + '/commits/' + head + '/check-runs?filter=latest&per_page=100']: [{ total_count: 0, check_runs: [] }],
  };
  writeFileSync(join(bin, 'responses.json'), JSON.stringify(responses));
  script('gh', `exec node -e 'const answers = require(process.argv[1]); const key = process.argv.at(-1);
    if (!Object.hasOwn(answers, key)) throw Error(key); console.log(JSON.stringify(answers[key]))' "$FIXTURE_BIN/responses.json" "$@"`);
  script('git', `case "$*" in
    '--no-replace-objects remote get-url origin'|'--no-replace-objects remote get-url --push --all origin') echo https://github.com/${repository}.git ;;
    *) PATH="$FIXTURE_PATH" exec git "$@" ;;
  esac`);
  script('npm', `test "$1" = ci
    mkdir -p node_modules
    echo '{}' > node_modules/.package-lock.json
    for dep in typescript js-yaml postcss saxes; do ln -s "$FIXTURE_MODULES/$dep" "node_modules/$dep"; done`);
  const env = { ...process.env, PATH: bin + ':' + process.env.PATH, FIXTURE_PATH: process.env.PATH, FIXTURE_BIN: bin,
    FIXTURE_MODULES: join(project, 'node_modules'), GIT_ALLOW_PROTOCOL: 'file' };
  // The fixture has its own Git common directory and reservation namespace.
  delete env.ULD_ARTIFACT_COMMON;
  delete env.ULD_TIMING_RESERVATION;
  return env;
}
