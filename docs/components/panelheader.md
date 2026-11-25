---
{
  "family": "PanelHeader",
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
      "name": "PanelHeader",
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

# PanelHeader

## Part A — Contract

### Purpose and when not to use it

Group a panel heading and its actions when the parent already identifies the region. Choose Heading when the text introduces a section.

### Anatomy

The caller arranges the heading, supporting text and local actions in reading order.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| content | Optional | collapse | Container gap | Children retain their semantics | Operable children keep their order |

### Variants

The header is structurally neutral. A heading-only arrangement and a heading with actions share the same wrapper. Alignment, density and heading levels belong to the composition.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Present | Display the panel heading | See Tokens | Its supplied heading level is retained | Interactive children only | Interactive children only | Pending: present scenario |
| Removed | Remove the panel header | Wrapper removed | Its content leaves the reading order | No | No | Pending: removal scenario |

### Keyboard, pointer and touch

A heading alone should not enter the tab order.

### Accessibility

Name the panel through an actual heading or explicit landmark name on its parent. Avoid deriving semantics from visual typography alone. Focus visibility, localization, hit targets and colors belong to the controls supplied as children. The wrapper introduces no animation, color treatment or focus target. The parent owns RTL placement and wrapping. A header must keep its heading intelligible at enlarged text sizes.

### State patterns

This family owns no request lifecycle. Its containing surface supplies any loading, empty, error, offline, permission or partial-failure state.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

N/A — the enclosing panel and its children choose the typography, spacing and surface tokens.

### Composition and content guidelines

Supply layout primitives as appropriate for available space. Use a heading such as “Invoice summary”. Keep action labels distinct, such as “Download invoice” when several panels share the page.

## Part B — Bindings

### API

The wrapper accepts div attributes, children and an HTMLDivElement ref. className extends the built-in class. It owns no state, title, action slot or heading-level prop.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `patterns:PanelHeader` | `children` | `import("react").ReactNode` | Unspecified | Caller content | — |
| `patterns:PanelHeader` | `className` | `string \| undefined` | Unspecified | Caller input | — |
| `patterns:PanelHeader` | `ref` | `import("react").Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `patterns:PanelHeader` | `style` | `import("react").CSSProperties \| undefined` | Unspecified | Caller input | — |
| `patterns:PanelHeader` | Host attributes | 276 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`patterns` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

A single div wraps caller-provided children. Consumers add the heading, subtitle and optional actions in the intended reading order.

#### Headless API

None. This family provides presentation or structure without separate behavior to extract.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Platform | Public contract |
| --- | --- |
| Web | `PanelHeader` from `@ui-lazy-dev/ui-web/patterns`. |
| Native | Planned. No exported renderer or simulator journey. Track parity in the [family inventory](../component-inventory.md). |

**Keyboard and pointer.** PanelHeader installs no keyboard or pointer handlers. Keep the heading first in DOM order and follow it with any actionable descendants. A heading alone should not enter the tab order.

**Tokens.** N/A — the wrapper exposes a class hook and preserves its children. Typography, spacing and surface tokens are selected by the host composition.

**Composition.** Put a real h2 or h3 in PanelHeader inside DocumentPreview, and place supplemental buttons after it. Supply layout primitives as appropriate for available space. [Catalog fixture](../../catalog/DocumentReview.stories.tsx).

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Mounted | Render children within the panel | Root is a generic div and nested heading keeps its supplied level | Interactive children only | Interactive children only | [patterns.test.tsx L33](../../tests/documentpreview/patterns.test.tsx#L9) |
| Detached | Unmount parent | Forwarded div ref clears | No | No | [family-contracts.test.tsx L18](../../tests/family-contracts.test.tsx#L15) |

#### Performance

The production named-import measurement is 177 B gzip for `PanelHeader`. The optional `/patterns` entry stays outside the default web entry. Measurements exclude React and React DOM and count JavaScript separately from CSS. [Bundle methodology](../../scripts/verify-bundles.mjs)

#### Tests

- Mounted. [patterns.test.tsx L33](../../tests/documentpreview/patterns.test.tsx#L9)
- Detached. [family-contracts.test.tsx L18](../../tests/family-contracts.test.tsx#L15)
- A dedicated three-engine journey for this family remains open.
- A dedicated visual baseline for this family remains open.
- Simulator coverage awaits a native export.

#### Changelog and deprecations

The `0.3.0-rc.1` draft documents the public contract introduced in `f58a492`. No deprecations are declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of PanelHeader.

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
