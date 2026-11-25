---
{
  "family": "EmptyState",
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
      "name": "EmptyState",
      "from": "@ui-lazy-dev/ui-web/patterns",
      "rendering": "server-safe"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/Group",
    "https://mui.com/material-ui/react-card/"
  ]
}
---

# EmptyState

## Part A — Contract

### Purpose and when not to use it

Explain an empty collection and, when useful, offer its first meaningful action. Use a loading indicator or an inline alert when results are pending or the request failed.

### Anatomy

A heading explains what is missing. Optional content provides context and a recovery action.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| heading | Required | N/A — required | Container gap | Provides the accessible name | Text adds no stop |
| illustration | Optional | collapse | Container gap | Excluded from the name | No stop |
| description | Optional | collapse | Container gap | Provides supporting information | Text adds no stop |
| action | Optional | collapse | Container gap | Action has its own name | Takes its place when available |

### Variants

The empty message may stand alone or include description, illustration and action. These slots alter content.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Empty with recovery action | Show an empty result with a next action | See Tokens | The heading explains the state and the action is reachable | Supplied action only | Supplied interactive descendants | Pending: empty with recovery action scenario |

### Keyboard, pointer and touch

The root needs no keyboard operation. Use a Button for a mutation or a link for navigation.

### Accessibility

Mark decorative illustrations hidden from assistive technology or give informative illustrations a concise alternative. There is no default motion or hit target. Check the optional recovery button in forced colors and with coarse input.

### State patterns

Represent the empty result with a heading and, when applicable, a recovery action. The owning surface distinguishes an empty result from a failed request.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

Styling and tokens come from the surrounding surface and the action or illustration component.

### Composition and content guidelines

Replace an empty results list in the existing panel. Keep search filters accessible for the “no matches” case and let the action clear or edit them. Use “No invoices yet” with “Create invoice”, or “No invoices match your filters” with “Clear filters”. Avoid “Nothing here” because it offers no explanation.

## Part B — Bindings

### API

Set title to the heading text. The caller owns the illustration, action and any stateful behavior inside those slots. Ordinary div props and a root ref pass through. headingLevel sets the document outline.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `patterns:EmptyState` | `action` | `ReactNode` | Unspecified | Caller input | — |
| `patterns:EmptyState` | `className` | `string \| undefined` | Unspecified | Caller input | — |
| `patterns:EmptyState` | `description` | `ReactNode` | Unspecified | Caller input | — |
| `patterns:EmptyState` | `headingLevel` | `2 \| 3 \| 4 \| undefined` | Unspecified | Caller input | — |
| `patterns:EmptyState` | `illustration` | `ReactNode` | Unspecified | Caller input | — |
| `patterns:EmptyState` | `ref` | `import("react").Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `patterns:EmptyState` | `style` | `import("react").CSSProperties \| undefined` | Unspecified | Caller input | — |
| `patterns:EmptyState` | `title` | `string` | Required | Caller input | — |
| `patterns:EmptyState` | Host attributes | 275 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`patterns` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

The root contains an optional illustration, required heading, optional description paragraph and an optional action. The heading is h2 by default and can be h3 or h4.

#### Headless API

None. This family provides presentation or structure without separate behavior to extract.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Platform | Public contract |
| --- | --- |
| Web | `EmptyState` from `@ui-lazy-dev/ui-web/patterns`. |
| Native | Planned. No exported renderer or simulator journey. Track parity in the [family inventory](../component-inventory.md). |

**Variants.** The empty message may stand alone or include description, illustration and action. These slots alter content. The component has no size or tone API.

**Keyboard and pointer.** The root needs no keyboard operation. Tab reaches an optional action according to its own HTML semantics. Use a Button for a mutation or a link for navigation.

**Accessibility.** Match headingLevel to neighboring content. Mark decorative illustrations hidden from assistive technology or give informative illustrations a concise alternative. An empty message inserted asynchronously needs a host announcement if focus remains elsewhere. There is no default motion or hit target. The host controls text contrast, line wrapping and direction. Check the optional recovery button in forced colors and with coarse input.

**Tokens.** N/A — EmptyState supplies structure and slot order. Styling and tokens come from the surrounding surface and the action or illustration component.

**Composition.** Replace an empty results list in the existing panel. Keep search filters accessible for the “no matches” case and let the action clear or edit them. [Catalog fixture](../../catalog/DocumentReview.stories.tsx).

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Empty with recovery action | Render the empty collection | Heading and supplied action are exposed | Supplied action only | Supplied interactive descendants | [patterns.test.tsx L52](../../tests/emptystate/patterns.test.tsx#L9) |
| Empty with recovery action | Omit every optional slot, or supply all of them | Optional slots collapse with no empty paragraph; reading order is illustration, heading, description, action; caller attributes kept; no live role | Supplied action only | Supplied interactive descendants | [Slot collapse and order](../../tests/emptystate/patterns.test.tsx) |

#### Performance

The production named-import measurement is 271 B gzip for `EmptyState`. The optional `/patterns` entry stays outside the default web entry. Measurements exclude React and React DOM and count JavaScript separately from CSS. [Bundle methodology](../../scripts/verify-bundles.mjs)

#### Tests

- Empty with recovery action. [patterns.test.tsx L52](../../tests/emptystate/patterns.test.tsx#L9) and [slot collapse and reading order](../../tests/emptystate/patterns.test.tsx).
- Open: `/patterns` ships no stylesheet, so centered layout, illustration sizing and spacing tokens wait for a per-family sheet; the entry has 32 B of script headroom.
- A dedicated three-engine journey for this family remains open.
- A dedicated visual baseline for this family remains open.
- Simulator coverage awaits a native export.

#### Changelog and deprecations

The `0.3.0-rc.1` draft documents the public contract introduced in `f58a492`. No deprecations are declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of EmptyState.

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
