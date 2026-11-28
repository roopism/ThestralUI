import { execFileSync } from 'node:child_process';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';

import { afterEach, expect, expectTypeOf, test, vi } from 'vitest';

import type { DataTableLabels as CollectionLabels, DataTableProps as CollectionProps } from '@ui-lazy-dev/ui-web/collections';
import type { DataTableLabels, DataTableProps } from '@ui-lazy-dev/ui-web/data-table';
import englishMessages from '../../packages/messages/locales/en.json';
import frenchMessages from '../../packages/messages/locales/fr.json';
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

test('legacy label dictionaries retain the viewport name with an undefined override', () => {
  expectTypeOf<CollectionLabels['viewport']>().toEqualTypeOf<string>();
  expectTypeOf<DataTableLabels['viewport']>().toEqualTypeOf<string>();
  const legacy = {
    search: 'Find records', loading: 'Loading', bulkFailed: 'Apply failed', selectPage: 'Select all',
    previous: 'Previous', next: 'Next', empty: 'No records', cancel: 'Cancel', save: 'Save',
    saveFailed: 'Save failed', select: (name: string) => 'Select ' + name,
    edit: (column: string, name: string) => column + ', ' + name,
    page: (current: number, total: number) => current + ' / ' + total,
    selected: (count: number) => count + ' selected',
  } satisfies Omit<DataTableLabels, 'viewport'>;
  const collectionLabels: CollectionProps<(typeof rows)[number]>['labels'] = legacy;
  const tableLabels: DataTableProps<(typeof rows)[number]>['labels'] = legacy;
  const { rerender } = render(<DataTable {...props} labels={collectionLabels} />);
  const viewport = () => screen.getByRole('group', { name: englishMessages['dataTable.viewport'] });
  expect(viewport().contains(screen.getByRole('table', { name: props.label }))).toBe(true);
  rerender(<DataTable {...props} labels={{ ...tableLabels, viewport: undefined }} />);
  expect(viewport().contains(screen.getByRole('table', { name: props.label }))).toBe(true);
  expect(screen.getByRole('searchbox', { name: legacy.search })).toBeTruthy();
  const name = frenchMessages['dataTable.viewport'];
  const translated = Object.defineProperty({ ...legacy }, 'viewport', { value: name });
  rerender(<DataTable {...props} labels={translated} />);
  expect(screen.getByRole('group', { name }).contains(screen.getByRole('table', { name: props.label }))).toBe(true);
});

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
  const viewport = screen.getByRole('group', { name: englishMessages['dataTable.viewport'] });
  expect(viewport.contains(screen.getByRole('table', { name: props.label }))).toBe(true);
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
  screen.getByRole('button', { name: 'Save' }).focus();
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(document.activeElement).toBe(input);
  expect((input as HTMLInputElement).value).toBe('Approved');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByRole('button', { name: 'Edit Name, Gamma' })).toBeTruthy();
  expect(document.activeElement).toBe(edit());
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
      labels={{ viewport: frenchMessages['dataTable.viewport'] }}
      onSortChange={sort}
      onPageChange={page}
      onSearchChange={search}
      onSelectionChange={selection}
      bulkAction={{ label: 'Archive', onApply: vi.fn() }}
    />,
  );
  const table = screen.getByRole('table', { name: 'Queue' });
  expect(screen.getByRole('group', { name: 'Contenu du tableau' }).contains(table)).toBe(true);
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

test('paging preserves an in-flight save for only its row and column', async () => {
  let finish!: () => void;
  const edit = vi.fn().mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
  const editScore = vi.fn();
  render(<DataTable {...props} pageSize={1} columns={[{ ...columns[0], onEdit: edit }, { ...columns[1], onEdit: editScore }]} />);
  const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
  click('Edit Name, Gamma');
  click('Save');
  click('Next page');
  click('Edit Name, Beta');
  click('Cancel');
  click('Previous page');
  click('Edit Score, Gamma');
  await act(async () => { click('Save'); });
  expect(editScore).toHaveBeenCalledTimes(1);
  click('Edit Name, Gamma');
  const duplicate = screen.queryByRole('button', { name: 'Save' });
  if (duplicate) fireEvent.click(duplicate);
  expect(edit).toHaveBeenCalledTimes(1);
  await act(async () => finish());
  click('Edit Name, Gamma');
  await act(async () => { click('Save'); });
  expect(edit).toHaveBeenCalledTimes(2);
});

test.each(['resolves', 'rejects'])('a save that %s leaves focus in the search field', async outcome => {
  let settle!: () => void;
  const onEdit = () => new Promise<void>((resolve, reject) => {
    settle = outcome === 'resolves' ? resolve : () => reject(Error('offline'));
  });
  render(<DataTable {...props} columns={[{ ...columns[0], onEdit }]} />);
  const name = 'Edit Name, Gamma';
  fireEvent.click(screen.getByRole('button', { name }));
  const field = screen.getByRole('textbox', { name });
  expect(document.activeElement).toBe(field);
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  const search = screen.getByRole('searchbox');
  search.focus();
  await act(async () => settle());
  expect(document.activeElement).toBe(search);
  if (outcome === 'resolves') expect(screen.getByRole('button', { name })).toBeTruthy();
  else expect(screen.getByRole('alert')).toBeTruthy();
});

test('an invalid table locale falls back for labels, sorting and search', () => {
  render(<DataTable {...props} data-testid="queue" locale="en_US" defaultSort={{ column: 'name', ascending: true }} />);
  expect(screen.getByTestId('queue').hasAttribute('locale')).toBe(false);
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search records' }), { target: { value: 'BETA' } });
  expect(screen.getByText('Beta')).toBeTruthy();
});

test('all ten catalogs cover the table, command palette and batch keys including their placeholders', () => {
  execFileSync(process.execPath, ['packages/messages/renderer.mjs', '--check']);
  const modules = import.meta.glob<Record<string, string>>('../../packages/messages/locales/*.json', { eager: true, import: 'default' });
  const catalogs = Object.fromEntries(Object.entries(modules).map(([path, messages]) => [path.split('/').pop()!.replace('.json', ''), messages]));
  expect(Object.keys(catalogs).sort()).toEqual(['ar', 'de', 'en', 'es', 'fr', 'he', 'hi', 'ja', 'pt-BR', 'zh-Hans']);
  const groups = {
    dataTable: ['search', 'selectPage', 'previousPage', 'nextPage', 'empty', 'cancel', 'save', 'saveFailed', 'select', 'edit', 'page', 'selected', 'loading', 'bulkFailed', 'details', 'ascending', 'descending'],
    commandPalette: ['search', 'empty', 'close'],
    batch: ['queued', 'running', 'complete', 'failed', 'denied', 'empty', 'summary', 'retry'],
  };
  for (const [locale, messages] of Object.entries(catalogs)) {
    for (const [group, keys] of Object.entries(groups)) for (const key of keys) {
      const id = group + '.' + key;
      expect(messages[id], locale + ' ' + id).toBeTruthy();
      expect((messages[id].match(/\{\w+\}/g) ?? []).sort()).toEqual((catalogs.en[id].match(/\{\w+\}/g) ?? []).sort());
    }
  }
});
