export interface Ticket { id: string; title: string; team: string; category: string }
export interface Query { query: string; sort: { column: string; ascending: boolean } | null; page: number }
export interface Result { rows: Ticket[]; totalRows: number }
export const initialTickets: Ticket[] = [
  { id: 't17', title: 'Atlas audit', team: 'North', category: 'finance' },
  { id: 't29', title: 'Birch review', team: 'West', category: 'operations' },
  { id: 't35', title: 'Cedar audit', team: 'South', category: 'finance' },
  { id: 't41', title: 'Delta review', team: 'East', category: 'operations' },
];
export const pageSize = 2;
export const firstQuery: Query = { query: '', sort: null, page: 0 };

export function readPage(records: readonly Ticket[], state: Query): Result {
  const query = state.query.trim().toLowerCase();
  const matches = records.filter(record => [record.title, record.team, record.category].some(value => value.toLowerCase().includes(query)));
  if (state.sort) {
    const key = state.sort.column === 'team' ? 'team' : 'title';
    const direction = state.sort.ascending ? 1 : -1;
    matches.sort((a, b) => a[key].localeCompare(b[key], 'en') * direction);
  }
  return { rows: matches.slice(state.page * pageSize, (state.page + 1) * pageSize), totalRows: matches.length };
}
