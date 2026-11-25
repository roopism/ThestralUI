import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const trusted = fileURLToPath(new URL('.', import.meta.url));
const probeNames = ['FrameActivity.kt', 'FrameFixture.js', 'index.js'];

function calibration(directory) {
  const { reference } = JSON.parse(readFileSync(join(directory, 'low-end-budget.json')));
  const source = reference.scrollInputSource;
  return { ...source.fixtureBlobs, 'FrameActivity.kt': source.probeBlob };
}

// Check both snapshots before even looking up a cached APK host. A candidate
// cannot replace a measured input by changing its copy of the pins as well.
export function verifiedAndroidProbes(root) {
  const candidate = join(root, 'tests/android');
  const expected = calibration(trusted);
  const proposed = calibration(candidate);
  for (const name of probeNames) {
    const bytes = readFileSync(join(trusted, name));
    const blob = createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
    if (blob !== expected[name] || proposed[name] !== blob || !bytes.equals(readFileSync(join(candidate, name)))) {
      throw Error('Android timing probe calibration mismatch for ' + name +
        '. Re-measure the reference on the calibrated device before changing this probe.');
    }
  }
  return trusted;
}
