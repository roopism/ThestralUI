---
{
  "family": "Skeleton",
  "status": "draft",
  "since": "0.3.0-rc.1",
  "owner": "@roopism",
  "platforms": {
    "web": "exported",
    "native": "planned"
  },
  "exports": [
    {
      "platform": "web",
      "name": "Skeleton",
      "from": "@ui-lazy-dev/ui-web/primitives",
      "rendering": "server-safe"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/",
    "https://mui.com/material-ui/react-skeleton/"
  ]
}
---

# Skeleton

## Part A — Contract

### Purpose and when not to use it

Reserve the shape of unfinished content while a request runs. Choose Spinner for a named indeterminate activity, or Progress for measurable work.

### Anatomy

A decorative shape reserves the space of content that is still loading.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | No content slot | No slot focus stop |

### Variants

One stationary block. There is no built-in shimmer variant.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Loading placeholder | Show a loading placeholder | Border fill and radius | The placeholder adds no accessible stop | No | No | Pending: loading placeholder scenario |

### Keyboard, pointer and touch

The placeholder has no keyboard operation. Do not place focusable controls in its hidden subtree. When switching to loaded content, maintain focus in the owning workflow.

### Accessibility

Skeleton is decorative. Use a sibling Status or an owner-managed loading announcement when needed. No animation runs, including in reduced motion. Forced colors draw an outline so the placeholder can remain visible. The placeholder has no text to localize, direction-sensitive glyph or hit area. Its border token conveys the shape without announcing a change.

### State patterns

Reserve the space that final content will occupy. The surrounding region announces loading once and replaces the placeholder when content is available.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

| Part or state | Token |
| --- | --- |
| Placeholder fill | `light.border`, `dark.border` |
| Corners | `size.radius` |

### Composition and content guidelines

Match the dimensions of the incoming row or card. Place accessible progress information outside the hidden subtree. Do use a separate message such as “Loading invoices” when necessary. Avoid putting the only loading text inside Skeleton. Its geometry should accommodate translations once loaded.

## Part B — Bindings

### API

Forwards div props and ref, combines classes, and sets `aria-hidden=true` after host props. The owner mounts the placeholder and replaces it when data arrives.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `primitives:Skeleton` | `children` | `import("react").ReactNode` | Unspecified | Caller content | — |
| `primitives:Skeleton` | `className` | `string \| undefined` | Unspecified | Caller input | — |
| `primitives:Skeleton` | `ref` | `import("react").Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `primitives:Skeleton` | `style` | `import("react").CSSProperties \| undefined` | Unspecified | Caller input | — |
| `primitives:Skeleton` | Host attributes | 276 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`primitives` is published without a client directive. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

A single `div.uld-skeleton` represents a decorative placeholder. `children` come from div host props, but the root hides its subtree from accessibility APIs.

#### Headless API

None. This family provides presentation or structure without separate behavior to extract.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Contract | Web | Native | Tracking |
| --- | --- | --- | --- |
| Renderer | Decorative placeholder div | No native family export | Native parity remains open in the [family audit](../component-depth.md). |

**Variants.** One stationary block. Size may be supplied through layout or host styling. There is no built-in shimmer variant.

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Loading placeholder | Mount while waiting for content | aria-hidden=true | No | No | [Placeholder is hidden from assistive technology](../../tests/family-contracts.test.tsx) |

#### Performance

`Skeleton` 166 B. Measured gzip sizes for separate tree-shaken production web imports, with React and React DOM external. Load primitives.css. There is no animation loop, network request or timer in the component. The full optional `primitives.css` entry measures 862 B gzip.

#### Tests

- **Loading placeholder.** [Placeholder is hidden from assistive technology](../../tests/family-contracts.test.tsx).

The unit suite verifies exclusion from the accessibility tree. Dedicated forced-color visual evidence is open. Native simulator coverage requires a native implementation.

#### Changelog and deprecations

The 0.3.0-rc.1 candidate documents the current contract. No family-specific deprecations are declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Skeleton.

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
