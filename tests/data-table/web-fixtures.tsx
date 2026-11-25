import { useRef, useState } from 'react';
import { Dialog } from '@ui-lazy-dev/ui-web/dialog';
import { EditQueue, EmptyQueue } from '../../catalog/data-table/StateExamples';
import { WorkQueue, type QueueSource } from '../../catalog/data-table/WorkQueue';
import { DataTable } from '@ui-lazy-dev/ui-web/collections';
import '@ui-lazy-dev/ui-web/collections.css';

function httpSource(): QueueSource {
  async function send<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(path, options);
    if (!response.ok) throw Error('Request failed with status ' + response.status);
    return response.json() as Promise<T>;
  }
  const json = (method: string, value: unknown) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
  return {
    list(query, signal) {
      const params = new URLSearchParams({ q: query.query, page: String(query.page) });
      if (query.sort) { params.set('sort', query.sort.column); params.set('asc', String(query.sort.ascending)); }
      // The delayed fixture emulates a transport that finishes after cancellation.
      return send('/records?' + params, query.query === 'slow' ? undefined : { signal });
    },
    save(id, title) { return send('/records/' + encodeURIComponent(id), json('PATCH', { title })); },
    archive(ids) { return send('/archive', json('POST', { ids })); },
  };
}
function HttpWorkQueue() { return <WorkQueue createSource={httpSource} />; }

type Item = { id: string; title: string; state: string; score: number };
const rows: Item[] = [
  { id: 'a', title: 'Gamma', state: 'Open', score: 2 },
  { id: 'b', title: 'Beta', state: 'Closed', score: 11 },
  { id: 'c', title: 'Alpha', state: 'Held', score: 9 },
];

function Queue() {
  return (
    <DataTable
      label="Queue"
      rows={rows}
      getRowLabel={(row) => row.title}
      columns={[
        {
          id: 'name',
          label: 'Name',
          value: (row) => row.title,
          render: (row) => (
            <>
              <span>{row.title}</span> <span>{row.state}</span>
            </>
          ),
        },
        { id: 'score', label: 'Score', value: (row) => row.score },
      ]}
      bulkAction={{ label: 'Archive', onApply: () => undefined }}
    />
  );
}

function ControlledSelection() {
  const proposal = useRef<HTMLOutputElement>(null);
  return <>
    <DataTable label="Controlled queue" getRowLabel={row => row.title} rows={rows}
      columns={[{ id: 'name', label: 'Name', value: row => row.title }]}
      selectedIds={['a']} onSelectionChange={ids => { if (proposal.current) proposal.current.value = ids.join(','); }} />
    <output ref={proposal} aria-label="Proposed IDs" />
  </>;
}

function ReviewTable() {
  const [open, setOpen] = useState(true);
  const [records, setRecords] = useState(rows);
  return <Dialog open={open} onDismiss={() => setOpen(false)} labelledBy="review-title">
    <h2 id="review-title">Review</h2>
    <DataTable label="Queue" rows={records} getRowLabel={row => row.title}
      columns={[{ id: 'title', label: 'Title', value: row => row.title, onEdit: () => undefined }]} />
    <button type="button" onClick={() => setRecords(records.slice(1))}>Remove first record</button>
  </Dialog>;
}

export { Queue };
export const fixtures = { queue: Queue, 'review-table': ReviewTable, 'controlled-selection': ControlledSelection, 'work-queue': WorkQueue, 'http-work-queue': HttpWorkQueue, 'edit-queue': EditQueue, 'empty-queue': EmptyQueue };
