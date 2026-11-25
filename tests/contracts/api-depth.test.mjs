import { readDeclaredApi } from '../../packages/policy/quality/specs/declarations.mjs';
import { strict as assert } from 'node:assert';
import { before, after, test } from 'node:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { verifyTypes, verifyFamilies, verifyRuntime, compare } from '../../packages/policy/quality/api-depth/api-depth.mjs';

const families = [
  { id: 'Button', exports: ['.:Button'], oracle: 'Logical icons leave the action named' },
  {
    id: 'Stack',
    exports: ['primitives:Stack'],
    oracle: 'Resizing the gap keeps the child mounted',
  },
];
const cases = {
  '.:Button': {
    accept: ['{ size:"sm", startIcon:"save", endIcon:"check" }', '{size:"lg"}'],
    reject: ['{size:"typo"}', '{startIcon:{invalid: true}}', '{endIcon:{invalid: true}}'],
  },
  'primitives:Stack': {
    accept: ['{gap:"sm",align:"start"}', '{gap:"lg",align:"end"}'],
    reject: ['{gap:123}', '{align:"typo"}'],
  },
};
const original = 'size?: "sm"|"lg"; startIcon?: string; endIcon?: string';
const stack = 'gap?: "sm"|"lg"; align?: "start"|"end"';
let root;
const pkg = join('node_modules', '@ui-lazy-dev', 'ui-web');
const entry = (name, props) =>
  'export declare function ' + name + '(props: {' + props + '}): string;\n';
function write(buttonProps = original, stackProps = stack) {
  writeFileSync(join(root, pkg, 'index.d.ts'), entry('Button', buttonProps));
  writeFileSync(join(root, pkg, 'primitives.d.ts'), entry('Stack', stackProps));
}
before(() => {
  root = mkdtempSync(join(tmpdir(), 'depth-type-test-'));
  mkdirSync(join(root, pkg), { recursive: true });
  symlinkSync(
    dirname(createRequire(import.meta.url).resolve('typescript/package.json')),
    join(root, 'node_modules/typescript'),
  );
  writeFileSync(
    join(root, pkg, 'package.json'),
    JSON.stringify({
      name: '@ui-lazy-dev/ui-web',
      type: 'module',
      exports: { '.': { types: './index.d.ts' }, './primitives': { types: './primitives.d.ts' } },
    }),
  );
  write();
});
after(() => rmSync(root, { recursive: true, force: true }));
test('an absent family or an unowned companion export fails', () => {
  assert.throws(() => verifyFamilies(families, families.slice(0, 1)), /Stack/);
  assert.throws(
    () =>
      verifyFamilies(families, [
        families[0],
        { ...families[1], exports: ['primitives:Stack', 'primitives:Inline'] },
      ]),
    /Inline/,
  );
});
test('real public import accepts all valid cases and rejects invalid ones', () => {
  write();
  assert.equal(verifyTypes(root, families, cases).bindings, 2);
});
test('missing props and narrowed unions fail positive consumers', () => {
  for (const [needle, value] of [
    ['size', 'size?: "sm"|"lg"; '],
    ['startIcon', 'startIcon?: string; '],
    ['endIcon', 'endIcon?: string'],
  ]) {
    write(original.replace(value, ''));
    assert.throws(() => verifyTypes(root, families, cases), new RegExp(needle));
  }
  for (const [needle, value] of [
    ['gap', 'gap?: "sm"|"lg"; '],
    ['align', 'align?: "start"|"end"'],
  ]) {
    write(original, stack.replace(value, ''));
    assert.throws(() => verifyTypes(root, families, cases), new RegExp(needle));
  }
  write(original.replace('"sm"|"lg"', '"sm"'));
  assert.throws(() => verifyTypes(root, families, cases), /lg/);
});
test('erased prop, widened prop, or any component fails consumer contracts', () => {
  write(original.replace('startIcon?: string', 'startIcon?: any'));
  assert.throws(() => verifyTypes(root, families, cases), /Unused|any/);
  write(original.replace('"sm"|"lg"', 'string'));
  assert.throws(() => verifyTypes(root, families, cases), /Unused/);
  write();
  writeFileSync(join(root, pkg, 'primitives.d.ts'), 'export declare const Stack:any;');
  assert.throws(() => verifyTypes(root, families, cases), /Stack/);
});
test('missing per-family type case blocks the release', () => {
  write();
  assert.throws(() => verifyTypes(root, families, { '.:Button': cases['.:Button'] }), /Stack/);
});
test('every export needs its own executed and mutation-sensitive probe', async () => {
  const bindings = { '.:Button': () => 'button', 'primitives:Stack': () => 'stack' };
  const resolve = (id) => bindings[id];
  const probes = {
    '.:Button': (subject) => compare(subject(), 'button', 'semantic button'),
    'primitives:Stack': (subject) => compare(subject(), 'stack', 'layout'),
  };
  assert.equal((await verifyRuntime(families, probes, resolve)).length, 2);
  await assert.rejects(
    verifyRuntime(families, { '.:Button': probes['.:Button'] }, resolve),
    /Stack/,
  );
  await assert.rejects(
    verifyRuntime(families, { ...probes, 'primitives:Stack': () => {} }, resolve),
    /Stack/,
  );
  await assert.rejects(
    verifyRuntime(
      families,
      {
        ...probes,
        'primitives:Stack': () => compare(resolve('.:Button')(), 'button', 'wrong export'),
      },
      resolve,
    ),
    /Stack/,
  );
  await assert.rejects(
    verifyRuntime(
      families,
      {
        ...probes,
        'primitives:Stack': () => {
          throw Error('crash');
        },
      },
      resolve,
    ),
    /crash/,
  );
});

test('the packed native root and a subpath keep distinct exports with the same name', t => {
  const directory = join(root, 'node_modules/@ui-lazy-dev/ui-native');
  mkdirSync(directory);
  t.after(() => rmSync(directory, { recursive: true }));
  writeFileSync(join(directory, 'package.json'), JSON.stringify({ name: '@ui-lazy-dev/ui-native',
    type: 'module', exports: { '.': { types: './root.d.ts' }, './modes': { types: './modes.d.ts' } } }));
  writeFileSync(join(directory, 'root.d.ts'), entry('Control', 'action: string'));
  const modes = join(directory, 'modes.d.ts');
  const declarationsText = entry('Control', 'scheme: "light" | "dark"') + '\nexport declare function useMode(): { scheme: string };';
  writeFileSync(modes, declarationsText);
  const family = { id: 'Native controls', exports: ['native:Control', 'native/modes:Control', 'native/modes:useMode'] };
  const samples = {
    'native/modes:useMode': { mode: 'call', accept: [''], reject: ['"dark"'] },
    'native:Control': { accept: ['{action:"save"}'], reject: ['{scheme:"dark"}'] },
    'native/modes:Control': { accept: ['{scheme:"dark"}'], reject: ['{action:"save"}'] },
  };
  verifyTypes(root, [family], samples);
  const declarations = readDeclaredApi(root, [family]);
  assert.deepEqual([...declarations.get('native/modes:useMode').keys()], []);
  assert.deepEqual([...declarations.get('native:Control').keys()], ['action']);
  assert.deepEqual([...declarations.get('native/modes:Control').keys()], ['scheme']);
  assert.throws(() => verifyTypes(root, [{ ...family, exports: ['native:Control'] }],
    { 'native:Control': samples['native:Control'] }), /unexpected native\/modes:Control/);
});
