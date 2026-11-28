import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyFamilies, verifyTypes } from './api-depth.mjs';
import { cases, shippedMinimum } from './consumer-cases.mjs';

const [consumer, registryPath] = process.argv.slice(2);
if (!consumer || !registryPath)
  throw Error('Pass the installed consumer directory and the current component registry');
const { revision, families: reviewed } = JSON.parse(
  readFileSync(new URL('./families.json', import.meta.url)),
);
const { families } = await import(pathToFileURL(resolve(registryPath)).href);
verifyFamilies(
  reviewed,
  families
    .filter((f) => f.api?.length)
    .map((f) => ({ id: f.id, exports: [...f.api, ...(f.nativeApi || [])] })),
);
const current = verifyTypes(consumer, reviewed, shippedMinimum);
console.log('Packed current API contracts', revision, current);
const proposed = cases === shippedMinimum ? current : verifyTypes(consumer, reviewed, cases);
console.log('Proposed API requirements', revision, proposed);
