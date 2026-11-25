---
{
  "family": "Checkbox",
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
      "name": "Checkbox",
      "from": "@ui-lazy-dev/ui-web/forms"
    },
    {
      "platform": "web",
      "name": "CheckboxGroup",
      "from": "@ui-lazy-dev/ui-web/forms"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/Checkbox",
    "https://mui.com/material-ui/react-checkbox/"
  ]
}
---

# Checkbox

## Part A — Contract

### Purpose and when not to use it

Choose each option independently. Choose Radio group when exactly one option is allowed.

### Anatomy

The label identifies one independent choice. A group collects the values of its checked choices.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| label | Required | N/A — required | Container gap | Provides the accessible name | Text adds no stop |
| check mark | Optional | collapse | Container gap | Excluded from the name | No stop |

### Variants

A standalone checkbox can be checked, unchecked or mixed. A group returns its values together. Define how a mixed parent updates children.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Controlled unchecked | Attempt a change while the owner holds the old value | Unselected outline | Selection waits for the owner | Yes | Yes | Pending: controlled unchecked scenario |
| Selected | Toggle by keyboard | Accent fill and checkmark | The checked state changes | Yes | Yes | Pending: selected scenario |
| Grouped selection | Choose a member | Selected treatment | Its value joins the group selection | Yes | Yes | Pending: grouped selection scenario |
| Read-only group | Inspect a read-only group | Existing selected mark remains | The current selection cannot be changed | No change | Enabled checkbox remains inspectable | Pending: read-only group scenario |

### Keyboard, pointer and touch

Space toggles the focused checkbox. Clicking or tapping its label activates the same choice. Each enabled input participates in tab order.

### Accessibility

The label names the checkbox. Checked state conveys selection to assistive technology. A custom checkmark supplements that state. Use the field’s localized labels in RTL layouts. Review touch-target geometry, contrast, forced colors and reduced-motion behavior in the consumer theme before promoting this draft.

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

A grouped change produces the array for the group owner. A standalone checkbox can instead participate in an explicitly controlled binary setting. Use “Include archived records”. Avoid “Yes”. Localize the whole label and keep it available when constrained text wraps.

## Part B — Bindings

### API

For a single Checkbox, `isSelected` is authoritative and `onChange(nextBoolean)` requests a change. `defaultSelected` initializes local selection. `isIndeterminate` represents a mixed choice. For CheckboxGroup, `value` and `defaultValue` contain strings matching its child values, and its onChange returns the next array. Read-only groups preserve their current choices.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `forms:Checkbox` | `aria-controls` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Checkbox` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Checkbox` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Checkbox` | `aria-errormessage` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Checkbox` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Checkbox` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Checkbox` | `autoFocus` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:Checkbox` | `children` | `import("react-aria-components").ChildrenOrFunction<CheckboxRenderProps>` | Unspecified | Caller content | — |
| `forms:Checkbox` | `className` | `ClassNameOrFunction<CheckboxRenderProps> \| undefined` | `'react-aria-Checkbox'` | Caller input | — |
| `forms:Checkbox` | `defaultSelected` | `boolean \| undefined` | Unspecified | Uncontrolled initial value | — |
| `forms:Checkbox` | `excludeFromTabOrder` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:Checkbox` | `form` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Checkbox` | `id` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Checkbox` | `inputRef` | `React.Ref<HTMLInputElement \| null> \| undefined` | Unspecified | Caller reference | `HTMLInputElement` |
| `forms:Checkbox` | `isDisabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:Checkbox` | `isIndeterminate` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:Checkbox` | `isInvalid` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:Checkbox` | `isReadOnly` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:Checkbox` | `isRequired` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:Checkbox` | `isSelected` | `boolean \| undefined` | Unspecified | Controlled value | — |
| `forms:Checkbox` | `name` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Checkbox` | `onBlur` | `((e: React.FocusEvent<Element, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Checkbox` | `onChange` | `((isSelected: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Checkbox` | `onClick` | `((e: React.MouseEvent<import("react-aria-components").FocusableElement>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Checkbox` | `onFocus` | `((e: React.FocusEvent<Element, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Checkbox` | `onFocusChange` | `((isFocused: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Checkbox` | `onHoverChange` | `((isHovering: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Checkbox` | `onHoverEnd` | `((e: import("react-aria-components").HoverEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Checkbox` | `onHoverStart` | `((e: import("react-aria-components").HoverEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Checkbox` | `onKeyDown` | `((e: import("react-aria-components").KeyboardEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Checkbox` | `onKeyUp` | `((e: import("react-aria-components").KeyboardEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Checkbox` | `onPress` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Checkbox` | `onPressChange` | `((isPressed: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Checkbox` | `onPressEnd` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Checkbox` | `onPressStart` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Checkbox` | `onPressUp` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Checkbox` | `ref` | `React.Ref<HTMLLabelElement> \| undefined` | Unspecified | Caller reference | `HTMLLabelElement` |
| `forms:Checkbox` | `render` | `import("react-aria-components").DOMRenderFunction<"label", CheckboxRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:Checkbox` | `slot` | `string \| null \| undefined` | Unspecified | Caller input | — |
| `forms:Checkbox` | `style` | `import("react-aria-components").StyleOrFunction<CheckboxRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:Checkbox` | `validate` | `((value: boolean) => import("@react-types/shared").ValidationError \| true \| null \| undefined) \| undefined` | Unspecified | Caller input | — |
| `forms:Checkbox` | `validationBehavior` | `"native" \| "aria" \| undefined` | `'native'` | Caller input | — |
| `forms:Checkbox` | `value` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Checkbox` | Host attributes | 70 standard platform attributes, not listed | Unspecified | Caller input | — |
| `forms:CheckboxGroup` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:CheckboxGroup` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:CheckboxGroup` | `aria-errormessage` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:CheckboxGroup` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:CheckboxGroup` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:CheckboxGroup` | `children` | `import("react-aria-components").ChildrenOrFunction<CheckboxGroupRenderProps>` | Unspecified | Caller content | — |
| `forms:CheckboxGroup` | `className` | `ClassNameOrFunction<CheckboxGroupRenderProps> \| undefined` | `'react-aria-CheckboxGroup'` | Caller input | — |
| `forms:CheckboxGroup` | `defaultValue` | `string[] \| undefined` | Unspecified | Uncontrolled initial value | — |
| `forms:CheckboxGroup` | `form` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:CheckboxGroup` | `id` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:CheckboxGroup` | `isDisabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:CheckboxGroup` | `isInvalid` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:CheckboxGroup` | `isReadOnly` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:CheckboxGroup` | `isRequired` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:CheckboxGroup` | `name` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:CheckboxGroup` | `onBlur` | `((e: React.FocusEvent<Element, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:CheckboxGroup` | `onChange` | `((value: string[]) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:CheckboxGroup` | `onFocus` | `((e: React.FocusEvent<Element, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:CheckboxGroup` | `onFocusChange` | `((isFocused: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:CheckboxGroup` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `forms:CheckboxGroup` | `render` | `import("react-aria-components").DOMRenderFunction<"div", CheckboxGroupRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:CheckboxGroup` | `slot` | `string \| null \| undefined` | Unspecified | Caller input | — |
| `forms:CheckboxGroup` | `style` | `import("react-aria-components").StyleOrFunction<CheckboxGroupRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:CheckboxGroup` | `validate` | `((value: string[]) => import("@react-types/shared").ValidationError \| true \| null \| undefined) \| undefined` | Unspecified | Caller input | — |
| `forms:CheckboxGroup` | `validationBehavior` | `"native" \| "aria" \| undefined` | `'native'` | Caller input | — |
| `forms:CheckboxGroup` | `value` | `string[] \| undefined` | Unspecified | Controlled value | — |
| `forms:CheckboxGroup` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`forms` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

Each Checkbox contains an input and label. A CheckboxGroup owns selected values and each child identifies its value.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Surface | Web | Native |
| --- | --- | --- |
| Availability | `Checkbox`, `CheckboxGroup` | planned. Track a platform contract and simulator fixture in the [family inventory](../component-inventory.md). |

**Tokens.** These mappings apply inside the optional `uld-controls` scope. A headless import does not install the stylesheet.

**Composition.** Place a named Checkbox inside CheckboxGroup and assign a unique value to each child. A grouped change produces the array for the group owner. A standalone checkbox can instead participate in an explicitly controlled binary setting. [Catalog composition](../../catalog/Controls.stories.tsx)

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Controlled unchecked | Click an unchecked checkbox with a fixed isSelected value | onChange requests true and checked stays false until rerender | Yes | Yes | [Owner-controlled checked state](../../tests/checkbox/family-contracts.test.tsx#L11) |
| Selected | Focus a checkbox and press Space | Native input is checked | Yes | Yes | [Keyboard selection and RTL](../../tests/browser/preferences.spec.ts#L10) |
| Grouped selection | Activate a child with a named value | Group change reports that value in an array | Yes | Yes | [Group callback payload](../../tests/advanced.test.tsx#L9) |
| Read-only group | Activate another choice when group isReadOnly | Previously checked item stays checked and callback is silent | No change | Enabled checkbox remains inspectable | [Read-only group selection](../../tests/form-spec-states.test.tsx#L41) |

#### Performance

Named JavaScript exports measured independently from the packed web consumer, gzip level 9, with React and React DOM external: `Checkbox` 14,884 B, `CheckboxGroup` 6,344 B. These optional imports stay out of the web root. Their sizes overlap when used together. [Measurement method](../../scripts/verify-bundles.mjs) The optional scoped `controls.css` entry measures 1,485 B gzip including its theme tokens. Apply `.uld-controls` to a containing element to opt into its treatments.

#### Tests

- **Controlled unchecked.** [Owner-controlled checked state](../../tests/checkbox/family-contracts.test.tsx#L11).
- **Selected.** [Keyboard selection and RTL](../../tests/browser/preferences.spec.ts#L10).
- **Grouped selection.** [Group callback payload](../../tests/advanced.test.tsx#L9).
- **Read-only group.** [Read-only group selection](../../tests/form-spec-states.test.tsx#L41).
- The [preferences journey](../../tests/browser/preferences.spec.ts) also exercises the composed controls on a compact viewport.
- Dedicated visual qualification and native simulator coverage remain open.

Mixed-to-checked transitions and physical screen-reader announcements of mixed selection need dedicated coverage.

#### Changelog and deprecations

The `0.3.0-rc.1` draft records the current public contract. Consult the packed declarations for upstream deprecation notices when upgrading React Aria.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Checkbox.

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
