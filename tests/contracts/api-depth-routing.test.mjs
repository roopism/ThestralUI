import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  families,
  reviewedFamilies,
  validateRoutes,
  verifyExamples,
  verifyPassed,
} from '../../packages/policy/quality/api-depth/evidence.mjs';
test('the frozen depth policy assigns an executed minimum to every family and every native implementation', () => {
  validateRoutes();
  const row = { ...families.find((f) => f.evidence.native), evidence: { unit: 'test case' } };
  assert.throws(() => validateRoutes([row]), /native/);
  assert.throws(() => validateRoutes([{ ...row, exports: ['native/modes:ModeProvider'] }]), /native/);
  assert.throws(
    () => validateRoutes([{ ...row, exports: ['.:Button'], evidence: {} }]),
    /behavior/,
  );
  assert.throws(
    () =>
      validateRoutes([{ ...row, exports: ['.:Button'], evidence: { packed: 'primitives:Stack' } }]),
    /Unrelated/,
  );
});
test('a planned case or a different engine cannot replace a passed family-specific behavior', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'depth-assertions-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'tests/tabs'), { recursive: true });
  const file = join(root, 'tests/tabs/navigation.spec.ts');
  writeFileSync(file, `test('changes selection',()=>{expect(value).toBe('active');});`);
  const row = {
    id: 'Tabs',
    next: 'Controlled selection',
    exports: ['navigation:Tabs'],
    evidence: { browser: 'tabs/navigation.spec.ts | changes selection' },
    assertions: { 'tabs/navigation.spec.ts | changes selection': "expect(value).toBe('active')" },
  };
  const engines = ['chromium', 'firefox', 'webkit'],
    cases = engines.map((engine) => engine + ' | ' + row.evidence.browser);
  verifyPassed('browser', cases, engines, [row], root);
  assert.throws(
    () => verifyPassed('browser', cases.slice(1), engines, [row], root),
    /chromium.*navigation/,
  );
  assert.throws(
    () => verifyPassed('browser', cases.slice(1), engines.slice(1), [row], root),
    /engine/,
  );
  writeFileSync(file, `test('changes selection',()=>{expect(true).toBe(true)});`);
  assert.throws(() => verifyPassed('browser', cases, engines, [row], root), /assertion missing/);
  assert.throws(
    () =>
      verifyPassed(
        'unit',
        ['form | other'],
        [],
        [{ ...row, evidence: { unit: 'tabs | changes selection' } }],
      ),
    /Tabs/,
  );
});

test('published depth increments require a matched API spec and public story with the reviewed properties', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'component-examples-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'catalog'), { recursive: true });
  mkdirSync(join(root, 'docs/components'), { recursive: true });
  const row = reviewedFamilies('actions').find((family) => family.id === 'Button');
  const inventory = [{ id: 'Button', web: 'supported', story: 'catalog/ButtonSizes.stories.tsx' }];
  const story = join(root, inventory[0].story),
    spec = join(root, 'docs/components/button.md');
  writeFileSync(
    spec,
    '---\n{"family":"Button"}\n---\n\n# Button\nsize startIcon endIcon tone [MUI](https://mui.com/material-ui/react-button/)',
  );
  const header =
    'import {Button as Action} from "@ui-lazy-dev/ui-web"; export const Review = () => ';
  const use =
    '<Action size="lg" tone="secondary" startIcon={<svg/>} endIcon={<svg/>}>Save</Action>';
  writeFileSync(story, header + use);
  assert.equal(verifyExamples([row], inventory, root).reviewedIncrements, 1);
  writeFileSync(story, header + use.replace(' startIcon={<svg/>}', ''));
  assert.throws(() => verifyExamples([row], inventory, root), /startIcon/);
  writeFileSync(story, header.replace('@ui-lazy-dev/ui-web', './local-button') + use);
  assert.throws(() => verifyExamples([row], inventory, root), /in the published story/);
  writeFileSync(story, header + use);
  writeFileSync(spec, '# Button\n[MUI](https://mui.com/material-ui/react-button/)');
  assert.throws(() => verifyExamples([row], inventory, root), /API specification/);
});
