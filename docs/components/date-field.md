---
{
  "family": "Date field",
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
      "name": "DateField",
      "from": "@ui-lazy-dev/ui-web/forms"
    },
    {
      "platform": "web",
      "name": "DateInput",
      "from": "@ui-lazy-dev/ui-web/forms"
    },
    {
      "platform": "web",
      "name": "DateSegment",
      "from": "@ui-lazy-dev/ui-web/forms"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/DateField",
    "https://mui.com/x/react-date-pickers/date-field/"
  ]
}
---

# Date field

## Part A — Contract

### Purpose and when not to use it

Enter a calendar date using localized segments. Choose Date picker for calendar browsing.

### Anatomy

The named editor contains editable date segments and the locale’s separators.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| label | Required | N/A — required | Container gap | Provides the accessible name | Text adds no stop |
| segments | Required | N/A — required | Container gap | Children retain their semantics | Operable children keep their order |

### Variants

Set date-only or date-time granularity and the appropriate calendar. Pass a typed date value in place of preformatted display text.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Editable date | Open an editable date | See Tokens | Named segments accept changes | Yes | Editable segments | Pending: editable date scenario |
| Read-only date | Make the date read-only | No distinct read-only paint | Each segment exposes its current value without accepting edits | No edits | Read-only segments remain inspectable | Pending: read-only date scenario |

### Keyboard, pointer and touch

Arrows traverse or adjust editable segments and digits replace values. Preserve locale order when arranging the field.

### Accessibility

Editable segments have accessible names inside the named group. Literal separators do not add a tab stop. Use the field’s localized labels in RTL layouts. Review touch-target geometry, contrast, forced colors and reduced-motion behavior in the consumer theme before promoting this draft.

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

Give helper text and validation messages their appropriate description and error slots. Use “Publication date”. Avoid “MM/DD/YYYY”. Localize the whole label and keep it available when constrained text wraps.

## Part B — Bindings

### API

`value` and `defaultValue` accept typed calendar date values or null. `onChange` reports the mapped value type or null. `granularity` chooses the smallest editable part. `isReadOnly` propagates to the segments. DateInput owns their visual sequence and DateSegment receives its segment object from the render callback.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `forms:DateField` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:DateField` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:DateField` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:DateField` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:DateField` | `autoComplete` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:DateField` | `autoFocus` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:DateField` | `children` | `import("react-aria-components").ChildrenOrFunction<DateFieldRenderProps>` | Unspecified | Caller content | — |
| `forms:DateField` | `className` | `ClassNameOrFunction<DateFieldRenderProps> \| undefined` | `'react-aria-DateField'` | Caller input | — |
| `forms:DateField` | `defaultValue` | `T \| null \| undefined` | Unspecified | Uncontrolled initial value | — |
| `forms:DateField` | `form` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:DateField` | `granularity` | `import("react-stately/useDateFieldState").Granularity \| undefined` | Unspecified | Caller input | — |
| `forms:DateField` | `hideTimeZone` | `boolean \| undefined` | `false` | Caller input | — |
| `forms:DateField` | `hourCycle` | `12 \| 24 \| undefined` | Unspecified | Caller input | — |
| `forms:DateField` | `id` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:DateField` | `isDateUnavailable` | `((date: DateValue) => boolean) \| undefined` | Unspecified | Caller input | — |
| `forms:DateField` | `isDisabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:DateField` | `isInvalid` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:DateField` | `isReadOnly` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:DateField` | `isRequired` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:DateField` | `maxValue` | `DateValue \| null \| undefined` | Unspecified | Caller input | — |
| `forms:DateField` | `minValue` | `DateValue \| null \| undefined` | Unspecified | Caller input | — |
| `forms:DateField` | `name` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:DateField` | `onBlur` | `((e: React.FocusEvent<Element, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:DateField` | `onChange` | `((value: import("react-stately/useDateFieldState").MappedDateValue<T> \| null) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:DateField` | `onFocus` | `((e: React.FocusEvent<Element, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:DateField` | `onFocusChange` | `((isFocused: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:DateField` | `onKeyDown` | `((e: import("react-aria-components").KeyboardEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:DateField` | `onKeyUp` | `((e: import("react-aria-components").KeyboardEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:DateField` | `placeholderValue` | `T \| null \| undefined` | Unspecified | Caller input | — |
| `forms:DateField` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `forms:DateField` | `render` | `import("react-aria-components").DOMRenderFunction<"div", DateFieldRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:DateField` | `shouldForceLeadingZeros` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:DateField` | `slot` | `string \| null \| undefined` | Unspecified | Caller input | — |
| `forms:DateField` | `style` | `import("react-aria-components").StyleOrFunction<DateFieldRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:DateField` | `validate` | `((value: import("react-stately/useDateFieldState").MappedDateValue<T>) => import("@react-types/shared").ValidationError \| true \| null \| undefined) \| undefined` | Unspecified | Caller input | — |
| `forms:DateField` | `validationBehavior` | `"native" \| "aria" \| undefined` | `'native'` | Caller input | — |
| `forms:DateField` | `value` | `T \| null \| undefined` | Unspecified | Controlled value | — |
| `forms:DateField` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |
| `forms:DateInput` | `children` | `(segment: IDateSegment) => ReactElement` | Required | Caller content | — |
| `forms:DateInput` | `className` | `ClassNameOrFunction<DateInputRenderProps> \| undefined` | `'react-aria-DateInput'` | Caller input | — |
| `forms:DateInput` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `forms:DateInput` | `render` | `import("react-aria-components").DOMRenderFunction<"div", DateInputRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:DateInput` | `slot` | `string \| null \| undefined` | Unspecified | Caller input | — |
| `forms:DateInput` | `style` | `import("react-aria-components").StyleOrFunction<DateInputRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:DateInput` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |
| `forms:DateSegment` | `children` | `import("react-aria-components").ChildrenOrFunction<DateSegmentRenderProps>` | Unspecified | Caller content | — |
| `forms:DateSegment` | `className` | `ClassNameOrFunction<DateSegmentRenderProps> \| undefined` | `'react-aria-DateSegment'` | Caller input | — |
| `forms:DateSegment` | `onHoverChange` | `((isHovering: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:DateSegment` | `onHoverEnd` | `((e: import("react-aria-components").HoverEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:DateSegment` | `onHoverStart` | `((e: import("react-aria-components").HoverEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:DateSegment` | `ref` | `React.Ref<HTMLSpanElement> \| undefined` | Unspecified | Caller reference | `HTMLSpanElement` |
| `forms:DateSegment` | `render` | `import("react-aria-components").DOMRenderFunction<"span", DateSegmentRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:DateSegment` | `segment` | `IDateSegment` | Required | Caller input | — |
| `forms:DateSegment` | `style` | `import("react-aria-components").StyleOrFunction<DateSegmentRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:DateSegment` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`forms` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

DateField labels DateInput. Render DateSegment for editable date parts and literal separators.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Surface | Web | Native |
| --- | --- | --- |
| Availability | `DateField`, `DateInput`, `DateSegment` | planned. Track a platform contract and simulator fixture in the [family inventory](../component-inventory.md). |

**Tokens.** These mappings apply inside the optional `uld-controls` scope. A headless import does not install the stylesheet.

**Composition.** Put DateInput inside the named DateField. Pass each callback segment directly to DateSegment so locale punctuation and field order are retained. Give helper text and validation messages their appropriate description and error slots. [Catalog composition](../../catalog/Authoring.stories.tsx)

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Editable date | Mount a named field with editable DateSegments | Named group contains a day spinbutton with contenteditable true | Yes | Editable segments | [Editable date segment](../../tests/depth-controls.test.tsx#L79) |
| Read-only date | Set isReadOnly on DateField | Each exposed spinbutton reports aria-readonly true | No edits | Read-only segments remain inspectable | [Read-only date spinbuttons](../../tests/form-spec-states.test.tsx#L150) |

#### Performance

Named JavaScript exports measured independently from the packed web consumer, gzip level 9, with React and React DOM external: `DateField` 40,382 B, `DateInput` 40,765 B, `DateSegment` 24,915 B. These optional imports stay out of the web root. Their sizes overlap when used together. [Measurement method](../../scripts/verify-bundles.mjs) The optional scoped `controls.css` entry measures 1,485 B gzip including its theme tokens. Apply `.uld-controls` to a containing element to opt into its treatments.

#### Tests

- **Editable date.** [Editable date segment](../../tests/depth-controls.test.tsx#L79).
- **Read-only date.** [Read-only date spinbuttons](../../tests/form-spec-states.test.tsx#L150).
- Dedicated browser coverage for the full contract remains open.
- Dedicated visual qualification and native simulator coverage remain open.

Arrow-key changes across month boundaries, deletion and non-Gregorian calendars need cross-engine tests.

#### Changelog and deprecations

The `0.3.0-rc.1` draft records the current public contract. Consult the packed declarations for upstream deprecation notices when upgrading React Aria.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Date field.

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
