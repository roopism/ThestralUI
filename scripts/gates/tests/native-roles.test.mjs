import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const nativeRoles = require('../../scenarios/native-roles.cjs');
const { deviceScenarios, nativeScenarios } = require('../../scenarios/native.cjs');
const { roleSelector, runNativeScenarios } = await import('../../../tests/simulator/scenarios.mjs');

// Run one neutral scenario through the Maestro adapter with recorded flows and live trees.
function runScenario(steps, { platform = 'ios', android = [], ios = {}, readers = true } = {}) {
  const checkout = mkdtempSync(join(tmpdir(), 'uld-native-roles-'));
  try {
    mkdirSync(join(checkout, 'docs/components'), { recursive: true });
    writeFileSync(join(checkout, 'docs/components/probe.scenarios.yaml'),
      JSON.stringify({ family: 'Probe', scenarios: [{ id: 'probe.roles', fixture: 'example', steps }] }));
    const registry = { 'probe.example': { label: 'Probe example', render: () => null } };
    const flows = [];
    const run = (_cwd, _command, args) => {
      if (args.includes('hierarchy')) return JSON.stringify(ios);
      flows.push(JSON.parse(readFileSync(args.at(-1), 'utf8').split('\n---\n')[1]));
      return '';
    };
    const ids = runNativeScenarios({ root: checkout, registry, run, platform, reports: checkout, log() {},
      maestro: 'maestro', device: 'probe-device', appId: 'probe-app', env: {},
      ...(readers ? { readAndroidTree: () => android, readIOSElements: () => ios } : {}) });
    return { ids, steps: flows.flat() };
  } finally {
    rmSync(checkout, { recursive: true, force: true });
  }
}
const visible = (role, name) => ({ expect: 'visible', target: { role, name } });
const activate = (role, name) => ({ act: 'activate', target: { role, name } });
const iosTree = (...children) => ({ elementType: 1, identifier: '', label: '', children });
const element = (role, name, elementType, value) => ({ identifier: 'scenario.' + role + '.' + name, label: name, elementType,
  ...(value === undefined ? {} : { value }), children: [] });
const node = (role, name, cls, extra = {}) => ({ 'resource-id': 'org.uilazydev:id/scenario.' + role + '.' + name,
  'content-desc': name, text: '', class: cls, ...extra });

test('the native vocabulary classifies every web scenario role and keeps the original four', () => {
  const adapter = readFileSync(join(root, 'tests/scenarios/web/adapter.ts'), 'utf8');
  const block = /const webRoles[^{]*\{([\s\S]*?)\n\};/.exec(adapter)[1];
  const web = [...block.matchAll(/(?:'([^']+)'|([a-z]+))\s*:/g)].map(match => match[1] ?? match[2]);
  assert.ok(web.length >= 39, 'Read the web role vocabulary');
  const native = [...Object.keys(nativeRoles.roles), ...Object.keys(nativeRoles.unsupported), ...nativeRoles.incumbent];
  assert.deepEqual([...native].sort(), [...new Set([...web, 'text'])].sort());
  assert.deepEqual(nativeRoles.incumbent, ['button', 'checkbox', 'text', 'alert']);
  for (const role of Object.keys(nativeRoles.roles)) assert.ok(!nativeRoles.incumbent.includes(role));
  for (const role of Object.keys(nativeRoles.unsupported)) assert.ok(!Object.hasOwn(nativeRoles.roles, role));
});

test('each Android role class is the class React Native assigns to its role', () => {
  const source = readFileSync(join(dirname(require.resolve('react-native/package.json')),
    'ReactAndroid/src/main/java/com/facebook/react/uimanager/ReactAccessibilityDelegate.kt'), 'utf8');
  const body = /fun getValue\(role: AccessibilityRole\): String \{([\s\S]*?)\n {6}\}/.exec(source)[1];
  const classes = new Map();
  for (const [, names, value] of body.matchAll(/((?:\s*[A-Z]+,?)+)\s*->\s*"([^"]+)"/g))
    for (const name of names.split(',').map(entry => entry.trim()).filter(Boolean)) classes.set(name.toLowerCase(), value.replace('\\$', '$'));
  const fromRole = /fun fromRole\(role: Role\): AccessibilityRole\? \{([\s\S]*?)else ->/.exec(source)[1];
  const aria = new Map([...fromRole.matchAll(/Role\.([A-Z]+) -> ([A-Z]+)/g)].map(([, from, to]) => [from.toLowerCase(), to.toLowerCase()]));
  const legacy = new Set([...classes.keys()]);
  for (const [role, spec] of Object.entries(nativeRoles.roles)) {
    for (const rn of spec.rn) {
      const mapped = aria.has(rn) ? aria.get(rn) : legacy.has(rn) ? rn : undefined;
      // An ARIA role without an Android mapping leaves the host view's own class.
      const expected = mapped ? [classes.get(mapped)] : ['android.view.ViewGroup', 'android.widget.TextView'];
      for (const value of expected) assert.ok(spec.android.classes.includes(value), role + ' via ' + rn + ' expects ' + value);
    }
  }
});

test('unsupported and unknown roles fail loudly before any device interaction', () => {
  assert.deepEqual(Object.keys(nativeRoles.unsupported), ['tooltip']);
  for (const platform of ['ios', 'android'])
    assert.throws(() => roleSelector({ role: 'tooltip', name: 'Hint' }, platform), /Role tooltip is not supported on native: /);
  assert.throws(() => roleSelector({ role: 'carousel', name: 'Hint' }, 'android'), /Unknown neutral role carousel is not supported on native/);
  assert.throws(() => runScenario([visible('tooltip', 'Hint')], { readers: false }),
    /probe.roles step 1: Role tooltip is not supported on native/);
  assert.throws(() => runScenario([activate('heading', 'Overview')]),
    /probe.roles step 1 has unsupported native activation role heading/);
  assert.throws(() => runScenario([activate('text', 'Saved')]), /probe.roles step 1 has unsupported native activation role text/);
});

test('generated Maestro selectors name each role target by its fixture identifier and exact label', () => {
  assert.deepEqual(roleSelector({ role: 'heading', name: 'Overview' }, 'ios'),
    { text: '^Overview$', id: '^scenario\\.heading\\.Overview$' });
  assert.deepEqual(roleSelector({ role: 'menu item', name: 'Rename (F2)' }, 'android'),
    { text: '^Rename \\(F2\\)$', id: '^(?:[^:]+:id/)?scenario\\.menu item\\.Rename \\(F2\\)$' });
  assert.deepEqual(roleSelector({ role: 'slider', name: 'Volume' }, 'android'),
    { text: '^Volume(?:, .+)?$', id: '^(?:[^:]+:id/)?scenario\\.slider\\.Volume$' });
  assert.deepEqual(roleSelector({ role: 'slider', name: 'Volume' }, 'ios'), { text: '^Volume$', id: '^scenario\\.slider\\.Volume$' });
  // The original four keep their original selectors.
  assert.deepEqual(roleSelector({ role: 'checkbox', name: 'Audit' }, 'android'),
    { text: '^Audit(?:, mixed)?$', id: '^(?:[^:]+:id/)?scenario\\.checkbox\\.Audit$' });
  assert.throws(() => roleSelector({ role: 'link', name: 'Help' }, 'ios', true), /Only a button can be busy/);
});

test('iOS role steps assert visibility and uniqueness, then verify the raw element type', () => {
  const ios = iosTree(element('heading', 'Overview', 1), element('link', 'Help', 42), element('switch', 'Alerts', 40, '1'),
    element('radio', 'Weekly', 1, 'radio button, unchecked'), element('separator', 'Sections', 1));
  const { ids, steps } = runScenario([visible('heading', 'Overview'), activate('link', 'Help'), activate('switch', 'Alerts'),
    activate('radio', 'Weekly'), visible('separator', 'Sections')], { ios });
  assert.deepEqual(ids, ['probe.roles']);
  const id = value => '^' + ('scenario.' + value).replace(/[.()]/g, '\\$&') + '$';
  assert.deepEqual(steps.filter(step => step.assertVisible?.id === id('heading.Overview')),
    [{ assertVisible: { text: '^Overview$', id: id('heading.Overview'), label: 'probe.roles step 1' } }]);
  assert.deepEqual(steps.find(step => step.assertNotVisible?.id === id('heading.Overview')),
    { assertNotVisible: { text: '^Overview$', id: id('heading.Overview'), index: '1', label: 'probe.roles step 1 (unique target)' } });
  for (const [role, name, index] of [['link', 'Help', 2], ['switch', 'Alerts', 3], ['radio', 'Weekly', 4]])
    assert.deepEqual(steps.find(step => step.tapOn?.id === id(role + '.' + name)),
      { tapOn: { text: '^' + name + '$', id: id(role + '.' + name), enabled: true, label: 'probe.roles step ' + index } });
});

test('a wrong native role fails on iOS and on Android', () => {
  const wrong = [
    [visible('heading', 'Overview'), iosTree(element('heading', 'Overview', 9)), /iOS element type Button belongs to another role/],
    [visible('link', 'Help'), iosTree(element('link', 'Help', 48)), /iOS element type 48 is not Link/],
    [visible('image', 'Logo'), iosTree(element('image', 'Logo', 9)), /iOS element type Button is not Image/],
    [visible('switch', 'Alerts'), iosTree(element('switch', 'Alerts', 9, 'checkbox, checked')), /native switch role and state/],
    [visible('radio', 'Weekly'), iosTree(element('radio', 'Weekly', 1, 'checkbox, checked')), /native radio role and state/],
    [visible('separator', 'Sections'), iosTree(element('separator', 'Sections', 43)), /iOS element type Image belongs to another role/],
    [visible('heading', 'Overview'), iosTree(element('heading', 'Overview Two', 1)), /Expected one iOS accessibility element/],
    [visible('heading', 'Overview'), iosTree(element('heading', 'Overview', 1), element('heading', 'Overview', 1)), /Expected one iOS/],
  ];
  for (const [step, ios, message] of wrong) assert.throws(() => runScenario([step], { ios }), message);
  const android = [
    [visible('heading', 'Overview'), [node('heading', 'Overview', 'android.widget.Button')], /Android class android.widget.Button is not android.view.View/],
    [visible('heading', 'Overview'), [node('heading', 'Overview', 'android.widget.TextView')], /is not android.view.View/],
    [visible('separator', 'Sections'), [node('separator', 'Sections', 'android.view.View')], /is not android.view.ViewGroup or android.widget.TextView/],
    [visible('switch', 'Alerts'), [node('switch', 'Alerts', 'android.widget.CheckBox')], /is not android.widget.Switch/],
    [visible('list', 'Files'), [node('list', 'Files', 'android.view.ViewGroup')], /is not android.widget.AbsListView/],
    [visible('image', 'Logo'), [node('image', 'Logo', 'android.widget.ImageView', { 'content-desc': 'Logo Two' })], /accessible name/],
    [visible('heading', 'Overview'), [], /Expected one Android accessibility node/],
  ];
  for (const [step, tree, message] of android) assert.throws(() => runScenario([step], { platform: 'android', android: tree }), message);
});

test('correct Android role classes pass and value-bearing roles may append their value text', () => {
  const android = [node('heading', 'Overview', 'android.view.View'), node('image', 'Logo', 'android.widget.ImageView'),
    node('slider', 'Volume', 'android.widget.SeekBar', { 'content-desc': 'Volume, 40%' }),
    node('dialog', 'Review', 'android.view.ViewGroup'), node('menu item', 'Rename', 'android.view.View')];
  const { steps } = runScenario([visible('heading', 'Overview'), visible('image', 'Logo'), visible('slider', 'Volume'),
    visible('dialog', 'Review'), activate('menu item', 'Rename')], { platform: 'android', android });
  assert.ok(steps.some(step => step.tapOn?.id === '^(?:[^:]+:id/)?scenario\\.menu item\\.Rename$'));
  assert.throws(() => runScenario([visible('heading', 'Overview')], { platform: 'android',
    android: [node('heading', 'Overview', 'android.view.View', { 'content-desc': 'Overview, 40%' })] }), /accessible name/);
});

test('a role step without the live tree reader fails instead of passing', () => {
  assert.throws(() => runScenario([visible('heading', 'Overview')], { readers: false }),
    /Native ios role evidence requires the live accessibility tree/);
  assert.throws(() => runScenario([visible('heading', 'Overview')], { platform: 'android', readers: false }),
    /Native android role evidence requires the live accessibility tree/);
});

test('the renderer reader keeps its original activation vocabulary while the device reader extends it', () => {
  const checkout = mkdtempSync(join(tmpdir(), 'uld-native-readers-'));
  try {
    mkdirSync(join(checkout, 'docs/components'), { recursive: true });
    writeFileSync(join(checkout, 'docs/components/probe.scenarios.yaml'), JSON.stringify({ family: 'Probe',
      scenarios: [{ id: 'probe.roles', fixture: 'example', steps: [activate('switch', 'Alerts')] }] }));
    const registry = { 'probe.example': { label: 'Probe example', render: () => null } };
    assert.equal(deviceScenarios(checkout, registry)[0].fixtureId, 'probe.example');
    assert.throws(() => nativeScenarios(checkout, registry), /probe.roles step 1 has unsupported native activation role switch/);
  } finally {
    rmSync(checkout, { recursive: true, force: true });
  }
});

test('iOS text fields require an editable XCTest element type', () => {
  for (const [role, allowed] of [['text field', [49, 50, 52]], ['search field', [45, 49]]]) {
    const run = type => runScenario([visible(role, 'Name')], { ios: iosTree(element(role, 'Name', type)) });
    for (const type of allowed) assert.deepEqual(run(type).ids, ['probe.roles']);
    for (const type of [48, 1, 9]) assert.throws(() => run(type), /native .*field role/);
  }
});
