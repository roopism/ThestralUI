---
{
  "family": "Drawer",
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
      "name": "Drawer",
      "from": "@ui-lazy-dev/ui-web/motion"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/Modal",
    "https://mui.com/material-ui/react-drawer/"
  ]
}
---

# Drawer

## Part A — Contract

### Purpose and when not to use it

Show supplementary navigation or tools in a modal side panel. Choose a gesture sheet for a bottom-edge mobile action surface.

### Anatomy

A heading labels the side panel. The close action and drag grip dismiss it while its content can scroll.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| heading | Required | N/A — required | Container gap | Provides the accessible name | Text adds no stop |
| close | Required | N/A — required | Container gap | Action has its own name | Takes its place when available |
| body | Required | N/A — required | Container gap | Children retain their semantics | Operable children keep their order |

### Variants

Placement is start or end, default end. These are logical edges, reversed under RTL.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Open | Open the panel | Themed edge panel | The drawer is a named modal dialog | Close or slotted actions | Modal descendants | Pending: open scenario |
| Dismissed | Dismiss the panel | Panel removed | The dialog leaves the reading order | Invoker available | Explicit connected invoker | Pending: dismissed scenario |

### Keyboard, pointer and touch

Escape, the close button, outside click and an outward drag on the grip request dismissal. Body scroll does not initiate drag.

### Accessibility

The heading names the dialog. The drag grip is hidden from assistive technology and has a button alternative. The close action uses coarse-target sizing. Motion transitions honor reduced motion; test translated header labels at large font scales. Action outlines use the theme focus token. The start and end edges follow writing direction.

### State patterns

This family owns no request lifecycle. Its containing surface supplies any loading, empty, error, offline, permission or partial-failure state.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

| Part or state | Token |
| --- | --- |
| Panel surface | `light.surface`, `dark.surface` |
| Panel border | `light.border`, `dark.border` |
| Grip color | `light.muted`, `dark.muted` |
| Close target | `size.control`, `density.coarseTarget` |
| Return transition | `motion.exitDuration` |

### Composition and content guidelines

Use “Search filters” and “Close filters”; avoid an unlabeled icon as the only way out.

## Part B — Bindings

### API

onDismiss requests closure; mounting owns openness. returnFocusRef may point to a specific invoker. The root has no public ref or prop passthrough.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `motion:Drawer` | `children` | `import("react").ReactNode` | Required | Caller content | — |
| `motion:Drawer` | `closeLabel` | `string` | Required | Caller input | — |
| `motion:Drawer` | `onDismiss` | `() => void` | Required | Caller callback | — |
| `motion:Drawer` | `placement` | `"start" \| "end" \| undefined` | Unspecified | Caller input | — |
| `motion:Drawer` | `returnFocusRef` | `import("react").RefObject<HTMLElement \| null> \| undefined` | Unspecified | Caller reference | `HTMLElement` |
| `motion:Drawer` | `title` | `string` | Required | Caller input | — |

### React web

#### Rendering

`motion` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

The dialog contains a decorative drag grip, titled header, explicit close button and scrolling content slot. The caller mounts and unmounts it; its logical edge determines drag direction.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Platform | Public contract |
| --- | --- |
| Web | `Drawer` from `@ui-lazy-dev/ui-web/motion`. |
| Native | Planned. No exported renderer or simulator journey. Track parity in the [family inventory](../component-inventory.md). |

**Variants.** Placement is start or end, default end. These are logical edges, reversed under RTL. Content height stays constrained to the viewport.

**Keyboard and pointer.** Escape, the close button, outside click and an outward drag on the grip request dismissal. Tab remains inside the native modal. Body scroll does not initiate drag. Use returnFocusRef when pointer-opening a launcher that does not take focus.

**Accessibility.** The heading names the dialog. The drag grip is hidden from assistive technology and has a button alternative. The close action uses coarse-target sizing. Motion transitions honor reduced motion; test translated header labels at large font scales. Action outlines use the theme focus token. The start and end edges follow writing direction. Confirm contrast of the host backdrop, particularly for layered dialogs in forced colors.

**Composition.** Mount one drawer per active overlay. Give nested confirmations a separate close callback and return focus to the correct invoker. [Catalog fixture](../../catalog/MotionGallery.stories.tsx).

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Open | Mount drawer with title | Named modal dialog | Close or slotted actions | Modal descendants | [motion-overlays.test.tsx L105](../../tests/drawer/motion-overlays.test.tsx#L26) |
| Dismissed | Press Escape or close | Dialog leaves accessibility tree | Invoker available | Explicit connected invoker | [motion.spec.ts L96](../../tests/browser/motion.spec.ts#L96) |

#### Performance

The production named-import measurement is 1,169 B gzip for `Drawer`. The optional `/motion` entry stays outside the default web entry. Measurements exclude React and React DOM and count JavaScript separately from CSS. [Bundle methodology](../../scripts/verify-bundles.mjs)

#### Tests

- Open. [motion-overlays.test.tsx L105](../../tests/drawer/motion-overlays.test.tsx#L26)
- Dismissed. [motion.spec.ts L96](../../tests/browser/motion.spec.ts#L96)
- Browser coverage. [motion.spec.ts](../../tests/browser/motion.spec.ts)
- A dedicated visual baseline for this family remains open.
- Simulator coverage awaits a native export.

#### Changelog and deprecations

The `0.3.0-rc.1` draft documents the public contract introduced in `1793e8a`. No deprecations are declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Drawer.

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
