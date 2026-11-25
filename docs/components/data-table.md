---
{
  "family": "Data table",
  "status": "experimental",
  "since": "0.3.0-rc.1",
  "owner": "@roopism",
  "platforms": {
    "web": "supported",
    "native": "experimental"
  },
  "exports": [
    {
      "platform": "web",
      "name": "DataTable",
      "from": "@ui-lazy-dev/ui-web/collections",
      "rendering": "client-only"
    },
    {
      "platform": "web",
      "name": "DataTable",
      "from": "@ui-lazy-dev/ui-web/data-table",
      "rendering": "client-only"
    },
    {
      "platform": "web",
      "name": "useDataTable",
      "from": "@ui-lazy-dev/ui-web/data-table",
      "rendering": "client-only"
    },
    {
      "platform": "web",
      "name": "getDataTableRow",
      "from": "@ui-lazy-dev/ui-web/data-table",
      "rendering": "client-only"
    },
    {
      "platform": "native",
      "name": "DataTable",
      "from": "@ui-lazy-dev/ui-native/data-table"
    },
    {
      "platform": "native",
      "name": "useDataTable",
      "from": "@ui-lazy-dev/ui-native/data-table"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/Table",
    "https://mui.com/material-ui/react-table/"
  ]
}
---

# Data table

## Part A — Contract

### Purpose and when not to use it

Compare and edit named records across columns. Choose a virtual data grid for keyboard traversal of a large, fixed-height collection.

### Anatomy

Named columns associate each value with its record. The table may expose search, sorting, editing and bulk actions.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| columns | Required | N/A — required | Container gap | Children retain their semantics | Operable children keep their order |
| rows | Required | N/A — required | Container gap | Children retain their semantics | Operable children keep their order |
| cell content | Optional | fallback — show the column value | Container gap | Children retain their semantics | Operable children keep their order |
| bulk action | Optional | collapse | Container gap | Action has its own name | Takes its place when available |

### Variants

Editable columns open an inline editor. A bulk action and controlled selection expose record checkboxes. The adaptive layout fits smaller screens. The table layout retains columns. The public sizes are small, medium and large. Page size defaults to 25.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Default | Display records | Inherited foreground and table rules | Headers identify the values in each column | Sort, edit and paging controls | Controls in reading order | [data-table.sort-column](data-table.scenarios.yaml) |
| Sorted | Sort a column | Active sort expressed through the header | The header exposes the sort direction | Sort again to reverse | Sort button | [data-table.sort-column](data-table.scenarios.yaml) |
| Empty | Filter out all rows | Empty message replaces data rows | The empty message is readable | Search remains available | Search input | [data-table.empty-results](data-table.scenarios.yaml) |
| Selected | Select rows | See Tokens | The page choice reports all, some or none selected | Bulk button when selection exists | Visible controls | [data-table.archive-across-pages](data-table.scenarios.yaml) |
| Editing | Edit a value | See Tokens | A named editor offers save and cancel | Yes | Draft input | [data-table.retry-edit](data-table.scenarios.yaml) |
| Saving | Save the edit | See Tokens | The draft cannot be changed during the operation | Submit and cancel blocked | Draft input | [data-table.retry-edit](data-table.scenarios.yaml) |
| Failed | Reject a save | Existing draft remains visible | An alert accompanies the retained draft | Retry Save | Draft and controls | [data-table.retry-edit](data-table.scenarios.yaml) |

### Keyboard, pointer and touch

Tab reaches search, scroll region, sortable headers, editable cells and paging controls. Enter submits an edit; Escape cancels an idle draft and focus returns to its edit button. Sorting is a button action, without a spreadsheet arrow-key model.

### Accessibility

Use a distinct table label and meaningful row names for checkboxes and edit buttons. Horizontal scrolling preserves column order. Table borders inherit the surrounding foreground; keyboard outlines use the system highlight color. The table uses logical alignment and has no animation. In forced colors, the focus outline uses Highlight. While a save is pending the row retains its draft, and duplicate submissions are blocked.

### State patterns

A filtered list with no rows shows an empty message. Loading and request errors can be supplied by the owner. A failed edit keeps its draft, and a failed bulk action keeps the selection for retry. Disabled and read-only modes retain readable data.

### Localization

Default messages are mapped to `dataTable.search`, `dataTable.selectPage`, `dataTable.previousPage`, `dataTable.nextPage`, `dataTable.empty`, `dataTable.cancel`, `dataTable.save`, `dataTable.saveFailed`, `dataTable.select`, `dataTable.edit`, `dataTable.page`, `dataTable.selected`, `dataTable.loading`, `dataTable.bulkFailed`, `dataTable.details`, `dataTable.ascending` and `dataTable.descending`. Pass translated strings and formatters through `labels`. Values and column headings belong to the caller. [Message inventory](../library-strings.md)

The ten checked-in dictionaries supply message templates. The application selects one and passes its strings and callbacks through `labels`. An Arabic right-to-left consumer used the row name عائشة in its checkbox and edit actions and `Intl.NumberFormat('ar-EG')` for selected counts and pagination. It announced `عدد العناصر المحددة: ١` after selection and `الصفحة ٢ من ١٢` on the second page. Automatic dictionary selection through a shared locale provider remains open for 1.0. [Arabic messages](../../packages/messages/locales/ar.json)

### Tokens

The table uses semantic spacing and control tokens. Native colors follow the selected theme. Web parts support application CSS overrides and the native renderer accepts per-part styles.

### Composition and content guidelines

For local collections, supply the complete array. For a server-fed table, supply one already filtered and sorted page with `server.state`, `server.totalRows` and `server.onStateChange`. A page change retains selected IDs from other pages. Keep requests and response ordering in the owning application. Place editor widgets outside nested forms. Use “Select invoice 42” instead of “Select item.” Spell out units in column labels; format row values using the product locale.

## Part B — Bindings

### API

The caller owns record data, column definitions and persistence. The table owns local query, sort and page. Supply `server` to own those values, and `selectedIds` plus `onSelectionChange` to own selection independently. `bulkAction.onApply` receives selected IDs across pages. A cell keeps its draft while an asynchronous edit is pending or after an error. Web host props and ref reach the outer section.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `collections:DataTable` | `bulkAction` | `{ label: string; onApply: (rowIds: string[]) => void; } \| undefined` | Unspecified | Caller input | — |
| `collections:DataTable` | `className` | `string \| undefined` | Unspecified | Caller input | — |
| `collections:DataTable` | `columns` | `readonly DataColumn<R>[]` | Required | Caller input | — |
| `collections:DataTable` | `defaultSelectedIds` | `readonly string[] \| undefined` | Unspecified | Uncontrolled initial value | — |
| `collections:DataTable` | `defaultSort` | `import("@ui-lazy-dev/ui-web/dist/data-table/state.js").DataTableSort \| undefined` | Unspecified | Uncontrolled initial value | — |
| `collections:DataTable` | `disabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `collections:DataTable` | `emptyState` | `ReactNode` | Unspecified | Caller input | — |
| `collections:DataTable` | `error` | `ReactNode` | Unspecified | Caller input | — |
| `collections:DataTable` | `getRowLabel` | `(row: R) => string` | Required | Caller input | — |
| `collections:DataTable` | `label` | `string` | Required | Caller input | — |
| `collections:DataTable` | `labels` | `Partial<{ search: string; loading: string; bulkFailed: string; selectPage: string; previous: string; next: string; empty: string; cancel: string; save: string; saveFailed: string; select: (name: string) => string; edit: (column: string, name: string) => string; page: (current: number, total: number) => string; selected: (count: number) => string; }> \| undefined` | Unspecified | Caller input | — |
| `collections:DataTable` | `layout` | `"table" \| "adaptive" \| undefined` | Unspecified | Caller input | — |
| `collections:DataTable` | `loading` | `boolean \| undefined` | Unspecified | Caller input | — |
| `collections:DataTable` | `locale` | `string \| undefined` | Unspecified | Caller input | — |
| `collections:DataTable` | `onPageChange` | `((page: number) => void) \| undefined` | Unspecified | Caller callback | — |
| `collections:DataTable` | `onSearchChange` | `((query: string) => void) \| undefined` | Unspecified | Caller callback | — |
| `collections:DataTable` | `onSelectionChange` | `((ids: string[]) => void) \| undefined` | Unspecified | Caller callback | — |
| `collections:DataTable` | `onSortChange` | `((sort: import("@ui-lazy-dev/ui-web/dist/data-table/state.js").DataTableSort) => void) \| undefined` | Unspecified | Caller callback | — |
| `collections:DataTable` | `pageSize` | `number \| undefined` | Unspecified | Caller input | — |
| `collections:DataTable` | `readOnly` | `boolean \| undefined` | Unspecified | Caller input | — |
| `collections:DataTable` | `ref` | `import("react").Ref<HTMLElement> \| undefined` | Unspecified | Caller reference | `HTMLElement` |
| `collections:DataTable` | `rows` | `readonly R[]` | Required | Caller input | — |
| `collections:DataTable` | `selectedIds` | `readonly string[] \| undefined` | Unspecified | Controlled value | — |
| `collections:DataTable` | `server` | `import("@ui-lazy-dev/ui-web/dist/data-table/state.js").DataTableServer \| undefined` | Unspecified | Caller input | — |
| `collections:DataTable` | `size` | `"sm" \| "md" \| "lg" \| undefined` | Unspecified | Caller input | — |
| `collections:DataTable` | `style` | `import("react").CSSProperties \| undefined` | Unspecified | Caller input | — |
| `collections:DataTable` | `toolbar` | `ReactNode` | Unspecified | Caller input | — |
| `collections:DataTable` | `unstyled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `collections:DataTable` | Host attributes | 276 standard platform attributes, not listed | Unspecified | Caller input | — |
| `data-table:DataTable` | `bulkAction` | `{ label: string; onApply: (rowIds: string[]) => void; } \| undefined` | Unspecified | Caller input | — |
| `data-table:DataTable` | `className` | `string \| undefined` | Unspecified | Caller input | — |
| `data-table:DataTable` | `columns` | `readonly DataColumn<R>[]` | Required | Caller input | — |
| `data-table:DataTable` | `defaultSelectedIds` | `readonly string[] \| undefined` | Unspecified | Uncontrolled initial value | — |
| `data-table:DataTable` | `defaultSort` | `import("@ui-lazy-dev/ui-web/dist/data-table/state.js").DataTableSort \| undefined` | Unspecified | Uncontrolled initial value | — |
| `data-table:DataTable` | `disabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `data-table:DataTable` | `emptyState` | `ReactNode` | Unspecified | Caller input | — |
| `data-table:DataTable` | `error` | `ReactNode` | Unspecified | Caller input | — |
| `data-table:DataTable` | `getRowLabel` | `(row: R) => string` | Required | Caller input | — |
| `data-table:DataTable` | `label` | `string` | Required | Caller input | — |
| `data-table:DataTable` | `labels` | `Partial<{ search: string; loading: string; bulkFailed: string; selectPage: string; previous: string; next: string; empty: string; cancel: string; save: string; saveFailed: string; select: (name: string) => string; edit: (column: string, name: string) => string; page: (current: number, total: number) => string; selected: (count: number) => string; }> \| undefined` | Unspecified | Caller input | — |
| `data-table:DataTable` | `layout` | `"table" \| "adaptive" \| undefined` | Unspecified | Caller input | — |
| `data-table:DataTable` | `loading` | `boolean \| undefined` | Unspecified | Caller input | — |
| `data-table:DataTable` | `locale` | `string \| undefined` | Unspecified | Caller input | — |
| `data-table:DataTable` | `onPageChange` | `((page: number) => void) \| undefined` | Unspecified | Caller callback | — |
| `data-table:DataTable` | `onSearchChange` | `((query: string) => void) \| undefined` | Unspecified | Caller callback | — |
| `data-table:DataTable` | `onSelectionChange` | `((ids: string[]) => void) \| undefined` | Unspecified | Caller callback | — |
| `data-table:DataTable` | `onSortChange` | `((sort: import("@ui-lazy-dev/ui-web/dist/data-table/state.js").DataTableSort) => void) \| undefined` | Unspecified | Caller callback | — |
| `data-table:DataTable` | `pageSize` | `number \| undefined` | Unspecified | Caller input | — |
| `data-table:DataTable` | `readOnly` | `boolean \| undefined` | Unspecified | Caller input | — |
| `data-table:DataTable` | `ref` | `import("react").Ref<HTMLElement> \| undefined` | Unspecified | Caller reference | `HTMLElement` |
| `data-table:DataTable` | `rows` | `readonly R[]` | Required | Caller input | — |
| `data-table:DataTable` | `selectedIds` | `readonly string[] \| undefined` | Unspecified | Controlled value | — |
| `data-table:DataTable` | `server` | `import("@ui-lazy-dev/ui-web/dist/data-table/state.js").DataTableServer \| undefined` | Unspecified | Caller input | — |
| `data-table:DataTable` | `size` | `"sm" \| "md" \| "lg" \| undefined` | Unspecified | Caller input | — |
| `data-table:DataTable` | `style` | `import("react").CSSProperties \| undefined` | Unspecified | Caller input | — |
| `data-table:DataTable` | `toolbar` | `ReactNode` | Unspecified | Caller input | — |
| `data-table:DataTable` | `unstyled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `data-table:DataTable` | Host attributes | 276 standard platform attributes, not listed | Unspecified | Caller input | — |
| `data-table:useDataTable` | `__0` | `UseDataTableOptions<R>` | Required | Caller input | — |
| `data-table:getDataTableRow` | `id` | `string` | Required | Caller input | — |
| `data-table:getDataTableRow` | `table` | `HTMLTableElement` | Required | Caller input | — |
| `native/data-table:DataTable` | `bulkAction` | `{ label: string; onApply: (ids: string[]) => void \| Promise<void>; } \| undefined` | Unspecified | Caller input | — |
| `native/data-table:DataTable` | `columns` | `readonly import("@ui-lazy-dev/ui-native/dist/data-table/model.js").DataColumn<R>[]` | Required | Caller input | — |
| `native/data-table:DataTable` | `defaultSelectedIds` | `readonly string[] \| undefined` | Unspecified | Uncontrolled initial value | — |
| `native/data-table:DataTable` | `defaultSort` | `import("@ui-lazy-dev/ui-native/dist/data-table/model.js").DataTableSort \| undefined` | Unspecified | Uncontrolled initial value | — |
| `native/data-table:DataTable` | `disabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `native/data-table:DataTable` | `emptyState` | `ReactNode` | Unspecified | Caller input | — |
| `native/data-table:DataTable` | `error` | `ReactNode` | Unspecified | Caller input | — |
| `native/data-table:DataTable` | `getPartTestID` | `((part: DataTablePart, context: DataTablePartContext) => string \| undefined) \| undefined` | Unspecified | Caller input | — |
| `native/data-table:DataTable` | `getRowLabel` | `(row: R) => string` | Required | Caller input | — |
| `native/data-table:DataTable` | `label` | `string` | Required | Caller input | — |
| `native/data-table:DataTable` | `labels` | `Partial<{ search: string; selectPage: string; previous: string; next: string; empty: string; cancel: string; save: string; saveFailed: string; select: (name: string) => string; edit: (column: string, name: string) => string; page: (current: number, total: number) => string; selected: (count: number) => string; loading: string; bulkFailed: string; ascending: string; descending: string; details: (name: string) => string; }> \| undefined` | Unspecified | Caller input | — |
| `native/data-table:DataTable` | `layout` | `"table" \| "adaptive" \| undefined` | Unspecified | Caller input | — |
| `native/data-table:DataTable` | `loading` | `boolean \| undefined` | Unspecified | Caller input | — |
| `native/data-table:DataTable` | `locale` | `string \| undefined` | Unspecified | Caller input | — |
| `native/data-table:DataTable` | `onPageChange` | `((page: number) => void) \| undefined` | Unspecified | Caller callback | — |
| `native/data-table:DataTable` | `onSearchChange` | `((query: string) => void) \| undefined` | Unspecified | Caller callback | — |
| `native/data-table:DataTable` | `onSelectionChange` | `((ids: string[]) => void) \| undefined` | Unspecified | Caller callback | — |
| `native/data-table:DataTable` | `onSortChange` | `((sort: import("@ui-lazy-dev/ui-native/dist/data-table/model.js").DataTableSort) => void) \| undefined` | Unspecified | Caller callback | — |
| `native/data-table:DataTable` | `pageSize` | `number \| undefined` | Unspecified | Caller input | — |
| `native/data-table:DataTable` | `partStyles` | `Partial<Record<DataTablePart, StyleProp<ViewStyle>>> \| undefined` | Unspecified | Caller input | — |
| `native/data-table:DataTable` | `readOnly` | `boolean \| undefined` | Unspecified | Caller input | — |
| `native/data-table:DataTable` | `ref` | `Ref<import("react-native/types_generated/src/private/webapis/dom/nodes/ReactNativeElement.js").default> \| undefined` | Unspecified | Caller reference | `import("react-native/types_generated/src/private/webapis/dom/nodes/ReactNativeElement.js").default` |
| `native/data-table:DataTable` | `rows` | `readonly R[]` | Required | Caller input | — |
| `native/data-table:DataTable` | `selectedIds` | `readonly string[] \| undefined` | Unspecified | Controlled value | — |
| `native/data-table:DataTable` | `server` | `import("@ui-lazy-dev/ui-native/dist/data-table/model.js").DataTableServer \| undefined` | Unspecified | Caller input | — |
| `native/data-table:DataTable` | `size` | `"sm" \| "md" \| "lg" \| undefined` | Unspecified | Caller input | — |
| `native/data-table:DataTable` | `style` | `StyleProp<ViewStyle> \| undefined` | Unspecified | Caller input | — |
| `native/data-table:DataTable` | `testID` | `string \| undefined` | Unspecified | Caller input | — |
| `native/data-table:DataTable` | `textStyle` | `StyleProp<TextStyle> \| undefined` | Unspecified | Caller input | — |
| `native/data-table:DataTable` | `theme` | `ResolvedTokens \| undefined` | Unspecified | Caller input | — |
| `native/data-table:DataTable` | `toolbar` | `ReactNode` | Unspecified | Caller input | — |
| `native/data-table:DataTable` | `unstyled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `native/data-table:useDataTable` | `__0` | `UseDataTableOptions<R>` | Required | Caller input | — |

### React web

#### Rendering

DataTable and useDataTable run in a client component. A server-rendered client component supplies initial table headers, records, a labeled search field and real page controls before hydration. Keep column value functions and event handlers inside the client boundary.

A search field precedes the scroll region and native table. Column headers own sort buttons. A column may provide a render slot or an edit callback. Optional checkboxes and a bulk action work on row IDs.

#### Headless API

Import `useDataTable` from the canonical family subpath for sorting, filtering, paging and selection without the table renderer. The hook exposes the current page, selected IDs, mixed-selection state and actions such as `goToPage` and `sortBy`.

#### Test helpers

Use `getDataTableRow(table, id)` to find a mounted HTML row by its stable application ID. It returns undefined when the current page does not contain the record. Query real named controls for edit, selection and paging interactions.

#### Platform differences

| Platform | Public contract |
| --- | --- |
| Web | `DataTable` from `@ui-lazy-dev/ui-web/collections`. |
| Native | The native subpath exposes DataTable and useDataTable. Native selection uses real accessibility checkboxes and compact layouts disclose secondary fields. |

**Variants.** Read-only columns render values. Editable columns open an inline editor. A bulk action and controlled selection expose record checkboxes. The adaptive layout fits smaller screens. The table layout retains columns. The public sizes are small, medium and large. Page size defaults to 25.

**Accessibility.** Use a distinct table label and meaningful row names for checkboxes and edit buttons. Localize page, sort context and action labels. Horizontal scrolling preserves column order. Table borders inherit the surrounding foreground; keyboard outlines use the system highlight color. Search, paging and edit buttons use a minimum height in the stylesheet. The table uses logical alignment and has no animation. In forced colors, the focus outline uses Highlight. While a save is pending the row retains its draft, and duplicate submissions are blocked.

**Tokens.** Layout and control spacing follow the semantic theme. Native supports per-part style overrides, and web publishes stable data-part names for application CSS.

**Composition.** Use stable unique IDs. For local collections, supply the complete array. For a server-fed table, supply one already filtered and sorted page with `server.state`, `server.totalRows` and `server.onStateChange`. A page change retains selected IDs from other pages. Keep requests and response ordering in the owning application. Place editor widgets outside nested forms. [Catalog fixture](../../catalog/data-table.stories.tsx).

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Default | Render initial rows | Native table announces column headers and data cells | Sort, edit and paging controls | Controls in DOM order | [Sort, paging and empty-state test](../../tests/data-table/collections.test.tsx#L50) |
| Sorted | Activate a sortable heading | aria-sort changes to ascending or descending | Sort again to reverse | Sort button | [Sort, paging and empty-state test](../../tests/data-table/collections.test.tsx#L50) |
| Empty | Search for absent text | Table exposes localized empty text | Search remains available | Search input | [Sort, paging and empty-state test](../../tests/data-table/collections.test.tsx#L50) |
| Selected | Check records and filter or page | Checked, mixed or unchecked page checkbox | Bulk button when selection exists | Visible controls | [Selection test](../../tests/data-table/collections.test.tsx#L28) |
| Editing | Open the edit control | Named textbox and Save and Cancel controls | Yes | Draft input | [Edit, save and retry test](../../tests/data-table/collections.test.tsx#L66) |
| Saving | Submit an asynchronous edit | Draft is read-only while the promise is outstanding | Submit and cancel blocked | Draft input | [Edit, save and retry test](../../tests/data-table/collections.test.tsx#L66) |
| Failed | Reject the edit promise | Error alert plus retained input | Retry Save | Draft and controls | [Edit, save and retry test](../../tests/data-table/collections.test.tsx#L66) |

#### Performance

The packed canonical entry measures 3,409 B of JavaScript and 990 B for its stylesheet, or 4,399 B gzip against the 15 KB family budget. The canonical named `DataTable` import measures 3,342 B. The previously released collections named route measures 3,339 B. The optional collections entry measures 82,904 B, and its aggregate stylesheet measures 1,290 B including the table sheet. A browser loading the aggregate CSS directly makes two requests. Both stylesheets use the same table rules. The standalone sheet provides the published focus width, offset, touch target, spacing, corner radius and caption size when an app loads it before its theme. Its minimum target remains 44 CSS pixels at application root font sizes of 10, 16 and 32 pixels. These JavaScript measurements exclude React and React DOM. [Bundle methodology](../../scripts/verify-bundles.mjs)

#### Tests

- Default. [Sort, paging and empty-state test](../../tests/data-table/collections.test.tsx#L50)
- Sorted. [Sort, paging and empty-state test](../../tests/data-table/collections.test.tsx#L50)
- Empty. [Sort, paging and empty-state test](../../tests/data-table/collections.test.tsx#L50)
- Selected. [Selection test](../../tests/data-table/collections.test.tsx#L28)
- Editing. [Edit, save and retry test](../../tests/data-table/collections.test.tsx#L66)
- Saving. [Edit, save and retry test](../../tests/data-table/collections.test.tsx#L66)
- Failed. [Edit, save and retry test](../../tests/data-table/collections.test.tsx#L66)
- [Server requests, paging, edits and retained cross-page selection](../../tests/data-table/data-table.spec.ts)
- [Phone and desktop visual cases](../../tests/data-table/data-table.visual.ts)
- [Headless, unstyled, server-rendered and failed bulk action cases](../../tests/data-table/ownership.test.tsx)

#### Changelog and deprecations

The `0.3.0-rc.1` draft documents the public contract introduced in `0567838`. No deprecations are declared.

### React Native

#### Rendering

DataTable renders real native text inputs, checkboxes, buttons and accessible cell values. In adaptive compact mode the first cell identifies the row and a named details action reveals its secondary columns. The table layout retains all visible columns. Pass `partStyles`, `textStyle` or `unstyled` for consumer presentation.

#### Headless API

Import `useDataTable` from `@ui-lazy-dev/ui-native/data-table`. It exposes the same state and selection actions as the web hook, including controlled server paging and off-page selection.

#### Test helpers

The native renderer exposes `getPartTestID(part, context)` for assigning deterministic component-part identifiers. The shared scenarios activate named controls and assert the native accessibility state of checkboxes.

#### Platform differences

Web renders a semantic HTML table. Native expresses row selection as accessibility checkboxes and sorting as named native buttons. Closed compact rows keep secondary values behind a details control. The native search and editor present the operating system keyboard. Set `keyboardShouldPersistTaps="handled"` on each enclosing React Native `ScrollView` so the first Save or Cancel tap reaches its action while the keyboard is open.

#### Performance

The canonical native subpath measures 5,384 B gzip in isolation. Adding it to a bundle that already imports Button costs 3,776 B. These tree-shaken JavaScript measurements exclude React, React Native and the shared tokens.

Native renders the current page. Local mode processes the supplied collection. Remote mode consumes one owner-provided page and its total, avoiding a second client-side sort or slice.

#### Tests

The [native renderer suite](../../tests/data-table/native.test.cjs) exercises sort order, mixed selection, server-owned rows, async editing and retry. [The portable journeys](data-table.scenarios.yaml) cover column sorting, the mixed selection state, cross-page archiving, an empty result and a failed save followed by a successful retry.

#### Changelog and deprecations

Import `DataTable` and `useDataTable` from `@ui-lazy-dev/ui-native/data-table` on native. The existing web `DataTable` import remains available from `@ui-lazy-dev/ui-web/collections`.
