---
{
  "family": "Live status and inline alert",
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
      "name": "Status",
      "from": "@ui-lazy-dev/ui-web/primitives",
      "rendering": "server-safe"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/",
    "https://mui.com/material-ui/react-alert/"
  ]
}
---

# Live status and inline alert

## Part A — Contract

### Purpose and when not to use it

Present a short result or nonmodal error that assistive technology can announce. Use an alert dialog when the user must respond before continuing.

### Anatomy

A localized message communicates the result with urgency appropriate to its severity.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| message | Required | N/A — required | Container gap | Supplies readable content | Text adds no stop |

### Variants

Use information for ordinary updates, success for successful completion, warning for a condition that needs attention soon but does not block the task, and error for an urgent problem. Only an error interrupts with an alert; information, success and warning wait for a pause in speech.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Information | Present information | Accent border and gap | Report an advisory status | No | No default stop | Pending: information scenario |
| Success | Complete an action | Success border and gap | Report the success status | No | No default stop | Pending: success scenario |
| Error | Report an error | Danger border and gap | Expose an urgent alert | No | No default stop | Pending: error scenario |

### Keyboard, pointer and touch

The message itself adds no keyboard stop. Put a separately named Retry button adjacent to an error if the user can recover.

### Accessibility

Status and alert roles expose polite and assertive semantics respectively. A warning is a polite status, never an alert. Keep the region mounted and replace its message, so each change is announced in place; mounting a new region with its message already inside may be silent in some screen readers. Keep a concise text message and essential instructions visible. The logical border follows reading direction. No animation or focus change is required. The edge color supplements the visible words. In forced colors, retain the text that identifies urgency. Status has no activation target.

### State patterns

Use advisory status for progress or success. Urgent errors use an alert. The operation owner supplies error recovery.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

| Part or state | Token |
| --- | --- |
| Information border | `light.accent`, `dark.accent` |
| Success border | `light.success`, `dark.success` |
| Warning border | `light.warning`, `dark.warning` |
| Error border | `light.danger`, `dark.danger` |
| Message padding | `size.gap` |

### Composition and content guidelines

Use in a form or workflow beneath the area that changed. Avoid announcing the same save result through multiple live regions. Do write “Invoice saved” or “Upload failed. Choose a file and try again.” Avoid “Success!” without naming the completed task. Allow longer translations to wrap.

## Part B — Bindings

### API

`tone` accepts `info` (default), `success`, `warning` or `error` and selects the semantic role: `error` renders an alert, every other tone a status. The caller controls the displayed message and any updates. Div attributes and ref are forwarded; role and tone attributes are set by Status.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `primitives:Status` | `children` | `import("react").ReactNode` | Unspecified | Caller content | — |
| `primitives:Status` | `className` | `string \| undefined` | Unspecified | Caller input | — |
| `primitives:Status` | `ref` | `import("react").Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `primitives:Status` | `style` | `import("react").CSSProperties \| undefined` | Unspecified | Caller input | — |
| `primitives:Status` | `tone` | `"info" \| "success" \| "warning" \| "error" \| undefined` | Unspecified | Caller input | — |
| `primitives:Status` | Host attributes | 276 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`primitives` is published without a client directive. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

A single div provides the live semantic role, tone and logical start border. The children slot holds the entire localized message.

#### Headless API

None. This family provides presentation or structure without separate behavior to extract.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Contract | Web | Native | Tracking |
| --- | --- | --- | --- |
| Renderer | Named tone with native HTML live-region roles | No native family export | Native parity remains open in the [family audit](../component-depth.md). |

**Variants.** `info` is the default for an ordinary update with the accent border. `success` communicates completion with the polite role and the success border. `warning` keeps the polite role with the warning border. `error` asks for attention with an alert role and danger border.

**Accessibility.** Status and alert roles expose polite and assertive semantics respectively. Exact speech timing belongs to the browser and screen reader. Keep a concise text message and essential instructions visible. The logical border follows reading direction. No animation or focus change is required. The edge color supplements the visible words. In forced colors, retain the text that identifies urgency. Status has no activation target.

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Information | Render or update with info | role=status | No | No default stop | [Informational role](../../tests/live-status-and-inline-alert/foundation-specs.test.tsx) |
| Success | Set tone to success | role=status | No | No default stop | [Success message](../../tests/live-status-and-inline-alert/foundation-specs.test.tsx) |
| Information | Set tone to warning | role=status, never alert | No | No default stop | [Polite warning](../../tests/live-status-and-inline-alert/foundation-specs.test.tsx) |
| Information | Replace the message | The same region persists and its text changes in place | No | No default stop | [Persistent live region](../../tests/live-status-and-inline-alert/foundation-specs.test.tsx) |
| Error | Set tone to error | role=alert | No | No default stop | [Alert message](../../tests/live-status-and-inline-alert/foundation-specs.test.tsx) |

#### Performance

`Status` 185 B; the warning tone adds no script. Measured gzip sizes for separate tree-shaken production web imports, with React and React DOM external. Load primitives.css for the start border. No timeout, portal or global notification queue is created. The full optional `primitives.css` entry measures 921 B gzip (949 B ceiling); the success and warning edges add 23 B.

#### Tests

- **Information.** [Informational role](../../tests/live-status-and-inline-alert/foundation-specs.test.tsx).
- **Success.** [Success message](../../tests/live-status-and-inline-alert/foundation-specs.test.tsx).
- **Error.** [Alert message](../../tests/live-status-and-inline-alert/foundation-specs.test.tsx).
- **Warning and updates.** [Polite warning, persistent region and forwarding](../../tests/live-status-and-inline-alert/foundation-specs.test.tsx).

Open: tone icons and a tinted surface per tone need more of `primitives.css` than its 28 B of headroom and wait for a per-family sheet. Unit tests inspect actual roles, the warning tone, in-place message changes, ref and attribute forwarding. Dedicated screen-reader listening, theme visuals and native renderer coverage remain open.

#### Changelog and deprecations

The 0.3.0-rc.1 candidate documents the current contract. No family-specific deprecations are declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Live status and inline alert.

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
