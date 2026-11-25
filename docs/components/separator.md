---
{
  "family": "Separator",
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
      "name": "Divider",
      "from": "@ui-lazy-dev/ui-web/primitives",
      "rendering": "server-safe"
    },
    {
      "platform": "web",
      "name": "Separator",
      "from": "@ui-lazy-dev/ui-web/navigation",
      "rendering": "client-only"
    },
    {
      "platform": "web",
      "name": "Separator",
      "from": "@ui-lazy-dev/ui-web/document",
      "rendering": "server-safe"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/Separator",
    "https://mui.com/material-ui/react-divider/"
  ]
}
---

# Separator

## Part A — Contract

### Purpose and when not to use it

Divide related groups of content or menu commands. For a resize handle with a movable value, use the resizable list and detail layout instead of a static separator.

### Anatomy

A boundary separates adjacent groups and adds no independent action.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | No content slot | No slot focus stop |

### Variants

Separator supports horizontal and vertical orientation.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Default | Separate groups | See Tokens | A semantic boundary is exposed | No | No | Pending: default scenario |
| Menu separator | Separate menu commands | See Tokens | The boundary preserves menu reading order | No | No | Pending: menu separator scenario |

### Keyboard, pointer and touch

There is no arrow adjustment or focus target. Menu navigation moves between actionable menu items while passing separators.

### Accessibility

Static separator semantics identify a boundary within the reading sequence. Orientation describes the rule relative to the surrounding controls. The component has no activation target or live announcement. Preserve visible system borders in forced colors. The static rule has no motion, label text to mirror or separate contrast color in the wrapper.

### State patterns

This family owns no request lifecycle. Its containing surface supplies any loading, empty, error, offline, permission or partial-failure state.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

N/A — the platform’s separator treatment supplies the basic dividing line.

### Composition and content guidelines

Put menu separators between coherent action groups. In prose, place Divider between independent sections. Keep labels and actionable children outside the rule. Do separate “Edit” and “Archive” groups within a menu. Avoid using repeated rules to replace helpful group headings. Localize neighboring headings.

## Part B — Bindings

### API

The standalone `/document` binding renders on the server. Use the `/navigation` binding inside React Aria collections or dialog slots to inherit their accessible relationships.

Divider forwards `hr` attributes, including a host ref. Separator accepts the declared React Aria separator props and ref, including orientation and styling. Its implementation applies separator semantics to the chosen host.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `primitives:Divider` | `children` | `import("react").ReactNode` | Unspecified | Caller content | — |
| `primitives:Divider` | `className` | `string \| undefined` | Unspecified | Caller input | — |
| `primitives:Divider` | `ref` | `import("react").Ref<HTMLHRElement> \| undefined` | Unspecified | Caller reference | `HTMLHRElement` |
| `primitives:Divider` | `style` | `import("react").CSSProperties \| undefined` | Unspecified | Caller input | — |
| `primitives:Divider` | Host attributes | 276 standard platform attributes, not listed | Unspecified | Caller input | — |
| `navigation:Separator` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Separator` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Separator` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Separator` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Separator` | `className` | `string \| undefined` | `'react-aria-Separator'` | Caller input | — |
| `navigation:Separator` | `elementType` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Separator` | `id` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Separator` | `orientation` | `import("@react-types/shared").Orientation \| undefined` | `'horizontal'` | Caller input | — |
| `navigation:Separator` | `ref` | `React.Ref<HTMLElement> \| undefined` | Unspecified | Caller reference | `HTMLElement` |
| `navigation:Separator` | `render` | `import("react-aria-components").DOMRenderFunction<"div" \| "hr", undefined> \| undefined` | Unspecified | Caller input | — |
| `navigation:Separator` | `slot` | `string \| null \| undefined` | Unspecified | Caller input | — |
| `navigation:Separator` | `style` | `React.CSSProperties \| undefined` | Unspecified | Caller input | — |
| `navigation:Separator` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |
| `document:Separator` | `children` | `import("react").ReactNode` | Unspecified | Caller content | — |
| `document:Separator` | `className` | `string \| undefined` | Unspecified | Caller input | — |
| `document:Separator` | `orientation` | `"horizontal" \| "vertical" \| undefined` | Unspecified | Caller input | — |
| `document:Separator` | `ref` | `import("react").Ref<HTMLHRElement> \| undefined` | Unspecified | Caller reference | `HTMLHRElement` |
| `document:Separator` | `style` | `import("react").CSSProperties \| undefined` | Unspecified | Caller input | — |
| `document:Separator` | Host attributes | 276 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`navigation` is a client entry. `primitives` is published without a client directive. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

`Divider` renders an `hr`. `Separator` from navigation delegates to React Aria and chooses a suitable semantic element for the orientation. Neither export needs child content.

#### Headless API

None. This family provides presentation or structure without separate behavior to extract.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Contract | Web | Native | Tracking |
| --- | --- | --- | --- |
| Renderer | Static DOM rule or React Aria separator | No native family export | Native parity remains open in the [family audit](../component-depth.md). |

**Variants.** Divider follows browser horizontal-rule styling. Separator supports horizontal and vertical orientation. Divider has no tokenized inset or orientation prop.

**Tokens.** N/A — the primitive uses browser rule styling. The navigation export delegates styling to its React Aria host and caller classes.

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Default | Mount a horizontal Divider | Implicit separator via hr | No | No | [Horizontal rule semantic](../../tests/foundation-specs.test.tsx) |
| Menu separator | Open the menu containing Separator | Accessible separator inside menu | No | No | [Menu separator by role](../../tests/browser/enterprise-navigation.spec.ts) |

#### Performance

`Divider` 108 B, `Separator` 4516 B. Measured gzip sizes for separate tree-shaken production web imports, with React and React DOM external. The navigation binding includes React Aria behavior. Divider is available through the smaller primitives subpath. Both inherit host styling.

#### Tests

- **Default.** [Horizontal rule semantic](../../tests/foundation-specs.test.tsx).
- **Menu separator.** [Menu separator by role](../../tests/browser/enterprise-navigation.spec.ts).

Unit coverage checks the primitive. The navigation browser journey checks separator semantics inside an opened menu. Vertical geometry and dedicated visual coverage are open. Native testing awaits a binding.

#### Changelog and deprecations

The 0.3.0-rc.1 candidate documents the current contract. No family-specific deprecations are declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Separator.

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
