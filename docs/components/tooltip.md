---
{
  "family": "Tooltip",
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
      "name": "Tooltip",
      "from": "@ui-lazy-dev/ui-web/navigation"
    },
    {
      "platform": "web",
      "name": "TooltipTrigger",
      "from": "@ui-lazy-dev/ui-web/navigation"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/Tooltip",
    "https://mui.com/material-ui/react-tooltip/"
  ]
}
---

# Tooltip

## Part A — Contract

### Purpose and when not to use it

Provide a brief supplementary description for a control. Put instructions required to finish a task in visible text or a Popover.

### Anatomy

Brief supplementary text describes the associated trigger. The trigger retains focus and its own action.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| trigger | Required | N/A — required | Container gap | Control has its own name | Participates in its logical position |
| description | Required | N/A — required | Container gap | Provides supporting information | Text adds no stop |

### Variants

The tooltip is open or closed. Placement belongs to the tooltip, separate from the action's semantics. It contains descriptive content.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Open | Show the explanation | See Tokens | The text describes the focused control | No | Trigger only | Pending: open scenario |
| Dismissed | Dismiss the explanation | See Tokens | The supplementary text disappears | No | Trigger only | Pending: dismissed scenario |

### Keyboard, pointer and touch

Hover or keyboard focus can reveal the message. Escape dismisses while focus remains on the trigger. Do not require a tooltip gesture on touch-only devices.

### Accessibility

The open message has tooltip semantics and describes the trigger. Do not put buttons, links or critical instructions inside it. Provide an inline touch alternative where needed.

### State patterns

This family owns no request lifecycle. Its containing surface supplies any loading, empty, error, offline, permission or partial-failure state.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

| Part or state | Token |
| --- | --- |
| Scope foreground | `light.text`, `dark.text` |
| Scoped focus-visible outline | `density.focusWidth`, `light.focus`, `dark.focus` |

### Composition and content guidelines

Put interactive help in a dialog or popover with a named trigger instead. Do use “Contact the review owner for exceptions”. Avoid restating the trigger name or hiding a required error in hover text.

## Part B — Bindings

### API

Use trigger delay and closeDelay for timing. Controlled trigger open state belongs to its owner; choose delay zero only when immediate feedback is intended.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `navigation:Tooltip` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Tooltip` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Tooltip` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Tooltip` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Tooltip` | `arrowBoundaryOffset` | `number \| undefined` | `0` | Caller input | — |
| `navigation:Tooltip` | `children` | `import("react-aria-components").ChildrenOrFunction<TooltipRenderProps>` | Unspecified | Caller content | — |
| `navigation:Tooltip` | `className` | `ClassNameOrFunction<TooltipRenderProps> \| undefined` | `'react-aria-Tooltip'` | Caller input | — |
| `navigation:Tooltip` | `containerPadding` | `number \| undefined` | `12` | Caller input | — |
| `navigation:Tooltip` | `crossOffset` | `number \| undefined` | `0` | Caller input | — |
| `navigation:Tooltip` | `defaultOpen` | `boolean \| undefined` | Unspecified | Uncontrolled initial value | — |
| `navigation:Tooltip` | `isEntering` | `boolean \| undefined` | Unspecified | Caller input | — |
| `navigation:Tooltip` | `isExiting` | `boolean \| undefined` | Unspecified | Caller input | — |
| `navigation:Tooltip` | `isOpen` | `boolean \| undefined` | Unspecified | Controlled value | — |
| `navigation:Tooltip` | `offset` | `number \| undefined` | `0` | Caller input | — |
| `navigation:Tooltip` | `onOpenChange` | `((isOpen: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Tooltip` | `placement` | `Placement \| undefined` | `'top'` | Caller input | — |
| `navigation:Tooltip` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `navigation:Tooltip` | `render` | `import("react-aria-components").DOMRenderFunction<"div", TooltipRenderProps> \| undefined` | Unspecified | Caller input | — |
| `navigation:Tooltip` | `shouldFlip` | `boolean \| undefined` | `true` | Caller input | — |
| `navigation:Tooltip` | `style` | `import("react-aria-components").StyleOrFunction<TooltipRenderProps> \| undefined` | Unspecified | Caller input | — |
| `navigation:Tooltip` | `triggerRef` | `RefObject<Element \| null> \| undefined` | Unspecified | Caller reference | `Element` |
| `navigation:Tooltip` | `UNSTABLE_portalContainer` | `Element \| undefined` | `document.body` | Caller input | — |
| `navigation:Tooltip` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |
| `navigation:TooltipTrigger` | `children` | `React.ReactNode` | Required | Caller content | — |
| `navigation:TooltipTrigger` | `closeDelay` | `number \| undefined` | `500` | Caller input | — |
| `navigation:TooltipTrigger` | `defaultOpen` | `boolean \| undefined` | Unspecified | Uncontrolled initial value | — |
| `navigation:TooltipTrigger` | `delay` | `number \| undefined` | `1500` | Caller input | — |
| `navigation:TooltipTrigger` | `isDisabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `navigation:TooltipTrigger` | `isOpen` | `boolean \| undefined` | Unspecified | Controlled value | — |
| `navigation:TooltipTrigger` | `onOpenChange` | `((isOpen: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:TooltipTrigger` | `shouldCloseOnPress` | `boolean \| undefined` | `true` | Caller input | — |
| `navigation:TooltipTrigger` | `trigger` | `"focus" \| "hover" \| undefined` | `'hover'` | Caller input | — |

### React web

#### Rendering

`navigation` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

TooltipTrigger coordinates the trigger child and Tooltip description. The trigger remains the action and focus target.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Contract | Web | Native | Tracking |
| --- | --- | --- | --- |
| Tooltip | Tooltip, TooltipTrigger | No family binding in the native package | Native implementation and platform-specific verification are open in the [family audit](../component-depth.md). |

**Tokens.** The optional controls stylesheet applies text color inside the controls scope. Interactive descendants can use its keyboard focus treatment. Custom slot paint remains the consumer’s responsibility.

**Composition.** Wrap one focusable control and one Tooltip in a TooltipTrigger. Put interactive help in a dialog or popover with a named trigger instead.

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Open | Tab to Policy help | Tooltip text describes the focused control | No | Trigger only | [Keyboard description](../../tests/browser/enterprise-navigation.spec.ts) |
| Dismissed | Press Escape | Tooltip disappears | No | Trigger only | [Escape dismisses help](../../tests/browser/enterprise-navigation.spec.ts) |

#### Performance

`Tooltip` 10,365 B, `TooltipTrigger` 7,300 B. Each number is a separate named-import gzip measurement with React and React DOM external. Optional controls CSS is measured separately at 1,457 B gzip. The library root entry does not import this family.

#### Tests

- **Open.** [Keyboard description](../../tests/browser/enterprise-navigation.spec.ts).
- **Dismissed.** [Escape dismisses help](../../tests/browser/enterprise-navigation.spec.ts).

The linked cases establish the behaviors above. Dedicated per-state visual comparisons and native simulator tests are open. [Catalog example](../../catalog/EnterpriseNavigation.stories.tsx)

#### Changelog and deprecations

The 0.3.0-rc.1 candidate documents the current web bindings. No family-specific deprecation is declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Tooltip.

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
