---
{
  "family": "ValidationSummary",
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
      "name": "ValidationSummary",
      "from": "@ui-lazy-dev/ui-web/entry-fields"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/Form",
    "https://mui.com/material-ui/react-alert/"
  ]
}
---

# ValidationSummary

## Part A — Contract

### Purpose and when not to use it

Summarize current form errors and jump to each affected field. Use the labeled field’s error text for the individual message.

### Anatomy

A heading introduces links to invalid fields. Each message identifies a problem and its destination.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| heading | Required | N/A — required | Container gap | Provides the accessible name | Text adds no stop |
| errors | Required | N/A — required | Container gap | Children retain their semantics | Operable children keep their order |

### Variants

A submission retry or successful correction changes the list through its owner.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Empty | Return no issues | See Tokens | The alert is absent | No | No | Pending: empty scenario |
| Populated | Return invalid fields | See Tokens | Correction links are available within a named alert | Yes on links | Yes on links | Pending: populated scenario |
| Targeted | Activate a correction link | See Tokens | The corresponding field receives focus | Yes | Yes | Pending: targeted scenario |

### Keyboard, pointer and touch

Tab through links. Enter or a pointer click focuses the target if it exists on the current screen. The summary itself does not take focus when it first appears.

### Accessibility

Localize the summary name and the corrective messages. Its alert role exposes updates; actual speech timing depends on the reader. Logical border placement works in RTL.

### State patterns

An empty issue list removes the summary. Nonempty issues provide correction actions that target their fields.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

| Part or state | Token |
| --- | --- |
| Scope foreground | `light.text`, `dark.text` |
| Error links and leading border | `light.danger`, `dark.danger` |
| Scoped focus-visible outline | `density.focusWidth`, `light.focus`, `dark.focus` |

### Composition and content guidelines

Keep field-level messages so the error remains available after following its link. Do use “Enter a six-digit recovery code”. Avoid “Invalid value”. Use the field's vocabulary and actionable corrections.

## Part B — Bindings

### API

The caller supplies `label` and a readonly `errors` collection. An empty list renders nothing. A present target receives focus from the link; otherwise the encoded fragment remains available to the browser.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `entry-fields:ValidationSummary` | `errors` | `readonly FieldIssue[]` | Required | Caller input | — |
| `entry-fields:ValidationSummary` | `label` | `string` | Required | Caller input | — |

### React web

#### Rendering

`entry-fields` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

A labeled alert section contains a level-two heading and a list of links. Each error provides its target field id and message.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Contract | Web | Native | Tracking |
| --- | --- | --- | --- |
| ValidationSummary | ValidationSummary | No family binding in the native package | Native implementation and platform-specific verification are open in the [family audit](../component-depth.md). |

**Variants.** The two render states are empty and populated. A submission retry or successful correction changes the list through its owner.

**Tokens.** The optional controls stylesheet applies text color inside the controls scope. Interactive descendants can use its keyboard focus treatment. Custom slot paint remains the consumer’s responsibility.

**Composition.** Place before invalid fields and link by stable DOM id. Keep field-level messages so the error remains available after following its link.

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Empty | Pass an empty errors array | No alert remains in the DOM | No | No | [Cleared summary](../../tests/validationsummary/entry-fields.test.tsx) |
| Populated | Provide a matching fieldId and message | Named alert exposes correction links | Yes on links | Yes on links | [Current errors](../../tests/validationsummary/entry-fields.test.tsx) |
| Targeted | Activate correction link | Matching field receives focus | Yes | Yes | [Forced-color field targeting](../../tests/browser/preferences.spec.ts) |

#### Performance

`ValidationSummary` 378 B. Each number is a separate named-import gzip measurement with React and React DOM external. Optional controls CSS is measured separately at 1,457 B gzip. The library root entry does not import this family.

#### Tests

- **Empty.** [Cleared summary](../../tests/validationsummary/entry-fields.test.tsx).
- **Populated.** [Current errors](../../tests/validationsummary/entry-fields.test.tsx).
- **Targeted.** [Forced-color field targeting](../../tests/browser/preferences.spec.ts).

The linked cases establish the behaviors above. Dedicated per-state visual comparisons and native simulator tests are open. [Catalog example](../../catalog/EntryFields.stories.tsx)

#### Changelog and deprecations

The 0.3.0-rc.1 candidate documents the current web bindings. Correction links now keep a block of at least the compact target height so they meet the WCAG 2.2 target-size minimum. No family-specific deprecation is declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of ValidationSummary.

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
