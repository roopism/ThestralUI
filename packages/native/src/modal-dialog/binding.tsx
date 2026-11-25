import {
  Children, Fragment, createContext, isValidElement, useContext, useEffect, useRef, useState,
  type ComponentRef, type ReactNode, type Ref, type RefObject,
} from 'react';
import {
  AccessibilityInfo, Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, View, useColorScheme,
  type ModalProps, type StyleProp, type TextProps, type TextStyle, type ViewProps, type ViewStyle,
} from 'react-native';
import { tokens } from '@ui-lazy-dev/tokens';
import type { ResolvedTokens } from '@ui-lazy-dev/tokens/modes';

const ParentWindowShown = createContext(true);
// Same caps as the web dialog at its default 16px root text size (20, 26, and 40rem).
const panelWidth = { sm: 320, md: 416, lg: 640 };

function hasContent(slot: ReactNode): boolean {
  return Children.toArray(slot).some(child =>
    isValidElement<{children?: ReactNode}>(child) && child.type === Fragment
      ? hasContent(child.props.children) : child !== '',
  );
}
type FocusTarget = Parameters<typeof AccessibilityInfo.sendAccessibilityEvent>[0];

export interface UseDialogOptions {
  onDismiss: () => void;
  /** The consumer can keep the component mounted while its native window is closed. */
  open?: boolean;
  /** The accessible press target that opened this dialog. */
  returnFocusRef?: RefObject<FocusTarget | null>;
}

export interface DialogBehavior {
  modalProps: Pick<ModalProps, 'visible' | 'transparent' | 'animationType' | 'onRequestClose' | 'onShow'>;
  panelProps: Pick<ViewProps, 'accessibilityViewIsModal' | 'onAccessibilityEscape'>;
  headingProps: Pick<TextProps, 'accessible' | 'accessibilityRole'> & { ref: RefObject<ComponentRef<typeof Text> | null> };
  /** Place nested dialogs and their launchers inside this window boundary. */
  content: (children: ReactNode) => ReactNode;
}

export function useDialog({ open = true, onDismiss, returnFocusRef }: UseDialogOptions): DialogBehavior {
  const parentShown = useContext(ParentWindowShown);
  const [shown, setShown] = useState(false);
  const heading = useRef<ComponentRef<typeof Text>>(null);
  const returnTarget = useRef<{ opener: RefObject<FocusTarget | null>; target: FocusTarget } | null>(null);
  const generation = useRef(0);
  const visible = open && parentShown;

  useEffect(() => {
    if (!visible) {
      setShown(false);
      return;
    }
    const presentation = ++generation.current;
    return () => {
      const captured = returnTarget.current;
      returnTarget.current = null;
      if (captured) {
        // Run after native removes the modal window. A replacement opener must not receive stale focus.
        requestAnimationFrame(() => {
          if (generation.current === presentation && captured.opener.current === captured.target) {
            AccessibilityInfo.sendAccessibilityEvent(captured.target, 'focus');
          }
        });
      }
    };
  }, [visible]);

  function show() {
    if (!visible) return;
    setShown(true);
    if (returnFocusRef?.current) returnTarget.current = { opener: returnFocusRef, target: returnFocusRef.current };
    if (heading.current) AccessibilityInfo.sendAccessibilityEvent(heading.current, 'focus');
  }

  return {
    modalProps: {
      visible, transparent: true, animationType: 'none', onShow: show,
      onRequestClose() {
        if (Platform.OS === 'android' && Keyboard.isVisible()) Keyboard.dismiss();
        else onDismiss();
      },
    },
    panelProps: { accessibilityViewIsModal: true, onAccessibilityEscape: onDismiss },
    headingProps: { ref: heading, accessible: true, accessibilityRole: 'header' },
    // Android gives each Modal its own window. A restored child waits until the parent is presented.
    content: children => <ParentWindowShown.Provider value={visible && (Platform.OS !== 'android' || shown)}>
      {children}
    </ParentWindowShown.Provider>,
  };
}

export interface DialogProps extends UseDialogOptions {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  /** Optional tokens resolved by the application for its brand, density, scheme and motion. */
  theme?: ResolvedTokens;
  testID?: string;
  size?: keyof typeof panelWidth;
  unstyled?: boolean;
  dismissOnBackdrop?: boolean;
  /** Ref and style for the panel; testID stays on the native Modal for back compatibility. */
  ref?: Ref<ComponentRef<typeof View>>;
  style?: StyleProp<ViewStyle>;
  backdropStyle?: StyleProp<ViewStyle>;
  headingStyle?: StyleProp<TextStyle>;
  bodyStyle?: StyleProp<ViewStyle>;
  actionsStyle?: StyleProp<ViewStyle>;
}

export function Dialog({
  title, children, actions, testID, size = 'md', unstyled = false, dismissOnBackdrop = false,
  ref, style, backdropStyle, headingStyle, bodyStyle, actionsStyle, theme: selectedTheme, ...options
}: DialogProps) {
  const dialog = useDialog(options);
  const backdropTouch = useRef(false);
  const scheme = useColorScheme();
  const theme = selectedTheme?.color ?? (scheme === 'dark' ? tokens.dark : tokens.light);
  const layout = selectedTheme ?? tokens;
  const part = (name: string) => (testID ?? 'dialog') + '.' + name;
  return <Modal testID={testID} {...dialog.modalProps}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={unstyled ? {} : { flex: 1, justifyContent: 'center', alignItems: 'center', padding: layout.space.spaceLg }}>
      <View testID={part('backdrop')} accessible={false} importantForAccessibility="no"
        pointerEvents={dismissOnBackdrop ? 'auto' : 'none'}
        onStartShouldSetResponder={() => dismissOnBackdrop}
        onResponderGrant={() => { backdropTouch.current = true; }}
        onResponderTerminate={() => { backdropTouch.current = false; }}
        onResponderRelease={() => {
          const shouldDismiss = dismissOnBackdrop && backdropTouch.current;
          backdropTouch.current = false;
          if (shouldDismiss) options.onDismiss();
        }}
        style={[StyleSheet.absoluteFill, unstyled ? {} : { backgroundColor: theme.shadowColor, opacity: 0.48 }, backdropStyle]} />
      <View testID={part('root')} ref={ref} {...dialog.panelProps}
        style={[unstyled ? {} : { width: '100%', maxWidth: panelWidth[size], maxHeight: '90%', backgroundColor: theme.surface,
          borderRadius: layout.size.radius, padding: layout.space.spaceLg }, style]}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={unstyled ? {} : { gap: layout.size.gap }}>
          <Text testID={part('heading')} {...dialog.headingProps}
            style={[unstyled ? {} : { color: theme.text, fontWeight: '700' }, headingStyle]}>{title}</Text>
          {dialog.content(<>
            <View testID={part('body')} style={[unstyled ? {} : { gap: layout.size.gap }, bodyStyle]}>{children}</View>
            {hasContent(actions) && <View testID={part('actions')}
              style={[unstyled ? {} : { gap: layout.size.gap }, actionsStyle]}>{actions}</View>}
          </>)}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
