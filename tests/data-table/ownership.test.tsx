import { useDataTable as usePublicDataTable } from '@ui-lazy-dev/ui-web/data-table';
import { createRef, useState } from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { DataTable, getDataTableRow, useDataTable, type DataTableState } from '../../packages/web/src/data-table/index';

afterEach(cleanup);
const input = { label: 'Review queue', columns: [{ id: 'title', label: 'Title', value: (row: { id: string; title: string }) => row.title }], getRowLabel: (row: { title: string }) => row.title, pageSize: 1 };
const start: DataTableState = { query: 'unrelated server-matched value', sort: null, page: 1 };

test('the server owns its page, order and total while selection retains off-page row IDs', () => {
  const row = { id: 'ticket[]#1', title: 'Atlas' };
  const update = vi.fn(), select = vi.fn(), apply = vi.fn();
  const { rerender } = render(<DataTable {...input} rows={[row]} server={{ state: start, totalRows: 7, onStateChange: update }}
    selectedIds={['off-page']} onSelectionChange={select} bulkAction={{ label: 'Archive', onApply: apply }} />);
  const table = screen.getByRole('table') as HTMLTableElement;
  expect(getDataTableRow(table, row.id)?.textContent).toContain('Atlas');
  expect(getDataTableRow(table, 'absent')).toBeUndefined();
  expect(screen.getByText('Page 2 of 7')).toBeTruthy();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Atlas' }));
  expect(select).toHaveBeenCalledWith(['off-page', row.id]);
  expect((screen.getByRole('checkbox', { name: 'Select Atlas' }) as HTMLInputElement).checked).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  expect(update).toHaveBeenLastCalledWith({ ...start, page: 2 });
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'again' } });
  expect(update).toHaveBeenLastCalledWith({ query: 'again', sort: null, page: 0 });
  fireEvent.click(screen.getByRole('button', { name: 'Title' }));
  expect(update).toHaveBeenLastCalledWith({ query: start.query, sort: { column: 'title', ascending: true }, page: 0 });
  rerender(<DataTable {...input} rows={[]} server={{ state: start, totalRows: 7, onStateChange: update }}
    selectedIds={['off-page', row.id]} onSelectionChange={select} bulkAction={{ label: 'Archive', onApply: apply }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
  expect(apply).toHaveBeenCalledWith(['off-page', row.id]);
});

test('a custom table can drive the public hook without mounting the styled table', () => {
  function Counter() {
    const [selectedIds, onSelectionChange] = useState<readonly string[]>([]);
    const model = useDataTable({ ...input, rows: [{ id: 'r', title: 'Atlas' }], selectedIds, onSelectionChange });
    return <button onClick={() => model.select(['r'], !model.selectedIds.includes('r'))}>{model.selectedIds.length} selected</button>;
  }
  render(<Counter />);
  fireEvent.click(screen.getByRole('button', { name: '0 selected' }));
  expect(screen.getByRole('button', { name: '1 selected' })).toBeTruthy();
});

test('unstyled table retains accessible parts and the caller can reference the host', () => {
  const ref = createRef<HTMLElement>();
  render(<DataTable {...input} ref={ref} className="review" unstyled rows={[{ id: 'r', title: 'Atlas' }]} />);
  expect(ref.current?.className).toBe('review');
  expect(ref.current?.querySelector('[class^="uld-"]')).toBeNull();
  expect(ref.current?.querySelector('[data-part="table"]')).toBe(screen.getByRole('table'));
});

test('read-only, permission and localization choices preserve the records and localized names', () => {
  const rows = [{ id: 'a', title: 'سجل' }];
  const edit = vi.fn();
  const props = { ...input, rows, columns: [{ ...input.columns[0], onEdit: edit }], labels: { search: 'Buscar registros' } };
  const { rerender } = render(<DataTable {...props} readOnly dir="rtl" />);
  expect(screen.getByRole('searchbox', { name: 'Buscar registros' })).toBeTruthy();
  expect(screen.getByRole('cell', { name: 'سجل' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Edit / })).toBeNull();
  rerender(<DataTable {...props} disabled />);
  expect((screen.getByRole('button', { name: 'Edit Title, سجل' }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole('searchbox') as HTMLInputElement).disabled).toBe(true);
});

test('the initial HTML contains labeled search, column headers, records and real paging controls', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const doc = new DOMParser().parseFromString(renderToStaticMarkup(
    <DataTable {...input} rows={[{ id: 'static', title: 'Initial record' }]} />
  ), 'text/html');
  expect(doc.querySelector('table')?.getAttribute('aria-label')).toBe('Review queue');
  expect(doc.querySelector('thead th')?.textContent).toContain('Title');
  expect(doc.querySelector('[data-row-id="static"]')?.textContent).toBe('Initial record');
  expect(doc.querySelector('label input')?.getAttribute('type')).toBe('search');
  expect(doc.querySelector('[data-part="pagination"] button')?.textContent).toBe('Previous page');
});

test('a rejected bulk operation retains selection and the application can retry once', async () => {
  let reject!: (error: Error) => void;
  const apply = vi.fn().mockImplementationOnce(() => new Promise<void>((_, no) => { reject = no; })).mockReturnValueOnce(1);
  render(<DataTable {...input} rows={[{ id: 'a', title: 'Atlas' }]} defaultSelectedIds={['a']}
    bulkAction={{ label: 'Archive', onApply: apply }} />);
  const archive = screen.getByRole('button', { name: 'Archive' });
  fireEvent.click(archive);
  fireEvent.click(archive);
  expect(apply).toHaveBeenCalledTimes(1);
  reject(Error('Unavailable'));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.getByText('1 selected')).toBeTruthy();
  fireEvent.click(archive);
  expect(apply).toHaveBeenCalledTimes(2);
  expect(apply).toHaveBeenLastCalledWith(['a']);
});

test('the web public hook obeys the shared paging, batched selection and controlled veto contract', async () => {
  const { assertDataTableContract } = require('./model-contract.cjs') as {
    assertDataTableContract: (hook: typeof usePublicDataTable, mount: typeof renderHook, update: typeof act) => Promise<void>;
  };
  await assertDataTableContract(usePublicDataTable, renderHook, act);
});
