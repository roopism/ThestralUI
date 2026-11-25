---
{
  "family": "Date range picker",
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
      "name": "DateRangePicker",
      "from": "@ui-lazy-dev/ui-web/forms"
    },
    {
      "platform": "web",
      "name": "RangeCalendar",
      "from": "@ui-lazy-dev/ui-web/forms"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/DateRangePicker",
    "https://mui.com/x/react-date-pickers/date-range-picker/"
  ]
}
---

# Date range picker

## Part A — Contract

### Purpose and when not to use it

Collect a start and end date as one interval. Choose separate Date pickers for independent dates.

### Anatomy

The start and end editors describe one interval. An optional calendar lets the user select both endpoints.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| label | Required | N/A — required | Container gap | Provides the accessible name | Text adds no stop |
| start editor | Required | N/A — required | Container gap | Control has its own name | Participates in its logical position |
| end editor | Required | N/A — required | Container gap | Control has its own name | Participates in its logical position |
| calendar | Optional | collapse | Container gap | Children retain their semantics | Operable children keep their order |

### Variants

Keep both endpoints together in the owner state. Validate bounds and incomplete intervals according to the task.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Editable endpoints | Open the date range | See Tokens | The start and end have distinct names | Yes | Endpoint segments | Pending: editable endpoints scenario |
| Read-only range | Make the range read-only | Inherited segment text | Neither endpoint can be edited | No edits | Endpoints remain inspectable | Pending: read-only range scenario |

### Keyboard, pointer and touch

Traverse segments for either endpoint or select two dates in the calendar. Keep calendar navigation available while choosing an end.

### Accessibility

Name the whole interval and distinguish the start and end segments for screen readers. Explain which endpoint needs correction. Use the field’s localized labels in RTL layouts. Review touch-target geometry, contrast, forced colors and reduced-motion behavior in the consumer theme before promoting this draft.

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

Label both endpoints in the user’s language. Use “Booking window”. Avoid “Dates here”. Localize the whole label and keep it available when constrained text wraps.

## Part B — Bindings

### API

`value`/`defaultValue` accept a range with typed start and end values or null. `onChange` returns the mapped range or null. `isReadOnly` propagates to both segmented inputs. Manage popup visibility independently via `isOpen` and `onOpenChange(boolean)`. RangeCalendar supplies interactive range selection for a calendar popup.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `forms:DateRangePicker` | `allowsNonContiguousRanges` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:DateRangePicker` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:DateRangePicker` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:DateRangePicker` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:DateRangePicker` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:DateRangePicker` | `autoFocus` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:DateRangePicker` | `children` | `import("react-aria-components").ChildrenOrFunction<DateRangePickerRenderProps>` | Unspecified | Caller content | — |
| `forms:DateRangePicker` | `className` | `ClassNameOrFunction<DateRangePickerRenderProps> \| undefined` | `'react-aria-DateRangePicker'` | Caller input | — |
| `forms:DateRangePicker` | `defaultOpen` | `boolean \| undefined` | Unspecified | Uncontrolled initial value | — |
| `forms:DateRangePicker` | `defaultValue` | `import("react-aria-components").RangeValue<T> \| null \| undefined` | Unspecified | Uncontrolled initial value | — |
| `forms:DateRangePicker` | `endName` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:DateRangePicker` | `firstDayOfWeek` | `"sun" \| "mon" \| "tue" \| "wed" \| "thu" \| "fri" \| "sat" \| undefined` | Unspecified | Caller input | — |
| `forms:DateRangePicker` | `form` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:DateRangePicker` | `granularity` | `import("react-stately/useDateFieldState").Granularity \| undefined` | Unspecified | Caller input | — |
| `forms:DateRangePicker` | `hideTimeZone` | `boolean \| undefined` | `false` | Caller input | — |
| `forms:DateRangePicker` | `hourCycle` | `12 \| 24 \| undefined` | Unspecified | Caller input | — |
| `forms:DateRangePicker` | `id` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:DateRangePicker` | `isDateUnavailable` | `((date: DateValue, anchorDate: import("@internationalized/date").CalendarDate \| null) => boolean) \| undefined` | Unspecified | Caller input | — |
| `forms:DateRangePicker` | `isDisabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:DateRangePicker` | `isInvalid` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:DateRangePicker` | `isOpen` | `boolean \| undefined` | Unspecified | Controlled value | — |
| `forms:DateRangePicker` | `isReadOnly` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:DateRangePicker` | `isRequired` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:DateRangePicker` | `maxValue` | `DateValue \| null \| undefined` | Unspecified | Caller input | — |
| `forms:DateRangePicker` | `minValue` | `DateValue \| null \| undefined` | Unspecified | Caller input | — |
| `forms:DateRangePicker` | `onBlur` | `((e: React.FocusEvent<Element, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:DateRangePicker` | `onChange` | `((value: import("react-aria-components").RangeValue<import("react-stately/useDateFieldState").MappedDateValue<T>> \| null) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:DateRangePicker` | `onFocus` | `((e: React.FocusEvent<Element, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:DateRangePicker` | `onFocusChange` | `((isFocused: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:DateRangePicker` | `onKeyDown` | `((e: import("react-aria-components").KeyboardEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:DateRangePicker` | `onKeyUp` | `((e: import("react-aria-components").KeyboardEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:DateRangePicker` | `onOpenChange` | `((isOpen: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:DateRangePicker` | `pageBehavior` | `import("react-stately/useCalendarState").PageBehavior \| undefined` | `visible` | Caller input | — |
| `forms:DateRangePicker` | `placeholderValue` | `T \| null \| undefined` | Unspecified | Caller input | — |
| `forms:DateRangePicker` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `forms:DateRangePicker` | `render` | `import("react-aria-components").DOMRenderFunction<"div", DateRangePickerRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:DateRangePicker` | `shouldCloseOnSelect` | `boolean \| (() => boolean) \| undefined` | `true` | Caller input | — |
| `forms:DateRangePicker` | `shouldForceLeadingZeros` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:DateRangePicker` | `slot` | `string \| null \| undefined` | Unspecified | Caller input | — |
| `forms:DateRangePicker` | `startName` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:DateRangePicker` | `style` | `import("react-aria-components").StyleOrFunction<DateRangePickerRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:DateRangePicker` | `validate` | `((value: import("react-aria-components").RangeValue<import("react-stately/useDateFieldState").MappedDateValue<T>>) => import("@react-types/shared").ValidationError \| true \| null \| undefined) \| undefined` | Unspecified | Caller input | — |
| `forms:DateRangePicker` | `validationBehavior` | `"native" \| "aria" \| undefined` | `'native'` | Caller input | — |
| `forms:DateRangePicker` | `value` | `import("react-aria-components").RangeValue<T> \| null \| undefined` | Unspecified | Controlled value | — |
| `forms:DateRangePicker` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |
| `forms:RangeCalendar` | `allowsNonContiguousRanges` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:RangeCalendar` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:RangeCalendar` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:RangeCalendar` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:RangeCalendar` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:RangeCalendar` | `autoFocus` | `boolean \| undefined` | `false` | Caller input | — |
| `forms:RangeCalendar` | `children` | `import("react-aria-components").ChildrenOrFunction<RangeCalendarRenderProps>` | Unspecified | Caller content | — |
| `forms:RangeCalendar` | `className` | `ClassNameOrFunction<RangeCalendarRenderProps> \| undefined` | `'react-aria-RangeCalendar'` | Caller input | — |
| `forms:RangeCalendar` | `commitBehavior` | `"reset" \| "select" \| "clear" \| undefined` | `'select'` | Caller input | — |
| `forms:RangeCalendar` | `createCalendar` | `((identifier: CalendarIdentifier) => ICalendar) \| undefined` | Unspecified | Caller input | — |
| `forms:RangeCalendar` | `defaultFocusedValue` | `DateValue \| null \| undefined` | Unspecified | Uncontrolled initial value | — |
| `forms:RangeCalendar` | `defaultValue` | `import("react-aria-components").RangeValue<T> \| null \| undefined` | Unspecified | Uncontrolled initial value | — |
| `forms:RangeCalendar` | `firstDayOfWeek` | `"sun" \| "mon" \| "tue" \| "wed" \| "thu" \| "fri" \| "sat" \| undefined` | Unspecified | Caller input | — |
| `forms:RangeCalendar` | `focusedValue` | `DateValue \| null \| undefined` | Unspecified | Controlled value | — |
| `forms:RangeCalendar` | `id` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:RangeCalendar` | `isDateUnavailable` | `((date: DateValue, anchorDate: CalendarDate \| null) => boolean) \| undefined` | Unspecified | Caller input | — |
| `forms:RangeCalendar` | `isDisabled` | `boolean \| undefined` | `false` | Caller input | — |
| `forms:RangeCalendar` | `isInvalid` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:RangeCalendar` | `isReadOnly` | `boolean \| undefined` | `false` | Caller input | — |
| `forms:RangeCalendar` | `maxValue` | `DateValue \| null \| undefined` | Unspecified | Caller input | — |
| `forms:RangeCalendar` | `minValue` | `DateValue \| null \| undefined` | Unspecified | Caller input | — |
| `forms:RangeCalendar` | `onChange` | `((value: import("react-aria-components").RangeValue<import("react-stately/dist/types/src/calendar/types.js").MappedDateValue<T>>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:RangeCalendar` | `onFocusChange` | `((date: CalendarDate) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:RangeCalendar` | `pageBehavior` | `import("react-stately/useCalendarState").PageBehavior \| undefined` | `visible` | Caller input | — |
| `forms:RangeCalendar` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `forms:RangeCalendar` | `render` | `import("react-aria-components").DOMRenderFunction<"div", RangeCalendarRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:RangeCalendar` | `selectionAlignment` | `"start" \| "center" \| "end" \| undefined` | `'center'` | Caller input | — |
| `forms:RangeCalendar` | `slot` | `string \| null \| undefined` | Unspecified | Caller input | — |
| `forms:RangeCalendar` | `style` | `import("react-aria-components").StyleOrFunction<RangeCalendarRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:RangeCalendar` | `value` | `import("react-aria-components").RangeValue<T> \| null \| undefined` | Unspecified | Controlled value | — |
| `forms:RangeCalendar` | `visibleDuration` | `DateDuration \| undefined` | `{ months: 1 }` | Caller input | — |
| `forms:RangeCalendar` | `weeksInMonth` | `number \| undefined` | Unspecified | Caller input | — |
| `forms:RangeCalendar` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`forms` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

DateRangePicker coordinates two DateInput slots, start and end. A RangeCalendar supplies the interactive interval in a popup.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Surface | Web | Native |
| --- | --- | --- |
| Availability | `DateRangePicker`, `RangeCalendar` | planned. Track a platform contract and simulator fixture in the [family inventory](../component-inventory.md). |

**Tokens.** These mappings apply inside the optional `uld-controls` scope. A headless import does not install the stylesheet.

**Composition.** Give the two DateInput children distinct `start` and `end` slots in a single Group. Label both endpoints in the user’s language. Render each endpoint’s DateSegment children from its own callback. In the optional dialog use a RangeCalendar so both dates are selected together.

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Editable endpoints | Render two slotted DateInputs with distinct labels | Start and end expose distinct named spinbuttons | Yes | Endpoint segments | [Independent endpoint names](../../tests/depth-controls.test.tsx#L97) |
| Read-only range | Set isReadOnly on DateRangePicker | Both start and end spinbuttons report aria-readonly true | No edits | Endpoints remain inspectable | [Both endpoints are read-only](../../tests/form-spec-states.test.tsx#L188) |

#### Performance

Named JavaScript exports measured independently from the packed web consumer, gzip level 9, with React and React DOM external: `DateRangePicker` 32,504 B, `RangeCalendar` 26,353 B. These optional imports stay out of the web root. Their sizes overlap when used together. [Measurement method](../../scripts/verify-bundles.mjs) The optional scoped `controls.css` entry measures 1,485 B gzip including its theme tokens. Apply `.uld-controls` to a containing element to opt into its treatments.

#### Tests

- **Editable endpoints.** [Independent endpoint names](../../tests/depth-controls.test.tsx#L97).
- **Read-only range.** [Both endpoints are read-only](../../tests/form-spec-states.test.tsx#L188).
- Dedicated browser coverage for the full contract remains open.
- Dedicated visual qualification and native simulator coverage remain open.

Partially entered ranges, reverse endpoint entry, keyboard range selection across months and popup dismissal need browser qualification.

#### Changelog and deprecations

The `0.3.0-rc.1` draft records the current public contract. Consult the packed declarations for upstream deprecation notices when upgrading React Aria.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Date range picker.

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
