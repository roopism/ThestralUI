import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { migrations, checkMigration } from './migrations.mjs';

for (const { id, transform: migrate } of migrations.filter((item) => item.transform)) {
  test(id + ' matches its before/after fixture and is safe to repeat', () => {
    const read = (name) => readFileSync(new URL('./fixtures/' + id + '/' + name + '.tsx', import.meta.url), 'utf8');
    const before = read('before');
    const after = read('after');
    assert.notEqual(before, after);
    assert.equal(migrate(before), after);
    assert.equal(migrate(after), after);
  });
}

test('a compatible additive codemod cannot account for an unrelated breaking change', () => {
  const failure = 'Button was removed';
  const change = { from: '0.2.0', to: '0.3.0-rc.1', entry: 'web/index', diagnostic: failure };
  const record = { ...change, diagnostics: [failure] };
  const manual = { ...record, manual: 'No automatic migration: choose a replacement action and retain its accessible name.' };
  assert.throws(() => checkMigration(change), /scoped codemod/);
  assert.throws(() => checkMigration(change, [record]), /with instructions/);
  assert.throws(() => checkMigration({ ...change, entry: 'native/index' }, [manual]), /scoped codemod/);
  assert.throws(() => checkMigration({ ...change, to: '0.4.0' }, [manual]), /scoped codemod/);
  assert.doesNotThrow(() => checkMigration(change, [manual]));
  const automatic = { ...record, transform: migrations[0].transform, id: migrations[0].id };
  assert.doesNotThrow(() => checkMigration(change, [automatic]));
});
