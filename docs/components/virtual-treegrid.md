---
{
  "family": "Virtual treegrid",
  "status": "draft",
  "since": "0.3.0-rc.1",
  "owner": "@thetechgeeek",
  "platforms": {
    "web": "supported",
    "native": "planned"
  },
  "exports": [
    {
      "platform": "web",
      "name": "VirtualTree",
      "from": "@ui-lazy-dev/ui-web/collections"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/Tree",
    "https://react-aria.adobe.com/Table"
  ]
}
---

# Virtual treegrid

## Part A — Contract

### Purpose and when not to use it

Expand a hierarchy and select records by stable ID. Choose a virtual data grid for flat rows and columns.

### Anatomy

Rows form a hierarchy with distinct expand and select actions. Child rows follow their parent when expanded.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| rows | Required | N/A — required | Container gap | Children retain their semantics | Operable children keep their order |
| row content | Optional | fallback — use the row label | Container gap | Children retain their semantics | Operable children keep their order |
| empty | Optional | collapse | Container gap | Children retain their semantics | Operable children keep their order |

### Variants

Leaves omit the chevron. Parents can expand to reveal nested rows.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Collapsed | Collapse a parent | Chevron toward logical end | The row reports collapsed | Chevron or arrow key | Active row | Pending: collapsed scenario |
| Expanded | Expand a parent | Rotated chevron | Its children become reachable | Child navigation | Parent or child | Pending: expanded scenario |
| Selected child | Choose a child | See Tokens | The child row reports selected | Selection according to mode | Active child | Pending: selected child scenario |

### Keyboard, pointer and touch

Right expands, Down moves to a child, Space selects, and Left collapses in the LTR journey. The chevron provides a pointer target. Keep traversal in the tree rather than introducing separate Tab stops inside each cell.

### Accessibility

A visible label accompanies the treegrid name. RTL reverses the collapsed chevron; verify keyboard direction and translated label fit per locale. The disclosure button has a minimum target in both dimensions. Focus uses a current-color outline and selection uses operating-system colors. Changes to expansion are immediate.

### State patterns

An empty hierarchy can expose substitute content. The data owner distinguishes an empty tree from unavailable children.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

Semantic tree geometry is an open item.

### Composition and content guidelines

Put long detail content in a sibling panel. Use “Design team” with children such as “Research”; avoid “Group 1” if more descriptive names are available.

## Part B — Bindings

### API

Expanded and selected keys each support controlled or default state. The caller supplies stable IDs, optional disabled keys, selection/action handlers and an optional empty slot. The root does not expose a ref.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `collections:VirtualTree` | `defaultExpandedKeys` | `Iterable<import("react-aria-components").Key> \| undefined` | Unspecified | Uncontrolled initial value | — |
| `collections:VirtualTree` | `defaultSelectedKeys` | `"all" \| Iterable<import("react-aria-components").Key> \| undefined` | Unspecified | Uncontrolled initial value | — |
| `collections:VirtualTree` | `disabledKeys` | `Iterable<import("react-aria-components").Key> \| undefined` | Unspecified | Caller input | — |
| `collections:VirtualTree` | `empty` | `ReactNode` | Unspecified | Caller input | — |
| `collections:VirtualTree` | `expandedKeys` | `Iterable<import("react-aria-components").Key> \| undefined` | Unspecified | Controlled value | — |
| `collections:VirtualTree` | `height` | `import("csstype").Property.Height<string \| number> \| undefined` | Unspecified | Caller input | — |
| `collections:VirtualTree` | `items` | `readonly TreeEntry[]` | Required | Caller input | — |
| `collections:VirtualTree` | `label` | `string` | Required | Caller input | — |
| `collections:VirtualTree` | `onAction` | `((key: import("react-aria-components").Key) => void) \| undefined` | Unspecified | Caller callback | — |
| `collections:VirtualTree` | `onExpandedChange` | `((keys: Set<import("react-aria-components").Key>) => any) \| undefined` | Unspecified | Caller callback | — |
| `collections:VirtualTree` | `onSelectionChange` | `((keys: import("react-aria-components").Selection) => void) \| undefined` | Unspecified | Caller callback | — |
| `collections:VirtualTree` | `renderItem` | `((item: TreeEntry) => ReactNode) \| undefined` | Unspecified | Caller input | — |
| `collections:VirtualTree` | `rowHeight` | `number \| undefined` | Unspecified | Caller input | — |
| `collections:VirtualTree` | `selectedKeys` | `"all" \| Iterable<import("react-aria-components").Key> \| undefined` | Unspecified | Controlled value | — |
| `collections:VirtualTree` | `selectionMode` | `import("react-aria-components").SelectionMode \| undefined` | Unspecified | Caller input | — |

### React web

#### Rendering

`collections` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

A ListLayout virtualizer wraps the named treegrid. Each item supplies a text value, optional chevron, label/renderItem slot and child collection. Logical start padding denotes depth.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Platform | Public contract |
| --- | --- |
| Web | `VirtualTree` from `@ui-lazy-dev/ui-web/collections`. |
| Native | Planned. No exported renderer or simulator journey. Track parity in the [family inventory](../component-inventory.md). |

**Variants.** Leaves omit the chevron. Parents can expand to reveal nested rows. Viewport and fixed row height are configurable; selection mode is independent of expansion.

**Accessibility.** A visible label accompanies the treegrid name. RenderItem must preserve the text identity supplied by each record. RTL reverses the collapsed chevron; verify keyboard direction and translated label fit per locale. The disclosure button has a minimum target in both dimensions. Focus uses a current-color outline and selection uses operating-system colors. Changes to expansion are immediate. Verify row actions at high text zoom with the chosen rowHeight.

**Tokens.** N/A — Tree indentation, chevron geometry and system selection colors currently live in the collection styles. Semantic tree geometry is an open item.

**Composition.** Give every descendant a unique stable ID and avoid unbounded recursion in incoming data. Put long detail content in a sibling panel. [Catalog fixture](../../catalog/EnterpriseCollections.stories.tsx).

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Collapsed | Render parent without expanded key | Row aria-expanded=false | Chevron or arrow key | Active row | [enterprise-collections.spec.ts L14](../../tests/virtual-treegrid/enterprise-collections.spec.ts#L3) |
| Expanded | Right arrow on parent | Row aria-expanded=true | Child navigation | Parent or child | [enterprise-collections.spec.ts L14](../../tests/virtual-treegrid/enterprise-collections.spec.ts#L3) |
| Selected child | Down then Space | Row aria-selected=true | Selection according to mode | Active child | [enterprise-collections.spec.ts L14](../../tests/virtual-treegrid/enterprise-collections.spec.ts#L3) |

#### Performance

The production named-import measurement is 57,931 B gzip for `VirtualTree`. The optional `/collections` entry stays outside the default web entry. Measurements exclude React and React DOM and count JavaScript separately from CSS. [Bundle methodology](../../scripts/verify-bundles.mjs)

#### Tests

- Collapsed. [enterprise-collections.spec.ts L14](../../tests/virtual-treegrid/enterprise-collections.spec.ts#L3)
- Expanded. [enterprise-collections.spec.ts L14](../../tests/virtual-treegrid/enterprise-collections.spec.ts#L3)
- Selected child. [enterprise-collections.spec.ts L14](../../tests/virtual-treegrid/enterprise-collections.spec.ts#L3)
- Browser coverage. [enterprise-collections.spec.ts](../../tests/virtual-treegrid/enterprise-collections.spec.ts)
- The primary regression is a browser journey; a dedicated component unit fixture remains open.
- A dedicated visual baseline for this family remains open.
- Simulator coverage awaits a native export.

#### Changelog and deprecations

The `0.3.0-rc.1` draft documents the public contract introduced in `d4dc70b`. No deprecations are declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Virtual treegrid.

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
