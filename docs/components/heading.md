---
{
  "family": "Heading",
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
      "name": "Heading",
      "from": "@ui-lazy-dev/ui-web/navigation",
      "rendering": "client-only"
    },
    {
      "platform": "web",
      "name": "Heading",
      "from": "@ui-lazy-dev/ui-web/document",
      "rendering": "server-safe"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/Dialog",
    "https://mui.com/material-ui/react-typography/"
  ]
}
---

# Heading

## Part A — Contract

### Purpose and when not to use it

Identify the next section in a document outline or provide a dialog title. Use Text for supporting copy that should not add an outline entry.

### Anatomy

A structured text label identifies a section and declares its level.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| content | Required | N/A — required | Container gap | Supplies readable content | Text adds no stop |

### Variants

Levels express document structure. The family does not define a typographic size or intent tone from the heading level.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Default | Present the default heading | See Tokens | The text names a level-three heading | No | No default stop | Pending: default scenario |
| Explicit level | Choose a different level | See Tokens | The heading reports the chosen level | No | No default stop | Pending: explicit level scenario |

### Keyboard, pointer and touch

The heading has no built-in activation. Screen-reader heading navigation follows level and location. Text does not enter the normal tab sequence.

### Accessibility

Use a meaningful level and preserve it when visual styling changes. Slotting as a dialog title can name the surrounding dialog. Keep visible text available at high zoom and in RTL.

### State patterns

This family owns no request lifecycle. Its containing surface supplies any loading, empty, error, offline, permission or partial-failure state.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

| Part or state | Token |
| --- | --- |
| Scope foreground | `light.text`, `dark.text` |

### Composition and content guidelines

Use inside a Disclosure heading region or supply the title slot for an overlay dialog. Avoid choosing the level solely to obtain larger letters. Do use “Review settings”. Avoid “Details” for every section or a paragraph-length title.

## Part B — Bindings

### API

The standalone `/document` binding renders on the server. Use the `/navigation` binding inside React Aria collections or dialog slots to inherit their accessible relationships.

`level` chooses the heading element; absent a contextual override the default is level three. The ref resolves to the actual HTMLHeadingElement. Host attributes apply to that heading.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `navigation:Heading` | `children` | `React.ReactNode` | Unspecified | Caller content | — |
| `navigation:Heading` | `className` | `string \| undefined` | `'react-aria-Heading'` | Caller input | — |
| `navigation:Heading` | `level` | `number \| undefined` | `3` | Caller input | — |
| `navigation:Heading` | `ref` | `React.Ref<HTMLHeadingElement> \| undefined` | Unspecified | Caller reference | `HTMLHeadingElement` |
| `navigation:Heading` | `render` | `import("react-aria-components").DOMRenderFunction<"h1", undefined> \| undefined` | Unspecified | Caller input | — |
| `navigation:Heading` | `style` | `React.CSSProperties \| undefined` | Unspecified | Caller input | — |
| `navigation:Heading` | Host attributes | 276 standard platform attributes, not listed | Unspecified | Caller input | — |
| `document:Heading` | `children` | `import("react").ReactNode` | Unspecified | Caller content | — |
| `document:Heading` | `className` | `string \| undefined` | Unspecified | Caller input | — |
| `document:Heading` | `level` | `HeadingLevel \| undefined` | Unspecified | Caller input | — |
| `document:Heading` | `ref` | `import("react").Ref<HTMLHeadingElement> \| undefined` | Unspecified | Caller reference | `HTMLHeadingElement` |
| `document:Heading` | `style` | `import("react").CSSProperties \| undefined` | Unspecified | Caller input | — |
| `document:Heading` | Host attributes | 276 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`navigation` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

A semantic heading host renders caller-supplied children. Context can supply the title slot of an overlay.

#### Headless API

None. This family provides presentation or structure without separate behavior to extract.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Contract | Web | Native | Tracking |
| --- | --- | --- | --- |
| Heading | Heading | No family binding in the native package | Native implementation and platform-specific verification are open in the [family audit](../component-depth.md). |

**Tokens.** The optional controls stylesheet applies text color inside the controls scope. Interactive descendants can use its keyboard focus treatment. Custom slot paint remains the consumer’s responsibility.

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Default | Render Heading without a level | Heading level three has the name Review | No | No default stop | [Default outline and host](../../tests/heading/navigation-labels.test.tsx) |
| Explicit level | Set level two | Accessible heading level updates and ref follows the host | No | No default stop | [Configured level and ref](../../tests/heading/navigation-labels.test.tsx) |

#### Performance

`Heading` 1,541 B. Each number is a separate named-import gzip measurement with React and React DOM external. Optional controls CSS is measured separately at 1,457 B gzip. The library root entry does not import this family.

#### Tests

- **Default.** [Default outline and host](../../tests/heading/navigation-labels.test.tsx).
- **Explicit level.** [Configured level and ref](../../tests/heading/navigation-labels.test.tsx).

The linked cases establish the behaviors above. Dedicated per-state visual comparisons and native simulator tests are open. [Catalog example](../../catalog/EnterpriseNavigation.stories.tsx)

#### Changelog and deprecations

The 0.3.0-rc.1 candidate documents the current web bindings. No family-specific deprecation is declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Heading.

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
