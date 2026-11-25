---
{
  "family": "Text",
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
      "name": "Text",
      "from": "@ui-lazy-dev/ui-web/primitives",
      "rendering": "server-safe"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/",
    "https://mui.com/material-ui/react-typography/"
  ]
}
---

# Text

## Part A — Contract

### Purpose and when not to use it

Display an inline run of text using the surrounding typography. Choose Heading to introduce a section or Status to announce a change.

### Anatomy

An inline text run remains part of its surrounding reading sequence.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| content | Optional | collapse | Container gap | Supplies readable content | Text adds no stop |

### Variants

The current binding offers one inline presentation. Its color, size and weight follow the surrounding text.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Default | Present a text run | Inherited text style | The words form part of the reading sequence | No | No default stop | Pending: default scenario |

### Keyboard, pointer and touch

Text has no activation handler or tab stop by default.

### Accessibility

The visible text supplies its meaning in surrounding content. Inherited colors and text size determine contrast and scaling. There is no built-in truncation, animation, target or announcement.

### State patterns

This family owns no request lifecycle. Its containing surface supplies any loading, empty, error, offline, permission or partial-failure state.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

It selects no semantic token directly.

### Composition and content guidelines

Use within a paragraph or action label. Use a real heading for the document outline. Let the surrounding link or button own interaction. Do display “Last updated yesterday” in the viewer's locale. Avoid embedding English-only fragments inside translated sentences. Preserve the full text when available space is limited.

## Part B — Bindings

### API

Forwards span attributes, DOM events and the span ref. The caller owns the string, language, direction and any class. No internal value or typography state is stored.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `primitives:Text` | `children` | `import("react").ReactNode` | Unspecified | Caller content | — |
| `primitives:Text` | `className` | `string \| undefined` | Unspecified | Caller input | — |
| `primitives:Text` | `ref` | `import("react").Ref<HTMLSpanElement> \| undefined` | Unspecified | Caller reference | `HTMLSpanElement` |
| `primitives:Text` | `style` | `import("react").CSSProperties \| undefined` | Unspecified | Caller input | — |
| `primitives:Text` | Host attributes | 276 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`primitives` is published without a client directive. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

One `span` renders its `children` unchanged. It has no prefix, suffix or hidden equivalent.

#### Headless API

None. This family provides presentation or structure without separate behavior to extract.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Contract | Web | Native | Tracking |
| --- | --- | --- | --- |
| Renderer | HTML span | No native family export | Native parity remains open in the [family audit](../component-depth.md). |

**Variants.** The current API has one inline host. Semantic element choice, variant, tone, weight, truncation and line-clamp controls remain open.

**Keyboard and pointer.** Pointer text selection and keyboard reading follow the browser. Text has no activation handler or tab stop by default.

**Accessibility.** The visible text supplies its meaning in surrounding content. `lang` and `dir` identify language and direction. Inherited colors and text size determine contrast and scaling. There is no built-in truncation, animation, target or announcement. Forced-color text follows the browser and its parent.

**Tokens.** N/A — the base span consumes typography and color through inheritance. It selects no semantic token directly.

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Default | Render a localized text run | Inline text in the reading sequence | No | No default stop | [Span and reading direction](../../tests/foundation-specs.test.tsx) |

#### Performance

`Text` 107 B. Measured gzip sizes for separate tree-shaken production web imports, with React and React DOM external. The span does not need a stylesheet import, measurement or observer.

#### Tests

- **Default.** [Span and reading direction](../../tests/foundation-specs.test.tsx).

Unit coverage verifies the actual span and inherited reading direction. Browser typography and visual tests become necessary as variants land. Pending: add native Text coverage once its binding exists.

#### Changelog and deprecations

The 0.3.0-rc.1 candidate documents the current contract. No family-specific deprecations are declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Text.

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
