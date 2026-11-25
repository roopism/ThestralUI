---
{
  "family": "Date picker",
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
      "name": "DatePicker",
      "from": "@ui-lazy-dev/ui-web/forms"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/DatePicker",
    "https://mui.com/x/react-date-pickers/date-picker/"
  ]
}
---

# Date picker

## Part A — Contract

### Purpose and when not to use it

Choose one date by typing or opening a calendar. Choose Date range picker for related endpoints.

### Anatomy

A named date field connects an opener to a calendar for choosing a single date.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| label | Required | N/A — required | Container gap | Provides the accessible name | Text adds no stop |
| segments | Required | N/A — required | Container gap | Children retain their semantics | Operable children keep their order |
| opener | Required | N/A — required | Container gap | Action has its own name | Takes its place when available |
| calendar | Required | N/A — required | Container gap | Children retain their semantics | Operable children keep their order |

### Variants

Use a date-only or date-time value according to granularity. Keep direct keyboard entry available in a compact layout.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Closed | Close the calendar | See Tokens | The opener identifies its calendar dialog | Yes | Yes | Pending: closed scenario |
| Disabled | Disable the opener | Disabled foreground | The calendar remains closed | No | No | Pending: disabled scenario |

### Keyboard, pointer and touch

Edit segments directly or open the calendar trigger. Escape dismisses the composed popup. Return focus to the field's trigger after dismissal.

### Accessibility

Name the field independently of the trigger. Expose the popup's dialog relationship on the trigger. Use the field’s localized labels in RTL layouts. Review touch-target geometry, contrast, forced colors and reduced-motion behavior in the consumer theme before promoting this draft.

### State patterns

The owning form reports validation, busy status and recovery. Preserve the field value while displaying a correctable error.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions. Format the value for the active locale, including segment order and separators.

### Tokens

| Part or state | Token |
| --- | --- |
| Inherited text / light | `light.text` |
| Inherited text / dark | `dark.text` |

### Composition and content guidelines

Give the editable date and the browse action distinguishable accessible names. Use “Choose deadline”. Avoid “Click calendar”. Localize the whole label and keep it available when constrained text wraps.

## Part B — Bindings

### API

`value`/`defaultValue` supply a typed date or null and `onChange` reports the mapped date value. Control the popup separately with `isOpen` and `onOpenChange(boolean)`. `isDisabled` propagates to the calendar trigger and prevents the control from requesting open.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `forms:DatePicker` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:DatePicker` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:DatePicker` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:DatePicker` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:DatePicker` | `autoComplete` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:DatePicker` | `autoFocus` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:DatePicker` | `children` | `import("react-aria-components").ChildrenOrFunction<DatePickerRenderProps>` | Unspecified | Caller content | — |
| `forms:DatePicker` | `className` | `ClassNameOrFunction<DatePickerRenderProps> \| undefined` | `'react-aria-DatePicker'` | Caller input | — |
| `forms:DatePicker` | `defaultOpen` | `boolean \| undefined` | Unspecified | Uncontrolled initial value | — |
| `forms:DatePicker` | `defaultValue` | `T \| null \| undefined` | Unspecified | Uncontrolled initial value | — |
| `forms:DatePicker` | `firstDayOfWeek` | `"sun" \| "mon" \| "tue" \| "wed" \| "thu" \| "fri" \| "sat" \| undefined` | Unspecified | Caller input | — |
| `forms:DatePicker` | `form` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:DatePicker` | `granularity` | `import("react-stately/useDateFieldState").Granularity \| undefined` | Unspecified | Caller input | — |
| `forms:DatePicker` | `hideTimeZone` | `boolean \| undefined` | `false` | Caller input | — |
| `forms:DatePicker` | `hourCycle` | `12 \| 24 \| undefined` | Unspecified | Caller input | — |
| `forms:DatePicker` | `id` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:DatePicker` | `isDateUnavailable` | `((date: DateValue) => boolean) \| undefined` | Unspecified | Caller input | — |
| `forms:DatePicker` | `isDisabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:DatePicker` | `isInvalid` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:DatePicker` | `isOpen` | `boolean \| undefined` | Unspecified | Controlled value | — |
| `forms:DatePicker` | `isReadOnly` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:DatePicker` | `isRequired` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:DatePicker` | `maxValue` | `DateValue \| null \| undefined` | Unspecified | Caller input | — |
| `forms:DatePicker` | `minValue` | `DateValue \| null \| undefined` | Unspecified | Caller input | — |
| `forms:DatePicker` | `name` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:DatePicker` | `onBlur` | `((e: React.FocusEvent<Element, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:DatePicker` | `onChange` | `((value: import("react-stately/useDateFieldState").MappedDateValue<T> \| null) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:DatePicker` | `onFocus` | `((e: React.FocusEvent<Element, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:DatePicker` | `onFocusChange` | `((isFocused: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:DatePicker` | `onKeyDown` | `((e: import("react-aria-components").KeyboardEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:DatePicker` | `onKeyUp` | `((e: import("react-aria-components").KeyboardEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:DatePicker` | `onOpenChange` | `((isOpen: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:DatePicker` | `pageBehavior` | `import("react-stately/useCalendarState").PageBehavior \| undefined` | `visible` | Caller input | — |
| `forms:DatePicker` | `placeholderValue` | `T \| null \| undefined` | Unspecified | Caller input | — |
| `forms:DatePicker` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `forms:DatePicker` | `render` | `import("react-aria-components").DOMRenderFunction<"div", DatePickerRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:DatePicker` | `shouldCloseOnSelect` | `boolean \| (() => boolean) \| undefined` | `true` | Caller input | — |
| `forms:DatePicker` | `shouldForceLeadingZeros` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:DatePicker` | `slot` | `string \| null \| undefined` | Unspecified | Caller input | — |
| `forms:DatePicker` | `style` | `import("react-aria-components").StyleOrFunction<DatePickerRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:DatePicker` | `validate` | `((value: import("react-stately/useDateFieldState").MappedDateValue<T>) => import("@react-types/shared").ValidationError \| true \| null \| undefined) \| undefined` | Unspecified | Caller input | — |
| `forms:DatePicker` | `validationBehavior` | `"native" \| "aria" \| undefined` | `'native'` | Caller input | — |
| `forms:DatePicker` | `value` | `T \| null \| undefined` | Unspecified | Controlled value | — |
| `forms:DatePicker` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`forms` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

DatePicker connects the named DateInput, calendar trigger and popup. Compose a Dialog and Calendar inside the popup when browsing is offered.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Surface | Web | Native |
| --- | --- | --- |
| Availability | `DatePicker` | planned. Track a platform contract and simulator fixture in the [family inventory](../component-inventory.md). |

**Tokens.** These mappings apply inside the optional `uld-controls` scope. A headless import does not install the stylesheet.

**Composition.** Keep Label, Group, DateInput and the calendar Trigger under DatePicker. For a date-selection popup, place Calendar inside the OverlayDialog and Popover so it inherits selection and dismissal context. Give the editable date and the browse action distinguishable accessible names.

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Closed | Render the deadline field and a named trigger | Trigger identifies a dialog popup | Yes | Yes | [Closed calendar trigger](../../tests/depth-controls.test.tsx#L97) |
| Disabled | Set isDisabled and attempt pointer activation | Trigger is disabled and no open callback fires | No | No | [Disabled picker remains closed](../../tests/form-spec-states.test.tsx#L188) |

#### Performance

Named JavaScript exports measured independently from the packed web consumer, gzip level 9, with React and React DOM external: `DatePicker` 33,306 B. These optional imports stay out of the web root. Their sizes overlap when used together. [Measurement method](../../scripts/verify-bundles.mjs) The optional scoped `controls.css` entry measures 1,485 B gzip including its theme tokens. Apply `.uld-controls` to a containing element to opt into its treatments.

#### Tests

- **Closed.** [Closed calendar trigger](../../tests/depth-controls.test.tsx#L97).
- **Disabled.** [Disabled picker remains closed](../../tests/form-spec-states.test.tsx#L188).
- Dedicated browser coverage for the full contract remains open.
- Dedicated visual qualification and native simulator coverage remain open.

Keyboard opening, popup focus containment, Escape restoration and selecting a day from the composed popup remain open browser journeys.

#### Changelog and deprecations

The `0.3.0-rc.1` draft records the current public contract. Consult the packed declarations for upstream deprecation notices when upgrading React Aria.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Date picker.

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
