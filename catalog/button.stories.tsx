import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@ui-lazy-dev/ui-web';
const meta = {
  title: 'Components',
  decorators: [
    (Story) => (
      <main className="catalog">
        <div className="specimen">
          <Story />
        </div>
      </main>
    ),
  ],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Actions: Story = {
  render: () => (
    <div className="actions">
      <Button>Primary</Button>
      <Button tone="secondary">Secondary</Button>
      <Button busy>Saving</Button>
    </div>
  ),
};
