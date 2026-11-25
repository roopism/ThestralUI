---
{
  "family": "Switch",
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
      "name": "Switch",
      "from": "@ui-lazy-dev/ui-web/forms"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/Switch",
    "https://mui.com/material-ui/react-switch/"
  ]
}
---

# Switch

## Part A — Contract

### Purpose and when not to use it

Change an on/off setting with immediate effect. Choose Checkbox for consent that takes effect on form submission.

### Anatomy

A labeled control exposes whether the setting is on or off. The track and thumb depict the state.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| label | Required | N/A — required | Container gap | Provides the accessible name | Text adds no stop |
| track | Optional | collapse | Container gap | Excluded from the name | No stop |
| thumb | Optional | collapse | Container gap | Excluded from the name | No stop |

### Variants

Use a boolean value. The label names the same setting in both on and off states.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Off | Turn the setting off | Muted track and thumb | The named switch reports off | Yes | Yes | Pending: off scenario |
| On | Turn the setting on | Accent track border and positioned thumb | The named switch reports on | Yes | Yes | Pending: on scenario |
| Read-only on | Try to change a read-only setting | On treatment remains | Its current state is retained | No change | Read-only input remains available | Pending: read-only on scenario |

### Keyboard, pointer and touch

Space toggles a focused switch. Tap the label or switch surface to trigger the same action.

### Accessibility

A named switch exposes its checked state. Keep its accessible name stable as the value changes. Use the field’s localized labels in RTL layouts. Review touch-target geometry, contrast, forced colors and reduced-motion behavior in the consumer theme before promoting this draft.

### State patterns

This family owns no request lifecycle. Its containing surface supplies any loading, empty, error, offline, permission or partial-failure state.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

| Part or state | Token |
| --- | --- |
| Label / light | `light.text` |
| Label / dark | `dark.text` |
| Selected mark / light | `light.accent` |
| Selected mark / dark | `dark.accent` |
| Disabled label | `light.disabled` |

### Composition and content guidelines

Provide one visible label, such as “Send alerts”. Lift the boolean to the owner when other parts of the screen must update in response to the switch. Use “Email notifications”. Avoid “Turn it on”. Localize the whole label and keep it available when constrained text wraps.

## Part B — Bindings

### API

`isSelected` controls the setting and `defaultSelected` initializes its internal boolean. `onChange(nextBoolean)` reports a user update. `isReadOnly` keeps the switch’s current value while suppressing changes. Its name describes the setting regardless of its position.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `forms:Switch` | `aria-controls` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Switch` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Switch` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Switch` | `aria-errormessage` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Switch` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Switch` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Switch` | `autoFocus` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:Switch` | `children` | `import("react-aria-components").ChildrenOrFunction<SwitchRenderProps>` | Unspecified | Caller content | — |
| `forms:Switch` | `className` | `ClassNameOrFunction<SwitchRenderProps> \| undefined` | `'react-aria-Switch'` | Caller input | — |
| `forms:Switch` | `defaultSelected` | `boolean \| undefined` | Unspecified | Uncontrolled initial value | — |
| `forms:Switch` | `excludeFromTabOrder` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:Switch` | `form` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Switch` | `id` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Switch` | `inputRef` | `React.Ref<HTMLInputElement \| null> \| undefined` | Unspecified | Caller reference | `HTMLInputElement` |
| `forms:Switch` | `isDisabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:Switch` | `isReadOnly` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:Switch` | `isSelected` | `boolean \| undefined` | Unspecified | Controlled value | — |
| `forms:Switch` | `name` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Switch` | `onBlur` | `((e: React.FocusEvent<Element, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Switch` | `onChange` | `((isSelected: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Switch` | `onClick` | `((e: React.MouseEvent<import("react-aria-components").FocusableElement>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Switch` | `onFocus` | `((e: React.FocusEvent<Element, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Switch` | `onFocusChange` | `((isFocused: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Switch` | `onHoverChange` | `((isHovering: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Switch` | `onHoverEnd` | `((e: import("react-aria-components").HoverEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Switch` | `onHoverStart` | `((e: import("react-aria-components").HoverEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Switch` | `onKeyDown` | `((e: import("react-aria-components").KeyboardEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Switch` | `onKeyUp` | `((e: import("react-aria-components").KeyboardEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Switch` | `onPress` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Switch` | `onPressChange` | `((isPressed: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Switch` | `onPressEnd` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Switch` | `onPressStart` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Switch` | `onPressUp` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Switch` | `ref` | `React.Ref<HTMLLabelElement> \| undefined` | Unspecified | Caller reference | `HTMLLabelElement` |
| `forms:Switch` | `render` | `import("react-aria-components").DOMRenderFunction<"label", SwitchRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:Switch` | `slot` | `string \| null \| undefined` | Unspecified | Caller input | — |
| `forms:Switch` | `style` | `import("react-aria-components").StyleOrFunction<SwitchRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:Switch` | `value` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Switch` | Host attributes | 70 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`forms` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

Switch supplies the named control. The track and thumb are decorative parts. The owner applies the setting.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Surface | Web | Native |
| --- | --- | --- |
| Availability | `Switch` | planned. Track a platform contract and simulator fixture in the [family inventory](../component-inventory.md). |

**Tokens.** These mappings apply inside the optional `uld-controls` scope. A headless import does not install the stylesheet.

**Composition.** Provide one visible label, such as “Send alerts”. Keep decorative thumb and track elements outside the accessible name. Lift the boolean to the owner when other parts of the screen must update in response to the switch. [Catalog composition](../../catalog/Controls.stories.tsx)

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Off | Render an uncontrolled switch with no initial selection | Named switch | Yes | Yes | [Named switch](../../tests/advanced.test.tsx#L9) |
| On | Focus switch and press Space | Switch exposes checked | Yes | Yes | [Keyboard toggle](../../tests/browser/preferences.spec.ts#L10) |
| Read-only on | Set isReadOnly and defaultSelected, then click | Switch retains checked and suppresses the change callback | No change | Read-only input remains available | [Read-only selected switch](../../tests/form-spec-states.test.tsx#L80) |

#### Performance

Named JavaScript exports measured independently from the packed web consumer, gzip level 9, with React and React DOM external: `Switch` 14,435 B. These optional imports stay out of the web root. Their sizes overlap when used together. [Measurement method](../../scripts/verify-bundles.mjs) The optional scoped `controls.css` entry measures 1,485 B gzip including its theme tokens. Apply `.uld-controls` to a containing element to opt into its treatments.

#### Tests

- **Off.** [Named switch](../../tests/advanced.test.tsx#L9).
- **On.** [Keyboard toggle](../../tests/browser/preferences.spec.ts#L10).
- **Read-only on.** [Read-only selected switch](../../tests/form-spec-states.test.tsx#L80).
- The [preferences journey](../../tests/browser/preferences.spec.ts) also exercises the composed controls on a compact viewport.
- Dedicated visual qualification and native simulator coverage remain open.

Disabled, read-only keyboard activation and announcements during controlled external changes remain open for browser and assistive-technology testing.

#### Changelog and deprecations

The `0.3.0-rc.1` draft records the current public contract. Consult the packed declarations for upstream deprecation notices when upgrading React Aria.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Switch.

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
