import assert from 'node:assert/strict';
import { lstatSync, readFileSync, realpathSync, renameSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';

export function shareBrowserKit(trusted, candidate) {
  const lock = root => JSON.parse(readFileSync(join(root,'package-lock.json'))).packages;
  const before = lock(trusted), after = lock(candidate);
  for (const name of ['@playwright/test','playwright','playwright-core']) {
    const dir = 'node_modules/' + name;
    assert.ok(before[dir]?.integrity && before[dir].integrity === after[dir]?.integrity,
      'Browser package integrity differs for ' + name);
    const target = join(realpathSync(candidate), dir);
    const source = join(realpathSync(trusted), dir);
    assert.equal(realpathSync(source), source);
    assert.equal(realpathSync(target), target);
    assert.ok(lstatSync(target).isDirectory());
    renameSync(target, target + '.candidate-install');
    symlinkSync(source, target, 'dir');
  }
}
