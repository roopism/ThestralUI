import { fixtureGit, isolateFixtureProcess } from './hermetic-git.mjs';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { noWeakening } from '../../no-weakening.mjs';

isolateFixtureProcess();

export function compareWithBase(t, path, before, baseFiles = {}, localDecision, judge = noWeakening) {
  const root = mkdtempSync(join(tmpdir(), 'uld-protected-inputs-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (args, input) => fixtureGit(root, args, input);
  git(['init', '--template=', '--quiet']);
  function blob(path, content) {
    const object = git(['hash-object', '-w', '--stdin'], content);
    git(['update-index', '--add', '--cacheinfo', '100644,' + object + ',' + path]);
  }
  blob('.github/CODEOWNERS', '# Fixture covers generic protected inputs.\n');
  for (const [file, text] of Object.entries(baseFiles)) blob(file, text);
  blob(path, before);
  const base = git(['write-tree']);
  git(['update-ref', 'refs/remotes/origin/feat/enterprise-ui', base]);
  if (localDecision) {
    mkdirSync(join(root, '.git/uld-delivery'));
    writeFileSync(join(root, '.git/uld-delivery/gate-file-decisions.md'), localDecision);
  }
  return (after, proposed = {}) => {
    git(['read-tree', base]);
    for (const [file, text] of Object.entries(proposed)) blob(file, text);
    blob(path, after);
    return judge(root, base, git(['write-tree']), root);
  };
}
