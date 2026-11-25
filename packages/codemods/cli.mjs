#!/usr/bin/env node
import { mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { migrations } from './migrations.mjs';

const { positionals: [name, ...paths], values } = parseArgs({
  allowPositionals: true,
  options: { write: { type: 'boolean' } },
});
const migration = migrations.find((record) => record.id === name && record.transform);
if (!migration || !paths.length || paths.some((file) => !/\.[jt]sx$/.test(file))) {
  console.error('Usage: ui-lazy-migrate button-icon-slots [--write] file.tsx [file.jsx ...]');
  process.exitCode = 2;
} else {
  for (const path of paths) {
    const target = realpathSync(path);
    const before = readFileSync(target, 'utf8');
    const after = migration.transform(before, target);
    if (before === after) continue;
    if (values.write) {
      const temp = mkdtempSync(join(dirname(target), '.ui-migration-'));
      try {
        const replacement = join(temp, 'output');
        writeFileSync(replacement, after, { mode: statSync(target).mode });
        renameSync(replacement, target);
      } finally {
        rmSync(temp, { recursive: true, force: true });
      }
    }
    console.log((values.write ? 'Updated ' : 'Would update ') + path);
  }
}
