const React = require('react');

const { render, fireEvent, act } = require('@testing-library/react-native');

afterEach(() => jest.restoreAllMocks());

test('native icon-only actions have square targets and keep the caller label', async () => {
  const { Text, StyleSheet } = require('react-native');
  const { IconButton } = require('@ui-lazy-dev/ui-native');
  const rendered = await render(
    React.createElement(IconButton, {
      label: 'Archive',
      icon: React.createElement(Text, null, 'glyph'),
      size: 'lg',
      onPress: jest.fn(),
    }),
  );
  const action = rendered.getByRole('button', { name: 'Archive' });
  const style = StyleSheet.flatten(action.props.style);
  expect(style.width).toBe(style.height);
  expect(style.width).toBeGreaterThanOrEqual(48);
  expect(rendered.queryByText('Archive')).toBeNull();
  expect(rendered.queryByText('glyph')).toBeNull();
});
