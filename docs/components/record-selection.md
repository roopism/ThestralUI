---
{
  "family": "Record selection",
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
      "name": "RecordList",
      "from": "@ui-lazy-dev/ui-web/workflows"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/ListBox",
    "https://mui.com/material-ui/react-table/"
  ]
}
---

# Record selection

## Part A — Contract

### Purpose and when not to use it

Choose one record from a labeled list to display its details. Use the navigation bar when activating an item changes the URL.

### Anatomy

The named list presents options with selection and availability. An empty message can replace the options.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| options | Required | N/A — required | Container gap | Children retain their semantics | Operable children keep their order |
| description | Optional | collapse | Container gap | Provides supporting information | Text adds no stop |
| empty | Optional | fallback — use the localized empty message | Container gap | Provides supporting information | Text adds no stop |

### Variants

Single selection uses replace behavior. A disabled record remains present. The optional empty slot defaults to “No records.”

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Selected | Select a record | Accent and on-accent | The chosen option exposes selection | Yes when enabled | Roving option | Pending: selected scenario |
| Selection request | Request a different record | See Tokens | The owner receives the new selection | Yes | Activated option | Pending: selection request scenario |

### Keyboard, pointer and touch

Keep button or link controls outside options.

### Accessibility

Set a meaningful list label and distinct option labels. Descriptions supplement the item label. Localize the empty slot. Use logical order for RTL, and check selected text against the selected background in each brand theme. The list adds no animation.

### State patterns

An empty list replaces choices with the supplied or localized empty message.

### Localization

Default messages are mapped to `recordList.empty`. Preserve caller-supplied translations. [Message inventory](../library-strings.md)

### Tokens

| Part or state | Token |
| --- | --- |
| Selected item fill | `light.accent`, `dark.accent` |
| Selected item label | `light.onAccent`, `dark.onAccent` |
| Container edge | `light.border`, `dark.border` |
| Container corner | `size.radius` |
| Hover fill | `light.surface`, `dark.surface` |

### Composition and content guidelines

Use “Ada Lovelace” with “Research team” as the description; avoid putting the same truncated name on several records.

## Part B — Bindings

### API

The host controls selectedId (including null) and receives an ID in onSelect. The component requests single selection and does not store record content. Root DOM props and ref are not exposed.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `workflows:RecordList` | `empty` | `ReactNode` | Unspecified | Caller input | — |
| `workflows:RecordList` | `items` | `readonly RecordListItem[]` | Required | Caller input | — |
| `workflows:RecordList` | `label` | `string` | Required | Caller input | — |
| `workflows:RecordList` | `onSelect` | `(id: string) => void` | Required | Caller callback | — |
| `workflows:RecordList` | `selectedId` | `string \| null` | Required | Caller input | — |

### React web

#### Rendering

`workflows` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

The named listbox contains options with a required label, optional description and exposed selection/disabled states. The optional empty slot replaces missing options.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Platform | Public contract |
| --- | --- |
| Web | `RecordList` from `@ui-lazy-dev/ui-web/workflows`. |
| Native | Planned. No exported renderer or simulator journey. Track parity in the [family inventory](../component-inventory.md). |

**Keyboard and pointer.** Use arrow navigation and Enter for selection through React Aria; clicking an enabled option requests its ID. Keep button or link controls outside options.

**Accessibility.** Set a meaningful list label and distinct option labels. Descriptions supplement the item label. Selected and focused appearance differ; disabled text uses the system GrayText color. Localize the empty slot. The stylesheet reserves a minimum block size per option and uses a current-color focus ring. Use logical order for RTL, and check selected text against the selected background in each brand theme. The list adds no animation.

**Composition.** Pair controlled selectedId with the detail in SplitView. Retain selection by ID after reordering, and decide what to display after deletion in the host. [Catalog fixture](../../catalog/EnterpriseWorkspace.stories.tsx).

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Selected | Supply selectedId | Option aria-selected=true | Yes when enabled | Roving option | [workflow-shell.test.tsx L63](../../tests/workflow-shell.test.tsx#L9) |
| Selection request | Activate another option | Listbox requests replacement | Yes | Activated option | [workflow-shell.test.tsx L63](../../tests/workflow-shell.test.tsx#L9) |

#### Performance

The production named-import measurement is 36,280 B gzip for `RecordList`. The optional `/workflows` entry stays outside the default web entry. Measurements exclude React and React DOM and count JavaScript separately from CSS. [Bundle methodology](../../scripts/verify-bundles.mjs)

#### Tests

- Selected. [workflow-shell.test.tsx L63](../../tests/workflow-shell.test.tsx#L9)
- Selection request. [workflow-shell.test.tsx L63](../../tests/workflow-shell.test.tsx#L9)
- Browser coverage. [enterprise-workspace.spec.ts L5](../../tests/browser/enterprise-workspace.spec.ts#L5)
- A dedicated visual baseline for this family remains open.
- Simulator coverage awaits a native export.
- The browser review fixture selects a record by pointer and verifies focus, scroll and selection across resize.

#### Changelog and deprecations

The `0.3.0-rc.1` draft documents the public contract introduced in `f7eeceb`. No deprecations are declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Record selection.

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
