---
{
  "family": "Time field",
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
      "name": "TimeField",
      "from": "@ui-lazy-dev/ui-web/forms"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/TimeField",
    "https://mui.com/x/react-date-pickers/time-field/"
  ]
}
---

# Time field

## Part A — Contract

### Purpose and when not to use it

Enter local time using localized segments. Choose Date field when the user needs a date without time.

### Anatomy

Editable time segments appear in the active locale’s order with localized separators.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| label | Required | N/A — required | Container gap | Provides the accessible name | Text adds no stop |
| segments | Required | N/A — required | Container gap | Children retain their semantics | Operable children keep their order |

### Variants

Use a suitable granularity and hour cycle. A read-only time stays inspectable while changes are suppressed.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Editable time | Edit the hour | See Tokens | Its named segment accepts changes | Yes | Editable clock segments | Pending: editable time scenario |
| Read-only time | Make the time read-only | Inherited text | The clock segments remain readable | No edits | Segments remain inspectable | Pending: read-only time scenario |

### Keyboard, pointer and touch

Move among time parts with arrow keys. Enter digits or increment a segment. Display separators follow the locale.

### Accessibility

Keep hour and minute segments named. Expose read-only programmatically to distinguish it from an unavailable field. Use the field’s localized labels in RTL layouts. Review touch-target geometry, contrast, forced colors and reduced-motion behavior in the consumer theme before promoting this draft.

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

Preserve locale-specific order, separators and day-period segments. Let the form owner decide which time zone is meaningful to the task. Use “Departure time”. Avoid “HH:MM”. Localize the whole label and keep it available when constrained text wraps.

## Part B — Bindings

### API

`value`/`defaultValue` hold typed time values or null. `onChange` reports the mapped time or null. `hourCycle` determines whether the hour uses a 12- or 24-hour cycle and `granularity` controls the smallest displayed unit. `isReadOnly` disables editing of the current segments.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `forms:TimeField` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:TimeField` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:TimeField` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:TimeField` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:TimeField` | `autoFocus` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:TimeField` | `children` | `import("react-aria-components").ChildrenOrFunction<DateFieldRenderProps>` | Unspecified | Caller content | — |
| `forms:TimeField` | `className` | `ClassNameOrFunction<DateFieldRenderProps> \| undefined` | `'react-aria-TimeField'` | Caller input | — |
| `forms:TimeField` | `defaultValue` | `T \| null \| undefined` | Unspecified | Uncontrolled initial value | — |
| `forms:TimeField` | `form` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:TimeField` | `granularity` | `"hour" \| "minute" \| "second" \| undefined` | `'minute'` | Caller input | — |
| `forms:TimeField` | `hideTimeZone` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:TimeField` | `hourCycle` | `12 \| 24 \| undefined` | Unspecified | Caller input | — |
| `forms:TimeField` | `id` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:TimeField` | `isDisabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:TimeField` | `isInvalid` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:TimeField` | `isReadOnly` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:TimeField` | `isRequired` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:TimeField` | `maxValue` | `TimeValue \| null \| undefined` | Unspecified | Caller input | — |
| `forms:TimeField` | `minValue` | `TimeValue \| null \| undefined` | Unspecified | Caller input | — |
| `forms:TimeField` | `name` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:TimeField` | `onBlur` | `((e: React.FocusEvent<Element, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:TimeField` | `onChange` | `((value: import("react-stately/useTimeFieldState").MappedTimeValue<T> \| null) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:TimeField` | `onFocus` | `((e: React.FocusEvent<Element, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:TimeField` | `onFocusChange` | `((isFocused: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:TimeField` | `onKeyDown` | `((e: import("react-aria-components").KeyboardEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:TimeField` | `onKeyUp` | `((e: import("react-aria-components").KeyboardEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:TimeField` | `placeholderValue` | `T \| undefined` | Unspecified | Caller input | — |
| `forms:TimeField` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `forms:TimeField` | `render` | `import("react-aria-components").DOMRenderFunction<"div", DateFieldRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:TimeField` | `shouldForceLeadingZeros` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:TimeField` | `slot` | `string \| null \| undefined` | Unspecified | Caller input | — |
| `forms:TimeField` | `style` | `import("react-aria-components").StyleOrFunction<DateFieldRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:TimeField` | `validate` | `((value: import("react-stately/useTimeFieldState").MappedTimeValue<T>) => import("@react-types/shared").ValidationError \| true \| null \| undefined) \| undefined` | Unspecified | Caller input | — |
| `forms:TimeField` | `validationBehavior` | `"native" \| "aria" \| undefined` | `'native'` | Caller input | — |
| `forms:TimeField` | `value` | `T \| null \| undefined` | Unspecified | Controlled value | — |
| `forms:TimeField` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`forms` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

TimeField wraps DateInput with one DateSegment per display part. A visible label names the segmented editor.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Surface | Web | Native |
| --- | --- | --- |
| Availability | `TimeField` | planned. Track a platform contract and simulator fixture in the [family inventory](../component-inventory.md). |

**Tokens.** These mappings apply inside the optional `uld-controls` scope. A headless import does not install the stylesheet.

**Composition.** Render DateInput inside a named TimeField, then emit DateSegment for each part returned by its callback. Preserve locale-specific order, separators and day-period segments. Let the form owner decide which time zone is meaningful to the task. [Catalog composition](../../catalog/Authoring.stories.tsx)

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Editable time | Render a TimeField with no read-only flag | Hour spinbutton is contenteditable | Yes | Editable clock segments | [Editable clock hour](../../tests/form-spec-states.test.tsx#L250) |
| Read-only time | Set isReadOnly on a labeled time field | All clock spinbuttons expose aria-readonly true | No edits | Segments remain inspectable | [Read-only clock segments](../../tests/depth-controls.test.tsx#L79) |

#### Performance

Named JavaScript exports measured independently from the packed web consumer, gzip level 9, with React and React DOM external: `TimeField` 35,914 B. These optional imports stay out of the web root. Their sizes overlap when used together. [Measurement method](../../scripts/verify-bundles.mjs) The optional scoped `controls.css` entry measures 1,485 B gzip including its theme tokens. Apply `.uld-controls` to a containing element to opt into its treatments.

#### Tests

- **Editable time.** [Editable clock hour](../../tests/form-spec-states.test.tsx#L250).
- **Read-only time.** [Read-only clock segments](../../tests/depth-controls.test.tsx#L79).
- Dedicated browser coverage for the full contract remains open.
- Dedicated visual qualification and native simulator coverage remain open.

12/24-hour switching, locale-specific day-period handling and keyboard wrapping at midnight need browser coverage.

#### Changelog and deprecations

The `0.3.0-rc.1` draft records the current public contract. Consult the packed declarations for upstream deprecation notices when upgrading React Aria.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Time field.

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
