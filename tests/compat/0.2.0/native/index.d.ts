import { type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
export interface ButtonProps {
    label: string;
    onPress: NonNullable<PressableProps['onPress']>;
    busy?: boolean;
    disabled?: boolean;
    motion?: 'none' | 'press';
    tone?: 'primary' | 'secondary';
    accessibilityHint?: string;
    style?: StyleProp<ViewStyle>;
}
export declare function Button({ label, onPress, disabled, busy, motion, tone, accessibilityHint, style, }: ButtonProps): import("react").JSX.Element;
