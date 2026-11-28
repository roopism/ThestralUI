import { mergeConfig } from 'vite';
import type { StorybookConfig } from '@storybook/react-vite';
const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  viteFinal: async config => mergeConfig(config, { resolve: { dedupe: ['react', 'react-dom'] } }),
  stories: ['../catalog/**/*.stories.tsx'],
  core: { disableTelemetry: true },
};
export default config;
