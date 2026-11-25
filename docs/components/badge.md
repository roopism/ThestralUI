---
{
  "family": "Badge",
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
      "name": "Badge",
      "from": "@ui-lazy-dev/ui-web/primitives",
      "rendering": "server-safe"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/",
    "https://mui.com/material-ui/react-badge/"
  ]
}
---

# Badge

## Part A — Contract

### Purpose and when not to use it

Show a short, persistent status or category alongside the item it describes. Use Status for a change that needs a live announcement.

### Anatomy

A short label identifies the category or status of a nearby item.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| content | Optional | collapse | Container gap | Supplies readable content | Text adds no stop |

### Variants

One neutral pill with a surface fill and border.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Default | Present a category | Surface, text and border | Static text identifies the item | No | No | Pending: default scenario |

### Keyboard, pointer and touch

Badge is a passive label. For an interactive filter, use the appropriate toggle or selection control and make the badge its content.

### Accessibility

The status is available as readable text. Preserve contrast in both themes and retain a text equivalent for a colored indicator. The pill inherits language and direction, supplies no target and generates no state-change announcement. It has no motion and allows normal forced-color adjustments for its surface, text and border.

### State patterns

This family owns no request lifecycle. Its containing surface supplies any loading, empty, error, offline, permission or partial-failure state.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

| Part or state | Token |
| --- | --- |
| Pill fill | `light.surface`, `dark.surface` |
| Label | `light.text`, `dark.text` |
| Edge | `light.border`, `dark.border` |

### Composition and content guidelines

Place next to the item heading or a list status cell. A static badge inside a button contributes its visible text to that button’s name. Do use “Awaiting review”. Avoid “AR” unless that abbreviation is established in the locale. Leave room for translation and text enlargement.

## Part B — Bindings

### API

Forwards span props and ref and combines the provided class with the styling class. The caller owns text, state changes and surrounding context.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `primitives:Badge` | `children` | `import("react").ReactNode` | Unspecified | Caller content | — |
| `primitives:Badge` | `className` | `string \| undefined` | Unspecified | Caller input | — |
| `primitives:Badge` | `ref` | `import("react").Ref<HTMLSpanElement> \| undefined` | Unspecified | Caller reference | `HTMLSpanElement` |
| `primitives:Badge` | `style` | `import("react").CSSProperties \| undefined` | Unspecified | Caller input | — |
| `primitives:Badge` | Host attributes | 276 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`primitives` is published without a client directive. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

One inline span wraps the children slot. The `uld-badge` class supplies the outlined pill treatment.

#### Headless API

None. This family provides presentation or structure without separate behavior to extract.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Contract | Web | Native | Tracking |
| --- | --- | --- | --- |
| Renderer | Passive inline pill | No native family export | Native parity remains open in the [family audit](../component-depth.md). |

**Variants.** One neutral pill with a surface fill and border. Dedicated tone, size and dot props are planned.

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Default | Render badge text | Static inline text with no implicit live role | No | No | [Static pill text and host class](../../tests/foundation-specs.test.tsx) |

#### Performance

`Badge` 152 B. Measured gzip sizes for separate tree-shaken production web imports, with React and React DOM external. The pill treatment lives in primitives.css. Rendering adds one span and no timers or observers. The full optional `primitives.css` entry measures 862 B gzip.

#### Tests

- **Default.** [Static pill text and host class](../../tests/foundation-specs.test.tsx).

Unit coverage verifies visible content and non-live semantics. Tone and forced-color visuals need dedicated browser coverage as the variants are added. No native binding exists.

#### Changelog and deprecations

The 0.3.0-rc.1 candidate documents the current contract. No family-specific deprecations are declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Badge.

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
