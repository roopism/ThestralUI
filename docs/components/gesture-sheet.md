---
{
  "family": "Gesture sheet",
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
      "name": "GestureSheet",
      "from": "@ui-lazy-dev/ui-web/motion"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/Modal",
    "https://mui.com/material-ui/react-drawer/"
  ]
}
---

# Gesture sheet

## Part A — Contract

### Purpose and when not to use it

Present contextual actions in a bottom sheet that can be dismissed with one hand. Choose Drawer for a panel anchored to an inline edge.

### Anatomy

A heading labels the sheet. Its grip supports dragging while the body scrolls. A close action provides an alternative.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| heading | Required | N/A — required | Container gap | Provides the accessible name | Text adds no stop |
| close | Required | N/A — required | Container gap | Action has its own name | Takes its place when available |
| body | Required | N/A — required | Container gap | Children retain their semantics | Operable children keep their order |

### Variants

Dismissal uses outward drag distance relative to the panel with upper and lower bounds.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Open | Open the sheet | Themed surface and rounded corners | The surface is a named modal | Close button and content | Modal controls | Pending: open scenario |
| Dragging | Drag the grip | Sheet follows drag offset | The grip adds no separate reading stop | Gesture may request dismissal | Focus remains in sheet | Pending: dragging scenario |
| Insufficient drag | Release before the dismissal threshold | Offset resets | The sheet stays open | Close and content still operable | Focus remains in sheet | Pending: insufficient drag scenario |
| Dismissed | Complete a dismissing gesture | Sheet removed | The sheet leaves the reading order | Launcher available | Returns to invoker | Pending: dismissed scenario |

### Keyboard, pointer and touch

The close button and Escape support keyboard dismissal. Drag on the grip only; scrolling or cancelling a short drag must keep the sheet open.

### Accessibility

Use a short heading and localized close label. Controls remain reachable with an on-screen keyboard and enlarged text. Reduced-motion users retain drag and button dismissal. The action target grows for coarse pointers and uses a visible focus outline. Logical inset rules account for writing direction.

### State patterns

This family owns no request lifecycle. Its containing surface supplies any loading, empty, error, offline, permission or partial-failure state.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

| Part or state | Token |
| --- | --- |
| Panel surface | `light.surface`, `dark.surface` |
| Panel border | `light.border`, `dark.border` |
| Grip | `light.muted`, `dark.muted` |
| Panel padding | `space.spaceMd` |
| Release transition | `motion.exitDuration` |

### Composition and content guidelines

Use the content slot for related actions. Keep long lists inside the scroll body and leave the grip free of other handlers. Use “Delivery options” with “Close options”; avoid instructions that require dragging as the sole interaction.

## Part B — Bindings

### API

The host controls visibility through mounting. onDismiss requests closure. Return focus to a supplied element through returnFocusRef. No snap-point, velocity, externally controlled offset or public root ref is exposed.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `motion:GestureSheet` | `children` | `ReactNode` | Required | Caller content | — |
| `motion:GestureSheet` | `closeLabel` | `string` | Required | Caller input | — |
| `motion:GestureSheet` | `onDismiss` | `() => void` | Required | Caller callback | — |
| `motion:GestureSheet` | `returnFocusRef` | `RefObject<HTMLElement \| null> \| undefined` | Unspecified | Caller reference | `HTMLElement` |
| `motion:GestureSheet` | `title` | `string` | Required | Caller input | — |

### React web

#### Rendering

`motion` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

A dialog lays out a drag grip, heading, close button and scrollable content. Only the grip captures and tracks a primary pointer; the scroll body is a caller slot.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Platform | Public contract |
| --- | --- |
| Web | `GestureSheet` from `@ui-lazy-dev/ui-web/motion`. |
| Native | Planned. No exported renderer or simulator journey. Track parity in the [family inventory](../component-inventory.md). |

**Variants.** Compact sheets span the inline area; on wide screens the sheet is centered and capped. Dismissal uses outward drag distance relative to the panel with upper and lower bounds.

**Keyboard and pointer.** The close button and Escape support keyboard dismissal. Drag on the grip only; scrolling or cancelling a short drag must keep the sheet open. Body scrolling and keyboard-safe sizing have a separate browser journey.

**Accessibility.** Use a short heading and localized close label. Controls remain reachable with an on-screen keyboard and enlarged text. Focus is contained by showModal; an explicit returnFocusRef supports pointer launchers. Reduced-motion users retain drag and button dismissal. The action target grows for coarse pointers and uses a visible focus outline. Logical inset rules account for writing direction. The browser scenario checks focus in system colors, plus keyboard and safe-area insets.

**Composition.** Use the content slot for related actions. Keep long lists inside the scroll body and leave the grip free of other handlers. Track native snap/velocity parity before release. [Catalog fixture](../../catalog/MotionGallery.stories.tsx).

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Open | Mount at bottom edge | Named modal dialog | Close button and content | Modal controls | [motion.spec.ts L39](../../tests/gesture-sheet/motion.spec.ts#L8) |
| Dragging | Move the primary pointer outward on the grip | Grip is decorative | Gesture may request dismissal | Focus remains in sheet | [motion.spec.ts L39](../../tests/gesture-sheet/motion.spec.ts#L8) |
| Insufficient drag | Release before threshold | Modal remains open | Close and content still operable | Focus remains in sheet | [motion.spec.ts L39](../../tests/gesture-sheet/motion.spec.ts#L8) |
| Dismissed | Choose Close or complete an outward drag | Dialog leaves accessibility tree | Launcher available | Returns to invoker | [motion.spec.ts L10](../../tests/browser/motion.spec.ts#L11) |

#### Performance

The production named-import measurement is 1,163 B gzip for `GestureSheet`. The optional `/motion` entry stays outside the default web entry. Measurements exclude React and React DOM and count JavaScript separately from CSS. [Bundle methodology](../../scripts/verify-bundles.mjs)

#### Tests

- Open. [motion.spec.ts L39](../../tests/gesture-sheet/motion.spec.ts#L8)
- Dragging. [motion.spec.ts L39](../../tests/gesture-sheet/motion.spec.ts#L8)
- Insufficient drag. [motion.spec.ts L39](../../tests/gesture-sheet/motion.spec.ts#L8)
- Dismissed. [motion.spec.ts L10](../../tests/browser/motion.spec.ts#L11)
- Browser coverage. [quality.spec.ts](../../tests/gesture-sheet/quality.spec.ts)
- Unit coverage. [motion-overlays.test.tsx](../../tests/motion-overlays.test.tsx)
- A dedicated visual baseline for this family remains open.
- Simulator coverage awaits a native export.

#### Changelog and deprecations

The `0.3.0-rc.1` draft documents the public contract introduced in `1793e8a`. No deprecations are declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Gesture sheet.

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
