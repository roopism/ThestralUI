---
{
  "family": "Inline",
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
      "name": "Inline",
      "from": "@ui-lazy-dev/ui-web/primitives",
      "rendering": "server-safe"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/",
    "https://mui.com/material-ui/react-stack/"
  ]
}
---

# Inline

## Part A — Contract

### Purpose and when not to use it

Arrange short groups of peers horizontally with optional wrapping. Choose Stack for an always-vertical sequence or a button group to give a group of related actions an accessible name.

### Anatomy

Ordered items share a horizontal row and may wrap when space runs out.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| items | Optional | collapse | Container gap | Children retain their semantics | Operable children keep their order |

### Variants

Items wrap by default and can stay on one line when requested. Gap can change with the width of the containing panel. Alignment governs the cross-axis position; distribution allocates extra space along the row.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Wrapping | Wrap a row | Theme gap or requested gap | Reading order follows the supplied items | Children only | Children only | Pending: wrapping scenario |
| Single line | Keep items on one line | Same token gap | Item names and roles stay intact | Children only | Children only | Pending: single line scenario |
| Responsive spacing | Change the available width | Independent base and wide space tokens | Reflow preserves roles, names and focus | Children only | Children only | Pending: responsive spacing scenario |

### Keyboard, pointer and touch

The root does not add arrow-key navigation or create a focus stop.

### Accessibility

Use explicit labels and roles for interactive children. Test narrow containers with long translations. No announcement or animation occurs when wrapping changes.

### State patterns

This family owns no request lifecycle. Its containing surface supplies any loading, empty, error, offline, permission or partial-failure state.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

| Part or state | Token |
| --- | --- |
| Default gap | `size.gap` |
| Explicit and responsive spacing | `space.spaceXs` [4px], `space.spaceSm` [8px], `space.spaceMd` [16px], `space.spaceLg` [24px], `space.spaceXl` [40px] |

### Composition and content guidelines

Place badges, actions or metadata in the children slot. Use a named group if the peers share one purpose. Do allow localized tags such as “Reference pending” to wrap onto their own line. Avoid a fixed-width no-wrap row unless overflow remains accessible.

## Part B — Bindings

### API

Forwards div props and a div ref. `align` controls cross-axis item placement. `justify` distributes items on the inline axis. `gap` accepts a token or a `{ base, wide }` pair. `wrap` defaults on; passing false requests a single flex line. Callers own all four settings and any child interaction.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `primitives:Inline` | `align` | `"start" \| "center" \| "end" \| "stretch" \| "baseline" \| undefined` | Unspecified | Caller input | — |
| `primitives:Inline` | `children` | `import("react").ReactNode` | Unspecified | Caller content | — |
| `primitives:Inline` | `className` | `string \| undefined` | Unspecified | Caller input | — |
| `primitives:Inline` | `gap` | `import("@ui-lazy-dev/ui-web/primitives").LayoutSpace \| { base: import("@ui-lazy-dev/ui-web/primitives").LayoutSpace; wide: import("@ui-lazy-dev/ui-web/primitives").LayoutSpace; } \| undefined` | Unspecified | Caller input | — |
| `primitives:Inline` | `justify` | `"start" \| "center" \| "end" \| "space-between" \| "space-around" \| "space-evenly" \| undefined` | Unspecified | Caller input | — |
| `primitives:Inline` | `ref` | `import("react").Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `primitives:Inline` | `style` | `import("react").CSSProperties \| undefined` | Unspecified | Caller input | — |
| `primitives:Inline` | `wrap` | `boolean \| undefined` | Unspecified | Caller input | — |
| `primitives:Inline` | Host attributes | 276 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`primitives` is published without a client directive. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

A single flex div contains direct item children in DOM order. The surrounding inline-size query container establishes the width used for responsive spacing.

#### Headless API

None. This family provides presentation or structure without separate behavior to extract.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

The default centers children across the row and enables wrapping. Gap keys cover xs through xl. The wide gap applies at 36rem of container width. Set align to start, center, end, stretch or baseline. Justify offers start, center, end, space-between, space-around or space-evenly. Responsive values currently apply only to gap.

| Contract | Web | Native | Tracking |
| --- | --- | --- | --- |
| Renderer | Wrapping flex layout with logical start/end alignment | No native family export | Native parity remains open in the [family audit](../component-depth.md). |

**Keyboard and pointer.** Tab visits children in DOM order even when wrapping or RTL geometry moves a later item onto another line. The root does not add arrow-key navigation or create a focus stop.

**Accessibility.** This is an unstyled semantic host with flex presentation. Use explicit labels and roles for interactive children. Test narrow containers with long translations. Direction comes from the host or an ancestor. No announcement or animation occurs when wrapping changes.

**Composition.** Place badges, actions or metadata in the children slot. Use a named group if the peers share one purpose. Give the enclosing panel an inline-size container when spacing must change independently of viewport size.

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Wrapping | Leave wrap enabled and constrain the row | Item order follows DOM | Children only | Children only | [RTL wrap and keyboard order](../../tests/browser/stack-inline.spec.ts) |
| Single line | Set wrap to false | One flex row, unchanged child semantics | Children only | Children only | [Unwrapped row](../../tests/browser/stack-inline.spec.ts) |
| Responsive spacing | Resize the query container between narrow and wide | No change in role, name or focus | Children only | Children only | [Parent-specific responsive gap](../../tests/browser/stack-inline.spec.ts) |

#### Performance

`Inline` 263 B. Measured gzip sizes for separate tree-shaken production web imports, with React and React DOM external. Load primitives.css (862 B gzip for the full entry). Flexbox and container queries perform layout with no resize subscription.

#### Tests

- **Wrapping.** [RTL wrap and keyboard order](../../tests/browser/stack-inline.spec.ts).
- **Single line.** [Unwrapped row](../../tests/browser/stack-inline.spec.ts).
- **Responsive spacing.** [Parent-specific responsive gap](../../tests/browser/stack-inline.spec.ts).
- [Typed wrapping and forwarded host refs](../../tests/stack-inline.test.tsx).

Cross-engine tests cover focus, RTL, resizing and independent nested defaults. A dedicated visual baseline and native flex binding remain open.

#### Changelog and deprecations

0.3.0-rc.1 adds token spacing, independent container sizing, alignment and optional wrapping. No prop is deprecated.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Inline.

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
