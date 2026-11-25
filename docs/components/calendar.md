---
{
  "family": "Calendar",
  "status": "draft",
  "since": "0.3.0-rc.1",
  "owner": "@thetechgeeek",
  "platforms": {
    "web": "exported",
    "native": "planned"
  },
  "exports": [
    {
      "platform": "web",
      "name": "Calendar",
      "from": "@ui-lazy-dev/ui-web/forms"
    },
    {
      "platform": "web",
      "name": "CalendarCell",
      "from": "@ui-lazy-dev/ui-web/forms"
    },
    {
      "platform": "web",
      "name": "CalendarGrid",
      "from": "@ui-lazy-dev/ui-web/forms"
    },
    {
      "platform": "web",
      "name": "CalendarGridHeader",
      "from": "@ui-lazy-dev/ui-web/forms"
    },
    {
      "platform": "web",
      "name": "CalendarHeaderCell",
      "from": "@ui-lazy-dev/ui-web/forms"
    },
    {
      "platform": "web",
      "name": "CalendarGridBody",
      "from": "@ui-lazy-dev/ui-web/forms"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/Calendar",
    "https://mui.com/x/react-date-pickers/date-calendar/"
  ]
}
---

# Calendar

## Part A — Contract

### Purpose and when not to use it

Browse dates and select a day. Choose Date field for compact typed entry.

### Anatomy

A named date grid follows a heading and period-navigation actions.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| heading | Required | N/A — required | Container gap | Provides the accessible name | Text adds no stop |
| previous | Required | N/A — required | Container gap | Action has its own name | Takes its place when available |
| next | Required | N/A — required | Container gap | Action has its own name | Takes its place when available |
| date cells | Required | N/A — required | Container gap | Children retain their semantics | Operable children keep their order |

### Variants

A calendar can have bounded or unavailable dates.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Available | Move to an available day | See Tokens | The named day can be selected | Yes | Via grid navigation | Pending: available scenario |
| Unavailable | Mark a day unavailable | See Tokens | The day identifies its unavailability | No selection | May be inspected via grid navigation | Pending: unavailable scenario |
| Selected | Select a day | See Tokens | The chosen date becomes selected | Yes | Day control | Pending: selected scenario |

### Keyboard, pointer and touch

Arrows move between days. Use named month controls for navigation. Activate an available day with keyboard or touch.

### Accessibility

Label the grid and localize day names. Distinguish unavailable, current and selected dates with programmatic state as well as styling. Use the field’s localized labels in RTL layouts. Review touch-target geometry, contrast, forced colors and reduced-motion behavior in the consumer theme before promoting this draft.

### State patterns

This family owns no request lifecycle. Its containing surface supplies any loading, empty, error, offline, permission or partial-failure state.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions. Format the value for the active locale, including segment order and separators.

### Tokens

| Part or state | Token |
| --- | --- |
| Inherited text / light | `light.text` |
| Inherited text / dark | `dark.text` |

### Composition and content guidelines

Navigation controls can use previous/next slots. Use “Publication calendar”. Avoid “Calendar 1”. Localize the whole label and keep it available when constrained text wraps.

## Part B — Bindings

### API

`value` controls selection and `defaultValue` initializes an uncontrolled calendar. `onChange` reports the selected typed date for a single-selection calendar. `focusedValue`/`onFocusChange` control the visible focus date independently. `isDateUnavailable(date)` evaluates dates in addition to min/max bounds.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `forms:Calendar` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Calendar` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Calendar` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Calendar` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Calendar` | `autoFocus` | `boolean \| undefined` | `false` | Caller input | — |
| `forms:Calendar` | `children` | `import("react-aria-components").ChildrenOrFunction<CalendarRenderProps<M>>` | Unspecified | Caller content | — |
| `forms:Calendar` | `className` | `ClassNameOrFunction<CalendarRenderProps<M>> \| undefined` | `'react-aria-Calendar'` | Caller input | — |
| `forms:Calendar` | `createCalendar` | `((identifier: CalendarIdentifier) => ICalendar) \| undefined` | Unspecified | Caller input | — |
| `forms:Calendar` | `defaultFocusedValue` | `DateValue \| null \| undefined` | Unspecified | Uncontrolled initial value | — |
| `forms:Calendar` | `defaultValue` | `import("react-stately/dist/types/src/calendar/types.js").CalendarValueType<T \| null, M> \| undefined` | Unspecified | Uncontrolled initial value | — |
| `forms:Calendar` | `firstDayOfWeek` | `"sun" \| "mon" \| "tue" \| "wed" \| "thu" \| "fri" \| "sat" \| undefined` | Unspecified | Caller input | — |
| `forms:Calendar` | `focusedValue` | `DateValue \| null \| undefined` | Unspecified | Controlled value | — |
| `forms:Calendar` | `id` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Calendar` | `isDateUnavailable` | `((date: DateValue) => boolean) \| undefined` | Unspecified | Caller input | — |
| `forms:Calendar` | `isDisabled` | `boolean \| undefined` | `false` | Caller input | — |
| `forms:Calendar` | `isInvalid` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:Calendar` | `isReadOnly` | `boolean \| undefined` | `false` | Caller input | — |
| `forms:Calendar` | `maxValue` | `DateValue \| null \| undefined` | Unspecified | Caller input | — |
| `forms:Calendar` | `minValue` | `DateValue \| null \| undefined` | Unspecified | Caller input | — |
| `forms:Calendar` | `onChange` | `((value: import("react-stately/dist/types/src/calendar/types.js").CalendarValueType<import("react-stately/dist/types/src/calendar/types.js").MappedDateValue<T>, M>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Calendar` | `onFocusChange` | `((date: CalendarDate) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Calendar` | `pageBehavior` | `import("react-stately/useCalendarState").PageBehavior \| undefined` | `visible` | Caller input | — |
| `forms:Calendar` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `forms:Calendar` | `render` | `import("react-aria-components").DOMRenderFunction<"div", CalendarRenderProps<M>> \| undefined` | Unspecified | Caller input | — |
| `forms:Calendar` | `selectionAlignment` | `"start" \| "center" \| "end" \| undefined` | `'center'` | Caller input | — |
| `forms:Calendar` | `selectionMode` | `M \| undefined` | `'single'` | Caller input | — |
| `forms:Calendar` | `slot` | `string \| null \| undefined` | Unspecified | Caller input | — |
| `forms:Calendar` | `style` | `import("react-aria-components").StyleOrFunction<CalendarRenderProps<M>> \| undefined` | Unspecified | Caller input | — |
| `forms:Calendar` | `value` | `import("react-stately/dist/types/src/calendar/types.js").CalendarValueType<T \| null, M> \| undefined` | Unspecified | Controlled value | — |
| `forms:Calendar` | `visibleDuration` | `DateDuration \| undefined` | `{ months: 1 }` | Caller input | — |
| `forms:Calendar` | `weeksInMonth` | `number \| undefined` | Unspecified | Caller input | — |
| `forms:Calendar` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |
| `forms:CalendarCell` | `children` | `import("react-aria-components").ChildrenOrFunction<CalendarCellRenderProps>` | Unspecified | Caller content | — |
| `forms:CalendarCell` | `className` | `ClassNameOrFunction<CalendarCellRenderProps> \| undefined` | `'react-aria-CalendarCell'` | Caller input | — |
| `forms:CalendarCell` | `date` | `CalendarDate` | Required | Caller input | — |
| `forms:CalendarCell` | `onHoverChange` | `((isHovering: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:CalendarCell` | `onHoverEnd` | `((e: import("react-aria-components").HoverEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:CalendarCell` | `onHoverStart` | `((e: import("react-aria-components").HoverEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:CalendarCell` | `ref` | `React.Ref<HTMLTableCellElement> \| undefined` | Unspecified | Caller reference | `HTMLTableCellElement` |
| `forms:CalendarCell` | `render` | `import("react-aria-components").DOMRenderFunction<"div", CalendarCellRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:CalendarCell` | `style` | `import("react-aria-components").StyleOrFunction<CalendarCellRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:CalendarCell` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |
| `forms:CalendarGrid` | `children` | `React.ReactElement<unknown, string \| React.JSXElementConstructor<any>> \| React.ReactElement<unknown, string \| React.JSXElementConstructor<any>>[] \| ((date: CalendarDate) => ReactElement) \| undefined` | Unspecified | Caller content | — |
| `forms:CalendarGrid` | `className` | `string \| undefined` | `'react-aria-CalendarGrid'` | Caller input | — |
| `forms:CalendarGrid` | `offset` | `DateDuration \| undefined` | Unspecified | Caller input | — |
| `forms:CalendarGrid` | `ref` | `React.Ref<HTMLTableElement> \| undefined` | Unspecified | Caller reference | `HTMLTableElement` |
| `forms:CalendarGrid` | `render` | `import("react-aria-components").DOMRenderFunction<"table", undefined> \| undefined` | Unspecified | Caller input | — |
| `forms:CalendarGrid` | `style` | `React.CSSProperties \| undefined` | Unspecified | Caller input | — |
| `forms:CalendarGrid` | `weekdayStyle` | `"narrow" \| "short" \| "long" \| undefined` | `'narrow'` | Caller input | — |
| `forms:CalendarGrid` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |
| `forms:CalendarGridHeader` | `children` | `(day: string) => ReactElement` | Required | Caller content | — |
| `forms:CalendarGridHeader` | `className` | `string \| undefined` | `'react-aria-CalendarGridHeader'` | Caller input | — |
| `forms:CalendarGridHeader` | `ref` | `React.Ref<HTMLTableSectionElement> \| undefined` | Unspecified | Caller reference | `HTMLTableSectionElement` |
| `forms:CalendarGridHeader` | `render` | `import("react-aria-components").DOMRenderFunction<"thead", undefined> \| undefined` | Unspecified | Caller input | — |
| `forms:CalendarGridHeader` | `style` | `React.CSSProperties \| undefined` | Unspecified | Caller input | — |
| `forms:CalendarGridHeader` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |
| `forms:CalendarHeaderCell` | `children` | `React.ReactNode` | Unspecified | Caller content | — |
| `forms:CalendarHeaderCell` | `className` | `string \| undefined` | `'react-aria-CalendarHeaderCell'` | Caller input | — |
| `forms:CalendarHeaderCell` | `id` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:CalendarHeaderCell` | `ref` | `React.Ref<HTMLTableCellElement> \| undefined` | Unspecified | Caller reference | `HTMLTableCellElement` |
| `forms:CalendarHeaderCell` | `render` | `import("react-aria-components").DOMRenderFunction<"th", undefined> \| undefined` | Unspecified | Caller input | — |
| `forms:CalendarHeaderCell` | `style` | `React.CSSProperties \| undefined` | Unspecified | Caller input | — |
| `forms:CalendarHeaderCell` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |
| `forms:CalendarGridBody` | `children` | `(date: CalendarDate) => ReactElement` | Required | Caller content | — |
| `forms:CalendarGridBody` | `className` | `string \| undefined` | `'react-aria-CalendarGridBody'` | Caller input | — |
| `forms:CalendarGridBody` | `ref` | `React.Ref<HTMLTableSectionElement> \| undefined` | Unspecified | Caller reference | `HTMLTableSectionElement` |
| `forms:CalendarGridBody` | `render` | `import("react-aria-components").DOMRenderFunction<"tbody", undefined> \| undefined` | Unspecified | Caller input | — |
| `forms:CalendarGridBody` | `style` | `React.CSSProperties \| undefined` | Unspecified | Caller input | — |
| `forms:CalendarGridBody` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`forms` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

Calendar owns navigation and selection. Compose a heading, previous/next triggers, CalendarGrid, header cells, body and CalendarCell per date.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Surface | Web | Native |
| --- | --- | --- |
| Availability | `Calendar`, `CalendarCell`, `CalendarGrid`, `CalendarGridHeader`, `CalendarHeaderCell`, `CalendarGridBody` | planned. Track a platform contract and simulator fixture in the [family inventory](../component-inventory.md). |

**Variants.** A calendar can have bounded or unavailable dates. Choose RangeCalendar for an interval.

**Tokens.** These mappings apply inside the optional `uld-controls` scope. A headless import does not install the stylesheet.

**Composition.** Compose CalendarGrid and generate a CalendarCell from each provided date. Use CalendarGridHeader and CalendarHeaderCell where a custom header is needed, preserving positional alignment with CalendarGridBody. Navigation controls can use previous/next slots. [Catalog composition](../../catalog/Authoring.stories.tsx)

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Available | Render a month with at least one allowed date | Grid contains enabled day buttons | Yes | Via grid navigation | [Available day controls](../../tests/depth-controls.test.tsx#L97) |
| Unavailable | Return true for a particular day in isDateUnavailable | Day button carries the unavailable marker | No selection | May be inspected via grid navigation | [Unavailable-day predicate](../../tests/depth-controls.test.tsx#L97) |
| Selected | Activate an available day | Cell reports selected and onChange receives a date | Yes | Day control | [Pointer selects an available day](../../tests/form-spec-states.test.tsx#L250) |

#### Performance

Named JavaScript exports measured independently from the packed web consumer, gzip level 9, with React and React DOM external: `Calendar` 25,068 B, `CalendarCell` 24,638 B, `CalendarGrid` 17,798 B, `CalendarGridHeader` 1,628 B, `CalendarHeaderCell` 1,074 B, `CalendarGridBody` 1,208 B. These optional imports stay out of the web root. Their sizes overlap when used together. [Measurement method](../../scripts/verify-bundles.mjs) The optional scoped `controls.css` entry measures 1,485 B gzip including its theme tokens. Apply `.uld-controls` to a containing element to opt into its treatments.

#### Tests

- **Available.** [Available day controls](../../tests/depth-controls.test.tsx#L97).
- **Unavailable.** [Unavailable-day predicate](../../tests/depth-controls.test.tsx#L97).
- **Selected.** [Pointer selects an available day](../../tests/form-spec-states.test.tsx#L250).
- Dedicated browser coverage for the full contract remains open.
- Dedicated visual qualification and native simulator coverage remain open.

Arrow navigation through unavailable dates, month paging and screen-reader announcement of the changed month need browser qualification.

#### Changelog and deprecations

The `0.3.0-rc.1` draft records the current public contract. Consult the packed declarations for upstream deprecation notices when upgrading React Aria.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Calendar.

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
