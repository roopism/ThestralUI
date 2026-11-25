import type { ComponentRef, Ref } from 'react';
import { TextInput, type TextInputProps } from 'react-native';

interface FieldControlProps extends TextInputProps {
  ref?: Ref<ComponentRef<typeof TextInput>>;
}

/** Shared native input host. Each owning field supplies its accessible name and its presentation. */
export function NativeFieldControl(props: FieldControlProps) {
  return <TextInput {...props} />;
}
