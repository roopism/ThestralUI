import type { Preview } from '@storybook/react-vite';
import { createElement, Fragment } from 'react';
import { ModeProvider } from '@ui-lazy-dev/ui-web/modes';
import { createContextCSS } from '@ui-lazy-dev/tokens/theme-css';
import type { ContextDefinition, ModeSelection } from '@ui-lazy-dev/tokens/modes';
import reading from '../catalog/modes/reading.json';
import '@ui-lazy-dev/ui-web/styles.css';
import '@ui-lazy-dev/tokens/modes.css';
import '@ui-lazy-dev/tokens/brands/enterprise.css';
import '@ui-lazy-dev/tokens/brands/expressive.css';
import '../catalog/catalog.css';

const readingCSS = createContextCSS(reading as ContextDefinition);
const axes = {
  brand: ['enterprise', 'expressive'],
  scheme: ['light', 'dark', 'high-contrast'],
  density: ['compact', 'comfortable', 'spacious'],
  motion: ['system', 'full', 'reduced'],
  mode: ['default', 'reading'],
};
const defaults = { brand: 'enterprise', scheme: 'light', density: 'comfortable', motion: 'system', mode: 'default' };
const preview: Preview = {
  initialGlobals: defaults,
  globalTypes: Object.fromEntries(Object.entries(axes).map(([name, items]) =>
    [name, { description: name, toolbar: { title: name, items, dynamicTitle: true } }])),
  decorators: [(Story, { globals }) => {
    const selection = Object.fromEntries(Object.entries(axes)
      .map(([axis, values]) => [axis, values.includes(globals[axis]) ? globals[axis] : defaults[axis as keyof typeof defaults]])
      .filter(([, value]) => value !== 'system')) as ModeSelection;
    return createElement(Fragment, null, createElement('style', null, readingCSS),
      createElement(ModeProvider, selection, createElement(Story)));
  }],
  parameters: {
    layout: 'fullscreen',
    options: { storySort: { order: ['Library', 'Components'] } },
  },
};
export default preview;
