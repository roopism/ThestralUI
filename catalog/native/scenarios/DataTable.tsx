import { useRef, useState } from 'react';
import { Button } from '@ui-lazy-dev/ui-native';
import { DataTable, type DataColumn, type DataTablePart, type DataTablePartContext, type DataTableState } from '@ui-lazy-dev/ui-native/data-table';
import { ScenarioSurface, ScenarioText } from './presentation';

interface Ticket { id: string; title: string; owner: string }
const queue: Ticket[] = [
  { id: 'a', title: 'Gamma', owner: 'Operations' }, { id: 'b', title: 'Beta', owner: 'Support' },
  { id: 'c', title: 'Alpha', owner: 'Finance' },
];
const initialWork: Ticket[] = [
  { id: 't17', title: 'Atlas audit', owner: 'Jules' }, { id: 't24', title: 'Birch audit', owner: 'Mira' },
  { id: 't35', title: 'Cedar audit', owner: 'Sol' },
];
const name = (row: Ticket) => row.title;
function scenarioPart(part: DataTablePart, context: DataTablePartContext) {
  if (!context.name) return;
  const role = part === 'status' && context.action === 'failure' ? 'alert' : part === 'selection' ? 'checkbox' : part === 'status' || (part === 'cell' && !context.action) ? 'text' : 'button';
  return 'scenario.' + role + '.' + context.name;
}
const names: DataColumn<Ticket>[] = [{ id: 'title', label: 'Name', value: name }];
export function Queue() {
  return <DataTable label="Queue" rows={queue} columns={names} getRowLabel={name} getPartTestID={scenarioPart}
    bulkAction={{ label: 'Archive selected', onApply() {} }} />;
}

export function WorkQueue() {
  const [rows, setRows] = useState(initialWork);
  const [state, setState] = useState<DataTableState>({ query: '', sort: null, page: 0 });
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([]);
  const [notice, setNotice] = useState('');
  const failedOnce = useRef(false);
  // The fixture acts as the server: only the returned page is ever supplied to DataTable.
  const matched = rows.filter(row => [row.title, row.owner].some(s => s.toLocaleLowerCase().includes(state.query.toLocaleLowerCase())));
  if (state.sort) {
    const { column, ascending } = state.sort;
    matched.sort((a,b) => (column === 'owner' ? a.owner.localeCompare(b.owner) : a.title.localeCompare(b.title)) * (ascending ? 1 : -1));
  }
  const columns: DataColumn<Ticket>[] = [
    { id: 'title', label: 'Title', value: name, async onEdit(row, draft) {
      if (!failedOnce.current) { failedOnce.current = true; throw Error('Temporary save failure'); }
      setRows(before => before.map(item => item.id === row.id ? { ...item, title: draft } : item));
      setNotice('Saved ' + draft);
    } },
    { id: 'owner', label: 'Owner', value: row => row.owner },
  ];
  return <ScenarioSurface>
    {notice !== '' && <ScenarioText accessibilityLiveRegion="polite" testID={'scenario.text.' + notice}>{notice}</ScenarioText>}
    <DataTable label="Work queue" rows={matched.slice(state.page * 2, (state.page + 1) * 2)} columns={columns}
      server={{ state, totalRows: matched.length, onStateChange: setState }} pageSize={2} getRowLabel={name}
      selectedIds={selectedIds} onSelectionChange={setSelectedIds} getPartTestID={scenarioPart}
      bulkAction={{ label: 'Archive selected', onApply(ids) {
        setRows(before => before.filter(row => !ids.includes(row.id)));
        setSelectedIds([]);
        setState(current => ({ ...current, page: 0 }));
        setNotice('Archived ' + ids.length + (ids.length === 1 ? ' record' : ' records'));
      } }} />
  </ScenarioSurface>;
}


export function EmptyQueue() {
  const [unassigned, setUnassigned] = useState(false);
  const visible = unassigned ? initialWork.filter(ticket => ticket.owner === '') : initialWork;
  return <ScenarioSurface>
    <Button label="Show unassigned" testID="scenario.button.Show unassigned" onPress={() => setUnassigned(true)} />
    <DataTable label="Assigned work" rows={visible} columns={names}
      getRowLabel={name} getPartTestID={scenarioPart} />
  </ScenarioSurface>;
}

export function EditQueue() {
  const [ticket, setTicket] = useState(initialWork[0]);
  const [accepted, setAccepted] = useState('');
  const [transport, setTransport] = useState<{resolve: () => void; reject: () => void} | null>(null);
  const columns: DataColumn<Ticket>[] = [{ id:'title', label:'Title', value:name, async onEdit(row, draft) {
    await new Promise<void>((resolve, reject) => setTransport({resolve, reject:() => reject(Error('Offline'))}));
    setTicket({...row,title:draft});
    setAccepted('Saved ' + draft);
  } }];
  return <ScenarioSurface>
    {transport && <ScenarioSurface>
      <ScenarioText testID="scenario.text.Waiting for connection">Waiting for connection</ScenarioText>
      <Button label="Work offline" testID="scenario.button.Work offline" onPress={() => { transport.reject(); setTransport(null); }} />
      <Button label="Reconnect" testID="scenario.button.Reconnect" onPress={() => { transport.resolve(); setTransport(null); }} />
    </ScenarioSurface>}
    {accepted !== '' && <ScenarioText testID={'scenario.text.' + accepted}>{accepted}</ScenarioText>}
    <DataTable label="Audit editor" rows={[ticket]} columns={columns} getRowLabel={name} getPartTestID={scenarioPart} />
  </ScenarioSurface>;
}
