import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export interface DataColumn<R> {
  id: string;
  label: string;
  value: (row: R) => string | number;
  render?: (row: R) => ReactNode;
  onEdit?: (row: R, draft: string) => void | Promise<void>;
}
export interface DataTableSort { column: string; ascending: boolean }
export interface DataTableState { query: string; sort: DataTableSort | null; page: number }
export interface DataTableServer {
  state: DataTableState;
  totalRows: number;
  onStateChange: (state: DataTableState) => void;
}
export interface UseDataTableOptions<R extends { id: string }> {
  rows: readonly R[];
  columns: readonly DataColumn<R>[];
  locale?: string;
  pageSize?: number;
  defaultSort?: DataTableSort;
  server?: DataTableServer;
  selectedIds?: readonly string[];
  defaultSelectedIds?: readonly string[];
  onSelectionChange?: (ids: string[]) => void;
  onSearchChange?: (query: string) => void;
  onSortChange?: (sort: DataTableSort) => void;
  onPageChange?: (page: number) => void;
}
export interface DataTableBehavior<R> {
  state: DataTableState;
  visible: readonly R[];
  pages: number;
  selectedIds: string[];
  selected: ReadonlySet<string>;
  allPage: boolean;
  somePage: boolean;
  search: (query: string) => void;
  sortBy: (column: string) => void;
  goToPage: (page: number) => void;
  select: (ids: readonly string[], checked: boolean) => void;
}

/** Remote rows already represent one server page. Only local collections are filtered, sorted, sliced or pruned. */
export function useDataTable<R extends { id: string }>({
  rows, columns, locale, pageSize = 25, defaultSort, server, selectedIds: controlled,
  defaultSelectedIds, onSelectionChange, onSearchChange, onSortChange, onPageChange,
}: UseDataTableOptions<R>): DataTableBehavior<R> {
  const [local, setLocal] = useState<DataTableState>(() => ({ query: '', sort: defaultSort ?? null, page: 0 }));
  const [localIds, setLocalIds] = useState<readonly string[]>(() => defaultSelectedIds ?? []);
  const pendingIds = useRef(localIds);
  const localState = useRef(local);
  const { query, sort, page } = server?.state ?? local;
  const remote = server !== undefined;
  const size = Number.isFinite(pageSize) ? Math.max(1, Math.floor(pageSize)) : 25;
  const localRows = useMemo(() => {
    if (remote) return rows;
    const normalize = (text: string) => text.normalize('NFC').toLocaleLowerCase(locale);
    const needle = normalize(query.trim());
    const matches = needle ? rows.filter(row => columns.some(column => normalize(String(column.value(row))).includes(needle))) : rows;
    const column = columns.find(entry => entry.id === sort?.column);
    if (!sort || !column) return matches;
    const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
    return [...matches].sort((a, b) => {
      const x = column.value(a), y = column.value(b);
      if (Number.isNaN(x)) return Number.isNaN(y) ? 0 : 1;
      if (Number.isNaN(y)) return -1;
      return (typeof x === 'number' && typeof y === 'number' ? x - y : collator.compare(String(x), String(y))) * (sort.ascending ? 1 : -1);
    });
  }, [remote, rows, columns, locale, query, sort]);
  const pages = Math.max(1, Math.ceil((server?.totalRows ?? localRows.length) / size));
  const effectivePage = (value: number) => remote ? value : Math.min(value, pages - 1);
  const current = effectivePage(page);
  const visible = remote ? rows : localRows.slice(current * size, (current + 1) * size);
  const valid = useMemo(() => remote ? undefined : new Set(rows.map(row => row.id)), [remote, rows]);
  useEffect(() => {
    if (!valid || controlled !== undefined) return;
    const before = pendingIds.current;
    const kept = before.filter(id => valid.has(id));
    if (kept.length !== before.length) {
      pendingIds.current = kept;
      setLocalIds(kept);
    }
  }, [valid, controlled]);
  const selected = new Set((controlled ?? localIds).filter(id => !valid || valid.has(id)));
  const state = { query, sort, page: current };
  function change(next: DataTableState) {
    if (server) server.onStateChange(next);
    else { localState.current = next; setLocal(next); }
  }
  return {
    state, visible, pages, selected, selectedIds: [...selected],
    allPage: visible.length > 0 && visible.every(row => selected.has(row.id)),
    somePage: visible.some(row => selected.has(row.id)),
    search(value) {
      const previous = server?.state ?? localState.current;
      if (value === previous.query) return;
      change({ ...previous, query: value, page: 0 });
      onSearchChange?.(value);
      if (effectivePage(previous.page) !== 0) onPageChange?.(0);
    },
    sortBy(column) {
      const previous = server?.state ?? localState.current;
      const next = { column, ascending: previous.sort?.column === column ? !previous.sort.ascending : true };
      change({ ...previous, sort: next, page: 0 });
      onSortChange?.(next);
      if (effectivePage(previous.page) !== 0) onPageChange?.(0);
    },
    goToPage(value) {
      if (!Number.isFinite(value)) return;
      const next = Math.min(pages - 1, Math.max(0, Math.trunc(value)));
      const previous = server?.state ?? localState.current;
      if (next === effectivePage(previous.page)) return;
      change({ ...previous, page: next });
      onPageChange?.(next);
    },
    select(ids, checked) {
      const next = new Set((controlled ?? pendingIds.current).filter(id => !valid || valid.has(id)));
      for (const id of ids) {
        if (!checked) next.delete(id);
        else if (!valid || valid.has(id)) next.add(id);
      }
      const list = [...next];
      if (controlled === undefined) { pendingIds.current = list; setLocalIds(list); }
      onSelectionChange?.(list);
    },
  };
}
