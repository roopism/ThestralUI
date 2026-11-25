const React = require('react');
const { StyleSheet, useColorScheme } = require('react-native');
const { fireEvent, render } = require('@testing-library/react-native');
const { tokens } = require('@ui-lazy-dev/tokens');
const { ScenarioSurface, ScenarioText } = require('../../catalog/native/scenarios/presentation.tsx');
const { WorkQueue } = require('../../catalog/native/scenarios/DataTable.tsx');

test('gallery surfaces and readbacks pair semantic colors, preserve native text props and lay out horizontal boundaries', async () => {
  const original = useColorScheme.getMockImplementation();
  try {
    for (const mode of ['dark', 'light']) {
      useColorScheme.mockReturnValue(mode);
      const view = await render(React.createElement(ScenarioSurface, { testID: 'surface' },
        React.createElement(ScenarioText, { testID: 'readback', selectable: true, accessibilityLiveRegion: 'polite' }, 'Record saved')));
      expect(StyleSheet.flatten(view.getByTestId('surface').props.style).backgroundColor).toBe(tokens[mode].canvas);
      const text = view.getByRole('text', { name: 'Record saved' });
      expect(StyleSheet.flatten(text.props.style).color).toBe(tokens[mode].text);
      expect(text.props.selectable).toBe(true);
      expect(text.props.accessibilityLiveRegion).toBe('polite');
      expect(StyleSheet.flatten(view.getByTestId('surface').props.style).flexDirection).toBe('column');
      await view.rerender(React.createElement(ScenarioSurface, { testID: 'surface', horizontal: true },
        React.createElement(ScenarioText, { accessibilityLabel: 'First option' }, 'Standard delivery'),
        React.createElement(ScenarioText, { accessibilityLabel: 'Second option' }, 'Express delivery')));
      expect(StyleSheet.flatten(view.getByTestId('surface').props.style)).toMatchObject({
        flexDirection: 'row', alignItems: 'stretch', backgroundColor: tokens[mode].canvas,
      });
      expect(view.getAllByRole('text').map(node => node.props.accessibilityLabel)).toEqual(['First option','Second option']);
      await view.unmount();
    }
  } finally {
    useColorScheme.mockImplementation(original);
  }
});

test('the native work queue announces one archived record and retains plural results', async () => {
  for (const [names, outcome] of [
    [['Select Atlas audit'], 'Archived 1 record'],
    [['Select Atlas audit', 'Select Birch audit'], 'Archived 2 records'],
  ]) {
    const view = await render(React.createElement(WorkQueue));
    for (const name of names) await fireEvent.press(view.getByRole('checkbox', { name }));
    await fireEvent.press(view.getByRole('button', { name: 'Archive selected' }));
    expect(await view.findByText(outcome)).toBeTruthy();
    expect(view.queryByText('Archived 1 records')).toBeNull();
    await view.unmount();
  }
});
