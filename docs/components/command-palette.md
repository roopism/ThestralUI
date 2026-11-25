---
{
  "family": "Command palette",
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
      "name": "CommandPalette",
      "from": "@ui-lazy-dev/ui-web/workflows"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/ComboBox",
    "https://react-aria.adobe.com/Modal"
  ]
}
---

# Command palette

## Part A — Contract

### Purpose and when not to use it

Search and invoke named commands from a modal. Use record selection when choices select content and remain visible after selection.

### Anatomy

A heading identifies the command collection. Search narrows the available actions and a close action dismisses the palette.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| heading | Required | N/A — required | Container gap | Provides the accessible name | Text adds no stop |
| search | Required | N/A — required | Container gap | Control has its own name | Participates in its logical position |
| options | Required | N/A — required | Container gap | Children retain their semantics | Operable children keep their order |
| empty message | Optional | collapse | Container gap | Provides supporting information | Text adds no stop |
| close | Required | N/A — required | Container gap | Action has its own name | Takes its place when available |

### Variants

The list filters command labels and keywords with Unicode normalization and locale-aware case handling. Disabled commands can match but cannot become the active choice.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Open | Open the command list | Default dialog | The heading names the dialog and search is expanded | Enabled commands only | Search input on open | Pending: open scenario |
| Active | Move to another command | See Tokens | The current option is identified | Enter chooses the command | Focus stays on input | Pending: active scenario |
| Disabled | Disable a command | See Tokens | Navigation skips the unavailable command | No | Not a tab stop | Pending: disabled scenario |
| No matches | Search for an absent command | Localized empty message | An empty status replaces the options | Enter invokes no command | Search input remains focused | Pending: no matches scenario |
| Closed | Dismiss the palette | Dialog removed | The modal is removed from the reading order | Launcher available | Connected launcher | Pending: closed scenario |

### Keyboard, pointer and touch

Up/Down cycle through enabled matches; Enter chooses the active command. Ignore composition keys while an IME is active. Mouse-down on a result preserves search focus.

### Accessibility

The dialog, input and listbox need distinguishable labels. Active options are exposed through the input and use system selection colors. Empty results use a status message. Translate close and search labels and supply locale for query matching. Options and commands have minimum target heights. Dialog motion is absent. Keep localized keyboard commands independent of writing direction.

### State patterns

Expose a localized status when a search returns no commands. Disabled commands remain identifiable.

### Localization

Default messages are mapped to `commandPalette.search`, `commandPalette.empty`, `commandPalette.close`. Preserve caller-supplied translations. [Message inventory](../library-strings.md)

### Tokens

| Part or state | Token |
| --- | --- |
| Dialog text | `light.text`, `dark.text` |
| Dialog surface | `light.surface`, `dark.surface` |
| Dialog edge | `light.border`, `dark.border` |

### Composition and content guidelines

Use “Export report” with searchable synonyms, and “No matching commands” when empty. Avoid several indistinguishable “Open” commands.

## Part B — Bindings

### API

Mounting controls openness. The palette manages query and active option; onChoose receives a command ID and leaves dismissal to the owner. returnFocusTo optionally identifies the launcher. No arbitrary host props or public root ref.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `workflows:CommandPalette` | `commands` | `readonly CommandEntry[]` | Required | Caller input | — |
| `workflows:CommandPalette` | `label` | `string` | Required | Caller input | — |
| `workflows:CommandPalette` | `labels` | `{ search?: string; close?: string; empty?: string; } \| undefined` | Unspecified | Caller input | — |
| `workflows:CommandPalette` | `locale` | `string \| undefined` | Unspecified | Caller input | — |
| `workflows:CommandPalette` | `onChoose` | `(id: string) => void` | Required | Caller callback | — |
| `workflows:CommandPalette` | `onDismiss` | `() => void` | Required | Caller callback | — |
| `workflows:CommandPalette` | `returnFocusTo` | `HTMLElement \| null \| undefined` | Unspecified | Caller input | — |

### React web

#### Rendering

`workflows` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

A modal dialog contains its heading, focused search combobox, listbox, options, an empty-status message and a close button. Records carry ID, label, keywords and a disabled flag.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Platform | Public contract |
| --- | --- |
| Web | `CommandPalette` from `@ui-lazy-dev/ui-web/workflows`. |
| Native | Planned. No exported renderer or simulator journey. Track parity in the [family inventory](../component-inventory.md). |

**Keyboard and pointer.** Up/Down cycle through enabled matches; Enter chooses the active command. Ignore composition keys while an IME is active. Mouse-down on a result preserves search focus. Escape requests dismissal; a connected explicit launcher can receive focus on unmount.

**Accessibility.** The dialog, input and listbox need distinguishable labels. Active options are exposed through the input and use system selection colors. Empty results use a status message. Translate close and search labels and supply locale for query matching. Options and commands have minimum target heights. Disabled results use GrayText and the active result uses Highlight and HighlightText. Dialog motion is absent. Keep localized keyboard commands independent of writing direction.

**Composition.** Mount from a named button or application shortcut. Keep navigation and destructive command execution in the host; explicitly close or display confirmation after choosing. [Catalog fixture](../../catalog/EnterpriseWorkspace.stories.tsx).

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Open | Mount the palette | Dialog named by heading; expanded combobox | Commands enabled by host | Search input on open | [enterprise-workspace.spec.ts L46](../../tests/browser/enterprise-workspace.spec.ts#L46) |
| Active | Arrow through filtered matches | Combobox refers to active option by ID | Enter chooses the command | Focus stays on input | [workflow-commands.test.tsx L51](../../tests/command-palette/workflow-commands.test.tsx#L9) |
| Disabled | Include an unavailable command | Option has aria-disabled and navigation skips it | No | Not a tab stop | [workflow-commands.test.tsx L51](../../tests/command-palette/workflow-commands.test.tsx#L9) |
| No matches | Enter a query with no results | Status explains the empty result and there is no active descendant | Enter invokes no command | Search input remains focused | [workflow-commands.test.tsx L51](../../tests/command-palette/workflow-commands.test.tsx#L9) |
| Closed | Dismiss with Escape | Modal leaves the accessibility tree | Launcher available | Connected launcher | [enterprise-workspace.spec.ts L46](../../tests/browser/enterprise-workspace.spec.ts#L46) |

#### Performance

The production named-import measurement is 1,400 B gzip for `CommandPalette`. The optional `/workflows` entry stays outside the default web entry. Measurements exclude React and React DOM and count JavaScript separately from CSS. [Bundle methodology](../../scripts/verify-bundles.mjs)

#### Tests

- Open. [enterprise-workspace.spec.ts L46](../../tests/browser/enterprise-workspace.spec.ts#L46)
- Active. [workflow-commands.test.tsx L51](../../tests/command-palette/workflow-commands.test.tsx#L9)
- Disabled. [workflow-commands.test.tsx L51](../../tests/command-palette/workflow-commands.test.tsx#L9)
- No matches. [workflow-commands.test.tsx L51](../../tests/command-palette/workflow-commands.test.tsx#L9)
- Closed. [enterprise-workspace.spec.ts L46](../../tests/browser/enterprise-workspace.spec.ts#L46)
- Browser coverage. [enterprise-workspace.spec.ts](../../tests/browser/enterprise-workspace.spec.ts)
- A dedicated visual baseline for this family remains open.
- Simulator coverage awaits a native export.

#### Changelog and deprecations

The `0.3.0-rc.1` draft documents the public contract introduced in `b6c015a`. No deprecations are declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Command palette.

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
