---
{
  "family": "Toast and snackbar",
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
      "name": "ToastRegion",
      "from": "@ui-lazy-dev/ui-web/motion"
    },
    {
      "platform": "web",
      "name": "createToastQueue",
      "from": "@ui-lazy-dev/ui-web/motion"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/Toast",
    "https://mui.com/material-ui/react-snackbar/"
  ]
}
---

# Toast and snackbar

## Part A — Contract

### Purpose and when not to use it

Show brief feedback after an operation without moving the user away. Choose the notification center for durable messages with read history.

### Anatomy

A named area presents a bounded set of messages. Each contains a title, optional description and a dismiss action.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| title | Required | N/A — required | Container gap | Provides the accessible name | Text adds no stop |
| description | Optional | collapse | Container gap | Provides supporting information | Text adds no stop |
| dismiss | Required | N/A — required | Container gap | Action has its own name | Takes its place when available |

### Variants

A toast may contain a title only or a title plus description. The queue caps visible items while retaining queued items for display after dismissal.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Visible | Show a message | Themed toast surface | The named notification area exposes the content | Dismiss available | Close control | Pending: visible scenario |
| Dismissed | Dismiss the message | Toast removed | The message is removed | Close no longer present | Queue controls remaining region focus | Pending: dismissed scenario |
| Queued message visible | Advance the queue | Previous toast returns to the surface | The next title and description become available | Dismiss available | Close control | Pending: queued message visible scenario |

### Keyboard, pointer and touch

The dismiss button works with keyboard and pointer. Do not move focus from the initiating workflow to announce routine updates.

### Accessibility

The region and dismiss action need localized names. Verify announcement timing on real assistive technology. Entrance animation is suppressed for reduced motion. Positioning uses logical insets. Text and border use theme values, and the dismiss action should remain legible in forced colors. Additional toast actions and automatic dismissal timing belong to the consumer’s queue configuration.

### State patterns

Messages beyond the visible limit wait in order. Removing a visible message makes room for the next.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

| Part or state | Token |
| --- | --- |
| Toast body | `light.surface`, `dark.surface` |
| Title | `type.strongWeight` |
| Region inset | `space.spaceMd` |
| Entrance | `motion.enterDuration` |

### Composition and content guidelines

Use a persistent region near the application shell so route swaps do not discard feedback. Keep recovery actions needing sustained attention in a persistent panel. Use “Invoice saved” with a short relevant detail; avoid “Success!” repeated for multiple unrelated tasks.

## Part B — Bindings

### API

Create the queue once for the lifetime of the region, then call its queue operations. createToastQueue(maxVisible) defaults to three. ToastRegion receives the queue by reference. The wrapper does not expose a DOM ref or root attributes.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `motion:ToastRegion` | `dismissLabel` | `string` | Required | Caller input | — |
| `motion:ToastRegion` | `label` | `string` | Required | Caller input | — |
| `motion:ToastRegion` | `queue` | `Queue<ToastMessage>` | Required | Caller input | — |
| `motion:createToastQueue` | `maxVisible` | `number \| undefined` | Unspecified | Caller input | — |

### React web

#### Rendering

`motion` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

The queue factory supplies a bounded queue. A labeled region renders each visible toast with a title, optional description and close button.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Platform | Public contract |
| --- | --- |
| Web | `ToastRegion`, `createToastQueue` from `@ui-lazy-dev/ui-web/motion`. |
| Native | Planned. No exported renderer or simulator journey. Track parity in the [family inventory](../component-inventory.md). |

**Keyboard and pointer.** The dismiss button works with keyboard and pointer. React Aria manages the region’s keyboard behavior. Do not move focus from the initiating workflow to announce routine updates.

**Accessibility.** The region and dismiss action need localized names. Toast titles and descriptions are exposed via React Aria slots. Verify announcement timing on real assistive technology. Entrance animation is suppressed for reduced motion. Positioning uses logical insets. Text and border use theme values, and the dismiss action should remain legible in forced colors. Additional toast actions and automatic dismissal timing belong to the consumer’s queue configuration.

**Composition.** Use a persistent region near the application shell so route swaps do not discard feedback. Keep recovery actions needing sustained attention in a persistent panel. [Catalog fixture](../../catalog/MotionGallery.stories.tsx).

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Visible | Add a titled message | Named notification region with toast content | Dismiss available | Close control | [motion-overlays.test.tsx L70](../../tests/toast-and-snackbar/motion-overlays.test.tsx#L26) |
| Dismissed | Close the visible toast | Region removes the closed message | Close no longer present | Queue controls remaining region focus | [motion-overlays.test.tsx L70](../../tests/toast-and-snackbar/motion-overlays.test.tsx#L26) |
| Queued message visible | Dismiss a newer message when the visible limit is one | Region exposes its title and description | Dismiss available | Close control | [motion-overlays.test.tsx L70](../../tests/toast-and-snackbar/motion-overlays.test.tsx#L26) |

#### Performance

The production named-import measurement is 20,141 B gzip for `ToastRegion`, 1,609 B gzip for `createToastQueue`. The optional `/motion` entry stays outside the default web entry. Measurements exclude React and React DOM and count JavaScript separately from CSS. [Bundle methodology](../../scripts/verify-bundles.mjs)

#### Tests

- Visible. [motion-overlays.test.tsx L70](../../tests/toast-and-snackbar/motion-overlays.test.tsx#L26)
- Dismissed. [motion-overlays.test.tsx L70](../../tests/toast-and-snackbar/motion-overlays.test.tsx#L26)
- Queued message visible. [motion-overlays.test.tsx L70](../../tests/toast-and-snackbar/motion-overlays.test.tsx#L26)
- Browser coverage. [motion.spec.ts](../../tests/browser/motion.spec.ts)
- A dedicated visual baseline for this family remains open.
- Simulator coverage awaits a native export.

#### Changelog and deprecations

The `0.3.0-rc.1` draft documents the public contract introduced in `1793e8a`. No deprecations are declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Toast and snackbar.

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
