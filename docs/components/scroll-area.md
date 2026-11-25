---
{
  "family": "Scroll area",
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
      "name": "ScrollArea",
      "from": "@ui-lazy-dev/ui-web/primitives",
      "rendering": "server-safe"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/",
    "https://www.radix-ui.com/primitives/docs/components/scroll-area"
  ]
}
---

# Scroll area

## Part A — Contract

### Purpose and when not to use it

Keep a long secondary region scrollable inside a constrained container. Use a normal Box for page content that should follow the document scroll.

### Anatomy

A named viewport exposes the caller’s content and lets the reader reach the part outside its bounds.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| content | Optional | collapse | Container gap | Children retain their semantics | Operable children keep their order |

### Variants

It exposes no custom thumb or track slot.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Default | Open the region | See Tokens | The label names the scrollable content | No | Yes | Pending: default scenario |
| Focused | Focus the region | System focus outline | The name stays available while scrolling | No | Yes | Pending: focused scenario |

### Keyboard, pointer and touch

Tab enters the region. Tab continues into or beyond its children. There is no keyboard trap or custom drag gesture.

### Accessibility

Use a distinct name such as “Activity history”. In forced colors the focus outline uses the system highlight. Reading order follows source order in RTL. No automatic scrolling or motion is applied. The scroll region has no separate pointer button. Text and image contrast come from its children.

### State patterns

This family owns no request lifecycle. Its containing surface supplies any loading, empty, error, offline, permission or partial-failure state.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

It consumes no theme token.

### Composition and content guidelines

Bound the parent’s block size so overflow can occur. Keep child actions reachable and avoid unnecessary nested scrolling regions. Do name the content “Version history”. Avoid “Scroll box”. Preserve the complete translated label and all scrollable content.

## Part B — Bindings

### API

Requires the localized `label` prop. Forwards div props and ref. The root sets `role`, `aria-label` and `tabIndex` after host props. The caller sets the available size.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `primitives:ScrollArea` | `children` | `import("react").ReactNode` | Unspecified | Caller content | — |
| `primitives:ScrollArea` | `className` | `string \| undefined` | Unspecified | Caller input | — |
| `primitives:ScrollArea` | `label` | `string` | Required | Caller input | — |
| `primitives:ScrollArea` | `ref` | `import("react").Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `primitives:ScrollArea` | `style` | `import("react").CSSProperties \| undefined` | Unspecified | Caller input | — |
| `primitives:ScrollArea` | Host attributes | 276 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`primitives` is published without a client directive. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

A single focusable `div.uld-scroll` is the region and the scrolling viewport. Its contents are the caller's `children` slot. Scrollbars belong to the browser.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Contract | Web | Native | Tracking |
| --- | --- | --- | --- |
| Renderer | Scrollable named HTML region | No native family export | Native parity remains open in the [family audit](../component-depth.md). |

**Variants.** One native-scroll mode using CSS overflow. It exposes no custom thumb or track slot.

**Keyboard and pointer.** Tab enters the region. Browser scrolling keys, wheel and touch pan move the viewport. Tab continues into or beyond its children. There is no keyboard trap or custom drag gesture.

**Accessibility.** Use a distinct name such as “Activity history”. Native scrollbar and scroll options follow system settings. In forced colors the focus outline uses the system highlight. Reading order follows source order in RTL. No automatic scrolling or motion is applied. The scroll region has no separate pointer button. Text and image contrast come from its children.

**Tokens.** N/A — the viewport uses browser scrollbars, inherited paint and a forced-color system focus outline. It consumes no theme token.

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Default | Mount the viewport | Region named by label | No | Yes | [Named activity region](../../tests/family-contracts.test.tsx) |
| Focused | Focus the region in keyboard order | Region retains its accessible name | No | Yes | [Focusable scrolling viewport](../../tests/foundation-specs.test.tsx) |

#### Performance

`ScrollArea` 186 B. Measured gzip sizes for separate tree-shaken production web imports, with React and React DOM external. Load primitives.css for overflow containment. Native scrolling adds no JavaScript listeners or virtualization. The full optional `primitives.css` entry measures 862 B gzip.

#### Tests

- **Default.** [Named activity region](../../tests/family-contracts.test.tsx).
- **Focused.** [Focusable scrolling viewport](../../tests/foundation-specs.test.tsx).

Unit coverage verifies naming and focus. Browser keyboard scrolling at zoom and scrollbar visuals need a dedicated family case. There is no native export for simulator testing.

#### Changelog and deprecations

The 0.3.0-rc.1 candidate documents the current contract. No family-specific deprecations are declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Scroll area.

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
