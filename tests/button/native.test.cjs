const React = require('react');

const { render, fireEvent, act } = require('@testing-library/react-native');

const { AccessibilityInfo, Animated } = require('react-native');

const { Button, useButton } = require('@ui-lazy-dev/ui-native');

afterEach(() => jest.restoreAllMocks());

test('busy buttons retain their name and suppress duplicate activation', async () => {
  const onPress = jest.fn();
  const button = state => React.createElement(Button, { label: 'Save role', onPress, ...state });
  const screen = await render(button({}));
  const ready = screen.getByRole('button', { name: 'Save role' });
  await screen.rerender(button({ busy: true }));
  const action = screen.getByRole('button', { name: 'Save role', busy: true });
  expect(action).toBe(ready);
  expect(action.props.onStartShouldSetResponder()).toBe(true);
  expect(action.props.focusable).toBe(true);
  expect(action).toBeDisabled();
  await fireEvent.press(action);
  const target = {};
  await act(async () => action.props.onClick({ nativeEvent: {}, target, currentTarget: target }));
  expect(onPress).not.toHaveBeenCalled();
  await screen.rerender(button({}));
  await fireEvent.press(ready);
  expect(onPress).toHaveBeenCalledTimes(1);
  await screen.rerender(button({ disabled: true }));
  const disabled = screen.getByRole('button', { name: 'Save role', disabled: true });
  expect(disabled).toBe(ready);
  expect(disabled.props.onStartShouldSetResponder()).toBe(false);
  expect(disabled.props.focusable).toBe(false);
  await fireEvent.press(disabled);
  expect(onPress).toHaveBeenCalledTimes(1);
});

test.each([true, false])(
  'press feedback honors the OS reduce motion setting (%p)',
  async (reduce) => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(reduce);
    const timing = jest.spyOn(Animated, 'timing');
    const onPress = jest.fn();
    const screen = await render(
      React.createElement(Button, {
        label: 'Save role',
        motion: 'press',
        onPress,
      }),
    );
    const action = screen.getByRole('button', { name: 'Save role' });
    await fireEvent(action, 'pressIn', { nativeEvent: {} });
    if (reduce) expect(timing).not.toHaveBeenCalled();
    else
      expect(timing).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          useNativeDriver: true,
          toValue: expect.any(Number),
        }),
      );
    await fireEvent.press(action);
    expect(onPress).toHaveBeenCalledTimes(1);
  },
);

test('a live reduced-motion change wins over a stale initial preference', async () => {
  let resolveInitial;
  let change;
  const remove = jest.fn();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(
    new Promise((resolve) => {
      resolveInitial = resolve;
    }),
  );
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((name, handle) => {
    if (name === 'reduceMotionChanged') change = handle;
    return { remove };
  });
  const timing = jest.spyOn(Animated, 'timing');
  const screen = await render(
    React.createElement(Button, {
      label: 'Save',
      motion: 'press',
      onPress: jest.fn(),
    }),
  );
  await act(async () => {
    change(true);
    resolveInitial(false);
  });
  await fireEvent(screen.getByRole('button', { name: 'Save' }), 'pressIn', {
    nativeEvent: {},
  });
  expect(timing).not.toHaveBeenCalled();
  const action = (motion) => React.createElement(Button, { label: 'Save', motion, onPress: jest.fn() });
  await screen.rerender(action());
  let resolveAfterTeardown;
  AccessibilityInfo.isReduceMotionEnabled.mockReturnValueOnce(new Promise(resolve => {
    resolveAfterTeardown = resolve;
  }));
  await screen.rerender(action('press'));
  await screen.rerender(action());
  await act(async () => resolveAfterTeardown(false));
  await fireEvent(screen.getByRole('button', { name: 'Save' }), 'pressIn', { nativeEvent: {} });
  expect(timing).not.toHaveBeenCalled();
  await screen.unmount();
  expect(remove).toHaveBeenCalled();
});

test('forwards the automation identifier to the same accessible press target', async () => {
  const screen = await render(
    React.createElement(Button, {
      testID: 'publish-action',
      label: 'Publish draft',
      onPress: jest.fn(),
    }),
  );
  expect(screen.getByTestId('publish-action')).toBe(
    screen.getByRole('button', { name: 'Publish draft' }),
  );
});

test('all native button sizes retain a coarse target and the default matches the previous medium size', async () => {
  const { StyleSheet } = require('react-native');
  const styles = {};
  for (const size of [undefined, 'sm', 'md', 'lg']) {
    const rendered = await render(
      React.createElement(Button, { size, label: 'Publish', onPress: jest.fn() }),
    );
    const style = StyleSheet.flatten(rendered.getByRole('button', { name: 'Publish' }).props.style);
    expect(style.minHeight).toBeGreaterThanOrEqual(48);
    expect(style.minWidth).toBeGreaterThanOrEqual(48);
    styles[size ?? 'default'] = style;
    await rendered.unmount();
  }
  expect(styles.default).toMatchObject({
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: 16,
    paddingVertical: 8,
  });
  expect(styles.md).toEqual(styles.default);
  expect(styles.sm.paddingHorizontal).toBeLessThan(styles.md.paddingHorizontal);
  expect(styles.lg.minHeight).toBeGreaterThan(styles.md.minHeight);
});

test('native actions retain decorative slots and one accessible label while busy', async () => {
  const { View } = require('react-native');
  const onPress = jest.fn();
  const properties = {
    startIcon: React.createElement(View, { testID: 'leading-glyph', accessible: true }),
    endIcon: React.createElement(View, { testID: 'trailing-glyph', accessible: true }),
    label: 'Publish',
    onPress,
  };
  const rendered = await render(React.createElement(Button, properties));
  const action = rendered.getByRole('button', { name: 'Publish' });
  for (const id of ['leading-glyph', 'trailing-glyph']) {
    expect(rendered.queryByTestId(id)).toBeNull();
    expect(rendered.getByTestId(id, { includeHiddenElements: true })).toBeTruthy();
  }
  await fireEvent.press(action);
  await rendered.rerender(React.createElement(Button, { ...properties, busy: true }));
  expect(rendered.getByTestId('trailing-glyph', { includeHiddenElements: true })).toBeTruthy();
  await fireEvent.press(rendered.getByRole('button', { name: 'Publish', busy: true }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

function rippleControls(onPress, state = {}) {
  const { View } = require('react-native');
  const { IconButton } = require('@ui-lazy-dev/ui-native');
  return React.createElement(View, null,
    React.createElement(Button, { label:'Continue', tone:'primary', onPress, ...state }),
    React.createElement(IconButton, { label:'Workspace help', tone:'secondary', icon:React.createElement(View), onPress, ...state }));
}

test('uses a bounded Android theme ripple on both active public controls', async () => {
  const { Platform } = require('react-native');
  jest.replaceProperty(Platform, 'OS', 'android');
  const onPress = jest.fn();
  const view = await render(rippleControls(onPress));
  const find = name => view.getByRole('button', { name, exact:true });
  for (const name of ['Continue', 'Workspace help']) {
    const host = find(name);
    if (Platform.OS === 'android') {
      expect(host.props.nativeForegroundAndroid).toMatchObject({
        type:'RippleAndroid', borderless:false, alpha:null,
      });
      expect(host.props.nativeForegroundAndroid.color == null).toBe(true);
    } else expect(host.props.nativeForegroundAndroid).toBeUndefined();
    expect(host.props.nativeBackgroundAndroid).toBeUndefined();
    await fireEvent.press(host);
  }
  for (const state of [{busy:true}, {disabled:true}]) {
    await view.rerender(rippleControls(onPress, state));
    for (const name of ['Continue', 'Workspace help']) {
      const host = find(name);
      expect(host.props.nativeForegroundAndroid).toBeUndefined();
      await fireEvent.press(host);
    }
  }
  expect(onPress).toHaveBeenCalledTimes(2);
  await view.unmount();
});

test('iOS keeps Android ripple props off active, busy and disabled public controls', async () => {
  const { Platform } = require('react-native');
  jest.replaceProperty(Platform, 'OS', 'ios');
  const onPress = jest.fn();
  const view = await render(rippleControls(onPress));
  for (const state of [{}, {busy:true}, {disabled:true}]) {
    await view.rerender(rippleControls(onPress, state));
    for (const name of ['Continue', 'Workspace help']) {
      const host = view.getByRole('button', { name, exact:true });
      expect(host.props.nativeForegroundAndroid).toBeUndefined();
      expect(host.props.nativeBackgroundAndroid).toBeUndefined();
      await fireEvent.press(host);
    }
  }
  expect(onPress).toHaveBeenCalledTimes(2);
  await view.unmount();
});

test('every tone uses its tokens in light and dark', async () => {
  const RN = require('react-native');
  const { StyleSheet } = RN;
  const { tokens } = require('@ui-lazy-dev/tokens');
  for (const scheme of ['light', 'dark']) {
    jest.spyOn(RN, 'useColorScheme').mockReturnValue(scheme);
    const colors = tokens[scheme];
    const expected = {
      primary: [colors.accent, colors.accent, colors.onAccent],
      secondary: [colors.surface, colors.border, colors.text],
      ghost: ['transparent', 'transparent', colors.text],
      danger: [colors.danger, colors.danger, colors.onAccent],
      link: ['transparent', 'transparent', colors.accent],
    };
    for (const [tone, [background, border, text]] of Object.entries(expected)) {
      const view = await render(React.createElement(Button, { tone, label: tone, testID: tone, onPress: jest.fn() }));
      const target = StyleSheet.flatten(view.getByRole('button', { name: tone }).props.style);
      expect([target.backgroundColor, target.borderColor]).toEqual([background, border]);
      const label = StyleSheet.flatten(view.getByTestId(tone + '.label').props.style);
      expect(label.color).toBe(text);
      expect(label.textDecorationLine).toBe(tone === 'link' ? 'underline' : undefined);
      await view.unmount();
    }
    jest.restoreAllMocks();
  }
});

test('busy keeps the size and focus, hides the label and icons behind an indicator, and names each part', async () => {
  const { StyleSheet, View } = require('react-native');
  const onPress = jest.fn();
  const props = state => ({
    testID: 'save',
    label: 'Save role',
    startIcon: React.createElement(View),
    endIcon: React.createElement(View),
    onPress,
    ...state,
  });
  const view = await render(React.createElement(Button, props({})));
  const action = view.getByTestId('save');
  const flat = id => StyleSheet.flatten(view.getByTestId(id, { includeHiddenElements: true }).props.style) ?? {};
  const size = () => {
    const style = StyleSheet.flatten(action.props.style);
    return [style.minHeight, style.minWidth, style.paddingHorizontal, style.paddingVertical];
  };
  const before = size();
  expect(view.queryByTestId('save.busy-indicator', { includeHiddenElements: true })).toBeNull();
  expect(flat('save.label').opacity).toBeUndefined();
  await view.rerender(React.createElement(Button, props({ busy: true })));
  expect(view.getByTestId('save')).toBe(action);
  expect(size()).toEqual(before);
  expect(action.props.focusable).toBe(true);
  expect(flat('save.label').opacity).toBe(0);
  expect(flat('save.start-icon').opacity).toBe(0);
  expect(flat('save.end-icon').opacity).toBe(0);
  expect(view.getByTestId('save.busy-indicator', { includeHiddenElements: true })).toBeTruthy();
  expect(view.getByRole('button', { name: 'Save role', busy: true })).toBe(action);
  await fireEvent.press(action);
  expect(onPress).not.toHaveBeenCalled();
});

test('full width stretches the action and unstyled mode keeps only the behaviour', async () => {
  const { StyleSheet } = require('react-native');
  const onPress = jest.fn();
  const view = await render(React.createElement(Button, { testID: 'go', label: 'Continue', fullWidth: true, onPress }));
  // The outermost host is the animated wrapper that carries layout.
  expect(StyleSheet.flatten(view.toJSON().props.style).alignSelf).toBe('stretch');
  await view.rerender(React.createElement(Button, { testID: 'go', label: 'Continue', onPress }));
  expect(StyleSheet.flatten(view.toJSON().props.style).alignSelf).toBeUndefined();
  await view.rerender(React.createElement(Button, { testID: 'go', label: 'Continue', unstyled: true, onPress }));
  const action = view.getByRole('button', { name: 'Continue' });
  const style = StyleSheet.flatten(action.props.style);
  expect(style.backgroundColor).toBeUndefined();
  expect(style.minHeight).toBeUndefined();
  expect(StyleSheet.flatten(view.getByTestId('go.label').props.style).color).toBeUndefined();
  expect(action.props.nativeForegroundAndroid).toBeUndefined();
  await fireEvent.press(action);
  expect(onPress).toHaveBeenCalledTimes(1);
  await view.rerender(React.createElement(Button, { testID: 'go', label: 'Continue', unstyled: true, busy: true, onPress }));
  const indicator = view.getByTestId('go.busy-indicator', { includeHiddenElements: true });
  expect(StyleSheet.flatten(indicator.props.style) ?? {}).toEqual({});
  expect(indicator.children).toHaveLength(0);
  expect(StyleSheet.flatten(view.getByTestId('go.label').props.style)?.opacity).toBeUndefined();
  await fireEvent.press(view.getByRole('button', { name: 'Continue', busy: true }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('iOS highlights a pressed action with the press-opacity token', async () => {
  const { Platform, StyleSheet } = require('react-native');
  const { tokens } = require('@ui-lazy-dev/tokens');
  expect(Platform.OS).toBe('ios');
  const view = await render(React.createElement(Button, { label: 'Share', onPress: jest.fn() }));
  const opacity = () => StyleSheet.flatten(view.getByRole('button', { name: 'Share' }).props.style).opacity;
  expect(opacity()).toBe(1);
  await fireEvent(view.getByRole('button', { name: 'Share' }), 'pressIn', { nativeEvent: {} });
  expect(opacity()).toBe(tokens.motion.pressOpacity);
  await fireEvent(view.getByRole('button', { name: 'Share' }), 'pressOut', { nativeEvent: {} });
  expect(opacity()).toBe(1);
  await view.rerender(React.createElement(Button, { label: 'Share', disabled: true, onPress: jest.fn() }));
  await fireEvent(view.getByRole('button', { name: 'Share' }), 'pressIn', { nativeEvent: {} });
  expect(opacity()).toBe(0.62);
});

test('the headless hook gives a custom Pressable the same accessible behaviour', async () => {
  const { Pressable } = require('react-native');
  const onPress = jest.fn();
  function CustomButton(props) {
    const { buttonProps } = useButton({ label: 'Save changes', accessibilityHint: 'Saves the draft', onPress, ...props });
    return React.createElement(Pressable, buttonProps);
  }
  const view = await render(React.createElement(CustomButton));
  const control = () => view.getByRole('button', { name: 'Save changes' });
  expect(control().props.accessibilityHint).toBe('Saves the draft');
  const press = { nativeEvent: { pageX: 17 } };
  await fireEvent.press(control(), press);
  expect(onPress.mock.calls[0][0].nativeEvent.pageX).toBe(17);
  await view.rerender(React.createElement(CustomButton, { busy: true }));
  expect(control().props.focusable).toBe(true);
  expect(control().props.accessibilityState).toMatchObject({ busy: true, disabled: true });
  // Direct host clicks also go through the headless guard while the target remains focusable.
  const target = {};
  await act(async () => control().props.onClick({ nativeEvent: {}, target, currentTarget: target }));
  await view.rerender(React.createElement(CustomButton, { disabled: true }));
  expect(control().props.focusable).toBe(false);
  await fireEvent.press(control());
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('the family subpath forwards a native ref and consumer styles to the named parts', async () => {
  const family = require('@ui-lazy-dev/ui-native/button');
  const { StyleSheet } = require('react-native');
  expect(family.Button).toBe(Button);
  expect(family.useButton).toBe(useButton);
  const ref = React.createRef();
  const view = await render(React.createElement(family.Button, {
    ref, label: 'Publish', testID: 'publish', onPress: jest.fn(), fullWidth: true,
    style: { alignSelf: 'flex-start' }, pressableStyle: { minHeight: 72, backgroundColor: '#167' },
    labelStyle: { color: '#fff', fontWeight: '400' },
  }));
  expect(typeof ref.current.measure).toBe('function');
  expect(StyleSheet.flatten(view.toJSON().props.style).alignSelf).toBe('flex-start');
  expect(StyleSheet.flatten(view.getByRole('button', { name: 'Publish' }).props.style))
    .toMatchObject({ minHeight: 72, backgroundColor: '#167' });
  expect(StyleSheet.flatten(view.getByTestId('publish.label').props.style))
    .toMatchObject({ color: '#fff', fontWeight: '400' });
  await view.unmount();
  expect(ref.current).toBeNull();
});


test('a busy action keeps a visible stationary indicator when reduced motion is enabled', async () => {
  let update;
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((_event, listener) => {
    update = listener;
    return { remove: jest.fn() };
  });
  const view = await render(React.createElement(Button, { label: 'Saving', testID: 'save', busy: true, onPress: jest.fn() }));
  const staticMark = () => view.queryByTestId('save.busy-static', { includeHiddenElements: true });
  expect(staticMark()).toBeTruthy();
  await act(async () => update(false));
  expect(staticMark()).toBeNull();
  await act(async () => update(true));
  expect(staticMark()).toBeTruthy();
  expect(view.getByRole('button', { name: 'Saving', busy: true })).toBeTruthy();
});
