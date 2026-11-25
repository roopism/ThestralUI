---
{
  "family": "Settings",
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
      "name": "SettingsPanel",
      "from": "@ui-lazy-dev/ui-web/workflows"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/Switch",
    "https://mui.com/material-ui/react-switch/"
  ]
}
---

# Settings

## Part A — Contract

### Purpose and when not to use it

Change binary preferences, grouped by topic, that take effect as soon as they change. Use a form with an explicit save action when changes must be reviewed together, a wizard when they must be made in sequence, and a single switch inside an existing form for one isolated preference.

### Anatomy

A titled panel contains named groups of switches. Each group can carry a description, and each switch a description of its own. A loading, denied or error message, or an empty message, replaces the groups.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| heading | Required | N/A — the panel is named by its heading text | Container gap | Names the panel region | Text adds no stop |
| groups | Required | N/A — supply at least one group, or an empty message | Container gap | Each group is named by its label | Switches in group order |
| group description | Optional | collapse | Container gap | Describes every switch in the group | Text adds no stop |
| setting description | Optional | collapse | Container gap | Describes its switch | Text adds no stop |
| empty | Optional | fallback — use the localized empty message | Container gap | Announced as status text | Text adds no stop |

### Variants

- **Groups without settings** are omitted, so a panel never shows an empty group.
- **Restricted settings** keep their name and value but cannot change.
- **Availability** replaces all groups with a loading, permission-denied or error message (with a retry action) while the values are unknown.
- **Empty** replaces the groups with a status message when no group has settings; it defaults to the localized “No settings available.”

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| On | The owner supplies an enabled preference | Platform switch, on | The named switch is on | Yes unless restricted | Yes | Pending: the neutral switch role lands with the native binding |
| Off | The owner supplies a disabled preference | Platform switch, off | The named switch is off | Yes unless restricted | Yes | Pending: the neutral switch role lands with the native binding |
| Restricted | The owner restricts a preference | Platform switch, unavailable | The switch is unavailable and keeps its value | No | No, skipped by Tab | Pending: the neutral vocabulary cannot yet observe an unavailable switch |
| Loading | Availability is loading | Inherited text | Status message replaces the groups | No | No | Pending: the neutral status role lands with the native binding |
| Error | Availability is an error | Inherited text | Alert message and a retry action replace the groups | Retry only | Retry action | Pending: the neutral alert role lands with the native binding |
| Empty | No group has settings | Inherited text | Status message replaces the groups | No | No | Pending: the neutral status role lands with the native binding |

### Keyboard, pointer and touch

- Tab moves through the available switches in group order; restricted switches and descriptions are skipped.
- Space toggles the focused switch. Activating a switch's visible label toggles it too, which gives a larger target than the switch glyph.
- The change is reported to the owner, who supplies the new value; the switch shows the owner's value, so a rejected change does not appear applied.

### Accessibility

- **Roles.** A named region with a heading; each group is a named group; each preference is a switch with on, off and unavailable states.
- **Name and description.** Each switch is named by its visible label and described by its own description; a group description describes the whole group.
- **Announcements.** Loading and empty messages are status messages; an error is an alert with a retry action.
- **Target size.** The label and the switch together form the activation area.
- **Contrast and forced colors.** Switches use the platform control, which follows system colors in forced colors.
- **Reduced motion.** No animation.
- **Right to left.** The setting grid follows the writing direction.

### State patterns

Loading, permission-denied and error-with-retry states replace the groups while values are unknown, so stale values are never presented as current. An empty collection has its own message. A setting the person may not change stays visible and restricted. When saving one change fails, keep the previous value and report the failure near the panel.

### Localization

Default messages are mapped to `settings.empty`. Preserve caller-supplied translations. [Message inventory](../library-strings.md)

### Tokens

The settings wrapper has no dedicated semantic tokens.

### Composition and content guidelines

- Do group related preferences by topic, with labels that name the preference, such as “Weekly digest”, and a description of the effect, such as “One email every Friday”.
- Do keep labels unchanged when the value changes; avoid labels that flip between “Enable” and “Disable”.
- Do show a failure when a change could not be saved rather than presenting the requested value.
- Avoid preferences that need confirmation or a combined save; use a form instead.

## Part B — Bindings

### API

Enabled and disabled values come from host records. onChange(id, enabled) requests a new boolean. The host decides when to persist or roll back. The section does not forward a ref or host attributes.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `workflows:SettingsPanel` | `availability` | `WorkflowAvailability \| undefined` | Unspecified | Caller input | — |
| `workflows:SettingsPanel` | `empty` | `ReactNode` | Unspecified | Caller input | — |
| `workflows:SettingsPanel` | `groups` | `readonly SettingsGroup[]` | Required | Caller input | — |
| `workflows:SettingsPanel` | `label` | `string` | Required | Caller input | — |
| `workflows:SettingsPanel` | `onChange` | `(id: string, enabled: boolean) => void` | Required | Caller callback | — |

### React web

#### Rendering

`workflows` is a client entry. The panel holds no state: each switch reflects the owner's `enabled` value and reports changes through `onChange`, so server and client markup match and hydrate without a mismatch.

A heading precedes grouped fieldsets. Each legend labels a group, and an optional group description is linked to the fieldset. Each setting includes its label, native checkbox switch and optional description slot. Availability and empty slots replace groups.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Platform | Public contract |
| --- | --- |
| Web | `SettingsPanel` from `@ui-lazy-dev/ui-web/workflows`. |
| Native | Planned. No exported renderer or simulator journey. Track parity in the [family inventory](../component-inventory.md). |

**Accessibility.** Each switch is a native checkbox with `role="switch"` and an explicit label; its description is connected by `aria-describedby`. A group description is linked to its `fieldset` the same way. Native checkboxes follow system colors.

**Tokens.** N/A — native switch visuals and inherited text provide the current presentation. The settings wrapper has no dedicated semantic tokens.

**Composition.** Use stable group and setting IDs. [Catalog fixture](../../catalog/EnterpriseWorkspace.stories.tsx).

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| On and off | Pass `enabled` | `role="switch"` checkbox reflects the owner value | Yes unless restricted | Yes | [Groups and owner value](../../tests/workflow-status.test.tsx) |
| Restricted | Pass `disabled` for a setting | Native disabled property; label activation ignored | No | Skipped by Tab | [Restricted setting](../../tests/workflow-status.test.tsx) |
| Loading, error and empty | Pass `availability` or no settings | Status, alert with retry, or empty status replaces groups | Retry only | Retry | [Availability and empty](../../tests/workflow-status.test.tsx) |

#### Performance

`SettingsPanel` measures 601 B gzip as a separate named import with React and React DOM external. The group description adds no CSS. The optional `/workflows` entry stays outside the default web entry. [Bundle methodology](../../scripts/verify-bundles.mjs)

#### Tests

- Groups, descriptions, owner value, restricted settings, availability and empty states. [workflow-status.test.tsx](../../tests/workflow-status.test.tsx)
- Pending: a dedicated three-engine journey, catalog story and the neutral scenario land with the native binding.

#### Changelog and deprecations

Unreleased: `SettingsGroup.description` describes a whole group. Additive; no migration needed.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Settings.

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
