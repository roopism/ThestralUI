import { Text, View, useColorScheme, type TextProps, type ViewProps } from 'react-native';
import { tokens } from '@ui-lazy-dev/tokens';

interface SurfaceProps extends Omit<ViewProps, 'style'> {
  horizontal?: boolean;
}

export function ScenarioSurface({ horizontal = false, ...props }: SurfaceProps) {
  const dark = useColorScheme() === 'dark';
  return <View {...props} style={{
    backgroundColor: dark ? tokens.dark.canvas : tokens.light.canvas,
    flexDirection: horizontal ? 'row' : 'column',
    alignItems: 'stretch',
  }} />;
}

export function ScenarioText(props: Omit<TextProps, 'style'>) {
  const dark = useColorScheme() === 'dark';
  return <Text {...props} style={{ color: dark ? tokens.dark.text : tokens.light.text }} />;
}
