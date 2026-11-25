---
{
  "family": "Surface",
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
      "name": "Surface",
      "from": "@ui-lazy-dev/ui-web/primitives",
      "rendering": "server-safe"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/",
    "https://mui.com/material-ui/react-paper/"
  ]
}
---

# Surface

## Part A — Contract

### Purpose and when not to use it

Give a bounded group of related information a shared background and border. Use Box for unstyled grouping and Dialog when the surface must contain modal focus.

### Anatomy

A bounded panel surrounds related content with a shared background and border.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| content | Optional | collapse | Container gap | Children retain their semantics | Operable children keep their order |

### Variants

One surface treatment. Color follows the active theme.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Default | Present a panel | Surface, text, border, gap and radius | Its content retains its own semantics | No | No default stop | Pending: default scenario |

### Keyboard, pointer and touch

Tab reaches interactive descendants in source order. The containing panel has no click, drag or key command.

### Accessibility

Color describes the boundary. Use a visible heading or an explicitly named region for meaningful sections. Text reflows in both directions. The component supplies no animation or independent hit target. The themed foreground and surface provide the color pair.

### State patterns

This family owns no request lifecycle. Its containing surface supplies any loading, empty, error, offline, permission or partial-failure state.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

| Part or state | Token |
| --- | --- |
| Panel background | `light.surface`, `dark.surface` |
| Foreground | `light.text`, `dark.text` |
| Outline | `light.border`, `dark.border` |
| Grid gap and corners | `size.gap`, `size.radius` |

### Composition and content guidelines

Place a Stack and a heading inside a Surface. Keep a panel’s primary action reachable independently of the panel boundary. Do label the group “Billing details”. Avoid inserting a visible “Card” label solely to identify the container. Let long translated values wrap.

## Part B — Bindings

### API

Forwards div attributes, events and ref. The library appends the caller's `className` to its styling class. The caller controls headings and any actions within the panel.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `primitives:Surface` | `children` | `import("react").ReactNode` | Unspecified | Caller content | — |
| `primitives:Surface` | `className` | `string \| undefined` | Unspecified | Caller input | — |
| `primitives:Surface` | `ref` | `import("react").Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `primitives:Surface` | `style` | `import("react").CSSProperties \| undefined` | Unspecified | Caller input | — |
| `primitives:Surface` | Host attributes | 276 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`primitives` is published without a client directive. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

A `div.uld-surface` provides the grid, border and fill. Caller children form the panel content.

#### Headless API

None. This family provides presentation or structure without separate behavior to extract.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Contract | Web | Native | Tracking |
| --- | --- | --- | --- |
| Renderer | CSS grid surface with a single children slot | No native family export | Native parity remains open in the [family audit](../component-depth.md). |

**Variants.** One surface treatment. Color follows the active theme. No selectable elevation, inset or radius prop is declared.

**Accessibility.** Color describes the boundary. Use a visible heading or an explicitly named region for meaningful sections. Text reflows in both directions. The component supplies no animation or independent hit target. The themed foreground and surface provide the color pair. Forced colors use the browser’s normal adjustment for text and borders.

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Default | Render a panel with children | Generic div, with no implicit landmark | No | No default stop | [Surface classes and semantics](../../tests/foundation-specs.test.tsx) |

#### Performance

`Surface` 152 B. Measured gzip sizes for separate tree-shaken production web imports, with React and React DOM external. Load primitives.css for the styled treatment. The surface does not observe layout or mount an overlay. The full optional `primitives.css` entry measures 862 B gzip.

#### Tests

- **Default.** [Surface classes and semantics](../../tests/foundation-specs.test.tsx).

Unit tests cover the host and class composition. Dedicated browser snapshots of surface contrast and high-contrast borders are open. Native simulator coverage awaits a native binding.

#### Changelog and deprecations

The 0.3.0-rc.1 candidate documents the current contract. No family-specific deprecations are declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Surface.

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
