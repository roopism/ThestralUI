---
{
  "family": "Avatar",
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
      "name": "Avatar",
      "from": "@ui-lazy-dev/ui-web/avatar"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/",
    "https://mui.com/material-ui/react-avatar/"
  ]
}
---

# Avatar

## Part A — Contract

### Purpose and when not to use it

Identify a person by photo or by a readable fallback when the image cannot be shown. Choose Icon for a generic status or product symbol.

### Anatomy

A photograph or readable substitute represents the same person.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| photo | Optional | fallback — use the supplied text or initials | Container gap | Use the image description | No independent action |
| fallback | Optional | fallback — use initials from the name | Container gap | Supplies readable content | Text adds no stop |

### Variants

Displays a validated URL, caller fallback, or the first Unicode code point of each of at most two whitespace-separated name words.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Image | Load a valid photo | Surface frame and text | The image carries the person’s name | No | No | Pending: image scenario |
| Fallback | Remove the photo or let it fail | Surface fill, text and border | The fallback retains the same name | No | No | Pending: fallback scenario |

### Keyboard, pointer and touch

Images and initials do not activate commands. Make the surrounding Link or Button own any profile navigation or disclosure.

### Accessibility

The name stays constant across image and fallback branches. For scripts or names where automatic initials are unsuitable, supply a localized short fallback. The round crop carries no extra meaning. The component has no animation, target or live announcement. Initials use the theme text/surface colors and inherit the surrounding text direction. A containing button owns the hit target.

### State patterns

This family owns no request lifecycle. Its containing surface supplies any loading, empty, error, offline, permission or partial-failure state.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

| Part or state | Token |
| --- | --- |
| Fallback fill | `light.surface`, `dark.surface` |
| Fallback label | `light.text`, `dark.text` |
| Edge | `light.border`, `dark.border` |

### Composition and content guidelines

Place in a person row or labeled profile action. If the same name already appears in a control, check the aggregate accessible name for duplication. Do pass a complete name such as “Zoë Miles”. Avoid fabricated initials for scripts without that convention. A compact fallback may contain a localized symbol while the full name remains readable by assistive technology.

## Part B — Bindings

### API

`name` provides the accessible image name. `image` accepts a relative or credential-free HTTP(S) location. `fallback` overrides initials. An image load error switches the current source to fallback. A changed accepted URL remounts the image branch and retries.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `avatar:Avatar` | `fallback` | `string \| undefined` | Unspecified | Caller input | — |
| `avatar:Avatar` | `image` | `string \| undefined` | Unspecified | Caller input | — |
| `avatar:Avatar` | `name` | `string` | Required | Caller input | — |

### React web

#### Rendering

`avatar` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

The image branch is an `img`; fallback is a named span. Both use the same `uld-avatar` style. The public API accepts a source and fallback text, with no interactive slot.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Contract | Web | Native | Tracking |
| --- | --- | --- | --- |
| Renderer | Image or named fallback span | No native family export | Native parity remains open in the [family audit](../component-depth.md). |

**Variants.** Displays a validated URL, caller fallback, or the first Unicode code point of each of at most two whitespace-separated name words. The visual size comes from the stylesheet.

**Accessibility.** The name stays constant across image and fallback branches. For scripts or names where automatic initials are unsuitable, supply a localized short fallback. The round crop carries no extra meaning. The component has no animation, target or live announcement. Initials use the theme text/surface colors and inherit the surrounding text direction. Forced colors use the browser’s normal adjustments for text. A containing button owns the hit target.

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Image | Supply a valid source | img with alt=name | No | No | [Changed source retries](../../tests/avatar/runtime-isolation.test.tsx) |
| Image | Load an accepted remote source | img named by the person, outside the tab order | No | No | [Loaded image name](../../tests/avatar/runtime-isolation.test.tsx) |
| Fallback | Supply a script address, a caller fallback, extra whitespace or astral characters | No img is created; fallback or two whole-character initials keep the name | No | No | [Unsafe address and initials](../../tests/avatar/runtime-isolation.test.tsx) |
| Fallback | Omit source, supply an unsupported address, or receive an image error | Named span with role=img | No | No | [Name survives fallback](../../tests/avatar/runtime-isolation.test.tsx) |

#### Performance

`Avatar` 470 B. Measured gzip sizes for separate tree-shaken production web imports, with React and React DOM external. An image request occurs only for an accepted source. React state records source failure. The avatar has its own optional subpath and shares primitives.css. The full optional `primitives.css` entry measures 862 B gzip.

#### Tests

- **Image.** [Changed source retries](../../tests/avatar/runtime-isolation.test.tsx).
- **Fallback.** [Name survives fallback](../../tests/avatar/runtime-isolation.test.tsx), [unsafe address and initials](../../tests/avatar/runtime-isolation.test.tsx).

Unit tests exercise invalid and script addresses, failed loading, a subsequent source change, initials from collapsed whitespace and astral characters, the caller fallback and the loaded image name. Size options are designed but deferred: they need 28 B of `primitives.css`, whose remaining headroom is shared with other families. Dedicated browser image sizing and visual coverage are open. There is no native renderer for this family.

#### Changelog and deprecations

The 0.3.0-rc.1 candidate documents the current contract. No family-specific deprecations are declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Avatar.

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
