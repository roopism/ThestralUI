import { readdirSync } from 'node:fs';
import { join } from 'node:path';

// Reservations made before the tree-wide protocol also consume the single allowed diagnostic.
export function hasEarlierAndroidDiagnostic(directory, tree, except) {
  try {
    return readdirSync(join(directory, '..', 'uld-delivery', 'android-timing-diagnostics'))
      .some(name => name !== except && name.startsWith(tree + '-') && name.endsWith('.json'));
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}
