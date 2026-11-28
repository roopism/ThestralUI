import { type ComponentRef, type Ref, type ReactElement, useRef, useEffect, useState } from "react";
import { type PressableProps, type StyleProp, type ViewStyle, type TextStyle, View, useColorScheme, useAnimatedValue, AccessibilityInfo, ActivityIndicator, Animated, Platform, Pressable, Text } from "react-native";
import { tokens } from "@ui-lazy-dev/tokens";
import type { ResolvedTokens } from "@ui-lazy-dev/tokens/modes";
import { NativePressTarget } from "./press-target.js";
export interface ButtonProps {
  /** Tokens resolved for the surrounding theme. Defaults to the device scheme. */
  theme?: ResolvedTokens;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  /** A decorative icon replacing visible text. The label remains the accessible name. */
  icon?: ReactElement;
  startIcon?: ReactElement;
  endIcon?: ReactElement;
  /** Identifies the press target. Parts get `<testID>.<part>`: label, start-icon, end-icon, busy-indicator. */
  testID?: string;
  onPress: NonNullable<PressableProps['onPress']>;
  /** An operation is in progress. The button stays focusable, keeps its size and ignores presses. */
  busy?: boolean;
  disabled?: boolean;
  motion?: 'none' | 'press';
  tone?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
  /** Fill the width of the container. */
  fullWidth?: boolean;
  /** Keep the behaviour and accessibility, and apply no library styles or press feedback. */
  unstyled?: boolean;
  accessibilityHint?: string;
  /** Refers to the accessible press target. */
  ref?: Ref<ComponentRef<typeof Pressable>>;
  /** Styles the outer layout wrapper. */
  style?: StyleProp<ViewStyle>;
  /** Styles the press target after the tone, size and interaction defaults. */
  pressableStyle?: StyleProp<ViewStyle>;
  /** Styles the visible label after the tone defaults. */
  labelStyle?: StyleProp<TextStyle>;
}
export type UseButtonOptions = Pick<ButtonProps, 'label' | 'onPress' | 'accessibilityHint' | 'busy' | 'disabled'>;
export interface ButtonBehavior {
  buttonProps: Pick<PressableProps, 'focusable' | 'accessibilityRole' | 'accessibilityLabel' | 'accessibilityHint' | 'accessibilityState' | 'disabled'> & {
    onPress: NonNullable<PressableProps['onPress']>;
  };
}

/** Spread buttonProps on a Pressable to retain accessible button behaviour with custom visuals. */
export function useButton({ label, onPress, accessibilityHint, busy = false, disabled = false }: UseButtonOptions): ButtonBehavior {
  const inactive = disabled || busy;
  return {
    buttonProps: {
      focusable: !disabled,
      accessibilityRole: 'button',
      accessibilityLabel: label,
      accessibilityHint,
      accessibilityState: { busy, disabled: inactive },
      disabled: disabled || undefined,
      onPress(event) {
        if (!inactive) onPress(event);
      },
    },
  };
}

function decorativeIcon(graphic: ReactElement, testID?: string, hidden = false) {
  return (
    <View
      testID={testID}
      style={{ ...(hidden ? { opacity: 0 } : {}) }}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      focusable={false}
    >
      {graphic}
    </View>
  );
}
export function Button({
  theme,
  label,
  testID,
  size,
  icon,
  startIcon,
  endIcon,
  onPress,
  disabled = false,
  busy = false,
  motion,
  tone = 'primary',
  fullWidth = false,
  unstyled = false,
  accessibilityHint,
  ref,
  style,
  pressableStyle,
  labelStyle,
}: ButtonProps) {
  const scheme = useColorScheme();
  const colors = theme?.color ?? (scheme === 'dark' ? tokens.dark : tokens.light);
  const layout = theme ?? tokens;
  const scale = useAnimatedValue(1);
  const animate = useRef(false);
  const [highlighted, setHighlighted] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(true);
  const { buttonProps } = useButton({ label, onPress, accessibilityHint, disabled, busy });
  const feedback = !busy && !disabled && !unstyled;
  useEffect(() => {
    if (!busy && (motion !== 'press' || !feedback)) return;
    let awaitingInitial = true;
    function apply(reduce: boolean) {
      awaitingInitial = false;
      animate.current = !reduce && feedback && motion === 'press';
      setReduceMotion(reduce);
      if (reduce) scale.setValue(1);
    }
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', apply);
    // A setting change can arrive before the initial asynchronous read resolves.
    void AccessibilityInfo.isReduceMotionEnabled().then(
      (reduce) => {
        if (awaitingInitial) apply(reduce);
      },
      () => {
        // Leave feedback disabled when the OS preference cannot be read.
      },
    );
    return () => {
      subscription.remove();
      apply(true);
    };
  }, [busy, motion, feedback, scale]);

  function press(pressed: boolean) {
    // iOS highlights a pressed control; Android draws its ripple instead.
    if (Platform.OS === 'ios') setHighlighted(feedback && pressed);
    if (animate.current) {
      Animated.timing(scale, {
        toValue: pressed ? layout.motion.pressScale : 1,
        duration: layout.motion.pressDuration,
        useNativeDriver: true,
      }).start();
    }
  }
  const primary = tone === 'primary';
  const danger = tone === 'danger';
  const link = tone === 'link';
  const quiet = tone === 'ghost' || link;
  const labelColor = primary || danger
    ? colors.onAccent
    : link
      ? colors.accent
      : colors.text;
  const target = size === 'lg' ? layout.density.largeTarget : layout.density.coarseTarget;
  const horizontalPadding =
    size === 'sm'
      ? layout.space.spaceSm
      : size === 'lg'
        ? layout.space.spaceLg
        : layout.space.spaceMd;
  const showBusyIndicator = busy && !unstyled;
  const part = (name: string) => testID && testID + '.' + name;
  return (
    <Animated.View style={[{ transform: [{ scale }], ...(fullWidth ? { alignSelf: 'stretch' } : {}) }, style]}>
      <NativePressTarget
        ref={ref}
        testID={testID}
        {...buttonProps}
        accessibilityRole="button"
        accessibilityLabel={label}
        android_ripple={feedback ? { foreground: true, borderless: false } : undefined}
        onPressIn={() => press(true)}
        onPressOut={() => press(false)}
        style={[{
          ...(unstyled
            ? {}
            : {
                alignItems: 'center',
                justifyContent: 'center',
                ...(startIcon || endIcon
                  ? { flexDirection: 'row', gap: layout.space.spaceSm }
                  : {}),
                minHeight: target,
                minWidth: target,
                ...(icon ? { width: target, height: target } : {}),
                paddingHorizontal: icon ? 0 : horizontalPadding,
                paddingVertical: layout.size.gap,
                borderRadius: layout.size.radius,
                borderWidth: 1,
                borderColor: primary
                  ? colors.accent
                  : danger
                    ? colors.danger
                    : quiet
                      ? 'transparent'
                      : colors.border,
                backgroundColor: primary
                  ? colors.accent
                  : danger
                    ? colors.danger
                    : quiet
                      ? 'transparent'
                      : colors.surface,
                opacity: highlighted ? layout.motion.pressOpacity : disabled ? 0.62 : 1,
              }),
        }, pressableStyle]}
      >
        {icon ? (
          decorativeIcon(icon, part('icon'), showBusyIndicator)
        ) : (
          <>
            {startIcon && decorativeIcon(startIcon, part('start-icon'), showBusyIndicator)}
            <Text
              testID={part('label')}
              style={[{
                ...(unstyled
                  ? {}
                  : {
                      color: labelColor,
                      fontWeight: '600',
                      ...(link ? { textDecorationLine: 'underline' } : {}),
                    }),
              }, labelStyle, showBusyIndicator ? { opacity: 0 } : {}]}
            >
              {label}
            </Text>
            {endIcon && decorativeIcon(endIcon, part('end-icon'), showBusyIndicator)}
          </>
        )}
        {busy && (
          <View
            testID={part('busy-indicator')}
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
            style={{ ...(unstyled ? {} : { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'center' }) }}
          >
            {showBusyIndicator && (reduceMotion ? (
              <View testID={part('busy-static')} style={{
                alignSelf: 'center', width: layout.space.spaceMd, height: layout.space.spaceMd,
                borderWidth: layout.shape.indicatorStroke, borderRadius: layout.shape.radiusLg,
                borderColor: labelColor,
              }} />
            ) : <ActivityIndicator color={labelColor} />)}
          </View>
        )}
      </NativePressTarget>
    </Animated.View>
  );
}
