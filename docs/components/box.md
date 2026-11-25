---
{
  "family": "Box",
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
      "name": "Box",
      "from": "@ui-lazy-dev/ui-web/primitives",
      "rendering": "server-safe"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/",
    "https://mui.com/material-ui/react-box/"
  ]
}
---

# Box

## Part A — Contract

### Purpose and when not to use it

Group related content and carry its reading direction. Choose Stack for vertical spacing or Surface for a bordered panel.

### Anatomy

One container groups the content and carries its reading direction.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| content | Optional | collapse | Container gap | Children retain their semantics | Operable children keep their order |

### Variants

Spacing, surface, radius and border presets remain open in the foundation roadmap.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Default | Group related content | See Tokens | Content keeps its own semantics | No | No default stop | Pending: default scenario |

### Keyboard, pointer and touch

Child controls handle keys and pointer input in reading order. Adding a pointer action to the container does not give it keyboard button behavior.

### Accessibility

The wrapper provides no landmark, target or announcement of its own. Child content owns contrast, motion and focus indicators. There is no system-color override on the wrapper.

### State patterns

This family owns no request lifecycle. Its containing surface supplies any loading, empty, error, offline, permission or partial-failure state.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

N/A — this unstyled grouping inherits its presentation and reads no token.

### Composition and content guidelines

Put actions on Button and headings on a semantic heading. Do keep “Review notes” as visible child text. Allow descendants to wrap and localize normally.

## Part B — Bindings

### API

Accepts the div host props, including events, classes, `style`, `children` and `ref`. The ref resolves to the div. There is no internal state or synthesized change event.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `primitives:Box` | `children` | `import("react").ReactNode` | Unspecified | Caller content | — |
| `primitives:Box` | `className` | `string \| undefined` | Unspecified | Caller input | — |
| `primitives:Box` | `ref` | `import("react").Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `primitives:Box` | `style` | `import("react").CSSProperties \| undefined` | Unspecified | Caller input | — |
| `primitives:Box` | Host attributes | 276 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`primitives` is published without a client directive. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

A single `div` owns the forwarded attributes. The `children` slot renders directly inside it.

#### Headless API

None. This family provides presentation or structure without separate behavior to extract.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Contract | Web | Native | Tracking |
| --- | --- | --- | --- |
| Renderer | HTML div | No native family export | Native parity remains open in the [family audit](../component-depth.md). |

**Variants.** One unstyled host. Spacing, surface, radius and border presets remain open in the foundation roadmap.

**Accessibility.** The wrapper provides no landmark, target or announcement of its own. Set `lang` and `dir` where content changes language. Child content owns contrast, motion and focus indicators. There is no system-color override on the wrapper.

**Tokens.** N/A — Box renders a transparent div and reads no tokens.

**Composition.** Use Box around related text, a ButtonGroup or a measurement target. Put actions on Button and headings on a semantic heading.

**Content guidelines.** Do keep “Review notes” as visible child text. Avoid naming every layout div “Container”. Allow descendants to wrap and localize normally.

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Default | Mount a Box with content | Generic div, no implicit name | No | No default stop | [Div host and ref](../../tests/foundation-specs.test.tsx) |

#### Performance

`Box` 106 B. Measured gzip sizes for separate tree-shaken production web imports, with React and React DOM external. No CSS entry is required for Box and it adds no event listeners.

#### Tests

- **Default.** [Div host and ref](../../tests/foundation-specs.test.tsx).

The host-ref unit test covers the default wrapper. A family browser example and dedicated visual case are open. Native simulator coverage awaits a native binding.

#### Changelog and deprecations

The 0.3.0-rc.1 candidate documents the current contract. No family-specific deprecations are declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Box.

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
