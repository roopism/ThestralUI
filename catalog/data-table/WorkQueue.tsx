import { useEffect, useState } from 'react';
import { Button } from '@ui-lazy-dev/ui-web';
import { DataTable, type DataTableProps } from '@ui-lazy-dev/ui-web/data-table';
import '@ui-lazy-dev/ui-web/data-table.css';
import { firstQuery, initialTickets, pageSize, readPage, type Query, type Result, type Ticket } from './work-records';

export interface QueueSource {
  list: (query: Query, signal: AbortSignal) => Promise<Result>;
  save: (id: string, title: string) => Promise<Ticket>;
  archive: (ids: readonly string[]) => Promise<number>;
}
function localSource(rejectFirstSave: boolean): QueueSource {
  let records = [...initialTickets];
  return {
    async list(query) { return readPage(records, query); },
    async save(id, title) {
      if (rejectFirstSave) { rejectFirstSave = false; throw Error('The record was updated elsewhere'); }
      const saved = { ...records.find(record => record.id === id)!, title };
      records = records.map(record => record.id === id ? saved : record);
      return saved;
    },
    async archive(ids) {
      const previous = records.length;
      records = records.filter(record => !ids.includes(record.id));
      return previous - records.length;
    },
  };
}
export type QueueAppearance = Pick<DataTableProps<Ticket>, 'size' | 'layout' | 'disabled' | 'readOnly' | 'unstyled'>;
export function WorkQueue({ rejectFirstSave = false, createSource, ...appearance }: QueueAppearance & {
  rejectFirstSave?: boolean; createSource?: () => QueueSource;
} = {}) {
  const [source] = useState(() => createSource?.() ?? localSource(rejectFirstSave));
  const [state, setState] = useState<Query>(firstQuery);
  const [data, setData] = useState<Result>(() => readPage(initialTickets, firstQuery));
  const [selected, setSelected] = useState<string[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    let latest = true;
    setLoading(true); setError(false);
    source.list(state, controller.signal).then(result => {
      if (latest) setData(result);
    }).catch(() => { if (latest) setError(true); }).finally(() => { if (latest) setLoading(false); });
    return () => { latest = false; controller.abort(); };
  }, [source, state, refresh]);
  return <main className="catalog">
    <h1>Audit work queue</h1>
    <DataTable {...appearance} layout={appearance.layout ?? 'adaptive'} label="Audit records" rows={data.rows}
      columns={[
        { id: 'title', label: 'Title', value: row => row.title, onEdit: async (row, draft) => {
          const saved = await source.save(row.id, draft);
          setData(before => ({ ...before, rows: before.rows.map(item => item.id === saved.id ? saved : item) }));
          setMessage('Saved ' + saved.title); setRefresh(before => before + 1);
        } },
        { id: 'team', label: 'Team', value: row => row.team },
      ]}
      pageSize={pageSize} server={{ state, onStateChange: setState, totalRows: data.totalRows }}
      getRowLabel={row => row.title} selectedIds={selected} onSelectionChange={setSelected}
      loading={loading} error={error ? <Button unstyled type="button" onClick={() => setRefresh(before => before + 1)}>Retry loading records</Button> : undefined}
      bulkAction={{ label: 'Archive selected', onApply: async ids => {
        const count = await source.archive(ids);
        setSelected([]); setState(before => ({ ...before, page: 0 })); setMessage('Archived ' + count + ' records');
      } }} />
    <div role="status"><span>{message}</span></div>
  </main>;
}
