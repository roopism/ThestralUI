---
{
  "family": "Notification center",
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
      "name": "NotificationCenter",
      "from": "@ui-lazy-dev/ui-web/workflows"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/Toast",
    "https://mui.com/material-ui/react-card/"
  ]
}
---

# Notification center

## Part A — Contract

### Purpose and when not to use it

Review persistent messages with read state and bulk actions. Choose a toast for brief event feedback.

### Anatomy

The list exposes each message’s title and read state, with optional details and read actions.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| heading | Required | N/A — required | Container gap | Provides the accessible name | Text adds no stop |
| items | Required | N/A — required | Container gap | Children retain their semantics | Operable children keep their order |
| detail | Optional | collapse | Container gap | Provides supporting information | Text adds no stop |
| mark all read | Optional | collapse | Container gap | Action has its own name | Takes its place when available |

### Variants

Default, empty, loading, permission-denied and retrieval-error presentations use explicit messages.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Unread | Receive an unread item | Textual marker | Unread state and a named action are available | Mark one or all | Read buttons | Pending: unread scenario |
| Loading | Load notifications | Localized state copy | A polite status replaces the list | No | Focus stays outside the message | Pending: loading scenario |
| Denied | Deny access | Localized permission message | The status explains the access restriction | No | Focus stays outside the message | Pending: denied scenario |
| Empty | Return no messages | Localized empty message | The status describes the empty inbox | No | Focus stays outside the message | Pending: empty scenario |
| Read | Mark a message read | Read text label | The item remains and its mark-read action disappears | No read action for this item | No read button | Pending: read scenario |
| Retrieval failed | Fail to retrieve messages | Error text and retry | An error alert is exposed | Retry | Retry button | Pending: retrieval failed scenario |

### Keyboard, pointer and touch

Tab reaches available read and retry buttons. Enter or Space activates them.

### Accessibility

Visible read/unread text conveys status without relying on color. A denied retrieval and an empty inbox use distinct descriptions. Localize every action-name function and confirm focus continuity when item controls disappear. List actions have minimum target heights. No read-state animation is required.

### State patterns

Loading, denied access and retrieval failure replace the list. Retrieval errors can expose retry. An empty inbox has its own status. Changing one item’s read marker leaves the others intact.

### Localization

Default messages are mapped to `notificationCenter.empty`, `notificationCenter.readAll`, `notificationCenter.read`, `notificationCenter.unread`, `notificationCenter.markRead`. Preserve caller-supplied translations. [Message inventory](../library-strings.md)

### Tokens

The status marker and separators inherit foreground. Pending: define any notification-specific semantic tokens during family qualification.

### Composition and content guidelines

Place one center inside a labeled page or drawer. A toast may link to the center for follow-up. Use “Mark invoice approval as read” for a specific action; avoid buttons named only “Apply.” Keep the message title concise and put supporting detail in the detail slot.

## Part B — Bindings

### API

The host supplies items and availability, receives onRead(id) or onReadAll(unreadIds), and updates the data. Retry calls the supplied availability.onRetry. There is no root ref or DOM prop passthrough.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `workflows:NotificationCenter` | `availability` | `WorkflowAvailability \| undefined` | Unspecified | Caller input | — |
| `workflows:NotificationCenter` | `items` | `readonly NotificationItem[]` | Required | Caller input | — |
| `workflows:NotificationCenter` | `label` | `string` | Required | Caller input | — |
| `workflows:NotificationCenter` | `labels` | `{ empty?: string; readAll?: string; markRead?: (title: string) => string; unread?: string; read?: string; } \| undefined` | Unspecified | Caller input | — |
| `workflows:NotificationCenter` | `onRead` | `(id: string) => void` | Required | Caller callback | — |
| `workflows:NotificationCenter` | `onReadAll` | `((ids: string[]) => void) \| undefined` | Unspecified | Caller callback | — |

### React web

#### Rendering

`workflows` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

A labeled section contains a heading, optional mark-all button and message list. Each item has a title, read marker, optional detail slot and individual read action when unread. Availability or empty content replaces the list.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Platform | Public contract |
| --- | --- |
| Web | `NotificationCenter` from `@ui-lazy-dev/ui-web/workflows`. |
| Native | Planned. No exported renderer or simulator journey. Track parity in the [family inventory](../component-inventory.md). |

**Variants.** Default, empty, loading, permission-denied and retrieval-error presentations use explicit messages. Omit onReadAll to remove the bulk action.

**Keyboard and pointer.** Tab reaches available read and retry buttons. Enter or Space activates them. Read actions may disappear after host updates; host workflows should choose a focus fallback when removing the focused notification.

**Accessibility.** Visible read/unread text conveys status without relying on color. A denied retrieval and an empty inbox use distinct descriptions. Localize every action-name function and confirm focus continuity when item controls disappear. List actions have minimum target heights. Status messages use native live-region semantics and remain readable with system colors. No read-state animation is required. Render localized title and detail text in the surrounding direction.

**Tokens.** N/A — Status markers use text and inherited colors. Workflow card separators use currentColor; no notification-specific semantic token is bound.

**Composition.** Place one center inside a labeled page or drawer. Supply storage and read acknowledgements through the host. A toast may link to the center for follow-up. [Catalog fixture](../../catalog/EnterpriseWorkspace.stories.tsx).

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Unread | Pass an unread item | Visible unread text plus named action | Mark one or all | Read buttons | [workflow-status.test.tsx L54](../../tests/workflow-status.test.tsx#L9) |
| Loading | Set availability.kind to loading | Polite status replaces the list | No | Host focus remains outside message | [workflow-status.test.tsx L27](../../tests/notification-center/workflow-status.test.tsx#L9) |
| Denied | Set availability.kind to denied | Status explains access | No | Host focus remains outside message | [workflow-status.test.tsx L27](../../tests/notification-center/workflow-status.test.tsx#L9) |
| Empty | Provide zero items without an availability override | Status describes an empty inbox | No | Host focus remains outside message | [workflow-status.test.tsx L27](../../tests/notification-center/workflow-status.test.tsx#L9) |
| Read | Host sets item.read true | Item remains in list with no individual mark-read button | No read action for this item | No read button | [workflow-status.test.tsx L54](../../tests/workflow-status.test.tsx#L9) |
| Retrieval failed | Supply error availability | role=alert | Retry | Retry button | [workflow-status.test.tsx L27](../../tests/notification-center/workflow-status.test.tsx#L9) |

#### Performance

The production named-import measurement is 579 B gzip for `NotificationCenter`. The optional `/workflows` entry stays outside the default web entry. Measurements exclude React and React DOM and count JavaScript separately from CSS. [Bundle methodology](../../scripts/verify-bundles.mjs)

#### Tests

- Unread. [workflow-status.test.tsx L54](../../tests/workflow-status.test.tsx#L9)
- Loading. [workflow-status.test.tsx L27](../../tests/notification-center/workflow-status.test.tsx#L9)
- Denied. [workflow-status.test.tsx L27](../../tests/notification-center/workflow-status.test.tsx#L9)
- Empty. [workflow-status.test.tsx L27](../../tests/notification-center/workflow-status.test.tsx#L9)
- Read. [workflow-status.test.tsx L54](../../tests/workflow-status.test.tsx#L9)
- Retrieval failed. [workflow-status.test.tsx L27](../../tests/notification-center/workflow-status.test.tsx#L9)
- A dedicated three-engine journey for this family remains open.
- A dedicated visual baseline for this family remains open.
- Simulator coverage awaits a native export.

#### Changelog and deprecations

The `0.3.0-rc.1` draft documents the public contract introduced in `02fe2ba`. No deprecations are declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Notification center.

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
