---
{
  "family": "Adaptive grid",
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
      "name": "AdaptiveGrid",
      "from": "@ui-lazy-dev/ui-web",
      "rendering": "server-safe"
    },
    {
      "platform": "web",
      "name": "Grid",
      "from": "@ui-lazy-dev/ui-web/primitives",
      "rendering": "server-safe"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/",
    "https://mui.com/material-ui/react-grid/"
  ]
}
---

# Adaptive grid

## Part A — Contract

### Purpose and when not to use it

Arrange a repeatable collection into as many readable columns as its parent can hold. Use Stack when a collection must remain one item per row.

### Anatomy

Items flow into as many columns as fit while preserving reading order.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| items | Optional | collapse | Container gap | Children retain their semantics | Operable children keep their order |

### Variants

A narrow parent produces a single column. A wide parent permits multiple equal tracks. Width belongs to the container, so panels on one desktop can choose different column counts.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Compact | Narrow the containing panel | See Tokens | Fewer columns retain item order | Children only | Children only | Pending: compact scenario |
| Wide | Widen the panel | Same grid template with additional tracks | More columns retain item order | Children only | Children only | Pending: wide scenario |

### Keyboard, pointer and touch

Keyboard and pointer interaction belong to children.

### Accessibility

Choose list or region semantics explicitly where needed. The parent’s direction determines inline start. Text can wrap and child actions remain reachable in compact views. There is no animated reordering, painted background or grid-owned pointer target. Children determine target sizes and contrast, including in forced colors.

### State patterns

This family owns no request lifecycle. Its containing surface supplies any loading, empty, error, offline, permission or partial-failure state.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

Pending: map the minimum column width and row gap to semantic tokens. The existing values are private to this layout.

### Composition and content guidelines

Place item cards or controls as direct children. Do give sibling cards distinct titles such as “Design engineer” and “Analyst”. Avoid abbreviating titles to preserve a particular column count. Allow translations to wrap.

## Part B — Bindings

### API

Both exports accept `HTMLAttributes<HTMLDivElement>`. The caller supplies children, host props and classes. These declarations do not expose a ref prop. CSS custom properties on the element or its parent can set the column minimum and gap.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `.:AdaptiveGrid` | `children` | `import("react").ReactNode` | Unspecified | Caller content | — |
| `.:AdaptiveGrid` | `className` | `string \| undefined` | Unspecified | Caller input | — |
| `.:AdaptiveGrid` | `style` | `import("react").CSSProperties \| undefined` | Unspecified | Caller input | — |
| `.:AdaptiveGrid` | Host attributes | 275 standard platform attributes, not listed | Unspecified | Caller input | — |
| `primitives:Grid` | `children` | `import("react").ReactNode` | Unspecified | Caller content | — |
| `primitives:Grid` | `className` | `string \| undefined` | Unspecified | Caller input | — |
| `primitives:Grid` | `style` | `import("react").CSSProperties \| undefined` | Unspecified | Caller input | — |
| `primitives:Grid` | Host attributes | 275 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`index` is published without a client directive. `primitives` is published without a client directive. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

`AdaptiveGrid` and the `Grid` alias render a single div with the grid class. Direct children become grid items and maintain their DOM order.

#### Headless API

None. This family provides presentation or structure without separate behavior to extract.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Contract | Web | Native | Tracking |
| --- | --- | --- | --- |
| Renderer | Intrinsic CSS grid and optional parent custom properties | No native family export | Native parity remains open in the [family audit](../component-depth.md). |

**Keyboard and pointer.** Keyboard and pointer interaction belong to children. A change in the number of columns does not reorder the DOM or introduce grid-style arrow-key navigation.

**Accessibility.** This is a visual grid, with no implicit ARIA grid role. Choose list or region semantics explicitly where needed. The parent’s direction determines inline start. Text can wrap and child actions remain reachable in compact views. There is no animated reordering, painted background or grid-owned pointer target. Children determine target sizes and contrast, including in forced colors.

**Tokens.** N/A — the current columns and gap use the component CSS custom properties `--uld-column-min` and `--uld-grid-gap`. They currently have stylesheet defaults rather than token JSON leaves.

**Composition.** Place item cards or controls as direct children. Include the root stylesheet. Give each card an independent heading and preserve a logical DOM reading order.

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Compact | Constrain available inline size | Ordinary container | Children only | Children only | [Narrow parent on a desktop](../../tests/browser/adaptive.spec.ts) |
| Wide | Expand the parent while preserving the items | The child source order persists | Children only | Children only | [Wide shortlist geometry](../../tests/browser/adaptive.spec.ts) |

#### Performance

`AdaptiveGrid` 192 B, `Grid` 194 B. Measured gzip sizes for separate tree-shaken production web imports, with React and React DOM external. Load the web root stylesheet. CSS calculates tracks without a resize listener or viewport measurement. The full web `styles.css` entry, including theme tokens, measures 1,224 B gzip.

#### Tests

- **Compact.** [Narrow parent on a desktop](../../tests/browser/adaptive.spec.ts).
- **Wide.** [Wide shortlist geometry](../../tests/browser/adaptive.spec.ts).

The shortlist browser suite covers compact and wide geometry, keyboard, touch and reduced motion on real items. There is no separate grid pixel baseline or native simulator export.

#### Changelog and deprecations

The 0.3.0-rc.1 candidate documents the current contract. No family-specific deprecations are declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Adaptive grid.

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
