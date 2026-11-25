---
{
  "family": "Form wizard",
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
      "name": "Wizard",
      "from": "@ui-lazy-dev/ui-web/workflows"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/Group",
    "https://mui.com/material-ui/react-stepper/"
  ]
}
---

# Form wizard

## Part A — Contract

### Purpose and when not to use it

Collect a draft across a known sequence of steps with explicit completion. Use Tabs when panels are independent and have no required order.

### Anatomy

An ordered list identifies the steps. The active step exposes its heading, fields, navigation and any validation error.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| steps | Required | N/A — required | Container gap | Children retain their semantics | Operable children keep their order |
| active heading | Required | N/A — required | Container gap | Provides the accessible name | Text adds no stop |
| step content | Required | N/A — required | Container gap | Children retain their semantics | Operable children keep their order |
| error | Optional | collapse | Container gap | Provides supporting information | Text adds no stop |
| navigation | Required | N/A — required | Container gap | Children retain their semantics | Operable children keep their order |

### Variants

First step has no Back action. Intermediate steps advance; the final step submits. Supply translated back/next/finish labels.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Active | Begin a step | Current step weight | The current step is identified | Back/Next as applicable | Current controls | Pending: active scenario |
| Invalid | Try to advance past an invalid field | See Tokens | The field needing correction is identified | Advance blocked until valid | The field needing correction | Pending: invalid scenario |
| Busy | Submit a busy step | Disabled navigation actions | Duplicate navigation is blocked | No | Busy controls skipped | Pending: busy scenario |
| Step changed | Advance to a new step | Heading takes focus | The new heading is exposed and prior fields are hidden | Next step controls | Heading programmatically | Pending: step changed scenario |

### Keyboard, pointer and touch

Enter submits if allowed. Pointer activation of Back or Next requests the same controlled transition.

### Accessibility

While busy, step content is unavailable. An error is exposed as an alert. Keep headings short enough to reflow and use clear translated navigation labels. Step changes move focus to the active heading without animation. Check disabled and error treatments in forced colors and translated action order in RTL.

### State patterns

Keep step contents during navigation. Validation blocks unavailable progression and a submission error can be displayed above the actions.

### Localization

Default messages are mapped to `wizard.back`, `wizard.finish`, `wizard.next`. Preserve caller-supplied translations. [Message inventory](../library-strings.md)

### Tokens

| Part or state | Token |
| --- | --- |
| Navigation button surface | `light.accent`, `dark.accent` |
| Navigation button foreground | `light.onAccent`, `dark.onAccent` |
| Keyboard outline | `light.focus`, `dark.focus` |

### Composition and content guidelines

Keep each field in its own step. Use “Review application” and “Submit application”; avoid “Finish” when a more specific final action is available.

## Part B — Bindings

### API

The host owns activeId, validity, busy, errors and persistence. onStepChange receives the requested step ID; onFinish signals a valid final submission. Unknown activeId produces no UI. Neither root ref nor native form props are forwarded.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `workflows:Wizard` | `activeId` | `string` | Required | Caller input | — |
| `workflows:Wizard` | `busy` | `boolean \| undefined` | Unspecified | Caller input | — |
| `workflows:Wizard` | `error` | `ReactNode` | Unspecified | Caller input | — |
| `workflows:Wizard` | `label` | `string` | Required | Caller input | — |
| `workflows:Wizard` | `labels` | `{ back?: string; next?: string; finish?: string; } \| undefined` | Unspecified | Caller input | — |
| `workflows:Wizard` | `onFinish` | `() => void` | Required | Caller callback | — |
| `workflows:Wizard` | `onStepChange` | `(id: string) => void` | Required | Caller callback | — |
| `workflows:Wizard` | `steps` | `readonly WizardStep[]` | Required | Caller input | — |

### React web

#### Rendering

`workflows` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

A labeled section wraps an ordered step list, active heading, form, one persistent fieldset per step, optional error alert and shared Back/Next buttons. Each step supplies its content slot.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Platform | Public contract |
| --- | --- |
| Web | `Wizard` from `@ui-lazy-dev/ui-web/workflows`. |
| Native | Planned. No exported renderer or simulator journey. Track parity in the [family inventory](../component-inventory.md). |

**Variants.** First step has no Back action. Intermediate steps advance; the final step submits. Supply translated back/next/finish labels. Hidden step controls remain mounted to preserve uncontrolled values.

**Keyboard and pointer.** Tab moves through only the active fieldset. Enter submits if allowed. After changing activeId the heading receives focus. Pointer activation of Back or Next requests the same controlled transition.

**Accessibility.** Each mounted step has an accessible label, with only the active fieldset available for interaction. Busy disables fieldsets; errors use a role=alert. Keep headings short enough to reflow and use clear translated navigation labels. The action stylesheet sets a minimum target height. Step changes move focus to the active heading without animation. Check disabled and error treatments in forced colors and translated action order in RTL.

**Composition.** Put fields in step.content, without nesting another form. Restore draft values and activeId in the host. Avoid changing a step ID when translating its title. [Catalog fixture](../../catalog/EnterpriseWorkspace.stories.tsx).

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Active | Supply a matching activeId | aria-current=step and named fieldset | Back/Next as applicable | Current controls | [workflow-commands.test.tsx L6](../../tests/form-wizard/workflow-commands.test.tsx#L11) |
| Invalid | Try advancing with an invalid required field | Browser identifies the invalid input | Advance blocked until valid | Invalid native input | [workflow-commands.test.tsx L33](../../tests/form-wizard/workflow-commands.test.tsx#L39) |
| Busy | Set busy during submission | Form aria-busy and disabled fieldsets | No | Busy controls skipped | [workflow-commands.test.tsx L33](../../tests/form-wizard/workflow-commands.test.tsx#L39) |
| Step changed | Supply a different activeId | New active heading, old fieldsets hidden | Next step controls | Heading programmatically | [workflow-commands.test.tsx L6](../../tests/form-wizard/workflow-commands.test.tsx#L11) |

#### Performance

The production named-import measurement is 880 B gzip for `Wizard`. The optional `/workflows` entry stays outside the default web entry. Measurements exclude React and React DOM and count JavaScript separately from CSS. [Bundle methodology](../../scripts/verify-bundles.mjs)

#### Tests

- Active. [workflow-commands.test.tsx L6](../../tests/form-wizard/workflow-commands.test.tsx#L11)
- Invalid. [workflow-commands.test.tsx L33](../../tests/form-wizard/workflow-commands.test.tsx#L39)
- Busy. [workflow-commands.test.tsx L33](../../tests/form-wizard/workflow-commands.test.tsx#L39)
- Step changed. [workflow-commands.test.tsx L6](../../tests/form-wizard/workflow-commands.test.tsx#L11)
- Browser coverage. [enterprise-workspace.spec.ts](../../tests/browser/enterprise-workspace.spec.ts)
- A dedicated visual baseline for this family remains open.
- Simulator coverage awaits a native export.

#### Changelog and deprecations

The `0.3.0-rc.1` draft documents the public contract introduced in `b6c015a`. No deprecations are declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Form wizard.

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
