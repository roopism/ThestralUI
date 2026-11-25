import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readDeclaredApi } from '../../packages/policy/quality/specs/declarations.mjs';

let root;
before(() => {
  root = mkdtempSync(join(tmpdir(), 'ui-spec-fixture-'));
  const dir = join(root, 'node_modules/@ui-lazy-dev/ui-web');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({
      name: '@ui-lazy-dev/ui-web',
      exports: { '.': { types: './entry.d.ts' } },
    }),
  );
  writeFileSync(
    join(dir, 'entry.d.ts'),
    [
      'interface HostProps { title?: string; onClick?(event: MouseEvent): void; ref?: (instance: HTMLButtonElement | null) => void }',
      'type Props = HostProps & ({\n/** @default false */\n loading: boolean } | { error: string });',
      'export declare function Button(props: Props): string;',
      'export declare function animate(source: string, options?: { duration: number }): void;',
    ].join('\n'),
  );
});
after(() => rmSync(root, { recursive: true, force: true }));

test('packed declarations include host props, variant-specific props and every helper parameter', () => {
  const result = readDeclaredApi(root, [{ id: 'Button', exports: ['.:Button', '.:animate'] }]);
  assert.deepEqual([...result.get('.:Button').keys()].sort(), [
    'error',
    'loading',
    'onClick',
    'ref',
    'title',
  ]);
  assert.deepEqual([...result.get('.:animate').keys()].sort(), ['options', 'source']);
  assert.match(result.get('.:Button').get('onClick'), /MouseEvent/);
});

const family = {
  id: 'Button',
  api: ['.:Button', '.:animate'],
  native: 'planned',
  web: 'supported',
  owner: 'UI platform',
  story: 'catalog/Button.stories.tsx',
  test: 'tests/button.test.tsx',
};
const fields = new Map([
  ['.:Button', new Map([['busy', 'boolean | undefined']])],
  ['.:animate', new Map([['source', 'string']])],
]);
const details = new Map([
  [
    '.:Button',
    new Map([['busy', { defaults: new Set(['false']), refs: new Set(), optional: true }]]),
  ],
  ['.:animate', new Map([['source', { defaults: new Set(), refs: new Set(), optional: false }]])],
]);
const meta = {
  family: 'Button',
  status: 'stable',
  since: '0.3.0-rc.1',
  owner: family.owner,
  platforms: { web: 'supported', native: 'planned' },
  exports: ['Button', 'animate'].map((name) => ({
    platform: 'web',
    name,
    from: '@ui-lazy-dev/ui-web',
    rendering: 'client-only',
  })),
  reference: ['https://react-aria.adobe.com/Button', 'https://mui.com/material-ui/react-button/'],
};
const scenarioLink = '[button.save-once](button.scenarios.yaml)';
const unitLink = '[unit](../../tests/button.test.tsx#L1)';
const slots = [
  '| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |',
  '| --- | --- | --- | --- | --- | --- |',
  '| Label | Required | N/A — required | Container gap | Names the action | No extra stop |',
  '| Icon | Optional | collapse | Container gap | Decorative | No extra stop |',
].join('\n');
const contractSections = [
  ['Purpose and when not to use it', 'Use Button for commands. Follow a Link to navigate.'],
  ['Anatomy', slots],
  ['Variants', 'Primary submits the form.'],
  [
    'States matrix',
    [
      '| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |',
      '| --- | --- | --- | --- | --- | --- | --- |',
      '| Pending | Submit | Muted | Busy button | No | Yes | ' + scenarioLink + ' |',
    ].join('\n'),
  ],
  ['Keyboard, pointer and touch', 'Enter activates the command.'],
  ['Accessibility', 'Button receives its accessible name from its label.'],
  ['State patterns', 'The caller announces a failed action and offers a retry.'],
  ['Localization', 'The caller provides the action label.'],
  ['Tokens', '| Part or state | Token |\n|---|---|\n| Target | `density.target` [48px] |'],
  ['Composition and content guidelines', 'Use a short verb phrase for the action in a form.'],
];
const apiTable = [
  '| Export | Prop | Type | Default | Ownership | Ref target |',
  '| --- | --- | --- | --- | --- | --- |',
  '| `.:Button` | `busy` | `boolean \\| undefined` | `false` | Caller input | — |',
  '| `.:animate` | `source` | `string` | Required | Caller input | — |',
].join('\n');
const webBinding = [
  ['Rendering', 'React web renders an HTML button with aria-busy when saving.'],
  ['Headless API', 'N/A — the package exposes a styled control only.'],
  ['Test helpers', 'Select the action by its role and label.'],
  ['Platform differences', 'The DOM button supports form submission.'],
  ['Performance', 'Only load the action entry for forms.'],
  [
    'Tests',
    'Pending is exercised by ' +
      unitLink +
      ', [browser](../../tests/button/behavior.spec.ts) and [visual](../../tests/button/button.visual.ts).',
  ],
  ['Changelog and deprecations', 'Introduced in 0.3.0-rc.1.'],
];
const nativeBinding = webBinding.map(([heading]) => [
  heading,
  'N/A — the planned React Native binding has no release.',
]);
const renderSections = (prefix, sections) =>
  sections.map(([heading, body]) => prefix + ' ' + heading + '\n\n' + body).join('\n\n');
const spec = (fm = meta) =>
  [
    '---\n' + JSON.stringify(fm, null, 2) + '\n---\n# Button',
    '## Part A — Contract',
    renderSections('###', contractSections),
    '## Part B — Bindings',
    '### API',
    apiTable,
    '### React web',
    renderSections('####', webBinding),
    '### React Native',
    renderSections('####', nativeBinding),
  ].join('\n\n');
before(() => {
  for (const name of ['docs/components', 'tests/button', 'tests/scenarios/web', 'catalog', 'packages/tokens'])
    mkdirSync(join(root, name), { recursive: true });
  for (const name of [
    'tests/button.test.tsx',
    'tests/button/behavior.spec.ts',
    'tests/button/unregistered.visual.tsx',
    'tests/scenarios/web/scenarios.spec.ts',
    'tests/scenarios/web/unregistered.visual.ts',
    'tests/button/button.visual.ts',
    'tests/empty.test.ts',
    'catalog/Button.stories.tsx',
  ])
    writeFileSync(
      join(root, name),
      name.includes('empty.') ? "// test('comment only')" : "test('pending', () => {});",
    );
  writeFileSync(
    join(root, 'docs/components/button.scenarios.yaml'),
    JSON.stringify({
      family: 'Button',
      scenarios: [
        {
          id: 'button.save-once',
          fixture: 'save',
          steps: [{ act: 'activate', target: { role: 'button', name: 'Save' } }],
        },
      ],
    }),
  );
  writeFileSync(
    join(root, 'packages/tokens/tokens.json'),
    JSON.stringify({ density: { target: { $type: 'dimension', $value: 48 } } }),
  );
});
async function audit(t, text) {
  const { auditComponentSpecs } = await import('../../packages/policy/quality/specs/validate.mjs');
  const file = join(root, 'docs/components/button.md');
  if (text !== null) writeFileSync(file, text);
  else rmSync(file, { force: true });
  return auditComponentSpecs({ root, families: [family], declarations: fields, details });
}
test('matching stable spec qualifies and a matching draft passes without counting', async (t) => {
  const a = await audit(t, spec());
  assert.deepEqual(a.issues, []);
  assert.equal(a.complete, 1);
  const d = await audit(t, spec({ ...meta, status: 'draft' }));
  assert.deepEqual(d.issues, []);
  assert.equal(d.stats.draft, 1);
  assert.equal(d.complete, 0);
});
test('a server-safe contract exercises its exact packed export in the foundation route', async t => {
  const dir = join(root, 'tests/packaging/fixture/app/foundations');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'page.js');
  t.after(() => rmSync(file, { force: true }));
  const claim = spec({ ...meta, exports: meta.exports.map(binding =>
    binding.name === 'Button' ? { ...binding, rendering: 'server-safe' } : binding) });
  const imported = "import {Button as Action} from '@ui-lazy-dev/ui-web';";
  for (const source of [
    imported + ' export default function Page(){return <div/>;}',
    imported + ' export default function Page(){const Action=()=>null;return <Action/>;}',
    "import {Button as Action} from '@ui-lazy-dev/ui-web/forms'; export default function Page(){return <Action/>;}",
  ]) {
    writeFileSync(file, source);
    assert.ok((await audit(t, claim)).issues.some(issue => issue.code === 'server-fixture'));
  }
  writeFileSync(file, imported + ' export default function Page(){return <Action/>;}');
  assert.deepEqual((await audit(t, claim)).issues, []);
});
for (const [name, transform, code] of [
  ['unclassified stable web export', s => s.replace('"rendering": "client-only"', '"rendering": null'), 'rendering'],
  ['unknown rendering classification', s => s.replace('"rendering": "client-only"', '"rendering": "server"'), 'rendering'],
  [
    'missing required section',
    (s) => s.replace('### Composition and content guidelines', ''),
    'sections',
  ],
  ['missing web binding', (s) => s.replace('### React web', ''), 'sections'],
  ['missing native binding', (s) => s.replace('### React Native', ''), 'sections'],
  ['missing binding section', (s) => s.replace('#### Platform differences', ''), 'sections'],
  ['missing Slots table', (s) => s.replace(slots, 'Button has a label.'), 'slots'],
  ['unnamed slot', (s) => s.replace('| Label | Required', '| | Required'), 'table'],
  ['duplicate slot', (s) => s.replace('| Icon | Optional', '| label | Optional'), 'slots'],
  [
    'undocumented required slot omission',
    (s) => s.replace('| N/A — required |', '| collapse |'),
    'slot-omission',
  ],
  [
    'optional placeholder without a reason',
    (s) => s.replace('| collapse |', '| placeholder |'),
    'slot-omission',
  ],
  [
    'optional fallback without a reason',
    (s) => s.replace('| collapse |', '| fallback — |'),
    'slot-omission',
  ],
  [
    'slot owns its own spacing',
    (s) => s.replace('| Container gap |', '| Own margin |'),
    'slot-spacing',
  ],
  [
    'framework term in contract',
    [
      'React handles activation.',
      'Use `React.useState` to retain the pending state.',
      'Activate the command.\n\n```tsx\n<button>Save</button>\n```',
    ].map((example) => (s) => s.replace('Enter activates the command.', example)),
    'contract-language',
  ],
  [
    'platform name in contract',
    (s) => s.replace('Enter activates the command.', 'On iOS the action can be activated.'),
    'contract-language',
  ],
  [
    'markup in contract',
    (s) => s.replace('Enter activates the command.', 'Activate the <button>.'),
    'contract-language',
  ],
  [
    'platform property in contract',
    (s) => s.replace('Enter activates the command.', 'Set aria-busy while saving.'),
    'contract-language',
  ],
  [
    'pending binding work in stable spec',
    (s) => s.replace('Only load the action entry for forms.', 'Pending: measure the action entry.'),
    'pending',
  ],
  [
    'missing stable scenario link',
    (s) => s.replace(scenarioLink, 'button.save-once'),
    'state-scenario',
  ],
  [
    'unimplemented stable scenario',
    (s) => s.replace(scenarioLink, 'Pending: save scenario'),
    'state-scenario',
  ],
  [
    'unknown scenario within existing file',
    (s) => s.replace(scenarioLink, '[button.unknown](button.scenarios.yaml)'),
    'state-scenario',
  ],
  [
    'foreign family scenario ID',
    (s) => s.replace(scenarioLink, '[stack.child-order](button.scenarios.yaml)'),
    'state-scenario',
  ],
  [
    'foreign family scenario file',
    (s) => s.replace(scenarioLink, '[button.save-once](stack.scenarios.yaml)'),
    'state-scenario',
  ],
  [
    'empty section',
    (s) => s.replace('Enter activates the command.', '<!-- pending -->'),
    'section-empty',
  ],
  [
    'multiline N/A reason',
    (s) => s.replace('Enter activates the command.', 'N/A\n— informational'),
    'section-empty',
  ],
  ['unexplained N/A', (s) => s.replace('Enter activates the command.', 'N/A'), 'section-empty'],
  [
    'undocumented public prop',
    (s) => s.replace(/\| `\.:Button` \| `busy` .*\n/, ''),
    'prop-missing',
  ],
  [
    'invented public prop',
    (s) => s.replace('| `.:Button` | `busy` |', '| `.:Button` | `unknown` |'),
    'prop-extra',
  ],
  ['documented type drift', (s) => s.replace('boolean \\| undefined', 'number'), 'prop-type'],
  ['documented default drift', (s) => s.replace('`false`', '`true`'), 'api-generated'],
  ['ownership drift', (s) => s.replace('Caller input', 'Uncontrolled'), 'api-generated'],
  [
    'ref drift',
    (s) => s.replace('Caller input | —', 'Caller input | HTMLButtonElement'),
    'api-generated',
  ],
  [
    'stable missing visual coverage',
    (s) => s.replace('[visual](../../tests/button/button.visual.ts)', 'visual'),
    'stable-coverage',
  ],
  [
    'the portable scenario project cannot qualify the web browser journey',
    (s) => s.replace('tests/button/behavior.spec.ts', 'tests/scenarios/web/scenarios.spec.ts'),
    'stable-coverage',
  ],
  [
    'a visual filename outside project testMatch cannot qualify the family',
    (s) => s.replace('tests/button/button.visual.ts', 'tests/button/unregistered.visual.tsx'),
    'stable-coverage',
  ],
  [
    'an unregistered nested visual fixture cannot qualify the family',
    (s) => s.replace('tests/button/button.visual.ts', 'tests/scenarios/web/unregistered.visual.ts'),
    'stable-coverage',
  ],
  [
    'native evidence cannot qualify the web visual test',
    (s) =>
      s
        .replace('[visual](../../tests/button/button.visual.ts)', 'visual')
        .replace(
          /### React Native([\s\S]*?#### Tests\n\n)[^\n]+/,
          '### React Native$1[visual](../../tests/button/button.visual.ts)',
        ),
    'stable-coverage',
  ],
  [
    'unquoted token beside a valid token',
    (s) => s.replace('`density.target` [48px]', '`density.target`, color.unknown'),
    'token-unknown',
  ],
  [
    'test-named file without a test',
    (s) => s.replace(unitLink, '[unit](../../tests/empty.test.ts)'),
    'test-link',
  ],
  [
    'line link outside the test',
    (s) => s.replace(unitLink, '[unit](../../tests/button.test.tsx#L5)'),
    'test-link',
  ],
  [
    'reference to missing test file',
    (s) => s.replace(unitLink, '[unit](../../tests/missing.test.tsx)'),
    'test-link',
  ],
  [
    'non-test link in a binding Tests section',
    (s) => s.replace(unitLink, '[unit](button.md)'),
    'test-link',
  ],
  ['raw token size', (s) => s.replace('[48px]', '48px'), 'token-literal'],
  ['invented token', (s) => s.replace('density.target', 'density.unknown'), 'token-unknown'],
  [
    'invalid platform status',
    (s) => s.replace('"web": "supported"', '"web": "planned"'),
    'platforms',
  ],
  [
    'incorrect import path',
    (s) => s.replace('@ui-lazy-dev/ui-web', '@ui-lazy-dev/ui-native'),
    'exports',
  ],
]) {
  test(name + ' fails qualification', async (t) => {
    const original = spec();
    for (const mutate of Array.isArray(transform) ? transform : [transform]) {
      const changed = mutate(original);
      assert.notEqual(changed, original, 'Fixture mutation must change the spec');
      const result = await audit(t, changed);
      assert.ok(
        result.issues.some((x) => x.code === code),
        JSON.stringify(result.issues),
      );
      assert.equal(result.complete, 0);
    }
  });
}
test('only draft specs can describe an outstanding scenario with a reason', async (t) => {
  for (const status of ['draft', 'experimental', 'stable', 'deprecated']) {
    const text = spec({ ...meta, status }).replace(scenarioLink, 'Pending: cover repeated saves');
    const result = await audit(t, text);
    if (status === 'draft') assert.deepEqual(result.issues, []);
    else
      assert.ok(
        result.issues.some((issue) => issue.code === 'pending'),
        JSON.stringify(result.issues),
      );
    assert.equal(result.complete, 0);
  }
  const invalid = spec({ ...meta, status: 'draft' }).replace(scenarioLink, 'Pending: ');
  const result = await audit(t, invalid);
  assert.ok(
    result.issues.some((issue) => issue.code === 'pending'),
    JSON.stringify(result.issues),
  );
});

test('optional slots may use explained fallbacks and placeholders', async (t) => {
  for (const omission of [
    'fallback — show initials',
    'placeholder — reserve a column for alignment',
  ]) {
    const result = await audit(t, spec().replace('| collapse |', '| ' + omission + ' |'));
    assert.deepEqual(result.issues, []);
  }
});

test('absent family spec fails in the full denominator', async (t) => {
  const a = await audit(t, null);
  assert.equal(a.total, 1);
  assert.equal(a.failingFamilies, 1);
  assert.equal(a.failureCount, 1);
  assert.equal(a.issues[0].code, 'spec-missing');
});
test('a state may draw light and dark values from different existing tokens in one cell', async (t) => {
  const doubled = spec().replace('`density.target` [48px]', '`density.target`, `density.target`');
  assert.deepEqual((await audit(t, doubled)).issues, []);
});
test('token literals are rejected even in a headless explanation and outside a table', async (t) => {
  for (const raw of ['#acb', '0.42ms', '.5px']) {
    const body = spec().replace(
      /\| Part or state \| Token \|[\s\S]+?(?=\n\n### Composition)/,
      'N/A — the browser supplies ' + raw + ' for this part.',
    );
    assert.ok((await audit(t, body)).issues.some((issue) => issue.code === 'token-literal'));
  }
});

test('packed defaults and ref targets are rendered and detect hand-edited generated rows', async () => {
  const { renderApiRows, replaceApiTable, currentApiTable } =
    await import('../../packages/policy/quality/specs/tables.mjs');
  const details = new Map();
  const declarations = readDeclaredApi(root, [family], details);
  const table = renderApiRows(family.api, declarations, details);
  assert.match(table, /`loading`.*`false`/);
  assert.match(table, /`error`.*Required in matching shape/);
  assert.match(table, /`ref`.*`HTMLButtonElement`/);
  assert.match(table, /`source`.*Required/);
  const generated = replaceApiTable(spec(), table);
  assert.equal(currentApiTable(generated), table);
  assert.equal(replaceApiTable(generated, table), generated);
  assert.match(generated, /### React web\n\n#### Rendering/);
  assert.notEqual(currentApiTable(generated.replace('`false`', '`true`')), table);
});

test('controlled and initial properties have distinct ownership when both are exported', async () => {
  const { renderApiRows } = await import('../../packages/policy/quality/specs/tables.mjs');
  const shapes = new Map([
    [
      '.:Button',
      new Map([
        ['isOpen', 'boolean'],
        ['defaultOpen', 'boolean'],
      ]),
    ],
  ]);
  const info = new Map([
    [
      '.:Button',
      new Map(
        ['isOpen', 'defaultOpen'].map((prop) => [
          prop,
          { defaults: new Set(), refs: new Set(), optional: true },
        ]),
      ),
    ],
  ]);
  const result = renderApiRows(['.:Button'], shapes, info);
  assert.match(result, /`isOpen`.*Controlled value/);
  assert.match(result, /`defaultOpen`.*Uncontrolled initial value/);
});

test('the same packed type has a portable name across private and public module layouts', async () => {
  const { portableType } = await import('../../packages/policy/quality/specs/declarations.mjs');
  const dir = join(root, 'node_modules/theme');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'theme', types: 'index.d.ts' }));
  writeFileSync(join(dir, 'index.d.ts'), 'export interface Radius {}');
  writeFileSync(join(dir, 'private.d.ts'), 'export interface Radius {}');
  const file = join(root, 'node_modules/@ui-lazy-dev/ui-web/entry.d.ts');
  assert.equal(
    portableType('import("' + dir + '/index.js").Radius', file),
    'import("theme").Radius',
  );
  assert.equal(
    portableType('import("theme/private.js").Radius', file),
    'import("theme/private.js").Radius',
  );
});

test('an internal peer type keeps its package-qualified name in sibling and hoisted installs', async () => {
  const { portableType } = await import('../../packages/policy/quality/specs/declarations.mjs');
  const verify = (scope, upward) => {
    const importer = join(root, scope, 'node_modules/@ui-lazy-dev/view/dist/index.d.ts');
    const peer = join(root, 'node_modules/native-peer');
    mkdirSync(join(peer, 'generated'), { recursive: true });
    mkdirSync(join(importer, '..'), { recursive: true });
    writeFileSync(importer, 'export {};');
    writeFileSync(
      join(peer, 'package.json'),
      JSON.stringify({
        name: 'native-peer',
        version: '1.0.0',
        exports: { '.': { types: './index.d.ts' } },
      }),
    );
    writeFileSync(join(peer, 'index.d.ts'), 'export {};');
    writeFileSync(join(peer, 'generated/color.d.ts'), 'export type Color = string;');
    assert.equal(
      portableType('import("' + upward + '/native-peer/generated/color.js").Color', importer),
      'import("native-peer/generated/color.js").Color',
    );
  };
  verify('', '../../..');
  verify('nested/consumer', '../../../../../../node_modules');
});
