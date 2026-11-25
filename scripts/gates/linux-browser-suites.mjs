import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { browserMatrix, scenarioMatrix } from '../../packages/policy/quality/browser-matrix.mjs';
import { verifyPassed } from '../../packages/policy/quality/api-depth/evidence.mjs';

assert.equal(process.platform, 'linux');
assert.equal(process.arch, 'arm64');
const manifest = 'tests/acceptance/browser-matrix.json';
const { cases, projects } = JSON.parse(readFileSync(manifest));
scenarioMatrix();
browserMatrix(manifest);
verifyPassed('browser', cases, projects);
