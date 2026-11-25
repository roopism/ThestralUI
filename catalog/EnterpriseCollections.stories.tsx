import type { Meta, StoryObj } from '@storybook/react-vite';
import { VirtualDataGrid, VirtualTree } from '@ui-lazy-dev/ui-web/collections';
import '@ui-lazy-dev/ui-web/collections.css';
import { events } from './collection-events';
const meta = { title: 'Enterprise/Collections' } satisfies Meta;
export default meta;
const teams = Array.from({ length: 2000 }, (_, i) => ({
  id: String(i + 1),
  label: 'Team ' + (i + 1),
  children: [{ id: 'member-' + i, label: 'Team ' + (i + 1) + ' member' }],
}));
const columns = [
  { id: 'name', label: 'Activity', render: (row: (typeof events)[number]) => row.name },
  {
    id: 'duration',
    label: 'Duration (ms)',
    render: (row: (typeof events)[number]) => row.duration,
  },
];

export const Virtual: StoryObj<typeof meta> = {
  render: () => (
    <main>
      <h1>Operations</h1>
      <h2>Activity log</h2>
      <VirtualDataGrid
        label="Activity log"
        rows={events}
        columns={columns}
        selectionMode="single"
      />
      <h2>Teams</h2>
      <VirtualTree label="Teams" items={teams} selectionMode="single" />
    </main>
  ),
};
