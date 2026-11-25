import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

import { afterEach, expect, test, vi } from 'vitest';

import { DataTable, type DataColumn } from '../../packages/web/src/collections';

afterEach(cleanup);

const rows = [
  { id: 'a', title: 'Gamma', score: 2 },
  { id: 'b', title: 'Beta', score: 11 },
  { id: 'c', title: 'Alpha', score: 9 },
];

const columns: DataColumn<(typeof rows)[number]>[] = [
  { id: 'name', label: 'Name', value: (row) => row.title },
  { id: 'score', label: 'Score', value: (row) => row.score },
];

const props = {
  label: 'Queue',
  rows,
  columns,
  getRowLabel: (row: (typeof rows)[number]) => row.title,
  pageSize: 2,
};

test('retains selected IDs across search and pages and excludes removed records', () => {
  const apply = vi.fn();
  const { rerender } = render(
    <DataTable {...props} bulkAction={{ label: 'Archive', onApply: apply }} />,
  );
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Gamma' }));
  expect(
    (screen.getByRole('checkbox', { name: 'Select page' }) as HTMLInputElement).indeterminate,
  ).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select page' }));
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'beta' } });
  expect(screen.getAllByRole('row')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
  expect(apply.mock.calls[0][0]).toEqual(['a', 'c']);
  rerender(
    <DataTable {...props} rows={rows.slice(1)} bulkAction={{ label: 'Archive', onApply: apply }} />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
  expect(apply.mock.calls[1][0]).toEqual(['c']);
});

test('sorts numbers by value, pages safely after data changes, and provides an empty state', () => {
  const { rerender } = render(<DataTable {...props} />);
  const sort = screen.getByRole('button', { name: 'Score' });
  fireEvent.click(sort);
  expect(screen.getByRole('columnheader', { name: 'Score' }).getAttribute('aria-sort')).toBe(
    'ascending',
  );
  fireEvent.click(sort);
  expect(within(screen.getAllByRole('row')[1]).getByText('Beta')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  rerender(<DataTable {...props} rows={rows.slice(0, 1)} />);
  expect(screen.getByText('Gamma')).toBeTruthy();
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'absent' } });
  expect(screen.getByText('No matching records')).toBeTruthy();
});

test('cancels or asynchronously saves edits and retains a draft on failure', async () => {
  const save = vi.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValue(undefined);
  render(<DataTable {...props} columns={[{ ...columns[0], onEdit: save }]} />);
  const edit = () => screen.getByRole('button', { name: 'Edit Name, Gamma' });
  fireEvent.click(edit());
  let input = screen.getByRole('textbox', { name: 'Edit Name, Gamma' });
  fireEvent.change(input, { target: { value: 'New title' } });
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(edit());
  input = screen.getByRole('textbox', { name: 'Edit Name, Gamma' });
  fireEvent.change(input, { target: { value: 'Approved' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect((input as HTMLInputElement).value).toBe('Approved');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByRole('button', { name: 'Edit Name, Gamma' })).toBeTruthy();
  expect(save).toHaveBeenLastCalledWith(rows[0], 'Approved');
});

test('reports sort, page, search and selection changes and honors an initial sort', () => {
  const sort = vi.fn(),
    page = vi.fn(),
    search = vi.fn(),
    selection = vi.fn();
  render(
    <DataTable
      {...props}
      defaultSort={{ column: 'score', ascending: false }}
      onSortChange={sort}
      onPageChange={page}
      onSearchChange={search}
      onSelectionChange={selection}
      bulkAction={{ label: 'Archive', onApply: vi.fn() }}
    />,
  );
  const table = screen.getByRole('table', { name: 'Queue' });
  const score = within(table).getByRole('columnheader', { name: /Score/ });
  expect(score.getAttribute('aria-sort')).toBe('descending');
  expect(within(table).getAllByRole('row')[1].textContent).toContain('Beta');
  fireEvent.click(within(score).getByRole('button'));
  expect(sort).toHaveBeenLastCalledWith({ column: 'score', ascending: true });
  expect(page).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  expect(page).toHaveBeenLastCalledWith(1);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Beta' }));
  expect(selection).toHaveBeenLastCalledWith(['b']);
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'al' } });
  expect(search).toHaveBeenLastCalledWith('al');
  expect(page).toHaveBeenLastCalledWith(0);
});
