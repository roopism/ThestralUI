import { inCommandGroup } from './isolated-command.mjs';
import { execFileSync } from 'node:child_process';
import { withTiming } from './resource-guard.mjs';
import { releaseLocksOnSignal } from './lock.mjs';

const [name, ...args] = process.argv.slice(2);
const run = (command, argv) => execFileSync(command, argv, { stdio: 'inherit' });
function packages(extra = []) {
  for (const workspace of ['tokens', 'ui-web', 'ui-native'])
    run('npm', [
      'run',
      'build',
      '-w',
      '@ui-lazy-dev/' + workspace,
      ...(workspace === 'ui-native' && extra.length ? ['--', ...extra] : []),
    ]);
}
releaseLocksOnSignal();
await inCommandGroup(() => withTiming('activity', name, () => {
  switch (name) {
    case 'packages':
      return packages(args);
    case 'build':
      packages();
      return run('storybook', ['build', '-o', 'dist/catalog', '--disable-telemetry', ...args]);
    case 'catalog':
      packages();
      return run(process.execPath, ['scripts/workers/catalog.mjs', ...args]);
    case 'browser':
      return run('playwright', ['test', ...args]);
    default:
      throw Error('Unknown build or browser command ' + name);
  }
}));
