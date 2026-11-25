#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { scan, review, adoption, loadPolicy } from './index.mjs';
import { applicableExceptions } from './owner-transitions.mjs';

const [command, ...args] = process.argv.slice(2);
function option(name) {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1];
}
if (!['check', 'inspect'].includes(command))
  throw Error('Use ui-lazy-policy check --config ui-policy.json [--report report.json].');
const configPath = resolve(option('--config') ?? 'ui-policy.json'),
  root = dirname(configPath),
  config = loadPolicy(configPath);
if (config.version !== 1) throw Error('Unsupported policy configuration version.');
const result = scan(root, config);
const report = {
  version: 1,
  files: result.files,
  adoption: adoption(result.usage),
  findings: result.findings,
};
const output = option('--report');
if (command === 'inspect') {
  if (!output) throw Error('Provide --report to inspect findings for individual review.');
  writeFileSync(resolve(output), JSON.stringify(report, null, 2) + '\n');
} else {
  if (!config.baseline)
    throw Error('Missing baseline path. Add a reviewed exception file even when it is empty.');
  const exceptions = applicableExceptions(
    JSON.parse(readFileSync(resolve(root, config.baseline), 'utf8')), result.historicalExceptions,
  );
  const errors = review(result.findings, exceptions);
  if (
    config.inventory &&
    JSON.stringify(loadPolicy(resolve(root, config.inventory))) !== JSON.stringify(report.adoption)
  )
    errors.push(
      'Adoption inventory changed. Inspect --report, review eligible usage by screen and family, and update the checked-in inventory.',
    );
  if (output)
    writeFileSync(
      resolve(output),
      JSON.stringify({ ...report, exceptions, errors }, null, 2) + '\n',
    );
  if (errors.length) {
    for (const detail of errors) console.error(detail);
    process.exitCode = 1;
  }
  console.log(
    result.files +
      ' production and catalog source files, ' +
      result.findings.length +
      ' findings, ' +
      exceptions.length +
      ' reviewed exceptions, ' +
      errors.length +
      ' errors.',
  );
}
