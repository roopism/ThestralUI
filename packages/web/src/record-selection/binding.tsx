'use client';
import { type ReactNode } from "react";
import { ListBox, ListBoxItem } from "react-aria-components";
export interface RecordListItem {
  id: string;
  label: string;
  description?: string;
  disabled?: boolean;
}
export interface RecordListProps {
  label: string;
  items: readonly RecordListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  empty?: ReactNode;
}
export function RecordList({
  label,
  items,
  selectedId,
  onSelect,
  empty = 'No records',
}: RecordListProps) {
  return (
    <ListBox
      aria-label={label}
      className="uld-record-list"
      items={items}
      selectionMode="single"
      selectionBehavior="replace"
      disallowEmptySelection
      selectedKeys={selectedId === null ? [] : [selectedId]}
      onSelectionChange={(keys) => {
        if (keys !== 'all') {
          const first = keys.values().next().value;
          if (first !== undefined) onSelect(String(first));
        }
      }}
      renderEmptyState={() => empty}
    >
      {(item) => (
        <ListBoxItem
          className="uld-record-option"
          id={item.id}
          textValue={item.label}
          isDisabled={item.disabled}
        >
          <strong>{item.label}</strong>
          {item.description && <small>{item.description}</small>}
        </ListBoxItem>
      )}
    </ListBox>
  );
}
