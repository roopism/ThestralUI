---
{
  "family": "Virtual data grid",
  "status": "draft",
  "since": "0.3.0-rc.1",
  "owner": "@roopism",
  "platforms": {
    "web": "supported",
    "native": "planned"
  },
  "exports": [
    {
      "platform": "web",
      "name": "VirtualDataGrid",
      "from": "@ui-lazy-dev/ui-web/collections"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/Table",
    "https://mui.com/material-ui/react-table/"
  ]
}
---

# Virtual data grid

## Part A — Contract

### Purpose and when not to use it

Explore a large collection with row and cell navigation while bounding the visible set of rows. Use the data table for paged sorting, search and inline editing.

### Anatomy

A bounded view exposes the currently reachable rows, cells and column headers. Row identifiers preserve selection while scrolling.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| headers | Required | N/A — required | Container gap | Children retain their semantics | Operable children keep their order |
| cells | Required | N/A — required | Container gap | Children retain their semantics | Operable children keep their order |
| empty | Optional | collapse | Container gap | Children retain their semantics | Operable children keep their order |

### Variants

Row and viewing-area height control density. Keep cell content within the chosen row height and place longer information in a detail view.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Default | Display the collection | Inherited text and row dividers | The grid exposes named row and column headers | Row action if supplied | Grid navigation | Pending: default scenario |
| Focused offscreen row | Navigate to a distant row | System focus ring | The requested record becomes accessible | Depends on row action | Active row | Pending: focused offscreen row scenario |

### Keyboard, pointer and touch

End from the first row reveals the final row.

### Accessibility

Name the grid, identify records in the first column and ensure row actions are also accessible from a keyboard. Fixed rows clip long content; provide the full text in the accessible cell or a detail view. The focused row uses a current-color outline and selected rows use operating-system highlight colors. The default configuration adds no animation. Verify custom cell presentations in forced colors and RTL.

### State patterns

An empty collection can expose substitute content. The record owner supplies loading, offline and retry behavior.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

Semantic density and contrast mappings remain open.

### Composition and content guidelines

Use “Shipment 5084” instead of a repeated “View” cell.

## Part B — Bindings

### API

Records and columns are caller inputs. Selection can use `selectedKeys` or `defaultSelectedKeys`; row actions and selection callbacks follow the shipped Table declarations. The public interface forwards its six declared interaction options. No root DOM ref.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `collections:VirtualDataGrid` | `columns` | `readonly VirtualGridColumn<R>[]` | Required | Caller input | — |
| `collections:VirtualDataGrid` | `defaultSelectedKeys` | `"all" \| Iterable<import("react-aria-components").Key> \| undefined` | Unspecified | Uncontrolled initial value | — |
| `collections:VirtualDataGrid` | `disabledKeys` | `Iterable<import("react-aria-components").Key> \| undefined` | Unspecified | Caller input | — |
| `collections:VirtualDataGrid` | `empty` | `ReactNode` | Unspecified | Caller input | — |
| `collections:VirtualDataGrid` | `height` | `import("csstype").Property.Height<string \| number> \| undefined` | Unspecified | Caller input | — |
| `collections:VirtualDataGrid` | `label` | `string` | Required | Caller input | — |
| `collections:VirtualDataGrid` | `onRowAction` | `((key: import("react-aria-components").Key) => void) \| undefined` | Unspecified | Caller callback | — |
| `collections:VirtualDataGrid` | `onSelectionChange` | `((keys: import("react-aria-components").Selection) => void) \| undefined` | Unspecified | Caller callback | — |
| `collections:VirtualDataGrid` | `rowHeight` | `number \| undefined` | Unspecified | Caller input | — |
| `collections:VirtualDataGrid` | `rows` | `readonly R[]` | Required | Caller input | — |
| `collections:VirtualDataGrid` | `selectedKeys` | `"all" \| Iterable<import("react-aria-components").Key> \| undefined` | Unspecified | Controlled value | — |
| `collections:VirtualDataGrid` | `selectionMode` | `import("react-aria-components").SelectionMode \| undefined` | Unspecified | Caller input | — |

### React web

#### Rendering

`collections` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

A React Aria Virtualizer manages a Table, header, rows and cells. The first column serves as the row header. The caller supplies cell renderers and the empty-state slot.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Platform | Public contract |
| --- | --- |
| Web | `VirtualDataGrid` from `@ui-lazy-dev/ui-web/collections`. |
| Native | Planned. No exported renderer or simulator journey. Track parity in the [family inventory](../component-inventory.md). |

**Variants.** Adjust rowHeight and viewport height for density. The column renderer must fit the fixed row height; use a detail panel for multiline content.

**Keyboard and pointer.** Move within the grid using its React Aria navigation. End from the first row reveals the final row. The scroll container supports wheel and touch scrolling; recycled DOM nodes must never hold product selection.

**Accessibility.** Name the grid, identify records in the first column and ensure row actions are also accessible from a keyboard. Selection uses Highlight/HighlightText. Fixed rows clip long content; provide the full text in the accessible cell or a detail view. The focused row uses a current-color outline and selected rows use operating-system highlight colors. Row geometry follows rowHeight. The default configuration adds no animation. Verify custom renderers in forced colors and RTL.

**Tokens.** N/A — The grid stylesheet uses inherited foreground and operating-system selection colors. Semantic density and contrast mappings remain open.

**Composition.** Mount one virtualizer around a stable row collection. Keep ID-based selection in the host while replacing data; keep additional interactive content out of the row header unless its navigation is explicitly tested. [Catalog fixture](../../catalog/EnterpriseCollections.stories.tsx).

**Content guidelines.** Use “Shipment 5084” instead of a repeated “View” cell. Keep headers short and localize dates and quantities in `column.render`.

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Default | Mount a populated grid | Named grid, column headers and row headers | Row action if supplied | Grid navigation | [enterprise-collections.spec.ts L3](../../tests/virtual-data-grid/enterprise-collections.spec.ts#L3) |
| Focused offscreen row | Focus first row and press End | Final record is mounted in grid | Depends on row action | Active row | [enterprise-collections.spec.ts L3](../../tests/virtual-data-grid/enterprise-collections.spec.ts#L3) |

#### Performance

The production named-import measurement is 71,036 B gzip for `VirtualDataGrid`. The optional `/collections` entry stays outside the default web entry. Measurements exclude React and React DOM and count JavaScript separately from CSS. [Bundle methodology](../../scripts/verify-bundles.mjs)

#### Tests

- Default. [enterprise-collections.spec.ts L3](../../tests/virtual-data-grid/enterprise-collections.spec.ts#L3)
- Focused offscreen row. [enterprise-collections.spec.ts L3](../../tests/virtual-data-grid/enterprise-collections.spec.ts#L3)
- Browser coverage. [enterprise-collections.spec.ts](../../tests/virtual-data-grid/enterprise-collections.spec.ts)
- The primary regression is a browser journey; a dedicated component unit fixture remains open.
- A dedicated visual baseline for this family remains open.
- Simulator coverage awaits a native export.

#### Changelog and deprecations

The `0.3.0-rc.1` draft documents the public contract introduced in `d4dc70b`. No deprecations are declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Virtual data grid.

#### Headless API

None. No native binding is exported.

#### Test helpers

None. No native binding is exported.

#### Platform differences

The web binding above records current platform coverage. Pending: document native parity or a reason for exclusion.

#### Performance

N/A — no native entry for this family.

#### Tests

Pending: native renderer and iPhone Simulator scenarios require an implementation.

#### Changelog and deprecations

N/A — no native export to migrate.
