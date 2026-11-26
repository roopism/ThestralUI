import { approvedTimingSuites } from './proposal-timing.mjs';
import { scopedSkip } from './device-verdict.mjs';
import { withLock } from '../workers/lock.mjs';

export function runWithIntegrationReservation(mode, root, tree, run, lock = withLock) {
  return mode === 'hook' ? run() : lock(root, 'integration', mode + ' ' + tree, run);
}

export function qualificationStatus(suites, error, receipt, root = process.cwd()) {
  const skips = approvedTimingSuites(root, receipt);
  const passed =
    suites.length > 0 &&
    suites.every(row => row.result === 'passed' || scopedSkip(receipt, row) ||
      (row.result === 'skipped' && skips?.includes(row.name)) ||
      (!receipt?.devicePlan && row.name === 'iPhone Simulator' && row.result === 'web-only'));
  return passed && skips !== null && !error ? 'passed' : 'failed';
}
