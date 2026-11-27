const React = require('react');

const { render, fireEvent } = require('@testing-library/react-native');

const { Text } = require('react-native');

const { FormField, Dialog } = require('@ui-lazy-dev/ui-native');

test('a native dialog exposes its localized title and delegates Back dismissal to its owner', async () => {
  const dismiss = jest.fn();
  const screen = await render(React.createElement(Dialog, {testID:'confirmation',title:'تأكيد', onDismiss:dismiss},
    React.createElement(Text, null, 'حفظ')));
  expect(screen.getByRole('header')).toHaveTextContent('تأكيد');
  expect(screen.getByText('حفظ')).toBeOnTheScreen();
  await fireEvent(screen.getByTestId('confirmation'), 'requestClose');
  expect(dismiss).toHaveBeenCalledTimes(1);
});

test('returns accessibility focus only to the mounted opener of a presented dialog', async () => {
  const { AccessibilityInfo } = require('react-native');
  const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => {});
  const pending = [];
  const frame = jest.spyOn(global, 'requestAnimationFrame').mockImplementation(callback => {
    pending.push(callback);
    return pending.length;
  });
  try {
    const opener = { current: {} };
    const makeDialog = () => React.createElement(Dialog, {
      title: 'Review changes', testID: 'review', onDismiss: () => {}, returnFocusRef: opener,
    }, React.createElement(Text, null, 'Scope'));
    let screen = await render(makeDialog());
    await fireEvent(screen.getByTestId('review'), 'show');
    expect(send).toHaveBeenCalled();
    send.mockClear();
    await screen.unmount();
    pending.splice(0).forEach(callback => callback(0));
    expect(send).toHaveBeenCalledWith(opener.current, 'focus');

    screen = await render(makeDialog());
    await fireEvent(screen.getByTestId('review'), 'show');
    send.mockClear();
    await screen.unmount();
    opener.current = {};
    pending.splice(0).forEach(callback => callback(0));
    expect(send).not.toHaveBeenCalled();
  } finally {
    frame.mockRestore();
    send.mockRestore();
  }
});

test('a custom native modal uses the headless window, heading and escape behavior', async () => {
  const { Modal, View } = require('react-native');
  const { useDialog } = require('@ui-lazy-dev/ui-native/modal-dialog');
  const dismiss = jest.fn();
  function CustomDialog() {
    const { modalProps, panelProps, headingProps, content } = useDialog({ onDismiss: dismiss });
    return React.createElement(Modal, { ...modalProps, testID: 'custom-window' },
      React.createElement(View, { ...panelProps, testID: 'custom-panel' },
        React.createElement(Text, headingProps, 'Custom task'),
        content(React.createElement(Text, null, 'Album approval'))));
  }
  const screen = await render(React.createElement(CustomDialog));
  expect(screen.getByRole('header', { name: 'Custom task' })).toBeVisible();
  expect(screen.getByTestId('custom-panel').props.accessibilityViewIsModal).toBe(true);
  await fireEvent(screen.getByTestId('custom-panel'), 'accessibilityEscape');
  await fireEvent(screen.getByTestId('custom-window'), 'requestClose');
  expect(dismiss).toHaveBeenCalledTimes(2);
});

test('native parts retain accessible behavior, omit empty slots and accept consumer styles', async () => {
  const { StyleSheet } = require('react-native');
  const { Dialog: FamilyDialog } = require('@ui-lazy-dev/ui-native/modal-dialog');
  const ref = React.createRef();
  const dismiss = jest.fn();
  const empty = React.createElement(React.Fragment, null, [null, false, React.createElement(React.Fragment, { key: 'empty' })]);
  const create = (props = {}) => React.createElement(FamilyDialog, {
    ref, title: 'Task', onDismiss: dismiss, actions: empty, ...props,
  }, React.createElement(Text, null, 'Review'));
  const screen = await render(create());
  const get = name => screen.getByTestId('dialog.' + name, { includeHiddenElements: name === 'backdrop' });
  expect(typeof ref.current.measure).toBe('function');
  expect(get('heading')).toHaveTextContent('Task');
  expect(get('body')).toBeOnTheScreen();
  expect(screen.queryByTestId('dialog.actions')).toBeNull();
  expect(get('backdrop').props.pointerEvents).toBe('none');
  expect(get('backdrop').props.onStartShouldSetResponder()).toBe(false);
  for (const [size, width] of [['sm',320],['md',416],['lg',640]]) {
    await screen.rerender(create({ size }));
    expect(StyleSheet.flatten(get('root').props.style)).toMatchObject({ maxWidth: width });
  }
  await screen.rerender(create({
    unstyled:true, dismissOnBackdrop:true, actions:React.createElement(Text, null, 'Skip'),
    style:{maxWidth:290}, backdropStyle:{backgroundColor:'#234567'}, headingStyle:{color:'#654321'},
    bodyStyle:{padding:5}, actionsStyle:{gap:9},
  }));
  expect(StyleSheet.flatten(get('root').props.style)).toEqual({ maxWidth:290 });
  expect(StyleSheet.flatten(get('heading').props.style)).toEqual({ color:'#654321' });
  expect(StyleSheet.flatten(get('body').props.style)).toEqual({ padding:5 });
  expect(StyleSheet.flatten(get('actions').props.style)).toEqual({ gap:9 });
  expect(StyleSheet.flatten(get('backdrop').props.style)).toMatchObject({ backgroundColor:'#234567' });
  expect(get('root').props.accessibilityViewIsModal).toBe(true);
  const backdrop = get('backdrop');
  expect(backdrop.props.accessible).toBe(false);
  expect(backdrop.props.onStartShouldSetResponder()).toBe(true);
  await fireEvent(backdrop, 'responderGrant');
  await fireEvent(backdrop, 'responderTerminate');
  await fireEvent(backdrop, 'responderRelease');
  expect(dismiss).not.toHaveBeenCalled();
  await fireEvent(backdrop, 'responderGrant');
  await fireEvent(backdrop, 'responderRelease');
  await fireEvent(backdrop, 'responderRelease');
  expect(dismiss).toHaveBeenCalledTimes(1);
  await screen.unmount();
  expect(ref.current).toBeNull();
});

test('the theme supplies native modal colors, spacing and corners without changing its behavior', async () => {
  const { defaultTheme } = require('@ui-lazy-dev/tokens/modes');
  const { StyleSheet } = require('react-native');
  const props = { title:'Review', testID:'review', onDismiss:jest.fn() };
  const screen = await render(React.createElement(Dialog,props, React.createElement(Text,null,'Draft')));
  for (const mode of [{scheme:'light',density:'comfortable'},{scheme:'dark',density:'compact'},{scheme:'high-contrast',density:'spacious'}]) {
    const {tokens} = defaultTheme.resolve(mode);
    await screen.rerender(React.createElement(Dialog,{ ...props,theme:tokens },React.createElement(Text,null,'Draft')));
    expect(StyleSheet.flatten(screen.getByTestId('review.root').props.style)).toMatchObject({
      backgroundColor:tokens.color.surface, borderRadius:tokens.size.radius, padding:tokens.space.spaceLg,
    });
    expect(StyleSheet.flatten(screen.getByTestId('review.backdrop', { includeHiddenElements: true }).props.style)).toMatchObject({backgroundColor:tokens.color.shadowColor});
    expect(StyleSheet.flatten(screen.getByTestId('review.heading').props.style)).toMatchObject({color:tokens.color.text});
    expect(screen.getByRole('header',{name:'Review'})).toBeVisible();
  }
});

test('Android restores nested windows in order and dismisses the keyboard before the dialog', async () => {
  const { Platform, Keyboard } = require('react-native');
  const oldOS = Platform.OS;
  Platform.OS = 'android';
  const visible = jest.spyOn(Keyboard, 'isVisible').mockReturnValue(true);
  const hide = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
  const closeChild = jest.fn(), closeParent = jest.fn();
  try {
    const screen = await render(React.createElement(Dialog, {title:'Workspace',testID:'parent',onDismiss:closeParent},
      React.createElement(Dialog,{title:'Confirm',testID:'child',onDismiss:closeChild},React.createElement(Text,null,'Review'))));
    expect(screen.queryByTestId('child', {includeHiddenElements:true})).toBeNull();
    await fireEvent(screen.getByTestId('parent'), 'show');
    await fireEvent(screen.getByTestId('child'), 'requestClose');
    expect(hide).toHaveBeenCalledTimes(1);
    expect(closeChild).not.toHaveBeenCalled();
    visible.mockReturnValue(false);
    await fireEvent(screen.getByTestId('child'), 'requestClose');
    expect(closeChild).toHaveBeenCalledTimes(1);
    expect(closeParent).not.toHaveBeenCalled();
  } finally {
    Platform.OS = oldOS;
    visible.mockRestore();
    hide.mockRestore();
  }
});

test('a newer presentation cancels a pending accessibility focus return from the previous close', async () => {
  const { AccessibilityInfo } = require('react-native');
  const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => {});
  const pending = [];
  const frame = jest.spyOn(global, 'requestAnimationFrame').mockImplementation(callback => {
    pending.push(callback);
    return pending.length;
  });
  const opener = { current: {} };
  const renderDialog = open => React.createElement(Dialog, {
    open, testID:'review', title:'Review', onDismiss: () => {}, returnFocusRef:opener,
  }, React.createElement(Text,null,'Draft'));
  try {
    const screen = await render(renderDialog(false));
    expect(screen.queryByTestId('review')).toBeNull();
    await screen.rerender(renderDialog(true));
    await fireEvent(screen.getByTestId('review'), 'show');
    await screen.rerender(renderDialog(false));
    await screen.rerender(renderDialog(true));
    await fireEvent(screen.getByTestId('review'), 'show');
    send.mockClear();
    pending.splice(0).forEach(callback => callback(0));
    expect(send).not.toHaveBeenCalledWith(opener.current, 'focus');
    await screen.unmount();
    pending.splice(0).forEach(callback => callback(0));
    expect(send).toHaveBeenCalledWith(opener.current, 'focus');
  } finally {
    frame.mockRestore();
    send.mockRestore();
  }
});

test('dark scoped controls keep their palette inside a dialog on a light device', async () => {
  const { defaultTheme } = require('@ui-lazy-dev/tokens/modes');
  const { Appearance, StyleSheet } = require('react-native');
  const { Button, IconButton } = require('@ui-lazy-dev/ui-native');
  const scheme = jest.spyOn(Appearance, 'getColorScheme').mockReturnValue('light');
  const { tokens: theme } = defaultTheme.resolve({ scheme: 'dark' });
  try {
    const view = await render(React.createElement(Dialog, { title: 'Dark editor', theme, onDismiss() {} },
      React.createElement(Button, { theme, label: 'Save', testID: 'save', onPress() {} }),
      React.createElement(IconButton, { theme, label: 'More', testID: 'more', onPress() {}, icon: React.createElement(Text, null, '…') }),
      React.createElement(FormField, { theme, label: 'Name', testID: 'name' })));
    const style = id => StyleSheet.flatten(view.getByTestId(id).props.style);
    expect(style('dialog.root').backgroundColor).toBe(theme.color.surface);
    expect(style('save').backgroundColor).toBe(theme.color.accent);
    expect(style('save.label').color).toBe(theme.color.onAccent);
    expect(style('more').backgroundColor).toBe(theme.color.accent);
    expect(style('name')).toMatchObject({ color: theme.color.text, backgroundColor: theme.color.surface, borderColor: theme.color.border });
    expect(view.getByTestId('name').props.placeholderTextColor).toBe(theme.color.muted);
  } finally { scheme.mockRestore(); }
});
