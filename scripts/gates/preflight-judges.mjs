import assert from 'node:assert/strict';
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readAttempt } from './qualification-attempt.mjs';
import { noWeakening } from './no-weakening.mjs';
import { reviewPolicy } from './review/qualification-policy.mjs';

// Keep the preliminary judgments in the integration snapshot's Git environment.
const [root, directory, id, base, commit, tree] = process.argv.slice(2);
const attempt = readAttempt(directory, id, base, commit, tree, 'qualification');
const preflight = JSON.parse(readFileSync(0, 'utf8'));
const findings = new Set();
for (const issues of [preflight.findings, noWeakening(process.cwd(), base, tree, root), reviewPolicy(root, base, tree)]) {
  assert.ok(Array.isArray(issues) && issues.every(issue => typeof issue === 'string' && issue.length));
  for (const issue of issues) findings.add(issue);
}
if (findings.size) {
  for (const issue of findings) console.error(issue);
  const path = join(directory, 'attempts', id + '.json');
  const body = { ...attempt, preflightId: preflight.id, judgeFindings: [...findings] };
  writeFileSync(path + '.judges', JSON.stringify(body, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  renameSync(path + '.judges', path);
}
