'use client';
import { useId, useLayoutEffect, useReducer, useRef, useState, type ComponentPropsWithRef, type ReactNode } from 'react';
import { ButtonTarget, useButton } from '../button/binding.js';
import { SelectionCheckbox, TableField } from './controls.js';
import { useDataTable, type DataColumn, type UseDataTableOptions } from './state.js';
export type { DataColumn } from './state.js';
export const english = {
  search: 'Search records',
  viewport: 'Table contents',
  loading: 'Loading records',
  bulkFailed: 'Could not apply changes. Try again.',
  selectPage: 'Select page',
  previous: 'Previous page',
  next: 'Next page',
  empty: 'No matching records',
  cancel: 'Cancel',
  save: 'Save',
  saveFailed: 'Could not save changes. Try again.',
  select: (name: string) => 'Select ' + name,
  edit: (column: string, name: string) => 'Edit ' + column + ', ' + name,
  page: (current: number, total: number) => 'Page ' + current + ' of ' + total,
  selected: (count: number) => count + ' selected',
};
export type DataTableLabels = typeof english;
type DataTableLabelOverrides = Partial<Omit<DataTableLabels, 'viewport'>> & { viewport?: string | undefined };
export interface DataTableProps<R extends { id: string }> extends UseDataTableOptions<R>, Omit<ComponentPropsWithRef<'section'>, 'children'> {
  label: string;
  getRowLabel: (row: R) => string;
  labels?: DataTableLabelOverrides;
  /** Returned promises lock the action until they settle; existing synchronous callbacks keep their return contract. */
  bulkAction?: { label: string; onApply: (rowIds: string[]) => void };
  unstyled?: boolean;
  layout?: 'table' | 'adaptive';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  error?: ReactNode;
  toolbar?: ReactNode;
  emptyState?: ReactNode;
  readOnly?: boolean;
  disabled?: boolean;
}
function TableAction({ busy, ...props }: ComponentPropsWithRef<'button'> & { busy?: boolean }) {
  return <ButtonTarget {...props} behavior={useButton({ ...props, busy })} />;
}

function useCellSaves(rows?: readonly { id: string }[]) {
  type Save = { id: string; draft: string | null };
  const [cells] = useState(() => new Map<string, Save>());
  const [, refresh] = useReducer((revision: number) => revision + 1, 0);

  useLayoutEffect(() => {
    if (!rows || !cells.size) return;
    const ids = new Set(rows.map(row => row.id));
    for (const [key, save] of cells) if (!ids.has(save.id)) cells.delete(key);
  }, [rows, cells]);

  function begin(key: string, id: string) {
    if (cells.get(key)?.draft === null) return;
    const save: Save = { id, draft: null };
    cells.set(key, save);
    refresh();
    return save;
  }
  return { cells, begin, refresh };
}

export function EditableCell<R extends { id: string }>({
  row,
  column,
  name,
  labels, disabled, busy, unstyled, saves,
}: {
  row: R;
  column: DataColumn<R>;
  name: string;
  labels: Pick<DataTableLabels, 'edit' | 'save' | 'cancel' | 'saveFailed'>;
  saves: ReturnType<typeof useCellSaves>;
  disabled?: boolean;
  busy?: boolean;
  unstyled?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const key = JSON.stringify([row.id, column.id]);
  const rejectedDraft = saves.cells.get(key)?.draft;
  const pending = rejectedDraft === null;
  const locked = disabled || busy;
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const restoreFocus = useRef(false);
  const ownsFocus = (control: HTMLElement | null | undefined = input.current?.form) =>
    control?.contains(control.ownerDocument.activeElement) === true;
  useLayoutEffect(() => () => {
    const control = trigger.current ?? input.current?.form;
    if (control && ownsFocus(control)) {
      control.closest<HTMLElement>('[data-part="viewport"]')?.focus({ preventScroll: true });
    }
  }, []);
  useLayoutEffect(() => {
    if (draft === null && restoreFocus.current) {
      const button = trigger.current;
      if (button && button.ownerDocument.activeElement === button.ownerDocument.body) button.focus({ preventScroll: true });
      restoreFocus.current = false;
    }
  }, [draft]);
  const finish = () => {
    restoreFocus.current = ownsFocus();
    saves.cells.delete(key);
    setDraft(null);
  };
  const accessibleName = labels.edit(column.label, name);
  const error = typeof rejectedDraft === 'string' && <span role="alert" aria-label={labels.saveFailed}>{labels.saveFailed}</span>;
  if (draft === null)
    return (
      <><TableAction
        ref={trigger}
        aria-label={accessibleName}
        disabled={disabled}
        busy={busy || pending}
        data-part="edit"
        className={unstyled ? undefined : "uld-cell-edit"}
        onClick={() => {
          setDraft(rejectedDraft ?? String(column.value(row)));
        }}
      >
        {rejectedDraft ?? (column.render ? column.render(row) : column.value(row))}
      </TableAction>{error}</>
    );
  return (
    <form data-part="editor"
      onSubmit={async (event) => {
        event.preventDefault();
        if (locked) return;
        const save = saves.begin(key, row.id);
        if (!save) return;
        try {
          await column.onEdit!(row, draft);
          if (saves.cells.get(key) === save) finish();
        } catch {
          save.draft = draft;
          if (ownsFocus()) input.current?.focus({ preventScroll: true });
        }
        saves.refresh();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && saves.cells.get(key)?.draft !== null) {
          event.preventDefault();
          event.stopPropagation();
          finish();
        }
      }}
    >
      <TableField ref={input} type="text" autoFocus aria-label={accessibleName} value={draft}
        readOnly={pending || locked} onValueChange={setDraft} />
      <TableAction type="submit" disabled={locked} busy={pending}>
        {labels.save}
      </TableAction>
      <TableAction disabled={pending || locked} onClick={finish}>
        {labels.cancel}
      </TableAction>
      {error}
    </form>
  );
}
/** A semantic table with local collection processing or explicit server-owned pages. */
export function DataTable<R extends { id: string }>(props: DataTableProps<R>) {
  const model = useDataTable(props);
  const {
    label, rows, columns, getRowLabel, locale, labels: overrides, pageSize, bulkAction,
    defaultSort, server, selectedIds, defaultSelectedIds, onSelectionChange, onSearchChange, onSortChange, onPageChange,
    unstyled, layout = 'table', size, loading, error, toolbar, emptyState, readOnly, disabled, className, ...host
  } = props;
  const { state, visible, pages, selected } = model;
  const labels = { ...english, ...overrides };
  const id = useId();
  const applying = useRef(false);
  const saves = useCellSaves(server ? undefined : rows);
  const [pending, setPending] = useState(false);
  const [bulkFailed, setBulkFailed] = useState(false);
  const locked = disabled || loading || pending;
  const classes = (name: string) => unstyled ? undefined : name;
  const selectRows = bulkAction !== undefined || selectedIds !== undefined || defaultSelectedIds !== undefined || onSelectionChange !== undefined;
  async function apply() {
    if (!bulkAction || applying.current || !selected.size) return;
    applying.current = true;
    setBulkFailed(false);
    try {
      const run: (ids: string[]) => unknown = bulkAction.onApply;
      const result = run(model.selectedIds);
      if (result && typeof result === 'object' && 'then' in result) { setPending(true); await result; }
    } catch {
      setBulkFailed(true);
    } finally {
      applying.current = false;
      setPending(false);
    }
  }
  return <section {...host} data-uld-table="" data-part="root" data-layout={layout} data-size={size}
    className={[classes('uld-data'), className].filter(Boolean).join(' ') || undefined}>
    <div data-part="toolbar" className={classes('uld-data-tools')}>
      <label>{labels.search}
        <TableField type="search" data-part="search" aria-label={labels.search} value={state.query} aria-controls={id}
          disabled={disabled} onValueChange={model.search} />
      </label>
      {selectRows && <output data-part="selection">{labels.selected(selected.size)}</output>}
      {bulkAction && <TableAction data-part="bulk-action" disabled={locked || readOnly || !selected.size} onClick={apply}>{bulkAction.label}</TableAction>}
      {toolbar}
    </div>
    {(error || bulkFailed) && <div data-part="status" role="alert">{error || labels.bulkFailed}</div>}
    <div data-part="viewport" className={classes('uld-data-scroll')} role="group" aria-label={overrides?.viewport ?? english.viewport} tabIndex={0}>
      {loading && <span data-part="status" role="status">{labels.loading}</span>}
      <table data-part="table" id={id} role="table" aria-label={label} aria-busy={loading || undefined}>
        <thead data-part="header" role="rowgroup"><tr role="row">
          {selectRows && <th role="columnheader" scope="col">
            <SelectionCheckbox label={labels.selectPage} disabled={locked || !visible.length}
              checked={model.somePage && !model.allPage ? 'mixed' : model.allPage}
              onChange={checked => model.select(visible.map(row => row.id), checked)} />
          </th>}
          {columns.map(column => <th key={column.id} role="columnheader" scope="col"
            aria-sort={state.sort?.column === column.id ? (state.sort.ascending ? 'ascending' : 'descending') : undefined}>
            <TableAction data-part="sort" disabled={disabled} onClick={() => model.sortBy(column.id)}>{column.label}
              <span aria-hidden="true">{state.sort?.column === column.id ? (state.sort.ascending ? ' ↑' : ' ↓') : ' ↕'}</span>
            </TableAction>
          </th>)}
        </tr></thead>
        <tbody role="rowgroup">{visible.map(row => <tr key={row.id} role="row" data-part="row" data-row-id={row.id}>
          {selectRows && <td role="cell" data-part="cell"><SelectionCheckbox label={labels.select(getRowLabel(row))}
            checked={selected.has(row.id)} disabled={locked} onChange={checked => model.select([row.id], checked)} /></td>}
          {columns.map(column => <td role="cell" data-part="cell" key={column.id}>
            {layout === 'adaptive' && !unstyled && <span aria-hidden="true" className="uld-data-cell-label">{column.label}</span>}
            {column.onEdit && !readOnly ? <EditableCell row={row} column={column} labels={labels} name={getRowLabel(row)} disabled={disabled} busy={loading || pending} unstyled={unstyled} saves={saves} />
              : column.render ? column.render(row) : column.value(row)}
          </td>)}
        </tr>)}
          {!visible.length && !loading && <tr role="row"><td role="cell" colSpan={columns.length + Number(selectRows)}>{emptyState ?? <span data-part="status" role="status">{labels.empty}</span>}</td></tr>}
        </tbody>
      </table>
    </div>
    <div data-part="pagination" className={classes('uld-data-pages')}>
      <TableAction disabled={disabled || state.page <= 0} onClick={() => model.goToPage(state.page - 1)}>{labels.previous}</TableAction>
      <output>{labels.page(state.page + 1, pages)}</output>
      <TableAction disabled={disabled || state.page >= pages - 1} onClick={() => model.goToPage(state.page + 1)}>{labels.next}</TableAction>
    </div>
  </section>;
}
