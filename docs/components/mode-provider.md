---
{
  "family": "Mode provider",
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
      "name": "ModeProvider",
      "from": "@ui-lazy-dev/ui-web/modes",
      "rendering": "server-safe"
    }
  ],
  "reference": [
    "https://www.designtokens.org/tr/2025.10/resolver/"
  ]
}
---

# Mode provider

## Part A — Contract

### Purpose and when not to use it

Apply a visual preference to a group of descendants. Use a component's content and visibility inputs to change which information or actions are available.

### Anatomy

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| content | Optional | collapse | Container gap | Children keep their own names | Children keep their existing order |

### Variants

The enterprise and expressive brands each supply light, dark and high-contrast schemes. Compact, comfortable and spacious density change spacing and sizing. Full and reduced motion select durations and movement. An application may name a contextual mode and declare the semantic values it changes. Unspecified preferences inherit from the nearest enclosing scope.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Inherited | Open a region with no local preference | Nearest active semantic values | Descendants retain their names and roles | Descendants | Descendants | Pending: shared scenario for inherited scopes |
| Changed | Switch a preference while editing | Values recomputed for the affected region | Input, focus and reading position persist | Descendants | Descendants | Pending: shared scenario for an edited field |
| Reduced motion | A user requests reduced motion | Movement durations and scale | Content remains available | Descendants | Descendants | Pending: shared preference-change scenario |

### Keyboard, pointer and touch

A scope adds no keyboard stop or activation gesture. A preference change preserves the active control, unsubmitted edits and scroll position. A compact layout preserves the coarse-pointer target size.

### Accessibility

Light and dark schemes maintain at least 4.5:1 text contrast for the checked text roles. The high-contrast scheme reaches 7:1 for the same roles. Focus and control outlines remain distinguishable against the surrounding surface. Respect system motion settings unless the user explicitly selects another preference.

### State patterns

Loading, empty, error, offline, permission and partial failure belong to the content inside the scope. Changing a preference preserves that content's state.

### Localization

The provider owns no messages or formatted data. Localize preference-control labels in the application. Changing presentation preserves the order of content in both reading directions.

### Tokens

The active scope resolves public semantic roles, including `color.surface`, `color.text`, `color.focus`, `size.control`, `density.coarseTarget` and `motion.enterDuration`. A context overrides only its declared roles.

### Composition and content guidelines

A reading area can set a larger body size while its neighboring toolbar keeps the page defaults. Give the preference control a persistent name such as “Reading appearance”. Preserve access to actions in every presentation.

## Part B — Bindings

### API

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `modes:ModeProvider` | `brand` | `import("@ui-lazy-dev/tokens/modes").Brand \| undefined` | Unspecified | Caller input | — |
| `modes:ModeProvider` | `children` | `import("react").ReactNode` | Unspecified | Caller content | — |
| `modes:ModeProvider` | `className` | `string \| undefined` | Unspecified | Caller input | — |
| `modes:ModeProvider` | `density` | `import("@ui-lazy-dev/tokens/modes").Density \| undefined` | Unspecified | Caller input | — |
| `modes:ModeProvider` | `mode` | `"default" \| undefined` | Unspecified | Caller input | — |
| `modes:ModeProvider` | `motion` | `import("@ui-lazy-dev/tokens/modes").MotionPreference \| undefined` | Unspecified | Caller input | — |
| `modes:ModeProvider` | `ref` | `Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `modes:ModeProvider` | `scheme` | `import("@ui-lazy-dev/tokens/modes").Scheme \| undefined` | Unspecified | Caller input | — |
| `modes:ModeProvider` | `style` | `import("react").CSSProperties \| undefined` | Unspecified | Caller input | — |
| `modes:ModeProvider` | Host attributes | 275 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

The server renders a single host with the supplied data attributes. Scoped custom properties resolve before hydration. Independent requests can select different brands and schemes. The forwarded ref addresses the host. [Streaming hydration](../../tests/runtime-streams.test.tsx)

#### Headless API

Set the scoped attributes on an existing element to apply the same preferences without adding a host. The provider has no interactive behavior.

#### Test helpers

Query a named descendant and measure its computed values or retained focus. The provider adds no accessibility role.

#### Platform differences

The browser inherits values through the cascade. It handles forced colors, coarse pointers and the operating system's reduced-motion preference. Native consumers receive resolved values from context.

#### Performance

The binding, runtime and brand styles have independent optional imports. The default web entry does not import the provider. With React external, the web entry measures 207 B gzip and the named provider measures 208 B gzip. The shared axis stylesheet adds 453 B gzip. Each optional brand stylesheet has its own [bundle budget](../../tests/packaging/bundle-baseline.json).

#### Tests

Browser tests switch nested modes with a focused, edited field, verify sibling isolation and coarse-pointer sizes, and exercise a reading-list story in both brands at 390 and 1100 pixels. [Browser journeys](../../tests/browser/mode-scopes.spec.ts) · [Schema and contrast](../../tests/contracts/token-modes.test.mjs)

#### Changelog and deprecations

The modes entry introduces scoped appearance settings in the release candidate. The existing light and dark theme attribute remains supported.

### React Native

#### Rendering

Pending: integrate the memoized provider with the native package and verify nested scopes on a simulator.

#### Headless API

Pending: verify the native hook's resolved preferences and semantic values through the packed public API.

#### Test helpers

Read a named descendant's output and verify the same mounted control survives a preference change.

#### Platform differences

The native binding receives system motion preferences asynchronously. The active local override takes precedence. Pending: validate both platform renderer paths and the iOS runtime.

#### Performance

Pending: measure the native entry in the packed consumer.

#### Tests

Pending: native renderer, independent sibling registrations and the iPhone preference-change journey.

#### Changelog and deprecations

Pending: native availability will be recorded with the first packed public binding.
