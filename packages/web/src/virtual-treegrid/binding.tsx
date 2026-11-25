'use client';
import { type TreeProps, TreeItem, TreeItemContent, Button, Collection, Virtualizer, ListLayout, Tree } from "react-aria-components";
import { type CSSProperties, type ReactNode } from "react";
export interface TreeEntry {
  id: string;
  label: string;
  children?: readonly TreeEntry[];
}
export type TreeInteraction = Pick<
  TreeProps<TreeEntry>,
  | 'selectedKeys'
  | 'defaultSelectedKeys'
  | 'selectionMode'
  | 'onSelectionChange'
  | 'expandedKeys'
  | 'defaultExpandedKeys'
  | 'onExpandedChange'
  | 'disabledKeys'
  | 'onAction'
>;
export interface VirtualTreeProps extends TreeInteraction {
  label: string;
  items: readonly TreeEntry[];
  rowHeight?: number;
  height?: CSSProperties['height'];
  empty?: ReactNode;
  renderItem?: (item: TreeEntry) => ReactNode;
}
export function VirtualTree({
  label,
  items,
  renderItem,
  rowHeight = 44,
  height = '22rem',
  empty,
  ...interaction
}: VirtualTreeProps) {
  const renderEntry = (entry: TreeEntry) => (
    <TreeItem id={entry.id} textValue={entry.label}>
      <TreeItemContent>
        {({ hasChildItems, level, isExpanded }) => (
          <div
            className="uld-tree-content"
            style={{ paddingInlineStart: (level - 1) * 1.25 + 'rem' }}
          >
            {hasChildItems && (
              <Button slot="chevron" className="uld-tree-chevron">
                <span aria-hidden="true" data-expanded={isExpanded}>
                  ›
                </span>
              </Button>
            )}
            {renderItem ? renderItem(entry) : entry.label}
          </div>
        )}
      </TreeItemContent>
      {entry.children?.length ? (
        <Collection items={entry.children}>{renderEntry}</Collection>
      ) : null}
    </TreeItem>
  );
  return (
    <Virtualizer layout={ListLayout} layoutOptions={{ rowHeight }}>
      <Tree
        aria-label={label}
        items={items}
        className="uld-virtual-tree"
        style={{ height }}
        renderEmptyState={() => empty}
        {...interaction}
      >
        {renderEntry}
      </Tree>
    </Virtualizer>
  );
}
