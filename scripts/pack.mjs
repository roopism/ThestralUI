import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { packageWorkspaces } from './package-workspaces.mjs';
import { verifyReviewedArchives } from './verify-reviewed-archives.mjs';
const archives = new Map();
const destination = resolve('release');
mkdirSync(destination, { recursive: true });
const sums = [];
for (const name of packageWorkspaces(process.cwd()).keys()) {
  const result = execFileSync(
    'npm',
    ['pack', '--workspace', name, '--pack-destination', destination, '--json'],
    { encoding: 'utf8' },
  );
  const [{ filename }] = JSON.parse(result);
  archives.set(name, resolve(destination, filename));
  const hash = createHash('sha256')
    .update(readFileSync(resolve(destination, filename)))
    .digest('hex');
  sums.push(hash + '  ' + filename);
}
await verifyReviewedArchives(process.cwd(), archives);
writeFileSync(resolve(destination, 'SHA256SUMS'), sums.join('\n') + '\n');
