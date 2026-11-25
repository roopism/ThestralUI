---
{
  "family": "Number field",
  "status": "draft",
  "since": "0.3.0-rc.1",
  "owner": "@roopism",
  "platforms": {
    "web": "exported",
    "native": "planned"
  },
  "exports": [
    {
      "platform": "web",
      "name": "NumberField",
      "from": "@ui-lazy-dev/ui-web/forms"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/NumberField",
    "https://mui.com/material-ui/react-number-field/"
  ]
}
---

# Number field

## Part A — Contract

### Purpose and when not to use it

Enter a quantity, amount or measurement whose value is a number, with bounds and a step. Use a text field for identifiers that only look numeric, such as postal codes, account numbers or one-time codes, and a slider when an approximate value within a range is enough.

### Anatomy

A number field has a label, an input between a decrement and an increment button, an optional description and an optional error message.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| label | Optional | fallback — the field must then receive a programmatic name from its owner | Container gap | Provides the input name | Text adds no stop |
| input | Required | N/A — the input holds the value | Container gap | Named by the label | One stop |
| stepper buttons | Optional | collapse | Container gap | Localized increase and decrease names that include the field name | Not in the tab order |
| description | Optional | collapse | Container gap | Becomes the input description | No stop |
| error message | Optional | collapse | Container gap | Added to the input description while invalid | No stop |

### Variants

Values can be plain numbers, percentages, currency or units through number formatting options, with a minimum, maximum and step. The stepper can be hidden for compact layouts.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Default | Present the field | `light.surface` input with `light.muted` border | Named number input with its current value | Yes | Yes | Pending: neutral scenario needs a text-entry verb |
| Stepping | Press an arrow key or a stepper button | Value updates in place | Value changes by one step and stays within bounds | Yes | Input keeps focus | Pending: neutral scenario lands with the native binding |
| At bound | The value reaches the minimum or maximum | The matching stepper uses the disabled treatment | That stepper is disabled | No, for that direction | Yes | Pending: neutral scenario lands with the native binding |
| Focus-visible | Move focus with the keyboard | `light.focus` outline at `density.focusWidth` | Focus is visible on the input | Yes | Yes | Pending: focus-visible scenario needs a focus verb |
| Read-only | Owner allows inspection but not change | Input text stays readable | Read-only is exposed; steppers are disabled | No change | Yes | Pending: neutral scenario lands with the native binding |
| Disabled | Owner disables the field | `light.disabled` text | Disabled is exposed on the input and steppers | No | No | Pending: disabled scenario needs a negative activation verb |
| Invalid | Validation fails or the owner marks the field invalid | `light.danger` message | Invalid is exposed; the error joins the input description | Yes | Yes | Pending: neutral scenario lands with the native binding |

### Keyboard, pointer and touch

Tab moves to the input; the stepper buttons are not separate stops. Arrow Up and Arrow Down step the value; Page Up and Page Down take larger steps; Home and End go to the minimum and maximum when they are set. Typed text is parsed in the current locale when the field loses focus or the form is submitted, then clamped to the bounds and formatted. Pressing and holding a stepper repeats the step. Scroll wheel input is ignored unless the input has focus.

### Accessibility

- **Role and name.** The input has the text entry role for numbers with the label as its name. The steppers are buttons named by localized increase and decrease labels together with the field name.
- **Value.** The formatted value is exposed, including currency and percent symbols, so screen readers read what is shown.
- **Description.** The description and, while invalid, the error message are announced as the input description.
- **State.** Read-only, disabled, required and invalid are exposed on the input. A stepper at a bound is disabled.
- **Target size.** The input and each stepper are at least `size.control` tall.
- **Forced colors and reduced motion.** The field uses system colors in forced colors and has no motion.
- **Right-to-left.** The decrement button stays at the inline start and the increment button at the inline end; numerals follow the locale.

### State patterns

A number field owns no request lifecycle. Validation runs on commit; the owner may supply server errors through the form. Loading and permission states belong to the form.

### Localization

The library owns the localized stepper names. Number parsing and formatting follow the locale, including decimal and grouping separators, numbering systems, currency and units. The caller supplies the label, description and error message.

### Tokens

| Part or state | Token |
| --- | --- |
| Input surface and text | `light.surface`, `dark.surface`, `light.text`, `dark.text` |
| Input border | `light.muted`, `dark.muted`, `shape.radiusMd` |
| Stepper buttons | `light.surface`, `dark.surface`, `light.text`, `dark.text` |
| Error message | `light.danger`, `dark.danger` |
| Keyboard focus | `light.focus`, `dark.focus`, `density.focusWidth` |
| Target height and spacing | `size.control`, `size.gap` |

### Composition and content guidelines

Do put the unit in the formatting options or the label, such as “Weight (kg)”. Set bounds whenever they exist so the steppers stop at them. Avoid a number field for values the person never adjusts by steps, such as phone numbers.

## Part B — Bindings

### API

`NumberField` wraps the React Aria number field. Without children it renders the label, the input between localized steppers, the description and the error message; `hideStepper` removes the buttons. Composed children, such as `Group`, `Input` and slotted triggers, replace the default rendering as before. It supports controlled (`value`) and uncontrolled (`defaultValue`) use, `minValue`, `maxValue`, `step`, `formatOptions`, form `name`, native or aria validation, and forwards a ref.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `forms:NumberField` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:NumberField` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:NumberField` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:NumberField` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:NumberField` | `autoFocus` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:NumberField` | `children` | `import("react-aria-components").ChildrenOrFunction<import("react-aria-components").NumberFieldRenderProps>` | Unspecified | Caller content | — |
| `forms:NumberField` | `className` | `import("react-aria-components").ClassNameOrFunction<import("react-aria-components").NumberFieldRenderProps> \| undefined` | `'react-aria-NumberField'` | Caller input | — |
| `forms:NumberField` | `commitBehavior` | `"validate" \| "snap" \| undefined` | `'snap'` | Caller input | — |
| `forms:NumberField` | `decrementAriaLabel` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:NumberField` | `defaultValue` | `number \| undefined` | Unspecified | Uncontrolled initial value | — |
| `forms:NumberField` | `description` | `ReactNode` | Unspecified | Caller input | — |
| `forms:NumberField` | `errorMessage` | `ReactNode \| ((validation: ValidationResult) => ReactNode)` | Unspecified | Caller input | — |
| `forms:NumberField` | `form` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:NumberField` | `formatOptions` | `Intl.NumberFormatOptions \| undefined` | Unspecified | Caller input | — |
| `forms:NumberField` | `hideStepper` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:NumberField` | `id` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:NumberField` | `incrementAriaLabel` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:NumberField` | `isDisabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:NumberField` | `isInvalid` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:NumberField` | `isReadOnly` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:NumberField` | `isRequired` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:NumberField` | `isWheelDisabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:NumberField` | `label` | `ReactNode` | Unspecified | Caller input | — |
| `forms:NumberField` | `maxValue` | `number \| undefined` | Unspecified | Caller input | — |
| `forms:NumberField` | `minValue` | `number \| undefined` | Unspecified | Caller input | — |
| `forms:NumberField` | `name` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:NumberField` | `onBeforeInput` | `import("react").FormEventHandler<HTMLInputElement> \| undefined` | Unspecified | Caller callback | — |
| `forms:NumberField` | `onBlur` | `((e: import("react").FocusEvent<Element, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:NumberField` | `onChange` | `((value: number) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:NumberField` | `onCompositionEnd` | `import("react").CompositionEventHandler<HTMLInputElement> \| undefined` | Unspecified | Caller callback | — |
| `forms:NumberField` | `onCompositionStart` | `import("react").CompositionEventHandler<HTMLInputElement> \| undefined` | Unspecified | Caller callback | — |
| `forms:NumberField` | `onCompositionUpdate` | `import("react").CompositionEventHandler<HTMLInputElement> \| undefined` | Unspecified | Caller callback | — |
| `forms:NumberField` | `onCopy` | `import("react").ClipboardEventHandler<HTMLInputElement> \| undefined` | Unspecified | Caller callback | — |
| `forms:NumberField` | `onCut` | `import("react").ClipboardEventHandler<HTMLInputElement> \| undefined` | Unspecified | Caller callback | — |
| `forms:NumberField` | `onFocus` | `((e: import("react").FocusEvent<Element, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:NumberField` | `onFocusChange` | `((isFocused: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:NumberField` | `onInput` | `import("react").FormEventHandler<HTMLInputElement> \| undefined` | Unspecified | Caller callback | — |
| `forms:NumberField` | `onKeyDown` | `((e: import("react-aria-components").KeyboardEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:NumberField` | `onKeyUp` | `((e: import("react-aria-components").KeyboardEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:NumberField` | `onPaste` | `import("react").ClipboardEventHandler<HTMLInputElement> \| undefined` | Unspecified | Caller callback | — |
| `forms:NumberField` | `onSelect` | `import("react").ReactEventHandler<HTMLInputElement> \| undefined` | Unspecified | Caller callback | — |
| `forms:NumberField` | `placeholder` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:NumberField` | `ref` | `Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `forms:NumberField` | `render` | `import("react-aria-components").DOMRenderFunction<"div", import("react-aria-components").NumberFieldRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:NumberField` | `slot` | `string \| null \| undefined` | Unspecified | Caller input | — |
| `forms:NumberField` | `step` | `number \| undefined` | Unspecified | Caller input | — |
| `forms:NumberField` | `style` | `import("react-aria-components").StyleOrFunction<import("react-aria-components").NumberFieldRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:NumberField` | `validate` | `((value: number) => import("@react-types/shared").ValidationError \| true \| null \| undefined) \| undefined` | Unspecified | Caller input | — |
| `forms:NumberField` | `validationBehavior` | `"native" \| "aria" \| undefined` | `'native'` | Caller input | — |
| `forms:NumberField` | `value` | `number \| undefined` | Unspecified | Controlled value | — |
| `forms:NumberField` | Host attributes | 70 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

Client-only. `forms` is a client entry because parsing and stepping are stateful. Server rendering produces the labeled input with its formatted value.

#### Headless API

React Aria's `useNumberField` provides the behavior. The library adds no separate hook.

#### Test helpers

None. Query the text entry role by the field name and the steppers by their localized names.

#### Platform differences

| Surface | Web | Native |
| --- | --- | --- |
| Availability | `NumberField` | planned |
| Styling | The input uses the `uld-controls` input treatment; steppers use the secondary button treatment from `styles.css` | — |

#### Performance

Measured from the packed consumer, gzip level 9, React external. The default rendering adds a few hundred bytes to `forms`; the stepper row adds one rule to `controls.css`. [Measurement method](../../scripts/verify-bundles.mjs)

#### Tests

- [Default rendering, steppers, locale parsing and clamping, validation, read-only, disabled and ref](../../tests/number-field/depth-controls.test.tsx)
- [Read-only number input](../../tests/form-spec-states.test.tsx)
- Pending: Chromium checks, neutral scenarios and a family story land with the native binding.

#### Changelog and deprecations

`0.3.0-rc.1`: `NumberField` gains a default rendering with `label`, `description`, `errorMessage`, `placeholder` and `hideStepper`. Composed children keep working. No breaking change.

### React Native

#### Rendering

Native status is `planned`.

#### Headless API

None. No native binding is exported yet.

#### Test helpers

None. No native binding is exported yet.

#### Platform differences

Pending: native parity lands in a separate native commit.

#### Performance

N/A — no native entry for this family yet.

#### Tests

Pending: native renderer and simulator scenarios arrive with the native binding.

#### Changelog and deprecations

N/A — no native export to migrate.
