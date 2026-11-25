---
{
  "family": "Spinner",
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
      "name": "Spinner",
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

# Spinner

## Part A — Contract

### Purpose and when not to use it

Indicate an operation with unknown progress and give it a localized name. Use Progress with a value when the fraction complete is known, and Skeleton when the shape of the incoming content is known.

### Anatomy

A ring that follows the surrounding text color and size. An optional localized name turns it into a status; without a name it is purely decorative.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| name | Optional | collapse | Container gap | Names the status; omitted, the ring is hidden from assistive technology | No stop |

### Variants

Named: a status for a standalone operation. Decorative: a hidden ring inside an action or region that already announces its own busy state, which prevents a double announcement. The size follows the surrounding text, so a heading-sized ring needs no separate size option. The reduced-motion presentation keeps the static ring, its gap and its name.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Loading | Start an indefinite operation, named or decorative | Inherited foreground; rotation removed under reduced motion | A named status identifies the activity; a decorative ring is hidden and the busy container supplies the name | No | No | Pending: loading scenario |

### Keyboard, pointer and touch

No key or pointer event changes progress. Keep keyboard focus on the control or content that initiated the operation.

### Accessibility

A named ring is a polite status that announces its name when it appears; an unnamed ring is hidden, so a busy action keeps exactly one announcement. Actual speech depends on assistive technology and update timing. Use text beside the ring for a lengthy operation. The ring follows current text color and does not require motion to expose meaning. The ring remains still under reduced motion. Its logical border responds to writing direction. In forced colors the ring keeps its border width and is drawn with the system text color. Surrounding text supplies readable context. The status supplies no hit area.

### State patterns

Represents an operation without a known completion fraction. The surrounding surface supplies completion, error and recovery messages.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

| Part or state | Token |
| --- | --- |
| Ring color | Inherited foreground (normally `light.text`, `dark.text`; `light.onAccent`, `dark.onAccent` inside a primary action) |
| Ring size | Inherited text size (`type.bodySize` by default) |

### Composition and content guidelines

Place beside the label of an in-progress region. Coordinate live messages with the action that started it to avoid duplicate announcements. Do use “Loading invoice history”. Avoid “Spinner”. Supply complete translated text containing the operation, even when the visible indicator is compact.

## Part B — Bindings

### API

Requires a string label. No host ref, host attribute spread or callback is exposed. The owner starts and stops the indication by mounting and unmounting it.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `primitives:Spinner` | `label` | `string \| undefined` | Unspecified | Caller input | — |

### React web

#### Rendering

`primitives` is published without a client directive. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

An empty span draws a ring with CSS. With `label` it has the status role and that accessible name. Without `label` it is `aria-hidden` and has no role, for use inside a busy Button or region that already announces the operation. The ring has no public child or icon slot, class or ref; attribute forwarding waits for budget headroom in the `primitives` entry (912 B of 915 B gzip).

#### Headless API

None. This family provides presentation or structure without separate behavior to extract.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Contract | Web | Native | Tracking |
| --- | --- | --- | --- |
| Renderer | CSS ring with named status role | No native family export | Native parity remains open in the [family audit](../component-depth.md). |

**Variants.** One indeterminate ring. CSS animates rotation only when no reduced-motion preference is set. The reduced-motion presentation keeps the static ring and its name.

**Accessibility.** The status role and aria-label expose the operation name. Actual speech depends on assistive technology and update timing. Use text beside the ring for a lengthy operation. The ring follows current text color and does not require motion to expose meaning. The ring remains still under reduced motion. Its logical border responds to writing direction. Children or surrounding text supply readable contrast in forced colors. The status supplies no hit area.

**Tokens.** N/A — the ring uses inherited currentColor. Its geometry and rotation timing are stylesheet values pending semantic token adoption.

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Loading | Render a spinner with a localized label | Named status role | No | No | [Spinner is named and outside tab order](../../tests/spinner/foundation-specs.test.tsx) |
| Loading | Render without a label inside a busy action or region | Hidden, no role, the action name is unchanged | No | No | [Decorative ring keeps one announcement](../../tests/spinner/foundation-specs.test.tsx) |

#### Performance

`Spinner` adds 2 B gzip to the `primitives` entry for optional naming (914 B of 915 B). Measured gzip sizes for separate tree-shaken production web imports, with React and React DOM external. The ring uses primitives.css and one span. There is no JavaScript animation loop. The full optional `primitives.css` entry measures 862 B gzip.

#### Tests

- **Loading.** [Spinner is named and outside tab order](../../tests/spinner/foundation-specs.test.tsx), [a label turns the ring into one status, and an unnamed ring stays hidden inside a busy region or action](../../tests/spinner/foundation-specs.test.tsx).

Unit tests verify name, status role, decorative hiding, a single status after naming and focusability. Rotation under reduced motion, inherited color and size, the right-to-left gap and forced colors are covered by a browser test and a neutral scenario that land with the next device-qualified batch. There is no native export.

#### Changelog and deprecations

The 0.3.0-rc.1 candidate documents the current contract. No family-specific deprecations are declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Spinner.

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
