---
{
  "family": "Icon",
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
      "name": "Icon",
      "from": "@ui-lazy-dev/ui-web/primitives",
      "rendering": "server-safe"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/",
    "https://mui.com/material-ui/icons/"
  ]
}
---

# Icon

## Part A — Contract

### Purpose and when not to use it

Show a decorative symbol or name a stand-alone image. Use an icon button for a symbol that activates a command.

### Anatomy

The glyph can decorate neighboring text. Supply a name when the image carries meaning independently.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| glyph | Required | N/A — required | Container gap | Excluded from the name | No stop |
| label | Optional | collapse | Container gap | Provides the accessible name | Text adds no stop |

### Variants

A nonempty label selects a named image. Omission or an empty label selects a decorative icon.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Decorative | Display an ornamental glyph | Glyph inherits caller paint | The glyph adds no reading stop | No | No | Pending: decorative scenario |
| Named image | Give the glyph a name | Glyph inherits caller paint | The graphic becomes a named image | No | No | Pending: named image scenario |

### Keyboard, pointer and touch

The wrapper has no keyboard or pointer behavior. Keep slotted graphics passive and free of interactive descendants.

### Accessibility

Describe what an informative symbol means. Hide a symbol that duplicates adjacent text. Its wrapper supplies no focus stop, independent hit area, motion or live announcement.

### State patterns

This family owns no request lifecycle. Its containing surface supplies any loading, empty, error, offline, permission or partial-failure state.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions. Mirror directional graphics when their meaning follows the reading direction.

### Tokens

Its slotted glyph supplies artwork and paint.

### Composition and content guidelines

Place a decorative Icon beside visible text or within the graphics slot of a labeled action. Use one accessible name for the complete control. Do label a verified symbol “Verified identity”. Avoid naming it “green checkmark”. Localize the meaning and adapt directional graphics to the language.

## Part B — Bindings

### API

Accepts only `children` and optional `label`. The wrapper has no public host-prop spread or ref. The caller owns the graphic and its accessible meaning.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `primitives:Icon` | `children` | `ReactNode` | Required | Caller content | — |
| `primitives:Icon` | `label` | `string \| undefined` | Unspecified | Caller input | — |

### React web

#### Rendering

`primitives` is published without a client directive. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

The wrapper is a span. Caller-provided `children` supply the glyph or SVG. An optional localized `label` makes the wrapper a named image.

#### Headless API

None. This family provides presentation or structure without separate behavior to extract.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Contract | Web | Native | Tracking |
| --- | --- | --- | --- |
| Renderer | Span wrapping a supplied graphic | No native family export | Native parity remains open in the [family audit](../component-depth.md). |

**Variants.** A nonempty label selects a named image. Omission or an empty label selects a decorative icon. The wrapper has no size or tone prop.

**Accessibility.** Describe what an informative symbol means. Hide a symbol that duplicates adjacent text. Icon does not automatically mirror directional graphics in RTL or recolor arbitrary SVG children for forced colors. Choose an appropriate glyph and preserve contrast at its rendered size. Its wrapper supplies no focus stop, independent hit area, motion or live announcement. A surrounding IconButton can provide the activation target.

**Tokens.** N/A — Icon selects no color, size or motion token. Its slotted glyph supplies artwork and paint.

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Decorative | Omit label | aria-hidden=true | No | No | [Decorative star excluded](../../tests/primitives.test.tsx) |
| Named image | Provide a meaningful label | role=img and aria-label | No | No | [Named verification graphic](../../tests/family-contracts.test.tsx) |

#### Performance

`Icon` 157 B. Measured gzip sizes for separate tree-shaken production web imports, with React and React DOM external. The wrapper imports no icon font or artwork package. The cost of the supplied SVG or image belongs to its caller.

#### Tests

- **Decorative.** [Decorative star excluded](../../tests/primitives.test.tsx).
- **Named image.** [Named verification graphic](../../tests/family-contracts.test.tsx).

Unit tests verify named and decorative output. Browser tests for icon theme treatment and a native binding remain open.

#### Changelog and deprecations

The 0.3.0-rc.1 candidate documents the current contract. No family-specific deprecations are declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Icon.

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
