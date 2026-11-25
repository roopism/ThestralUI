import { Children, Fragment, isValidElement, useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import { AccessibilityInfo, Platform, type Pressable, ScrollView, Text, View, useColorScheme, useWindowDimensions,
  type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { tokens } from '@ui-lazy-dev/tokens';
import { Button } from '../button/binding.js';
import { NativePressTarget } from '../button/press-target.js';
import { NativeFieldControl } from '../labeled-field/control.js';
import type { ResolvedTokens } from '@ui-lazy-dev/tokens/modes';
import { useDataTable, type DataColumn, type UseDataTableOptions } from './model.js';

export { useDataTable, type DataColumn, type DataTableBehavior, type DataTableState, type DataTableSort, type DataTableServer, type UseDataTableOptions } from './model.js';
const english = {
  search: 'Search records', selectPage: 'Select page', previous: 'Previous page', next: 'Next page',
  empty: 'No matching records', cancel: 'Cancel', save: 'Save', saveFailed: 'Could not save changes. Try again.',
  select: (name: string) => 'Select ' + name,
  edit: (column: string, name: string) => 'Edit ' + column + ', ' + name,
  page: (current: number, total: number) => 'Page ' + current + ' of ' + total,
  selected: (count: number) => count + ' selected',
  loading: 'Loading records', bulkFailed: 'Could not apply changes. Try again.', ascending: 'Ascending', descending: 'Descending',
  details: (name: string) => 'Details, ' + name,
};
export type DataTableLabels = typeof english;
export type DataTablePart = 'root' | 'toolbar' | 'search' | 'selection' | 'bulk-action' | 'viewport' |
  'table' | 'header' | 'row' | 'cell' | 'pagination' | 'editor' | 'status';
export interface DataTablePartContext {
  /** Distinguishes repeated parts in the same row without requiring label parsing. */
  action?: string;
  rowId?: string;
  columnId?: string;
  name?: string;
}
export interface DataTableProps<R extends { id: string }> extends UseDataTableOptions<R> {
  label: string;
  getRowLabel: (row: R) => string;
  labels?: Partial<DataTableLabels>;
  bulkAction?: { label: string; onApply: (ids: string[]) => void | Promise<void> };
  loading?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  layout?: 'table' | 'adaptive';
  size?: 'sm' | 'md' | 'lg';
  toolbar?: ReactNode;
  emptyState?: ReactNode;
  error?: ReactNode;
  unstyled?: boolean;
  theme?: ResolvedTokens;
  testID?: string;
  getPartTestID?: (part: DataTablePart, context: DataTablePartContext) => string | undefined;
  ref?: Ref<ComponentRef<typeof View>>;
  style?: StyleProp<ViewStyle>;
  partStyles?: Partial<Record<DataTablePart, StyleProp<ViewStyle>>>;
  textStyle?: StyleProp<TextStyle>;
}

interface ActionProps {
  name: string;
  children?: ReactNode;
  testID: string;
  checked?: boolean | 'mixed';
  busy?: boolean;
  expanded?: boolean;
  hint?: string;
  disabled?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  targetRef?: Ref<ComponentRef<typeof Pressable>>;
  onFocus?: () => void;
  onBlur?: () => void;
}
function TableAction({ name, children, testID, checked, busy, expanded, hint, disabled, onPress, style, textStyle, targetRef, onFocus, onBlur }: ActionProps) {
  if (checked === undefined && expanded === undefined && children === undefined) {
    return <Button unstyled ref={targetRef} testID={testID} label={name} onPress={onPress}
      accessibilityHint={hint} busy={busy} disabled={!busy && disabled} pressableStyle={style} labelStyle={textStyle} />;
  }
  const state = { busy, disabled, expanded };
  const semantics = checked === undefined
    ? { accessibilityRole: 'button' as const, accessibilityState: state }
    : { accessibilityRole: 'checkbox' as const, accessibilityState: { ...state, checked } };
  return <NativePressTarget ref={targetRef} testID={testID} accessible {...semantics} onFocus={onFocus} onBlur={onBlur}
    accessibilityLabel={name} accessibilityHint={hint}
    disabled={disabled} onPress={onPress} style={style}>
    {children ?? <Text style={textStyle}>{checked === undefined ? '' : checked === 'mixed' ? '− ' : checked ? '☑ ' : '☐ '}{name}</Text>}
  </NativePressTarget>;
}

interface CellProps<R> {
  row: R;
  column: DataColumn<R>;
  name: string;
  labels: DataTableLabels;
  focusViewport: () => void;
  cellID: string;
  editorID: string;
  saveID: string;
  cancelID: string;
  failureID: string;
  disabled?: boolean;
  actionStyle: StyleProp<ViewStyle>;
  inputStyle: StyleProp<TextStyle>;
  textStyle: StyleProp<TextStyle>;
}
function CellEditor<R>({ row, column, name, labels, focusViewport, cellID, editorID, saveID, cancelID, failureID,
  actionStyle, inputStyle, textStyle, disabled }: CellProps<R>) {
  const [draft, setDraft] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);
  const restoreFocus = useRef(false);
  const ownsFocus = useRef(false);
  const onFocus = () => { ownsFocus.current = true; };
  const onBlur = () => { ownsFocus.current = false; };
  useLayoutEffect(() => () => { if (ownsFocus.current) focusViewport(); }, [focusViewport]);
  const trigger = useRef<ComponentRef<typeof Pressable>>(null);
  useEffect(() => {
    if (draft !== null || !restoreFocus.current) return;
    restoreFocus.current = false;
    const frame = requestAnimationFrame(() => {
      if (trigger.current) {
        trigger.current.focus();
        AccessibilityInfo.sendAccessibilityEvent(trigger.current, 'focus');
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [draft]);
  function finish() {
    restoreFocus.current = true;
    setDraft(null);
  }
  async function save() {
    if (busy.current || disabled || draft === null || !column.onEdit) return;
    busy.current = true;
    setPending(true);
    setFailed(false);
    try { await column.onEdit(row, draft); finish(); }
    catch { setFailed(true); }
    finally { busy.current = false; setPending(false); }
  }
  if (draft === null) {
    const content = column.render ? column.render(row) : column.value(row);
    return <TableAction name={name} disabled={disabled} targetRef={trigger} testID={cellID} onFocus={onFocus} onBlur={onBlur}
      onPress={() => { setFailed(false); setDraft(String(column.value(row))); }} style={actionStyle} textStyle={textStyle}>
      {typeof content === 'number' || typeof content === 'string' ? <Text style={textStyle}>{content}</Text> : content}
    </TableAction>;
  }
  return <View>
    <NativeFieldControl testID={editorID} autoFocus submitBehavior="submit" onFocus={onFocus} onBlur={onBlur} accessibilityLabel={name} value={draft} editable={!pending && !disabled}
      accessibilityState={{ busy: pending }} onChangeText={value => { if (!busy.current) setDraft(value); }}
      onSubmitEditing={() => { void save(); }} returnKeyType="done" style={inputStyle} />
    <TableAction testID={saveID} name={labels.save} busy={pending} disabled={pending || disabled} onPress={() => { void save(); }} style={actionStyle} textStyle={textStyle} />
    <TableAction testID={cancelID} name={labels.cancel} disabled={pending || disabled} onPress={() => { if (!busy.current) finish(); }}
      style={actionStyle} textStyle={textStyle} />
    {failed && <Text testID={failureID} accessibilityRole="alert" accessibilityLiveRegion="assertive" style={textStyle}>{labels.saveFailed}</Text>}
  </View>;
}

function hasContent(content: ReactNode): boolean {
  return Children.toArray(content).some(child => isValidElement<{children?: ReactNode}>(child) && child.type === Fragment
    ? hasContent(child.props.children) : child !== '');
}

export function DataTable<R extends { id: string }>(props: DataTableProps<R>) {
  const viewport = useRef<ComponentRef<typeof View>>(null);
  const [restoreViewport, setRestoreViewport] = useState(false);
  const focusViewport = useCallback(() => setRestoreViewport(true), []);
  useEffect(() => {
    if (!restoreViewport || !viewport.current) return;
    viewport.current.focus();
    AccessibilityInfo.sendAccessibilityEvent(viewport.current, 'focus');
    setRestoreViewport(false);
  }, [restoreViewport]);
  const { label, columns, getRowLabel, bulkAction, loading = false, unstyled, theme, partStyles, getPartTestID } = props;
  const table = useDataTable({
    rows: props.rows, columns, locale: props.locale, pageSize: props.pageSize,
    defaultSort: props.defaultSort, server: props.server, selectedIds: props.selectedIds,
    defaultSelectedIds: props.defaultSelectedIds, onSelectionChange: props.onSelectionChange,
    onSearchChange: props.onSearchChange, onSortChange: props.onSortChange, onPageChange: props.onPageChange,
  });
  const labels = { ...english, ...props.labels };
  const scheme = useColorScheme();
  const { width, fontScale } = useWindowDimensions();
  // At larger text sizes phones keep the record summary and offer the other named fields on demand.
  const compact = props.layout !== 'table' && width / Math.max(1, fontScale) < 600;
  const [expanded, setExpanded] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [bulkFailed, setBulkFailed] = useState(false);
  const inFlight = useRef(false);
  const locked = Boolean(loading || applying || props.disabled);
  const selectable = !!bulkAction || props.selectedIds !== undefined || props.defaultSelectedIds !== undefined || props.onSelectionChange !== undefined;
  async function apply() {
    if (!bulkAction || inFlight.current || locked || props.readOnly || !table.selectedIds.length) return;
    inFlight.current = true;
    setApplying(true);
    setBulkFailed(false);
    try { await bulkAction.onApply(table.selectedIds); }
    catch { setBulkFailed(true); }
    finally { inFlight.current = false; setApplying(false); }
  }
  const layout = theme ?? tokens;
  const colors = theme?.color ?? (scheme === 'dark' ? tokens.dark : tokens.light);
  const textStyle: StyleProp<TextStyle> = [unstyled ? {} : { color: colors.text }, props.textStyle];
  const control: StyleProp<ViewStyle> = unstyled ? {} : { minHeight: props.size === 'lg' ? layout.density.largeTarget : layout.density.coarseTarget,
    minWidth: layout.density.coarseTarget, justifyContent: 'center', paddingHorizontal: props.size === 'lg' ? layout.space.spaceMd : props.size === 'sm' ? layout.space.spaceXs : layout.space.spaceSm };
  const input: StyleProp<TextStyle> = [unstyled ? {} : { minHeight: layout.density.coarseTarget,
    color: colors.text, borderColor: colors.border, borderBottomWidth: layout.shape.indicatorStroke }, props.textStyle];
  const line: StyleProp<ViewStyle> = unstyled ? {} : { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: layout.space.spaceSm };
  function id(part: DataTablePart, context: DataTablePartContext = {}) {
    return getPartTestID?.(part, context) ?? [props.testID ?? 'data-table', part, context.rowId, context.columnId, context.action]
      .filter(value => value !== undefined).join('.');
  }
  const action = (part: DataTablePart, name: string, onPress: () => void, context: DataTablePartContext, extra: Partial<ActionProps> = {}) =>
    <TableAction key={id(part, context)} name={name} testID={id(part, { ...context, name })} onPress={onPress}
      style={[control, partStyles?.[part]]} textStyle={textStyle} {...extra} />;
  function status(name: string, action: string) {
    return <Text testID={id('status', { action, name })} accessibilityLiveRegion="polite" style={[textStyle, partStyles?.status]}>{name}</Text>;
  }

  const hasError = hasContent(props.error);
  const slot = (content: ReactNode) => typeof content === 'string' || typeof content === 'number' ? <Text style={textStyle}>{content}</Text> : content;
  return <View ref={props.ref} testID={id('root')} style={[unstyled ? {} : { backgroundColor: colors.surface }, partStyles?.root, props.style]}>
    <Text accessibilityRole="header" style={textStyle}>{label}</Text>
    <View testID={id('toolbar')} style={partStyles?.toolbar}>
      <NativeFieldControl testID={id('search')} editable={!props.disabled} accessibilityState={{ disabled: props.disabled }} accessibilityLabel={labels.search} placeholder={labels.search}
        placeholderTextColor={unstyled ? undefined : colors.text} value={table.state.query} onChangeText={table.search} returnKeyType="search"
        style={[input, partStyles?.search]} />
      {selectable && <View style={line}>
        {status(labels.selected(table.selectedIds.length), 'selected')}
        {bulkAction && action('bulk-action', bulkAction.label, () => { void apply(); }, { action: 'apply' },
          { disabled: locked || props.readOnly || !table.selectedIds.length })}
      </View>}
      {slot(props.toolbar)}
    </View>
    {(hasError || bulkFailed) && <View testID={id('status', { action: 'error' })} accessible accessibilityRole="alert" accessibilityLiveRegion="assertive">
      {slot(hasError ? props.error : labels.bulkFailed)}
    </View>}
    <View ref={viewport} testID={id('viewport')} collapsable={false}
      hasTVPreferredFocus={Platform.OS === 'android' && restoreViewport}
      style={[unstyled ? {} : { flexShrink: 1 }, partStyles?.viewport]}>
    <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
      <View testID={id('table')} accessibilityState={{ busy: loading }} style={partStyles?.table}>
        <View testID={id('header')} style={[line, partStyles?.header]}>
          {selectable && action('selection', labels.selectPage, () => table.select(table.visible.map(row => row.id), !table.allPage), { action: 'page' },
            { checked: table.allPage ? true : table.somePage ? 'mixed' : false, disabled: locked || !table.visible.length })}
          {columns.map(c => action('header', c.label, () => table.sortBy(c.id), { columnId: c.id, action: 'sort' },
            { disabled: props.disabled, hint: table.state.sort?.column === c.id ? table.state.sort.ascending ? labels.ascending : labels.descending : undefined }))}
        </View>
        {loading && status(labels.loading, 'loading')}
        {!loading && !table.visible.length && (!hasContent(props.emptyState) ? status(labels.empty, 'empty') : slot(props.emptyState))}
        {table.visible.map(row => {
          const name = getRowLabel(row);
          const rowContext = { rowId: row.id };
          const showAll = !compact || expanded === row.id;
          return <View key={row.id} testID={id('row', rowContext)} style={[unstyled ? {} : { borderTopWidth: layout.shape.indicatorStroke,
            borderColor: colors.border, paddingVertical: layout.space.spaceXs }, partStyles?.row]}>
            {selectable && action('selection', labels.select(name), () => table.select([row.id], !table.selected.has(row.id)), rowContext,
              { checked: table.selected.has(row.id), disabled: locked })}
            <View style={compact ? {} : line}>
              {(showAll ? columns : columns.slice(0, 1)).map((column, index) => {
                const context = { ...rowContext, columnId: column.id };
                const value = column.value(row);
                const cell = column.onEdit && !props.readOnly ? <CellEditor focusViewport={focusViewport} disabled={locked} row={row} column={column} name={labels.edit(column.label, name)} labels={labels}
                  cellID={id('cell', { ...context, action: 'edit', name: labels.edit(column.label, name) })} editorID={id('editor', context)}
                  saveID={id('editor', { ...context, action: 'save', name: labels.save })} cancelID={id('editor', { ...context, action: 'cancel', name: labels.cancel })}
                  failureID={id('status', { ...context, action: 'failure', name: labels.saveFailed })} actionStyle={control}
                  inputStyle={[input, partStyles?.editor]} textStyle={textStyle} /> : column.render ? column.render(row) : value;
                return <View key={column.id} style={[compact || unstyled ? {} : { flex: 1 }, partStyles?.cell]}>
                  {compact && index > 0 && <Text style={textStyle}>{column.label}</Text>}
                  {typeof cell === 'string' || typeof cell === 'number'
                    ? <Text testID={id('cell', { ...context, name: String(cell) })} accessibilityHint={column.label} style={textStyle}>{cell}</Text>
                    : cell}
                </View>;
              })}
            </View>
            {compact && columns.length > 1 && action('row', labels.details(name),
              () => setExpanded(current => current === row.id ? null : row.id), { ...rowContext, action: 'details' }, { expanded: showAll })}
          </View>;
        })}
      </View>
    </ScrollView>
    </View>
    <View testID={id('pagination')} style={[line, partStyles?.pagination]}>
      {action('pagination', labels.previous, () => table.goToPage(table.state.page - 1), { action: 'previous' }, { disabled: props.disabled || table.state.page === 0 })}
      {status(labels.page(table.state.page + 1, table.pages), 'page')}
      {action('pagination', labels.next, () => table.goToPage(table.state.page + 1), { action: 'next' }, { disabled: props.disabled || table.state.page >= table.pages - 1 })}
    </View>
  </View>;
}
