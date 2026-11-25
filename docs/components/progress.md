---
{
  "family": "Progress",
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
      "name": "Progress",
      "from": "@ui-lazy-dev/ui-web/primitives",
      "rendering": "server-safe"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/ProgressBar",
    "https://mui.com/material-ui/react-progress/"
  ]
}
---

# Progress

## Part A — Contract

### Purpose and when not to use it

Expose a measurable operation and how much has finished. Use Spinner to indicate activity of unknown duration.

### Anatomy

A named indicator conveys progress toward a total or an indeterminate operation.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | No content slot | No slot focus stop |

### Variants

Omitted values leave the amount unknown. A measured value is read against the maximum, which defaults to one. A localized value text (“6 of 8 files”) replaces the computed percentage for assistive technology; there is no built-in text formatter.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Indeterminate | Start without a known total | Platform progress styling | The named indicator exposes indeterminate activity | No | No default stop | Pending: indeterminate scenario |
| Determinate | Provide a measured value, up to the maximum when the work completes | Platform track and fill | The named indicator exposes the current range, value and any localized value text | No | No default stop | Pending: determinate scenario |

### Keyboard, pointer and touch

The bar is read-only. To allow a person to change a numerical value, put Slider in the form.

### Accessibility

The indicator is named by the task, not by the word “progress”. Supply a localized value text when the units matter (“6 of 8 files”). The indicator is not live: reserve a separate live Status for milestones such as completion or failure, so screen readers are not flooded with every increment. The bar is not a pointer target and adds no focus stop. Each progress update changes the semantic value on the same element. Direction, forced-color paint and indeterminate motion follow the platform.

### State patterns

An unknown total is indeterminate. A known total exposes progress. The operation owner reports success or failure independently.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

N/A — the platform supplies the track, fill and high-contrast presentation.

### Composition and content guidelines

Put next to a readable task label. Report work units consistently. Values and maximum must describe the same operation. Do use “Importing employee records”. Avoid “Progress indicator”. Localize units and any separately displayed percentage.

## Part B — Bindings

### API

Requires `label`. The caller supplies `value` and optional `max`, host attributes, events and the ref to the HTMLProgressElement. Omit `value` to keep the host indeterminate; zero represents a measured zero fraction.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `primitives:Progress` | `children` | `import("react").ReactNode` | Unspecified | Caller content | — |
| `primitives:Progress` | `className` | `string \| undefined` | Unspecified | Caller input | — |
| `primitives:Progress` | `label` | `string` | Required | Caller input | — |
| `primitives:Progress` | `ref` | `import("react").Ref<HTMLProgressElement> \| undefined` | Unspecified | Caller reference | `HTMLProgressElement` |
| `primitives:Progress` | `style` | `import("react").CSSProperties \| undefined` | Unspecified | Caller input | — |
| `primitives:Progress` | Host attributes | 278 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`primitives` is published without a client directive. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

A single HTML progress element owns the track and fill painted by the browser. The label is set directly on the element.

#### Headless API

None. This family provides presentation or structure without separate behavior to extract.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Contract | Web | Native | Tracking |
| --- | --- | --- | --- |
| Renderer | HTMLProgressElement with determinate and indeterminate modes | No native family export | Native parity remains open in the [family audit](../component-depth.md). |

**Variants.** Measured values use the HTML progress range, with a default maximum of one. Omitted values leave the amount unknown. There is no built-in text formatter.

**Accessibility.** The label names the operation and the host exposes its value and maximum. Reserve a separate live Status for milestones requiring announcements. Direction, high-contrast paint and indeterminate motion follow the browser. The bar is not a pointer target. Each progress update changes the semantic value. The host provides no guarantee that a screen reader announces every increment.

**Tokens.** N/A — the current component uses native HTML progress styling. The browser supplies the track, fill and high-contrast appearance.

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Indeterminate | Omit value | Named progressbar without a measured value | No | No default stop | [Indeterminate position](../../tests/progress/foundation-specs.test.tsx) |
| Determinate | Supply value and max | Named progressbar with numeric range | No | No default stop | [Fraction and zero](../../tests/progress/foundation-specs.test.tsx) |
| Determinate | Supply a localized value text and complete the work | Value text and caller attributes forwarded; full fraction on the same element, no live role | No | No default stop | [Value text and completion](../../tests/progress/foundation-specs.test.tsx) |

#### Performance

`Progress` 128 B. Measured gzip sizes for separate tree-shaken production web imports, with React and React DOM external. There is no component stylesheet or timer. New values come from its owner.

#### Tests

- **Indeterminate.** [Indeterminate position](../../tests/progress/foundation-specs.test.tsx).
- **Determinate.** [Fraction and zero](../../tests/progress/foundation-specs.test.tsx) and [value text, forwarding and completion](../../tests/progress/foundation-specs.test.tsx).

Open: a tokenized track and fill (accent fill, border track, rounded ends) needs a class on the element and about 30 B of `primitives.css`; the `primitives` entry has 1 B of headroom (914 of 915 B), so the platform presentation stays until a per-family entry and sheet land. Unit and packed-consumer checks verify named progress, range values, localized value text, attribute forwarding and completion without a live announcement. Dedicated cross-engine appearance and a native binding are open.

#### Changelog and deprecations

The 0.3.0-rc.1 candidate documents the current contract. No family-specific deprecations are declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Progress.

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
