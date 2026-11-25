---
{
  "family": "Popover",
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
      "name": "Popover",
      "from": "@ui-lazy-dev/ui-web/navigation"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/Popover",
    "https://mui.com/material-ui/react-popover/"
  ]
}
---

# Popover

## Part A — Contract

### Purpose and when not to use it

Present temporary content anchored to a trigger. Use Tooltip for a brief description or Dialog for a modal task demanding its own structure.

### Anatomy

An anchored surface presents contextual content and keeps its relationship to the opener.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| content | Required | N/A — required | Container gap | Children retain their semantics | Operable children keep their order |

### Variants

The Popover shell itself does not select an option. A nonmodal configuration changes whether outside content stays available.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Open | Open the chooser | See Tokens | Its anchored content becomes available | Yes on options | Yes on active option | Pending: open scenario |
| Selection | Choose an option | See Tokens | The selected value remains visible after dismissal | Yes on trigger | Yes on trigger | Pending: selection scenario |

### Keyboard, pointer and touch

Activation opens the associated surface. Selection or Escape closes according to its child's contract. Support a visible trigger that can be tapped as well as focused.

### Accessibility

Identify the content by its role and name. Verify focus enters and returns through the trigger for the chosen child.

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

Do label a language chooser “Language”. Avoid an unlabeled grid of options or relying on hover to open it.

## Part B — Bindings

### API

Use placement, offsets and an anchor to position the overlay. The owner or associated trigger manages open state. Give the contained menu, list or dialog its own name and state.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `navigation:Popover` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Popover` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Popover` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Popover` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Popover` | `arrowBoundaryOffset` | `number \| undefined` | `0` | Caller input | — |
| `navigation:Popover` | `arrowRef` | `RefObject<Element \| null> \| undefined` | Unspecified | Caller reference | `Element` |
| `navigation:Popover` | `boundaryElement` | `Element \| undefined` | `document.body` | Caller input | — |
| `navigation:Popover` | `children` | `import("react-aria-components").ChildrenOrFunction<PopoverRenderProps>` | Unspecified | Caller content | — |
| `navigation:Popover` | `className` | `ClassNameOrFunction<PopoverRenderProps> \| undefined` | `'react-aria-Popover'` | Caller input | — |
| `navigation:Popover` | `containerPadding` | `number \| undefined` | `12` | Caller input | — |
| `navigation:Popover` | `crossOffset` | `number \| undefined` | `0` | Caller input | — |
| `navigation:Popover` | `defaultOpen` | `boolean \| undefined` | Unspecified | Uncontrolled initial value | — |
| `navigation:Popover` | `getTargetRect` | `((target: Element) => DOMRect \| null \| undefined) \| undefined` | `target.getBoundingClientRect()` | Caller input | — |
| `navigation:Popover` | `isEntering` | `boolean \| undefined` | Unspecified | Caller input | — |
| `navigation:Popover` | `isExiting` | `boolean \| undefined` | Unspecified | Caller input | — |
| `navigation:Popover` | `isKeyboardDismissDisabled` | `boolean \| undefined` | `false` | Caller input | — |
| `navigation:Popover` | `isNonModal` | `boolean \| undefined` | Unspecified | Caller input | — |
| `navigation:Popover` | `isOpen` | `boolean \| undefined` | Unspecified | Controlled value | — |
| `navigation:Popover` | `maxHeight` | `number \| undefined` | Unspecified | Caller input | — |
| `navigation:Popover` | `offset` | `number \| undefined` | `8` | Caller input | — |
| `navigation:Popover` | `onBlurWithin` | `((e: React.FocusEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Popover` | `onFocusWithin` | `((e: React.FocusEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Popover` | `onFocusWithinChange` | `((isFocusWithin: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Popover` | `onOpenChange` | `((isOpen: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Popover` | `placement` | `import("react-aria-components").Placement \| undefined` | `'bottom'` | Caller input | — |
| `navigation:Popover` | `ref` | `React.Ref<HTMLElement> \| undefined` | Unspecified | Caller reference | `HTMLElement` |
| `navigation:Popover` | `render` | `import("react-aria-components").DOMRenderFunction<"div", PopoverRenderProps> \| undefined` | Unspecified | Caller input | — |
| `navigation:Popover` | `scrollRef` | `RefObject<Element \| null> \| undefined` | `overlayRef` | Caller reference | `Element` |
| `navigation:Popover` | `shouldCloseOnInteractOutside` | `((element: Element) => boolean) \| undefined` | Unspecified | Caller input | — |
| `navigation:Popover` | `shouldFlip` | `boolean \| undefined` | `true` | Caller input | — |
| `navigation:Popover` | `shouldSkipAnimation` | `boolean \| undefined` | Unspecified | Caller input | — |
| `navigation:Popover` | `shouldUpdatePosition` | `boolean \| undefined` | `true` | Caller input | — |
| `navigation:Popover` | `slot` | `string \| null \| undefined` | Unspecified | Caller input | — |
| `navigation:Popover` | `style` | `import("react-aria-components").StyleOrFunction<PopoverRenderProps> \| undefined` | Unspecified | Caller input | — |
| `navigation:Popover` | `trigger` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Popover` | `triggerRef` | `RefObject<Element \| null> \| undefined` | Unspecified | Caller reference | `Element` |
| `navigation:Popover` | `UNSTABLE_portalContainer` | `Element \| undefined` | `document.body` | Caller input | — |
| `navigation:Popover` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`navigation` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

The positioned overlay contains the caller's semantic child, for example a ListBox or Menu. Its anchor comes from the trigger context or trigger ref.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Contract | Web | Native | Tracking |
| --- | --- | --- | --- |
| Popover | Popover | No family binding in the native package | Native implementation and platform-specific verification are open in the [family audit](../component-depth.md). |

**Variants.** Placement can flip when viewport space is limited. The Popover shell itself does not select an option. A nonmodal configuration changes whether outside content stays available.

**Accessibility.** Identify the content by its role and name. Verify focus enters and returns through the trigger for the chosen child. Keep important actions inside the viewport as text grows.

**Tokens.** The optional controls stylesheet applies text color inside the controls scope. Interactive descendants can use its keyboard focus treatment. Custom slot paint remains the consumer’s responsibility.

**Composition.** Use Popover around a ListBox under Select or a Menu under MenuTrigger. In a portal, opt into the controls CSS scope on the overlay as needed.

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Open | Activate the Language chooser | French option becomes available in the list | Yes on options | Yes on active option | [Select popover interaction](../../tests/browser/enterprise-navigation.spec.ts) |
| Selection | Click French | Closed chooser displays the new language | Yes on trigger | Yes on trigger | [Selection updates the trigger](../../tests/browser/enterprise-navigation.spec.ts) |

#### Performance

`Popover` 22,942 B. Each number is a separate named-import gzip measurement with React and React DOM external. Optional controls CSS is measured separately at 1,457 B gzip. The library root entry does not import this family.

#### Tests

- **Open.** [Select popover interaction](../../tests/browser/enterprise-navigation.spec.ts).
- **Selection.** [Selection updates the trigger](../../tests/browser/enterprise-navigation.spec.ts).

The linked cases establish the behaviors above. Dedicated per-state visual comparisons and native simulator tests are open. [Catalog example](../../catalog/EnterpriseNavigation.stories.tsx)

#### Changelog and deprecations

The 0.3.0-rc.1 candidate documents the current web bindings. No family-specific deprecation is declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Popover.

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
