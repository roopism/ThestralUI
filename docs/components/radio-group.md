---
{
  "family": "Radio group",
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
      "name": "RadioGroup",
      "from": "@ui-lazy-dev/ui-web/forms"
    },
    {
      "platform": "web",
      "name": "Radio",
      "from": "@ui-lazy-dev/ui-web/forms"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/RadioGroup",
    "https://mui.com/material-ui/react-radio-button/"
  ]
}
---

# Radio group

## Part A — Contract

### Purpose and when not to use it

Select one mutually exclusive value. Choose Checkbox when more than one answer may apply.

### Anatomy

Each named choice represents one distinct value. Only one can be selected.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| choices | Required | N/A — required | Container gap | Children retain their semantics | Operable children keep their order |
| group label | Required | N/A — required | Container gap | Provides the accessible name | Text adds no stop |

### Variants

Choose an initial value when the group manages selection. Use owner-controlled selection when a parent accepts or rejects changes.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Selected | Choose one item | Accent radio mark | Only the chosen item is checked | Yes | Selected radio is the normal tab stop | Pending: selected scenario |
| Required | Require a choice | Ordinary choice treatments | The group identifies the requirement | Through available radios | Through available radios | Pending: required scenario |
| Disabled option | Disable another option | Disabled foreground | Selection remains on the available item | No | No | Pending: disabled option scenario |

### Keyboard, pointer and touch

Tab enters the group. Arrows move among options, and Space or a pointer selects the active option.

### Accessibility

Name the group and its individual choices. The checked state is carried by the radio input. Use the field’s localized labels in RTL layouts. Review touch-target geometry, contrast, forced colors and reduced-motion behavior in the consumer theme before promoting this draft.

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

Give each Radio a stable value and a visible option label. Disabling one option leaves another eligible option selected and the group can still be required. Use “Weekly digest”. Avoid “Option two”. Localize the whole label and keep it available when constrained text wraps.

## Part B — Bindings

### API

`value`/`defaultValue` identify one child by its string `value`. `onChange(value)` reports the new option. Set `isRequired` on the group, set `isDisabled` on a child to disable just that option, and localize the group label separately from each radio label.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `forms:RadioGroup` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:RadioGroup` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:RadioGroup` | `aria-errormessage` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:RadioGroup` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:RadioGroup` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:RadioGroup` | `children` | `import("react-aria-components").ChildrenOrFunction<RadioGroupRenderProps>` | Unspecified | Caller content | — |
| `forms:RadioGroup` | `className` | `ClassNameOrFunction<RadioGroupRenderProps> \| undefined` | `'react-aria-RadioGroup'` | Caller input | — |
| `forms:RadioGroup` | `defaultValue` | `string \| null \| undefined` | Unspecified | Uncontrolled initial value | — |
| `forms:RadioGroup` | `form` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:RadioGroup` | `id` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:RadioGroup` | `isDisabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:RadioGroup` | `isInvalid` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:RadioGroup` | `isReadOnly` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:RadioGroup` | `isRequired` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:RadioGroup` | `name` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:RadioGroup` | `onBlur` | `((e: React.FocusEvent<Element, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:RadioGroup` | `onChange` | `((value: string) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:RadioGroup` | `onFocus` | `((e: React.FocusEvent<Element, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:RadioGroup` | `onFocusChange` | `((isFocused: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:RadioGroup` | `orientation` | `Orientation \| undefined` | `'vertical'` | Caller input | — |
| `forms:RadioGroup` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `forms:RadioGroup` | `render` | `import("react-aria-components").DOMRenderFunction<"div", RadioGroupRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:RadioGroup` | `slot` | `string \| null \| undefined` | Unspecified | Caller input | — |
| `forms:RadioGroup` | `style` | `import("react-aria-components").StyleOrFunction<RadioGroupRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:RadioGroup` | `validate` | `((value: string) => import("@react-types/shared").ValidationError \| true \| null \| undefined) \| undefined` | Unspecified | Caller input | — |
| `forms:RadioGroup` | `validationBehavior` | `"native" \| "aria" \| undefined` | `'native'` | Caller input | — |
| `forms:RadioGroup` | `value` | `string \| null \| undefined` | Unspecified | Controlled value | — |
| `forms:RadioGroup` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |
| `forms:Radio` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Radio` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Radio` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Radio` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Radio` | `autoFocus` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:Radio` | `children` | `import("react-aria-components").ChildrenOrFunction<RadioRenderProps>` | Unspecified | Caller content | — |
| `forms:Radio` | `className` | `ClassNameOrFunction<RadioRenderProps> \| undefined` | `'react-aria-Radio'` | Caller input | — |
| `forms:Radio` | `id` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Radio` | `inputRef` | `React.Ref<HTMLInputElement \| null> \| undefined` | Unspecified | Caller reference | `HTMLInputElement` |
| `forms:Radio` | `isDisabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:Radio` | `onBlur` | `((e: React.FocusEvent<Element, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Radio` | `onClick` | `((e: React.MouseEvent<import("react-aria-components").FocusableElement>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Radio` | `onFocus` | `((e: React.FocusEvent<Element, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Radio` | `onFocusChange` | `((isFocused: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Radio` | `onHoverChange` | `((isHovering: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Radio` | `onHoverEnd` | `((e: import("react-aria-components").HoverEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Radio` | `onHoverStart` | `((e: import("react-aria-components").HoverEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Radio` | `onKeyDown` | `((e: import("react-aria-components").KeyboardEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Radio` | `onKeyUp` | `((e: import("react-aria-components").KeyboardEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Radio` | `onPress` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Radio` | `onPressChange` | `((isPressed: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Radio` | `onPressEnd` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Radio` | `onPressStart` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Radio` | `onPressUp` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Radio` | `ref` | `React.Ref<HTMLLabelElement> \| undefined` | Unspecified | Caller reference | `HTMLLabelElement` |
| `forms:Radio` | `render` | `import("react-aria-components").DOMRenderFunction<"label", RadioRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:Radio` | `slot` | `string \| null \| undefined` | Unspecified | Caller input | — |
| `forms:Radio` | `style` | `import("react-aria-components").StyleOrFunction<RadioRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:Radio` | `value` | `string` | Required | Caller input | — |
| `forms:Radio` | Host attributes | 70 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`forms` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

RadioGroup labels the choices. Each Radio has a distinct value and label. The selected child represents the group's form value.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Surface | Web | Native |
| --- | --- | --- |
| Availability | `RadioGroup`, `Radio` | planned. Track a platform contract and simulator fixture in the [family inventory](../component-inventory.md). |

**Variants.** Use defaultValue to restore an initial choice or value and onChange for owner-driven selection.

**Tokens.** These mappings apply inside the optional `uld-controls` scope. A headless import does not install the stylesheet.

**Composition.** Keep all mutually exclusive choices within one RadioGroup. Give each Radio a stable value and a visible option label. Disabling one option leaves another eligible option selected and the group can still be required. [Catalog composition](../../catalog/Controls.stories.tsx)

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Selected | Initialize defaultValue to the available option | Selected named radio is checked | Yes | Selected radio is the normal tab stop | [Initial radio selection](../../tests/advanced.test.tsx#L9) |
| Required | Set isRequired with ARIA validation | Radiogroup exposes aria-required | Through available radios | Through available radios | [Required group](../../tests/form-spec-states.test.tsx#L41) |
| Disabled option | Disable one nonselected Radio | Input disables that option and preserves the selected sibling | No | No | [Unavailable radio option](../../tests/form-spec-states.test.tsx#L41) |

#### Performance

Named JavaScript exports measured independently from the packed web consumer, gzip level 9, with React and React DOM external: `RadioGroup` 10,457 B, `Radio` 13,335 B. These optional imports stay out of the web root. Their sizes overlap when used together. [Measurement method](../../scripts/verify-bundles.mjs) The optional scoped `controls.css` entry measures 1,485 B gzip including its theme tokens. Apply `.uld-controls` to a containing element to opt into its treatments.

#### Tests

- **Selected.** [Initial radio selection](../../tests/advanced.test.tsx#L9).
- **Required.** [Required group](../../tests/form-spec-states.test.tsx#L41).
- **Disabled option.** [Unavailable radio option](../../tests/form-spec-states.test.tsx#L41).
- The [preferences journey](../../tests/browser/preferences.spec.ts) also exercises the composed controls on a compact viewport.
- Dedicated visual qualification and native simulator coverage remain open.

Cross-engine directional navigation around a disabled child and screen-reader announcements when validation becomes invalid remain open.

#### Changelog and deprecations

The `0.3.0-rc.1` draft records the current public contract. Consult the packed declarations for upstream deprecation notices when upgrading React Aria.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Radio group.

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
