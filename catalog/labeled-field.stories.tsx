import type { Meta, StoryObj } from '@storybook/react-vite';
import { FieldExample } from './examples';
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

export const Field: Story = { render: FieldExample };
