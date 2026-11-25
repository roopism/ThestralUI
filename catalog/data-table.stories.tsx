import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { EditQueue, EmptyQueue } from './data-table/StateExamples';
import { WorkQueue, type QueueAppearance } from './data-table/WorkQueue';
import { DataTable } from '@ui-lazy-dev/ui-web/collections';
import '@ui-lazy-dev/ui-web/collections.css';
import { events } from './collection-events';
const meta = { title: 'Enterprise/Collections' } satisfies Meta;
export default meta;

export const Editable: StoryObj<typeof meta> = {
  render: function Queue() {
    const [rows, setRows] = useState(events.slice(0, 24));
    return (
      <main>
        <h1>Activity review</h1>
        <DataTable
          label="Review queue"
          rows={rows}
          getRowLabel={(row) => row.name}
          pageSize={5}
          columns={[
            {
              id: 'name',
              label: 'Activity',
              value: (row) => row.name,
              onEdit: (record, value) =>
                setRows((before) =>
                  before.map((row) => (row.id === record.id ? { ...row, name: value } : row)),
                ),
            },
            { id: 'duration', label: 'Duration (ms)', value: (row) => row.duration },
          ]}
          bulkAction={{
            label: 'Archive selected',
            onApply: (ids) => setRows((before) => before.filter((row) => !ids.includes(row.id))),
          }}
        />
      </main>
    );
  },
};

export const AuditQueue: StoryObj<QueueAppearance & { rejectFirstSave: boolean }> = {
  args: { layout: 'adaptive', size: 'md', disabled: false, readOnly: false, unstyled: false, rejectFirstSave: false },
  argTypes: { layout: { control: 'select', options: ['adaptive', 'table'] }, size: { control: 'select', options: ['sm', 'md', 'lg'] } },
  render: args => <WorkQueue {...args} />,
};

export const EmptyAssignments: StoryObj<typeof meta> = { render: () => <EmptyQueue /> };
export const OfflineEditing: StoryObj<typeof meta> = { render: () => <EditQueue /> };
