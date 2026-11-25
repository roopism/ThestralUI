import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { compareWithBase } from '../../../scripts/gates/tests/fixtures/protected-inputs.mjs';

test('protected Maestro flows retain every registered step', t => {
  const header = 'appId: test.workspace\n---\n- launchApp\n';
  const compare = compareWithBase(t, 'tests/simulator/workspace.yaml', header + '- assertVisible: "Save workspace?"\n');
  const issues = compare(header);
  assert.ok(issues.some(issue => issue.includes('registered entry removed')), issues.join('\n'));
});

test('Android hardware profiles require a recorded owner decision to change', t => {
  const profile = cores => JSON.stringify({ profiles: [{ id: 'low-end', cores }] });
  const compare = compareWithBase(t, 'tests/android/profiles.json', profile(2));
  const issues = compare(profile(8));
  assert.ok(issues.some(issue => issue.includes('frozen')), issues.join('\n'));
});

test('workflow pins retain the trusted action and every registered step input', t => {
  const sha = '1'.repeat(40);
  const checkout = { uses: 'actions/checkout@v4' };
  const setup = { name: 'Set up Node', uses: 'actions/setup-node@v4', with: { cache: 'npm' } };
  const pinnedCheckout = { uses: 'actions/checkout@' + sha, with: { 'persist-credentials': false } };
  const pinnedSetup = { ...setup, uses: 'actions/setup-node@' + sha };
  const workflow = steps => JSON.stringify({ name: 'Library checks', jobs: { verify: { steps } } });
  const baseFiles = { '.github/workflows/release-gates.yml': [
    'jobs:', '  pack:', '    steps:',
    '      - uses: actions/checkout@' + sha + ' # v4',
    '      - uses: actions/setup-node@' + sha + ' # v4',
  ].join('\n') };
  const base = workflow([checkout, setup]);
  const check = compareWithBase(t, '.github/workflows/checks.yml', base, baseFiles);
  const compare = steps => check(workflow(steps));
  assert.deepEqual(compare([pinnedCheckout, pinnedSetup]), []);
  for (const steps of [
    [pinnedCheckout],
    [pinnedCheckout, { ...pinnedSetup, uses: 'actions/checkout@' + sha }],
    [pinnedCheckout, { ...pinnedSetup, uses: 'actions/setup-node@' + '2'.repeat(40) }],
    [pinnedCheckout, { ...pinnedSetup, with: {} }],
    [pinnedCheckout, { ...pinnedSetup, if: 'false' }],
    [{ ...pinnedCheckout, with: { 'persist-credentials': true } }, pinnedSetup],
  ]) {
    assert.ok(compare(steps).some(issue => issue.includes('registered entry removed')), JSON.stringify(steps));
  }
  const release = '.github/workflows/release-gates.yml';
  const otherTag = compareWithBase(t, '.github/workflows/checks.yml', base, {
    [release]: baseFiles[release].replaceAll('# v4', '# v3'),
  });
  assert.ok(otherTag(workflow([pinnedCheckout, pinnedSetup])).length > 0);
});

test('the measured catalog fixtures participate in protected input checks', t => {
  const motion = compareWithBase(t, 'catalog/MotionGallery.stories.tsx', 'const sample = <Carousel animate={mode === "editorial"} />;');
  assert.ok(motion('const sample = <Carousel animate={false} />;').length > 0);
  const owners = readFileSync(new URL('../../../.github/CODEOWNERS', import.meta.url), 'utf8').split('\n');
  for (const file of ['catalog/MotionGallery.stories.tsx', 'catalog/EnterpriseWorkspace.stories.tsx',
    'catalog/EnterpriseCollections.stories.tsx', 'catalog/collection-events.ts']) {
    assert.ok(owners.includes('/' + file + ' @thetechgeeek'), file);
    assert.ok(compareWithBase(t, file, 'assert.ok(sample);')('// fixture').length > 0, file);
  }
});

test('Git and deployment ignore linked worker checkouts', () => {
  for (const file of ['.gitignore', '.vercelignore']) {
    const rules = readFileSync(new URL('../../../' + file, import.meta.url), 'utf8').split('\n');
    assert.ok(rules.includes('.worktrees/'), file);
  }
});
