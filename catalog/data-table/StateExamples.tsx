import { useRef, useState } from 'react';
import { Button } from '@ui-lazy-dev/ui-web';
import { DataTable } from '@ui-lazy-dev/ui-web/data-table';
import '@ui-lazy-dev/ui-web/data-table.css';
import { firstQuery, initialTickets, pageSize, readPage, type Query, type Ticket } from './work-records';

const getRowLabel = (row: Ticket) => row.title;
const titleColumn = { id: 'title', label: 'Title', value: getRowLabel };

export function EmptyQueue() {
  const [state, setState] = useState<Query>(firstQuery);
  const page = readPage(initialTickets, state);
  return <main className="catalog"><h1>Assignment review</h1>
    <DataTable label="Assignments" rows={page.rows} columns={[titleColumn]} pageSize={pageSize} getRowLabel={getRowLabel}
      server={{ state, totalRows: page.totalRows, onStateChange: setState }}
      toolbar={<Button unstyled type="button" onClick={() => setState({ ...state, query: 'unassigned', page: 0 })}>Show unassigned</Button>} />
  </main>;
}

export function EditQueue() {
  const [row, setRow] = useState(initialTickets[0]);
  const [waiting, setWaiting] = useState(false);
  const [offline, setOffline] = useState(false);
  const [notice, setNotice] = useState('');
  const pending = useRef<{ resolve: () => void; reject: (cause: Error) => void } | null>(null);
  return <main className="catalog"><h1>Offline review</h1>
    <DataTable label="Drafts" rows={[row]} getRowLabel={getRowLabel} columns={[{ ...titleColumn, onEdit: async (_, title) => {
      setWaiting(true); setNotice('Waiting for connection');
      await new Promise<void>((resolve, reject) => { pending.current = { resolve, reject }; });
      setRow(before => ({ ...before, title })); setNotice('Saved ' + title);
    } }]} />
    {waiting && <Button unstyled type="button" onClick={() => {
      const request = pending.current;
      pending.current = null; setWaiting(false);
      if (offline) { setOffline(false); request?.resolve(); }
      else { setOffline(true); setNotice(''); request?.reject(Error('Connection lost')); }
    }}>{offline ? 'Reconnect' : 'Work offline'}</Button>}
    <div role="status"><span>{notice}</span></div>
  </main>;
}
