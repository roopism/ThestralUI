import { copyFileSync, globSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

export function retainDeviceEvidence(root, destination) {
  const patterns = ['final-budget-failure.json', 'device.json', '*/device.json', 'maestro-session-*/ready.json', '*/maestro-session-*/ready.json',
    '{maestro-session-*,*/maestro-session-*}/*/{request.json,reply.json,suite.json,junit.xml,nodes.xml,elements.json}',
    '*/timing-source.json', '*/timing-admission.json', '*/timing-diagnostic/**/*.txt',
    '*/timing-diagnostic/*.json', '*/timing-diagnostic-error.txt', '*/frame-trial-*/*.txt', '*/frame-measurements.json', '*/motion-target.json', '*/ripple.json'];
  for (const file of globSync(patterns, { cwd: root })) {
    const target = join(destination, file);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(root, file), target);
  }
}
