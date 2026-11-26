import { type TextInputProps, TextInput, useColorScheme, View, Text } from "react-native";
import { type Ref, type ComponentRef, useId } from "react";
import { tokens } from "@ui-lazy-dev/tokens";
import { NativeFieldControl } from "./control.js";
export interface FormFieldProps extends TextInputProps {
  label: string;
  hint?: string;
  error?: string;
  ref?: Ref<ComponentRef<typeof TextInput>>;
}
export function FormField({ label, hint, error, accessibilityHint, style, ref, ...input }: FormFieldProps) {
  const titleId = useId();
  const theme = useColorScheme() === 'dark' ? tokens.dark : tokens.light;
  const minHeight = tokens.density.coarseTarget >= tokens.size.control
    ? tokens.density.coarseTarget : tokens.size.control;
  const description = [hint, error, accessibilityHint].filter(Boolean).join(' ');
  return (
    <View style={{ gap: tokens.size.gap }}>
      <Text nativeID={titleId} style={{ color: theme.text }}>{label}</Text>
      <NativeFieldControl {...input} ref={ref} accessibilityLabel={label} accessibilityLabelledBy={titleId}
        accessibilityHint={description || undefined} placeholderTextColor={input.placeholderTextColor ?? theme.muted}
        style={[{ color: theme.text, backgroundColor: theme.surface, minHeight,
          borderColor: error ? theme.danger : theme.border, borderWidth: 1, borderRadius: tokens.size.radius,
          paddingHorizontal: tokens.size.gap }, style]} />
      {hint ? <Text style={{ color: theme.muted }}>{hint}</Text> : null}
      {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: theme.danger }}>{error}</Text> : null}
    </View>
  );
}
