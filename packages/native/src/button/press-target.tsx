import type { ComponentRef, Ref } from 'react';
import { Pressable, type AccessibilityState, type PressableProps } from 'react-native';

type CommonState = Omit<AccessibilityState, 'checked'>;
type TargetSemantics =
  | { accessibilityRole: 'button'; accessibilityState?: CommonState }
  | { accessibilityRole: 'checkbox'; accessibilityState: CommonState & { checked: boolean | 'mixed' } };

type NativePressTargetProps = Omit<PressableProps, 'accessibilityLabel' | 'accessibilityRole' | 'accessibilityState'> & TargetSemantics & {
  accessibilityLabel: string;
  ref?: Ref<ComponentRef<typeof Pressable>>;
};

/** Private native host shared by buttons and composite controls that expose their own explicit role. */
export function NativePressTarget(props: NativePressTargetProps) {
  return <Pressable {...props} />;
}
