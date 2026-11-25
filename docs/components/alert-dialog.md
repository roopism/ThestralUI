---
{
  "family": "Alert dialog",
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
      "name": "AlertDialog",
      "from": "@ui-lazy-dev/ui-web/motion"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/Modal",
    "https://www.radix-ui.com/primitives/docs/components/alert-dialog"
  ]
}
---

# Alert dialog

## Part A — Contract

### Purpose and when not to use it

Ask for a decision before a consequential change. Choose Dialog for ordinary information or a multi-field editor.

### Anatomy

A title and description explain the decision. Cancel and confirm have distinct names.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| title | Required | N/A — required | Container gap | Provides the accessible name | Text adds no stop |
| description | Required | N/A — required | Container gap | Provides supporting information | Text adds no stop |
| cancel | Required | N/A — required | Container gap | Action has its own name | Takes its place when available |
| confirm | Required | N/A — required | Container gap | Action has its own name | Takes its place when available |

### Variants

This is a two-action confirmation. Cancellation is the safe initial choice. Its presentation does not expose additional emphasis choices.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Open | Open the decision | Raised alert with danger action | Named modal alert with a description | Cancel or confirm | Cancel initially | Pending: open scenario |
| Cancelled | Cancel the decision | Inner alert removed | Return to the initiating surface | Outer controls | Inner invoker | Pending: cancelled scenario |
| Confirmed | Confirm the decision | See Tokens | Invoke the confirmation once | Yes | The decision owner places focus at the resulting destination | Pending: confirmed scenario |

### Keyboard, pointer and touch

Enter or Space activates the focused choice; Escape requests cancellation, including when nested. Backdrop clicks do not confirm. A separate explicit confirm button is the only destructive action.

### Accessibility

Initial focus goes to the least destructive button; label the consequence directly. Provide a suitable return target if confirming removes the original launcher. Destructive text and border share the danger color. All choices remain explicitly labeled in forced colors. Action targets grow for coarse pointers. The dialog adds no entrance animation, and the action row wraps in reading order.

### State patterns

This family owns no request lifecycle. Its containing surface supplies any loading, empty, error, offline, permission or partial-failure state.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

| Part or state | Token |
| --- | --- |
| Dialog surface | `light.surface`, `dark.surface` |
| Dialog edge | `light.border`, `dark.border` |
| Destructive label and border | `light.danger`, `dark.danger` |
| Action focus outline | `light.focus`, `dark.focus` |
| Action size | `size.control`, `density.coarseTarget` |

### Composition and content guidelines

When nested in a sheet, dismiss only the active alert and restore the sheet control. Use “Remove invoice?” with “Keep invoice” and “Remove invoice”; avoid “OK” for irreversible changes.

## Part B — Bindings

### API

The host mounts the alert. onCancel and onConfirm are distinct void callbacks. returnFocusRef optionally names the invoker. Title, description and both action labels are required inputs. No host prop/ref passthrough.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `motion:AlertDialog` | `cancelLabel` | `string` | Required | Caller input | — |
| `motion:AlertDialog` | `confirmLabel` | `string` | Required | Caller input | — |
| `motion:AlertDialog` | `description` | `string` | Required | Caller input | — |
| `motion:AlertDialog` | `onCancel` | `() => void` | Required | Caller callback | — |
| `motion:AlertDialog` | `onConfirm` | `() => void` | Required | Caller callback | — |
| `motion:AlertDialog` | `returnFocusRef` | `RefObject<HTMLElement \| null> \| undefined` | Unspecified | Caller reference | `HTMLElement` |
| `motion:AlertDialog` | `title` | `string` | Required | Caller input | — |

### React web

#### Rendering

`motion` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

A native modal has an alertdialog role, title, explanatory description and a pair of cancel/confirm buttons. The confirm action uses the danger treatment.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Platform | Public contract |
| --- | --- |
| Web | `AlertDialog` from `@ui-lazy-dev/ui-web/motion`. |
| Native | Planned. No exported renderer or simulator journey. Track parity in the [family inventory](../component-inventory.md). |

**Accessibility.** Title and description use independent IDs. Initial focus goes to the least destructive button; label the consequence directly. Provide a suitable return target if confirming removes the original launcher. Destructive text and border share the danger color. All choices remain explicitly labeled in forced colors. Action targets grow for coarse pointers. The dialog adds no entrance animation, and the action row wraps in document order.

**Composition.** Keep the alert mounted until the caller processes the decision. When nested in a sheet, dismiss only the active alert and restore the sheet control. [Catalog fixture](../../catalog/MotionGallery.stories.tsx).

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Open | Mount confirmation | Named and described alertdialog | Cancel or confirm | Cancel initially | [motion.spec.ts L10](../../tests/browser/motion.spec.ts#L11) |
| Cancelled | Escape in nested alert | Outer dialog preserved | Outer controls | Inner invoker | [motion-overlays.test.tsx L85](../../tests/motion-overlays.test.tsx#L43) |
| Confirmed | Activate destructive action | Confirm callback only | Yes | Host owns resulting focus | [motion-overlays.test.tsx L46](../../tests/alert-dialog/motion-overlays.test.tsx#L26) |

#### Performance

The production named-import measurement is 771 B gzip for `AlertDialog`. The optional `/motion` entry stays outside the default web entry. Measurements exclude React and React DOM and count JavaScript separately from CSS. [Bundle methodology](../../scripts/verify-bundles.mjs)

#### Tests

- Open. [motion.spec.ts L10](../../tests/browser/motion.spec.ts#L11)
- Cancelled. [motion-overlays.test.tsx L85](../../tests/motion-overlays.test.tsx#L43)
- Confirmed. [motion-overlays.test.tsx L46](../../tests/alert-dialog/motion-overlays.test.tsx#L26)
- Browser coverage. [motion.spec.ts](../../tests/browser/motion.spec.ts)
- A dedicated visual baseline for this family remains open.
- Simulator coverage awaits a native export.

#### Changelog and deprecations

The `0.3.0-rc.1` draft documents the public contract introduced in `1793e8a`. No deprecations are declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Alert dialog.

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
