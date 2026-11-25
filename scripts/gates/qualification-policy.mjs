import { withLock } from '../workers/lock.mjs';

export function runWithIntegrationReservation(mode, root, tree, run, lock = withLock) {
  return mode === 'hook' ? run() : lock(root, 'integration', mode + ' ' + tree, run);
}

export function qualificationStatus(suites, error) {
  const passed =
    suites.length > 0 &&
    suites.every(
      (row) => row.result === 'passed' || (row.name === 'iPhone Simulator' && row.result === 'web-only'),
    );
  return passed && !error ? 'passed' : 'failed';
}
