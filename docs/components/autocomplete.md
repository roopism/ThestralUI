---
{
  "family": "Autocomplete",
  "status": "draft",
  "since": "0.3.0-rc.1",
  "owner": "@thetechgeeek",
  "platforms": {
    "web": "exported",
    "native": "planned"
  },
  "exports": [
    {
      "platform": "web",
      "name": "Autocomplete",
      "from": "@ui-lazy-dev/ui-web/forms"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/Autocomplete",
    "https://mui.com/material-ui/react-autocomplete/"
  ]
}
---

# Autocomplete

## Part A — Contract

### Purpose and when not to use it

Filter an associated collection from a separate search field. Choose Combobox for an editable single-selection form field.

### Anatomy

A query narrows the items in an associated collection.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| search field | Required | N/A — required | Container gap | Control has its own name | Participates in its logical position |
| results | Required | N/A — required | Container gap | Children retain their semantics | Operable children keep their order |

### Variants

Control the query for local or server filtering. The collection determines result selection and action semantics.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Filtering | Enter a matching query | Input surface and visible rows | Only matching options remain | Matching options only | Search input | Pending: filtering scenario |
| No match | Enter a query without matches | Caller empty-state treatment | Empty message replaces results | No option | Search input | Pending: no match scenario |
| Restored | Clear the query | Regular option content returns | Matching choices return | Yes | Search input | Pending: restored scenario |

### Keyboard, pointer and touch

Type into the search editor to filter. Keep keyboard access to the results and retain an editable input while the result count changes.

### Accessibility

Name the search field and the result collection individually. Include meaningful option text for assistive technology. Use the field’s localized labels in RTL layouts. Review touch-target geometry, contrast, forced colors and reduced-motion behavior in the consumer theme before promoting this draft.

### State patterns

An empty result replaces the options when a filter matches nothing. Clearing the filter restores matching choices.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

| Part or state | Token |
| --- | --- |
| Input foreground / light | `light.text` |
| Input surface / light | `light.surface` |
| Input surface / dark | `dark.surface` |
| Field border / light | `light.muted` |
| Field border / dark | `dark.muted` |
| Keyboard outline | `density.focusWidth` |

### Composition and content guidelines

Use “Find region”. Avoid “Filter”. Localize the whole label and keep it available when constrained text wraps.

## Part B — Bindings

### API

`inputValue` controls the query and `onInputChange(text)` receives proposed changes. `defaultInputValue` initializes an internally managed query. A custom `filter(textValue, query, node)` decides whether a collection node remains visible. The SearchField supplies the editor and ListBox supplies result selection.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `forms:Autocomplete` | `children` | `React.ReactNode` | Required | Caller content | — |
| `forms:Autocomplete` | `defaultInputValue` | `string \| undefined` | Unspecified | Uncontrolled initial value | — |
| `forms:Autocomplete` | `disableAutoFocusFirst` | `boolean \| undefined` | `false` | Caller input | — |
| `forms:Autocomplete` | `disableVirtualFocus` | `boolean \| undefined` | `false` | Caller input | — |
| `forms:Autocomplete` | `filter` | `((textValue: string, inputValue: string, node: Node<T>) => boolean) \| undefined` | Unspecified | Caller input | — |
| `forms:Autocomplete` | `inputValue` | `string \| undefined` | Unspecified | Controlled value | — |
| `forms:Autocomplete` | `onInputChange` | `((value: string) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Autocomplete` | `slot` | `string \| null \| undefined` | Unspecified | Caller input | — |

### React web

#### Rendering

`forms` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

Autocomplete shares the query and filtering context between SearchField and a collection. The caller composes the result rows.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Surface | Web | Native |
| --- | --- | --- |
| Availability | `Autocomplete` | planned. Track a platform contract and simulator fixture in the [family inventory](../component-inventory.md). |

**Tokens.** These mappings apply inside the optional `uld-controls` scope. A headless import does not install the stylesheet.

**Composition.** Place SearchField/Input and a separate ListBox under one Autocomplete. Give complex rows textValue so the predicate can search the same description users hear. Supply a distinct renderEmptyState message when filtering leaves no results.

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Filtering | Type west in the controlled SearchField | West remains available while East leaves the collection | Matching options only | Search input | [Filtered collection](../../tests/depth-controls.test.tsx#L37) |
| No match | Set a query that matches no data | Empty message is rendered and previous option is unavailable | No option | Search input | [No matching team](../../tests/autocomplete/form-spec-states.test.tsx#L9) |
| Restored | Clear the query | Empty searchbox and matching option reappear together | Yes | Search input | [Restored unfiltered collection](../../tests/autocomplete/form-spec-states.test.tsx#L9) |

#### Performance

Named JavaScript exports measured independently from the packed web consumer, gzip level 9, with React and React DOM external: `Autocomplete` 9,396 B. These optional imports stay out of the web root. Their sizes overlap when used together. [Measurement method](../../scripts/verify-bundles.mjs) The optional scoped `controls.css` entry measures 1,485 B gzip including its theme tokens. Apply `.uld-controls` to a containing element to opt into its treatments.

#### Tests

- **Filtering.** [Filtered collection](../../tests/depth-controls.test.tsx#L37).
- **No match.** [No matching team](../../tests/autocomplete/form-spec-states.test.tsx#L9).
- **Restored.** [Restored unfiltered collection](../../tests/autocomplete/form-spec-states.test.tsx#L9).
- Dedicated browser coverage for the full contract remains open.
- Dedicated visual qualification and native simulator coverage remain open.

Virtual focus during keyboard navigation and announcements of rapidly changing result counts require browser and assistive-technology qualification.

#### Changelog and deprecations

The `0.3.0-rc.1` draft records the current public contract. Consult the packed declarations for upstream deprecation notices when upgrading React Aria.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Autocomplete.

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
