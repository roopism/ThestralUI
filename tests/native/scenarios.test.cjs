const path = require('node:path');
const React = require('react');
const { Text, View } = require('react-native');
const { fireEvent, render } = require('@testing-library/react-native');
const { nativeScenarios } = require('../../scripts/scenarios/native.cjs');
const fixtureRegistry = require('../../catalog/native/scenarios/fixtures.cjs');
const { withAdditionalFixture } = require('../scenarios/native-registry-fixture.cjs');
const { NativeScenario } = require('../../catalog/native/ScenarioGallery.tsx');

const root = path.resolve(__dirname, '../..');
const scenarios = nativeScenarios(root);

// Respect RN's explicit order, which names descendants by nativeID and excludes unlisted siblings.
function childrenInOrder(element) {
  const children = element.children.filter((child) => typeof child !== 'string');
  const ids = element.props.experimental_accessibilityOrder;
  if (!ids) return children;
  const descendants = element.queryAll((child) => child !== element && !!child.props.nativeID);
  return ids.map((id) => {
    const matches = descendants.filter((child) => child.props.nativeID === id);
    if (matches.length !== 1) throw new Error('Ambiguous or missing accessibility traversal target ' + id);
    return matches[0];
  });
}
function traversal(element) {
  return [element, ...childrenInOrder(element).flatMap(traversal)];
}

async function executeScenario({ id, fixtureId, steps }, registry = fixtureRegistry) {
  const screen = await render(React.createElement(NativeScenario, { fixture: fixtureId, registry }));
  function target({ role, name }) {
    if (!['button', 'checkbox', 'text', 'alert'].includes(role)) throw new Error('Unsupported role ' + role);
    const node = screen.getByRole(role, { name, exact: true });
    expect(node).toBeVisible();
    return node;
  }
  for (const [index, step] of steps.entries()) {
    try {
      const node = target(step.target);
      if (step.act === 'activate') {
        expect(node).toBeEnabled();
        await fireEvent.press(node);
      }
      if (['checked', 'unchecked', 'mixed'].includes(step.expect)) {
        expect(node.props.accessibilityState?.checked).toBe(step.expect === 'mixed' ? 'mixed' : step.expect === 'checked');
      }
      if (step.expect === 'busy') {
        expect(node.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
        expect(node).toBeDisabled();
      }
      if (step.expect === 'before') {
        const other = target(step.other);
        const order = traversal(screen.root);
        expect(order.indexOf(node)).toBeGreaterThanOrEqual(0);
        expect(order.indexOf(other)).toBeGreaterThan(order.indexOf(node));
      }
    } catch (error) {
      throw new Error(id + ' step ' + (index + 1) + ': ' + error.message, { cause: error });
    }
  }
}

for (const scenario of scenarios) {
  test(scenario.id, () => executeScenario(scenario));
}

test('a registered third fixture runs through the native renderer', async () => {
  const entry = { label: 'Quote example', render: () => React.createElement(Text, {}, 'Quote ready') };
  await withAdditionalFixture(root, entry, async (checkout, registry) => {
    const third = nativeScenarios(checkout, registry).find(s => s.fixtureId === 'quote.preview');
    expect(third).toBeDefined();
    await executeScenario(third, registry);
    const onPress = jest.fn();
    const { Button } = require('@ui-lazy-dev/ui-native');
    const busyFixture = {
      ...entry,
      render: () => React.createElement(Button, { label: 'Publish', busy: true, onPress }),
    };
    const action = { act: 'activate', target: { role: 'button', name: 'Publish' } };
    const busyRegistry = { ...registry, [third.fixtureId]: busyFixture };
    await expect(executeScenario({ ...third, steps: [action] }, busyRegistry))
      .rejects.toThrow(/quote.shows-preview step 1/);
    expect(onPress).not.toHaveBeenCalled();
  });
});

test('explicit native accessibility order overrides JSX sibling order', async () => {
  const screen = await render(React.createElement(View, { experimental_accessibilityOrder: ['second', 'first'] },
    React.createElement(Text, { nativeID: 'first' }, 'First'),
    React.createElement(Text, { nativeID: 'second' }, 'Second')));
  const order = traversal(screen.root);
  const first = screen.getByRole('text', { name: 'First' });
  const second = screen.getByRole('text', { name: 'Second' });
  expect(order.indexOf(second)).toBeGreaterThanOrEqual(0);
  expect(order.indexOf(first)).toBeGreaterThan(order.indexOf(second));
});

test('a static text duplicate cannot satisfy a named live alert observation', async () => {
  const message = 'Unable to save this record';
  const scenario = {id:'audit.save-failed',fixtureId:'audit.editor',steps:[
    {expect:'visible',target:{role:'alert',name:message}},
  ]};
  const fixture = props => ({'audit.editor':{label:'Audit editor',render:()=>React.createElement(Text,props,message)}});
  await expect(executeScenario(scenario,fixture({}))).rejects.toThrow(/audit.save-failed step 1/);
  await executeScenario(scenario,fixture({accessibilityRole:'alert',accessibilityLiveRegion:'assertive'}));
});
