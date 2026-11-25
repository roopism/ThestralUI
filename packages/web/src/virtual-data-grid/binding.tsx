'use client';
import { type ReactNode, type CSSProperties } from "react";
import { type TableProps, Virtualizer, TableLayout, Table, TableHeader, Column, TableBody, Row, Cell } from "react-aria-components";
export interface VirtualGridColumn<R> {
  id: string;
  label: string;
  render: (row: R) => ReactNode;
}
export type GridInteraction = Pick<
  TableProps,
  | 'onRowAction'
  | 'onSelectionChange'
  | 'selectedKeys'
  | 'selectionMode'
  | 'defaultSelectedKeys'
  | 'disabledKeys'
>;
export interface VirtualDataGridProps<R extends { id: string }> extends GridInteraction {
  label: string;
  rows: readonly R[];
  columns: readonly VirtualGridColumn<R>[];
  rowHeight?: number;
  height?: CSSProperties['height'];
  empty?: ReactNode;
}
/** Rows share a fixed block size. Put multiline details outside the grid or increase rowHeight. */
export function VirtualDataGrid<R extends { id: string }>({
  label,
  rows,
  columns,
  height = '22rem',
  rowHeight = 44,
  empty,
  ...interactions
}: VirtualDataGridProps<R>) {
  return (
    <Virtualizer layout={TableLayout} layoutOptions={{ rowHeight, headingHeight: rowHeight }}>
      <Table aria-label={label} className="uld-virtual-grid" style={{ height }} {...interactions}>
        <TableHeader columns={columns}>
          {(column) => (
            <Column isRowHeader={column.id === columns[0]?.id} id={column.id}>
              {column.label}
            </Column>
          )}
        </TableHeader>
        <TableBody items={rows} renderEmptyState={() => empty}>
          {(row) => (
            <Row id={row.id} columns={columns}>
              {(column) => <Cell>{column.render(row)}</Cell>}
            </Row>
          )}
        </TableBody>
      </Table>
    </Virtualizer>
  );
}
