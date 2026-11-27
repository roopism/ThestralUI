const assert = require('node:assert/strict');

// Neutral scenario roles on iOS and Android, as React Native 0.88 exposes them to Maestro 2.4.
// Android evidence is the node class React Native assigns (ReactAccessibilityDelegate.setRole).
// iOS evidence is the XCUIElementType and value from the raw XCTest snapshot. Fabric derives
// traits from the role (accessibilityPropsConversions.h) and values for switches and radios
// (RCTViewComponentView accessibilityValue).
// A role without its own platform signal still rejects any node that carries another role's signal.

// The four original roles keep their original selectors and checks in tests/simulator/scenarios.mjs.
const incumbent = ['button', 'checkbox', 'text', 'alert'];

// React Native sets no role class for these ARIA roles, so the host keeps its own view class.
const plainHost = ['android.view.ViewGroup', 'android.widget.TextView'];
const roleView = ['android.view.View'];

// XCUIElementType values that identify a specific control. Each role allows its own types.
const iosControlTypes = {
  9: 'Button', 10: 'RadioButton', 12: 'CheckBox', 20: 'Key', 22: 'TabBar', 33: 'Slider', 40: 'Switch',
  41: 'Toggle', 42: 'Link', 43: 'Image', 45: 'SearchField', 49: 'TextField', 50: 'SecureTextField', 52: 'TextView',
};

const container = (rn, extra = {}) => ({ rn, android: { classes: plainHost }, ios: { allow: [] }, evidence: 'container', ...extra });
const roles = {
  heading: { rn: ['heading', 'header'], android: { classes: roleView }, ios: { allow: [] }, evidence: 'role class' },
  link: { rn: ['link'], android: { classes: roleView }, ios: { elementType: 42 }, activate: true, evidence: 'role class' },
  image: { rn: ['img', 'image'], android: { classes: ['android.widget.ImageView'] }, ios: { elementType: 43 }, evidence: 'distinct' },
  group: container(['group']),
  region: container(['region']),
  // A TextInput host carries no role prop.
  'text field': { rn: [], android: { classes: ['android.widget.EditText'] }, ios: { allow: [49, 50, 52], requireType: true }, evidence: 'distinct' },
  'search field': { rn: ['searchbox', 'search'], android: { classes: ['android.widget.EditText'] }, ios: { allow: [45, 49], requireType: true }, evidence: 'distinct' },
  option: container(['option'], { activate: true }),
  radio: { rn: ['radio'], android: { classes: ['android.widget.RadioButton'] },
    ios: { value: /^radio button(?:, |$)/, allow: [10] }, activate: true, evidence: 'distinct' },
  switch: { rn: ['switch'], android: { classes: ['android.widget.Switch'] },
    ios: { value: /^[01]$/, allow: [9, 40, 41] }, activate: true, evidence: 'distinct' },
  slider: { rn: ['slider', 'adjustable'], android: { classes: ['android.widget.SeekBar'], value: true },
    ios: { allow: [33] }, evidence: 'distinct' },
  // Android needs spinbutton (SpinButton class). An iOS binding may use adjustable for increment and decrement.
  stepper: { rn: ['spinbutton'], android: { classes: ['android.widget.SpinButton'], value: true },
    ios: { allow: [33] }, evidence: 'distinct' },
  progress: { rn: ['progressbar'], android: { classes: [...roleView, 'android.widget.ProgressBar'], value: true },
    ios: { allow: [] }, evidence: 'role class' },
  status: container(['status']),
  dialog: container(['dialog']),
  'alert dialog': container(['alertdialog']),
  menu: { rn: ['menu'], android: { classes: roleView }, ios: { allow: [] }, evidence: 'role class' },
  'menu item': { rn: ['menuitem'], android: { classes: roleView }, ios: { allow: [] }, activate: true, evidence: 'role class' },
  'tab group': { rn: ['tablist', 'tabbar'], android: { classes: roleView }, ios: { allow: [22] }, evidence: 'role class' },
  tab: { rn: ['tab'], android: { classes: roleView }, ios: { allow: [] }, activate: true, evidence: 'role class' },
  'tab panel': container(['tabpanel']),
  list: { rn: ['list'], android: { classes: ['android.widget.AbsListView'] }, ios: { allow: [] }, evidence: 'distinct' },
  'list item': container(['listitem']),
  table: { rn: ['table', 'grid'], android: { classes: [...plainHost, 'android.widget.GridView'] }, ios: { allow: [] }, evidence: 'container' },
  row: container(['row'], { activate: true }),
  header: container(['columnheader', 'rowheader']),
  cell: container(['cell', 'gridcell']),
  // React Native has no listbox role. A native list of choices is a list or a named container of options.
  'list of choices': { rn: ['list'], android: { classes: [...plainHost, 'android.widget.AbsListView'] }, ios: { allow: [] },
    evidence: 'container' },
  'editable choice': { rn: ['combobox'], android: { classes: [...roleView, 'android.widget.EditText'] },
    ios: { allow: [45, 49] }, evidence: 'role class' },
  tree: container(['tree']),
  'hierarchical grid': container(['treegrid']),
  toolbar: { rn: ['toolbar'], android: { classes: roleView }, ios: { allow: [] }, evidence: 'role class' },
  form: container(['form']),
  separator: container(['separator']),
  navigation: container(['navigation']),
};
const unsupported = {
  tooltip: 'a native tooltip is the hint of the control it describes (iOS accessibilityHint, Android tooltipText), ' +
    'not a separate accessibility element. Target the described control instead',
};

function nativeRole(role) {
  if (Object.hasOwn(unsupported, role)) throw new Error('Role ' + role + ' is not supported on native: ' + unsupported[role]);
  if (incumbent.includes(role)) return { incumbent: true, activate: role === 'button' || role === 'checkbox' };
  if (!Object.hasOwn(roles, role)) throw new Error('Unknown neutral role ' + role + ' is not supported on native');
  return roles[role];
}

const androidId = id => node => node['resource-id']?.replace(/^[^:]+:id\//, '') === id;
function iosNodes(tree) {
  const nodes = [];
  (function walk(node) {
    if (!node || typeof node !== 'object') return;
    nodes.push(node);
    for (const child of node.children ?? []) walk(child);
  })(tree);
  return nodes;
}

// Verify one fixture target's platform role evidence. The node must be unique and carry the exact name.
function verifyNativeRole(tree, platform, { role, name }) {
  const spec = nativeRole(role);
  assert.ok(!spec.incumbent, 'Role ' + role + ' keeps its original native checks');
  const id = 'scenario.' + role + '.' + name;
  if (platform === 'android') {
    assert.ok(Array.isArray(tree), 'Android role evidence requires the accessibility node list');
    const matches = tree.filter(androidId(id));
    assert.equal(matches.length, 1, 'Expected one Android accessibility node for ' + id);
    const [node] = matches;
    const description = node['content-desc'] ?? '';
    const named = [node.text, description].includes(name) || (spec.android.value === true && description.startsWith(name + ', '));
    assert.ok(named, id + ' accessible name');
    assert.ok(spec.android.classes.includes(node.class),
      id + ' native ' + role + ' role: Android class ' + node.class + ' is not ' + spec.android.classes.join(' or '));
    return { platform, role, evidence: spec.evidence, class: node.class };
  }
  assert.equal(platform, 'ios', 'Unsupported native platform ' + platform);
  assert.ok(tree && typeof tree === 'object' && !Array.isArray(tree), 'iOS role evidence requires the raw XCTest element tree');
  const matches = iosNodes(tree).filter(node => node.identifier === id);
  assert.equal(matches.length, 1, 'Expected one iOS accessibility element for ' + id);
  const [node] = matches;
  assert.equal(node.label, name, id + ' accessible name');
  assert.ok(Number.isInteger(node.elementType), id + ' has no XCTest element type');
  const own = spec.ios.elementType === undefined ? spec.ios.allow : [spec.ios.elementType];
  if (spec.ios.elementType !== undefined)
    assert.equal(node.elementType, spec.ios.elementType, id + ' native ' + role + ' role: iOS element type ' +
      (iosControlTypes[node.elementType] ?? node.elementType) + ' is not ' + iosControlTypes[spec.ios.elementType]);
  else assert.ok(!Object.hasOwn(iosControlTypes, node.elementType) || own.includes(node.elementType),
    id + ' native ' + role + ' role: iOS element type ' + iosControlTypes[node.elementType] + ' belongs to another role');
  if (spec.ios.requireType) assert.ok(own.includes(node.elementType),
    id + ' native ' + role + ' role requires an editable XCTest element type, got ' + node.elementType);
  if (spec.ios.value) assert.match(node.value ?? '', spec.ios.value, id + ' native ' + role + ' role and state');
  return { platform, role, evidence: spec.ios.elementType !== undefined || spec.ios.value ? 'distinct' : spec.evidence,
    elementType: node.elementType };
}

module.exports = { incumbent, roles, unsupported, iosControlTypes, nativeRole, verifyNativeRole, iosNodes };
