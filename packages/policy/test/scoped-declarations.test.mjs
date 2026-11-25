import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readDeclaredApi } from '../quality/specs/declarations.mjs';

test('scoped packed declarations preserve canonical union order and retain genuine role changes', t => {
  const consumer = mkdtempSync(join(tmpdir(), 'ui-scoped-role-'));
  t.after(() => rmSync(consumer, {recursive:true,force:true}));
  const pkg = join(consumer, 'node_modules/@ui-lazy-dev/ui-web');
  mkdirSync(pkg, { recursive:true });
  writeFileSync(join(pkg, 'package.json'), JSON.stringify({name:'@ui-lazy-dev/ui-web',exports:{'.':{types:'./index.d.ts'}}}));
  const selected = {id:'Modal',exports:['.:OverlayDialog']};
  const universe = [{id:'Notice',exports:['.:Notice']},selected];
  const declaration = join(pkg,'index.d.ts');
  function emit(role) {
    writeFileSync(declaration, [
      'export declare function Notice(props: { role: "alertdialog" }): void;',
      'export declare function OverlayDialog(props: { role?: '+role+' }): void;',
    ].join('\n'));
  }
  const role = result => result.get('.:OverlayDialog').get('role');
  emit('"dialog" | "alertdialog"');
  const full = role(readDeclaredApi(consumer,universe));
  const scoped = () => readDeclaredApi(consumer,[selected],new Map(),{scoped:true, universe});
  assert.equal(role(scoped()),full);
  assert.deepEqual([...scoped().keys()],['.:OverlayDialog']);
  emit('"dialog" | "alertdialog" | "status"');
  assert.notEqual(role(scoped()),full);
  assert.match(role(scoped()),/"status"/);
});
