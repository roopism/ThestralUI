import { type TextInputProps, TextInput, useColorScheme, View, Text } from "react-native";
import { type Ref, type ComponentRef, useId } from "react";
import { tokens } from "@ui-lazy-dev/tokens";
import type { ResolvedTokens } from "@ui-lazy-dev/tokens/modes";
import { NativeFieldControl } from "./control.js";
export interface FormFieldProps extends TextInputProps {
  /** Tokens resolved for the surrounding theme. Defaults to the device scheme. */
  theme?: ResolvedTokens;
  label: string;
  hint?: string;
  error?: string;
  ref?: Ref<ComponentRef<typeof TextInput>>;
}
export function FormField({ theme: selectedTheme, label, hint, error, accessibilityHint, style, ref, ...input }: FormFieldProps) {
  const titleId = useId();
  const scheme = useColorScheme();
  const theme = selectedTheme?.color ?? (scheme === 'dark' ? tokens.dark : tokens.light);
  const layout = selectedTheme ?? tokens;
  const minHeight = layout.density.coarseTarget >= layout.size.control
    ? layout.density.coarseTarget : layout.size.control;
  const description = [hint, error, accessibilityHint].filter(Boolean).join(' ');
  return (
    <View style={{ gap: layout.size.gap }}>
      <Text nativeID={titleId} style={{ color: theme.text }}>{label}</Text>
      <NativeFieldControl {...input} ref={ref} accessibilityLabel={label} accessibilityLabelledBy={titleId}
        accessibilityHint={description || undefined} placeholderTextColor={input.placeholderTextColor ?? theme.muted}
        style={[{ color: theme.text, backgroundColor: theme.surface, minHeight,
          borderColor: error ? theme.danger : theme.border, borderWidth: 1, borderRadius: layout.size.radius,
          paddingHorizontal: layout.size.gap }, style]} />
      {hint ? <Text style={{ color: theme.muted }}>{hint}</Text> : null}
      {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: theme.danger }}>{error}</Text> : null}
    </View>
  );
}
