import { spawnSync } from 'node:child_process';
import { servicePorts } from './ports.mjs';

const result = spawnSync('storybook', ['dev', '-p', String(servicePorts().catalog), '--exact-port', '--disable-telemetry'], {
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
