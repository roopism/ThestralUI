---
{
  "family": "Stack",
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
      "name": "Stack",
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

# Stack

## Part A — Contract

### Purpose and when not to use it

Lay out siblings down a panel with consistent vertical rhythm. Choose Inline to lay out peers across the line and an adaptive grid for equally sized columns.

### Anatomy

Items follow one another vertically. Their reading order stays the same as the available width changes.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| items | Optional | collapse | Container gap | Children retain their semantics | Operable children keep their order |

### Variants

The default uses the theme gap. Choose a fixed gap or change the gap when the containing panel becomes wide. Alignment and distribution control how items share the available space.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Default | Arrange the items | size.gap | The items retain their own identities and reading order | Children only | Operable children only | [stack.child-order](stack.scenarios.yaml) |
| Compact panel | Narrow the panel | Chosen base space token | Children keep the same order | Children only | Operable children only | Pending: compact panel scenario |
| Wide panel | Widen the panel | Chosen wide space token | The focused child keeps focus | Children only | Operable children only | Pending: wide panel scenario |

### Keyboard, pointer and touch

Focus follows source order. Stack has no keyboard commands and does not simulate pointer gestures. Children retain focus and their own keyboard bindings when the container changes size.

### Accessibility

The root supplies layout without injecting a list or landmark role. Supply semantic children and localized text. Logical start and end respect writing direction. Static spacing needs no animation or forced-color treatment. Individual controls own their focus rings and target sizes.

### State patterns

This family owns no request lifecycle. Its containing surface supplies any loading, empty, error, offline, permission or partial-failure state.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

| Part or state | Token |
| --- | --- |
| Default gap | `size.gap` |
| Compact or wide choice | `space.spaceXs` [4px], `space.spaceSm` [8px], `space.spaceMd` [16px], `space.spaceLg` [24px], `space.spaceXl` [40px] |

### Composition and content guidelines

Use Stack for the outer vertical sequence and an Inline child for row actions. Each layout chooses its own spacing. Do allow “Employment verification pending” to wrap. Avoid abbreviating labels to preserve a vertical gap.

## Part B — Bindings

### API

Forwards div host attributes and ref. `gap` accepts one of five spacing keys or a required `{ base, wide }` pair. `align` sets grid item alignment on the inline axis. `justify` distributes the tracks within the block axis. These optional layout values belong to the caller. No observer callback or internal responsive state is exposed.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `primitives:Stack` | `align` | `"start" \| "center" \| "end" \| "stretch" \| "baseline" \| undefined` | Unspecified | Caller input | — |
| `primitives:Stack` | `children` | `import("react").ReactNode` | Unspecified | Caller content | — |
| `primitives:Stack` | `className` | `string \| undefined` | Unspecified | Caller input | — |
| `primitives:Stack` | `gap` | `LayoutSpace \| { base: LayoutSpace; wide: LayoutSpace; } \| undefined` | Unspecified | Caller input | — |
| `primitives:Stack` | `justify` | `"start" \| "center" \| "end" \| "space-between" \| "space-around" \| "space-evenly" \| undefined` | Unspecified | Caller input | — |
| `primitives:Stack` | `ref` | `import("react").Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `primitives:Stack` | `style` | `import("react").CSSProperties \| undefined` | Unspecified | Caller input | — |
| `primitives:Stack` | Host attributes | 276 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`primitives` is published without a client directive. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

One div with the Stack class is a CSS grid. Its direct children are the ordered items. The enclosing panel supplies the optional inline-size query container.

#### Headless API

None. This family provides presentation or structure without separate behavior to extract.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Contract | Web | Native | Tracking |
| --- | --- | --- | --- |
| Renderer | Container-responsive CSS grid | No native family export | Native parity remains open in the [family audit](../component-depth.md). |

**Variants.** The default spacing uses the theme gap. Explicit keys are xs, sm, md, lg and xl. Responsive gap changes at 36rem in the closest query container. Alignment supports start, center, end, stretch and baseline; distribution additionally supports space-between, space-around and space-evenly in place of stretch/baseline. There is no wrapping or responsive alignment prop on Stack.

**Composition.** Set `container-type: inline-size` on the actual resizable panel. Use Stack for the outer vertical sequence and an Inline child for row actions. Each layout chooses its own spacing.

**Content guidelines.** Do allow “Employment verification pending” to wrap. Avoid abbreviating labels to preserve a vertical gap. Keep logical reading order in the DOM for every locale.

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Default | Omit gap | Unlabeled div unless caller supplies semantics | Children only | Children only | [Nested layouts keep their default gap](../../tests/browser/stack-inline.spec.ts) |
| Compact panel | Set responsive gap inside a narrow panel | Child order remains unchanged | Children only | Children only | [Two unequal parent widths](../../tests/browser/stack-inline.spec.ts) |
| Wide panel | Expand the nearest query container across the threshold | Focused child remains mounted | Children only | Children only | [Resize without losing focus](../../tests/browser/stack-inline.spec.ts) |

#### Performance

`Stack` 264 B. Measured gzip sizes for separate tree-shaken production web imports, with React and React DOM external. The styles live in primitives.css (862 B gzip for the full entry). CSS container queries avoid resize listeners and rerenders.

#### Tests

- **Default.** [Nested layouts keep their default gap](../../tests/browser/stack-inline.spec.ts).
- **Compact panel.** [Two unequal parent widths](../../tests/browser/stack-inline.spec.ts).
- **Wide panel.** [Resize without losing focus](../../tests/browser/stack-inline.spec.ts).
- [Typed props, host class and ref forwarding](../../tests/stack-inline.test.tsx).

All three browser engines run the [wide desktop, narrow panel and RTL cases](../../tests/browser/stack-inline.spec.ts). A separate pixel baseline and a native layout binding are open.

Scenario fixture: [stack.child-order](stack.scenarios.yaml).

#### Changelog and deprecations

0.3.0-rc.1 adds token gaps, container breakpoints and explicit alignment while preserving the previous host. No prop is deprecated.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Stack.

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
