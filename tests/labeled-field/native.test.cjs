const React = require('react');
const { StyleSheet } = require('react-native');
const { tokens } = require('@ui-lazy-dev/tokens');

const { render, fireEvent } = require('@testing-library/react-native');

const { FormField, Dialog } = require('@ui-lazy-dev/ui-native');

test('a controlled field preserves its name, help, validation and caller input props', async () => {
  const change = jest.fn();
  const screen = await render(React.createElement(FormField, {
    label: '識別名', hint: '３文字以上', error: '入力が必要です', value: '', onChangeText: change, testID: 'field',
  }));
  const input = screen.getByLabelText('識別名');
  expect(StyleSheet.flatten(input.props.style).minHeight).toBeGreaterThanOrEqual(tokens.density.coarseTarget);
  expect(input.props.accessibilityHint).toContain('入力が必要です');
  expect(screen.getByRole('alert')).toHaveTextContent('入力が必要です');
  await fireEvent.changeText(input, '山田');
  expect(change).toHaveBeenCalledWith('山田');
  expect(input.props.placeholderTextColor).toBe(tokens.light.muted);
  await screen.rerender(React.createElement(FormField, { label: '識別名', placeholderTextColor: '#eee' }));
  expect(screen.getByLabelText('識別名').props.placeholderTextColor).toBe('#eee');
});
