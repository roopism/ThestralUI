import type { StoryObj } from '@storybook/react-vite';
import { Badge, Inline, Stack, Surface } from '@ui-lazy-dev/ui-web/primitives';
import '@ui-lazy-dev/ui-web/styles.css';
import '@ui-lazy-dev/ui-web/primitives.css';

export default { title: 'Layout/Responsive panels' };

export const ReviewDetails: StoryObj = {
  render: () => (
    <main className="catalog">
      <h1>Review details</h1>
      <p>Resize the panel to see its spacing change independently of the page.</p>
      <Surface style={{ containerType: 'inline-size', resize: 'horizontal', overflow: 'auto' }}>
        <Stack gap={{ base: 'xs', wide: 'lg' }} align="start">
          <h2>Document collection</h2>
          <Inline gap={{ base: 'xs', wide: 'md' }} align="center" justify="start" wrap>
            <Badge>Identity verified</Badge>
            <Badge>Reference pending</Badge>
            <Badge>Portfolio approved</Badge>
          </Inline>
        </Stack>
      </Surface>
    </main>
  ),
};
