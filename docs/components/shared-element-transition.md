---
{
  "family": "Shared element transition",
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
      "name": "animateSharedElement",
      "from": "@ui-lazy-dev/ui-web/motion"
    },
    {
      "platform": "web",
      "name": "captureSharedElement",
      "from": "@ui-lazy-dev/ui-web/motion"
    }
  ],
  "reference": [
    "https://mui.com/material-ui/transitions/",
    "https://mui.com/material-ui/react-card/"
  ]
}
---

# Shared element transition

## Part A — Contract

### Purpose and when not to use it

Show how an item moves from its previous position and size to a new one. Use a simple opacity change when there is no spatial relationship to explain.

### Anatomy

A visual moves from its previous position and size to its destination while the item retains its identity.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | No content slot | No slot focus stop |

### Variants

- **Move.** The default translates and scales from the captured rectangle to the final rectangle, anchored at the top-left corner, so the item appears to travel from where it was.
- **Corner morph.** A captured corner radius is carried through the move and eases into the destination's own radius, so a rounded thumbnail can become a square header image without a visible jump.
- **Cross-fade.** With fade, the destination also dissolves in, for pairing with an outgoing copy that fades out.
- **Pacing.** Journeys longer than a short hop take proportionally longer, never more than twice the entrance duration.
- Zero-sized or equal rectangles, reduced motion and unsupported animation skip the interpolation.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Animating | Move between positions | Translate and scale from captured rectangle | The destination retains the item’s role and identity | Through eligible controls | The owning surface retains focus | Pending: animating scenario |
| Completed | Finish the movement | Destination remains at its final layout | The item is at its final position | Through eligible controls | The owning surface retains focus | Pending: completed scenario |
| Skipped | Skip interpolation | No transform applied | The final layout remains available | Through eligible controls | The owning surface retains focus | Pending: skipped scenario |
| Interrupted | Interrupt with a new destination | Current transform yields to a new measurement | Only one accessible item remains | Through eligible controls | The owning surface retains focus | Pending: interrupted scenario |
| Reversed | Reverse a running transition | The item travels back towards the captured rectangle and reports reversed on arrival | The caller decides whether the semantic change is undone | Through eligible controls | The owning surface retains focus | Pending: reversed scenario |

### Keyboard, pointer and touch

The measurement and animation functions add no input handlers. Initiating controls must support keyboard and touch independently. Keep focus on the initiating control or deliberately restore it after a remount.

### Accessibility

Reduced motion bypasses interpolation, including the cross-fade and corner morph. Never delay semantic updates until animation completes. Only transform, opacity and corner radius animate; layout and hit targets are already final when the motion starts. The utility positions visuals in physical pixels using actual layout measurements, including RTL. The utility introduces no target or new colors. Keep focus and naming with the semantic destination even if forced colors or reduced motion remove visual cues.

### State patterns

This family owns no request lifecycle. Its containing surface supplies any loading, empty, error, offline, permission or partial-failure state.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

| Part or state | Token |
| --- | --- |
| Transition duration (up to twice for long journeys) | `motion.enterDuration` |
| Journey length that doubles the duration (twenty times) | `space.spaceXl` |
| Reduced-motion duration | `motion.enterDuration` [0ms in the reduced mode] |

### Composition and content guidelines

Capture in the activation handler before the change. Measure the destination in a layout effect after committing the new layout. The transition produces no copy. Where moving an item changes its status, describe the destination in words such as “Moved to Reading list”.

## Part B — Bindings

### API

Capture immediately before the DOM change, then pass the snapshot and the destination HTMLElement after layout. The snapshot holds the source rectangle and its corner radius. Options accept a signal and `fade`. The caller owns semantic state, node identity and cleanup. A single destination has no visible stagger. The handle resolves finished, reversed, cancelled or skipped.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `motion:animateSharedElement` | `destination` | `HTMLElement` | Required | Caller input | — |
| `motion:animateSharedElement` | `options` | `(MotionOptions & { fade?: boolean; }) \| undefined` | Unspecified | Caller input | — |
| `motion:animateSharedElement` | `source` | `SharedElementBounds` | Required | Caller input | — |
| `motion:captureSharedElement` | `source` | `HTMLElement` | Required | Caller input | — |

### React web

#### Rendering

`motion` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

captureSharedElement snapshots the source rectangle. animateSharedElement compares that snapshot with the destination and returns a reversible, cancellable animation handle.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Platform | Public contract |
| --- | --- |
| Web | `animateSharedElement`, `captureSharedElement` from `@ui-lazy-dev/ui-web/motion`. |
| Native | Planned. No exported renderer or simulator journey. Track parity in the [family inventory](../component-inventory.md). |

**Accessibility.** Reduced motion bypasses interpolation, including the cross-fade and corner morph. Never delay semantic updates until animation completes. Only transform, opacity and corner radius animate; layout and hit targets are already final when the motion starts. The utility positions visuals in physical pixels using actual layout measurements, including RTL. Alt text and focus indicators belong to the composed elements. The utility introduces no target or new colors. Keep focus and naming with the semantic destination even if forced colors or reduced motion remove visual cues.

**Composition.** Capture in the activation handler before the change. Measure the destination in a layout effect after committing the new layout. Cancel the returned handle when the host unmounts. [Catalog fixture](../../catalog/MotionSequences.stories.tsx).

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Animating | Measure, change layout and animate destination | Destination keeps its own role and identity | Host inputs | Host retains focus responsibility | [motion-choreography.test.tsx L65](../../tests/shared-element-transition/motion-choreography.test.tsx#L28) |
| Completed | Allow destination animation to settle | Handle resolves finished | Host inputs | Host retains focus responsibility | [motion-choreography.test.tsx L65](../../tests/shared-element-transition/motion-choreography.test.tsx#L28) |
| Skipped | Destination lacks measurable bounds | Final layout remains available | Host controls only | Host retains focus responsibility | [motion-choreography.test.tsx L60](../../tests/shared-element-transition/motion-choreography.test.tsx#L23) |
| Interrupted | Move again while the prior transition is active | No extra overlay or duplicated accessible content is added | Host controls only | Focus remains with host | [motion.spec.ts L144](../../tests/browser/motion.spec.ts#L144) |

#### Performance

The production named-import measurement is 1,463 B gzip for `animateSharedElement`, 232 B gzip for `captureSharedElement`. The optional `/motion` entry stays outside the default web entry. Measurements exclude React and React DOM and count JavaScript separately from CSS. [Bundle methodology](../../scripts/verify-bundles.mjs)

#### Tests

- Animating. [motion-choreography.test.tsx L65](../../tests/shared-element-transition/motion-choreography.test.tsx#L28)
- Completed. [motion-choreography.test.tsx L65](../../tests/shared-element-transition/motion-choreography.test.tsx#L28)
- Skipped. [motion-choreography.test.tsx L60](../../tests/shared-element-transition/motion-choreography.test.tsx#L23)
- Interrupted. [motion.spec.ts L144](../../tests/browser/motion.spec.ts#L144)
- Corner morph, cross-fade, pacing and reversal. [motion-choreography.test.tsx L44](../../tests/shared-element-transition/motion-choreography.test.tsx#L44)
- Captured corner radius. [motion-choreography.test.tsx L62](../../tests/shared-element-transition/motion-choreography.test.tsx#L62)
- Browser coverage. [motion.spec.ts L144](../../tests/browser/motion.spec.ts#L144)
- A dedicated visual baseline for this family remains open.
- Simulator coverage awaits a native export.

#### Changelog and deprecations

The `0.3.0-rc.1` draft documents the public contract introduced in `c1626ab`. No deprecations are declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Shared element transition.

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
