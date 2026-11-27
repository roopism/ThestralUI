import assert from 'node:assert/strict';
import { renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { judgeOnlyFindings, requirePreflight } from './preflight-receipt.mjs';
import { readAttempt } from './qualification-attempt.mjs';
import { noWeakening } from './no-weakening.mjs';
import { reviewPolicy } from './review/qualification-policy.mjs';

// Keep the preliminary judgments in the integration snapshot's Git environment.
const [root, directory, id, base, commit, tree, preflightId] = process.argv.slice(2);
const attempt = readAttempt(directory, id, base, commit, tree, 'qualification');
assert.ok(preflightId, 'Missing admitted preflight ID');
const receipt = requirePreflight(root, dirname(directory), base, commit, tree, preflightId);
assert.equal(receipt?.reuseSchema, 1, 'The trusted judges require a sealed preflight');
const preflight = { id: receipt.id, findings: judgeOnlyFindings(receipt) ?? [] };
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
