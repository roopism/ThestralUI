import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Run the real CLI on a tiny offline repo. The probe reports the hook input
// and stops before any suite can produce a qualification result.
export function stagedHookProbe(cwd, git, env, cli, args, input) {
  mkdirSync(join(cwd, 'scripts/gates'), { recursive: true });
  mkdirSync(join(cwd, 'dep'), { recursive: true });
  writeFileSync(join(cwd, 'dep/package.json'), '{"name":"fixture-dep","version":"1.0.0"}');
  writeFileSync(
    join(cwd, 'package.json'),
    JSON.stringify({
      name: 'local-hook-fixture',
      version: '1.0.0',
      dependencies: { 'fixture-dep': 'file:dep' },
    }),
  );
  execFileSync(
    'npm',
    ['install', '--package-lock-only', '--offline', '--ignore-scripts', '--no-audit', '--no-fund'],
    { cwd, env },
  );
  const judge = "import assert from 'node:assert/strict'; assert.match(process.argv[3], /^[0-9a-f]{40}$/);";
  writeFileSync(join(cwd, 'scripts/gates/no-weakening.mjs'), judge);
  const runner = [
    "import { readFileSync } from 'node:fs';",
    'const content = readFileSync(' + JSON.stringify(input) + ", 'utf8');",
    "throw Error('staged probe ' + process.argv[5] + ': ' + content);",
  ].join('\n');
  writeFileSync(join(cwd, 'scripts/gates/local-run.mjs'), runner);
  git('add', 'scripts/gates', 'dep', 'package.json', 'package-lock.json');
  git('commit', '--quiet', '-m', 'fixture for staged hook');
  writeFileSync(join(cwd, input), 'from index');
  git('add', '--', input);
  writeFileSync(join(cwd, input), 'from working copy');
  return spawnSync(process.execPath, [cli, ...args], { cwd, env, encoding: 'utf8' });
}
