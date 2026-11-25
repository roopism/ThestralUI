export { DataTable, type DataTableProps, type DataTableLabels } from './binding.js';
export { useDataTable, type DataColumn, type DataTableBehavior, type DataTableServer, type DataTableSort, type DataTableState, type UseDataTableOptions } from './state.js';

/** Resolve a rendered row by its stable application ID, including IDs with CSS-special characters. */
export function getDataTableRow(table: HTMLTableElement, id: string): HTMLTableRowElement | undefined {
  return Array.from(table.tBodies[0]?.rows ?? []).find(row => row.dataset.rowId === id);
}
