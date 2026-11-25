---
{
  "family": "Slider",
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
      "name": "Slider",
      "from": "@ui-lazy-dev/ui-web/forms"
    },
    {
      "platform": "web",
      "name": "SliderTrack",
      "from": "@ui-lazy-dev/ui-web/forms"
    },
    {
      "platform": "web",
      "name": "SliderThumb",
      "from": "@ui-lazy-dev/ui-web/forms"
    },
    {
      "platform": "web",
      "name": "SliderFill",
      "from": "@ui-lazy-dev/ui-web/forms"
    },
    {
      "platform": "web",
      "name": "SliderOutput",
      "from": "@ui-lazy-dev/ui-web/forms"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/Slider",
    "https://mui.com/material-ui/react-slider/"
  ]
}
---

# Slider

## Part A — Contract

### Purpose and when not to use it

Set a bounded value by position. Choose Number field for precise numeric entry.

### Anatomy

A thumb adjusts a bounded value along a track. A label and optional value display identify it.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| label | Required | N/A — required | Container gap | Provides the accessible name | Text adds no stop |
| track | Required | N/A — required | Container gap | Children retain their semantics | Operable children keep their order |
| thumb | Required | N/A — required | Container gap | Control has its own name | Participates in its logical position |
| value | Optional | collapse | Container gap | Provides supporting information | Text adds no stop |

### Variants

Choose horizontal or vertical orientation with a meaningful step. Give each thumb a distinct purpose for a multi-value range.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Keyboard increment | Increase by one step | See Tokens | The current value advances by one step | Yes | Yes | Pending: keyboard increment scenario |
| Upper bound | Reach the upper bound | Thumb remains at the maximum | The value stays bounded and can decrease | Yes, toward the range | Focus stays on the thumb | Pending: upper bound scenario |
| Disabled | Disable adjustment | Disabled foreground | The current value remains available | No | No | Pending: disabled scenario |

### Keyboard, pointer and touch

Arrows adjust the focused thumb by a step. Drag or tap to adjust the pointer position. Bounds constrain the result.

### Accessibility

Label the slider and each independent thumb. Provide readable units where a bare number is ambiguous. Use the field’s localized labels in RTL layouts. Review touch-target geometry, contrast, forced colors and reduced-motion behavior in the consumer theme before promoting this draft.

### State patterns

This family owns no request lifecycle. Its containing surface supplies any loading, empty, error, offline, permission or partial-failure state.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

| Part or state | Token |
| --- | --- |
| Inherited text / light | `light.text` |
| Inherited text / dark | `dark.text` |

### Composition and content guidelines

Supply unique accessible names for independent thumbs. Use “Playback volume”. Avoid “Level 1”. Localize the whole label and keep it available when constrained text wraps.

## Part B — Bindings

### API

`value`/`defaultValue` supply a number for one thumb or a compatible array for multiple thumbs. `onChange` reports the new value during interaction and `onChangeEnd` reports completion. `minValue`, `maxValue` and `step` define available positions. The accessibility target is the input associated with each SliderThumb.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `forms:Slider` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Slider` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Slider` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Slider` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Slider` | `children` | `import("react-aria-components").ChildrenOrFunction<SliderRenderProps>` | Unspecified | Caller content | — |
| `forms:Slider` | `className` | `ClassNameOrFunction<SliderRenderProps> \| undefined` | `'react-aria-Slider'` | Caller input | — |
| `forms:Slider` | `defaultValue` | `T \| undefined` | Unspecified | Uncontrolled initial value | — |
| `forms:Slider` | `formatOptions` | `Intl.NumberFormatOptions \| undefined` | Unspecified | Caller input | — |
| `forms:Slider` | `id` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Slider` | `isDisabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:Slider` | `maxValue` | `number \| undefined` | `100` | Caller input | — |
| `forms:Slider` | `minValue` | `number \| undefined` | `0` | Caller input | — |
| `forms:Slider` | `onChange` | `((value: T) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Slider` | `onChangeEnd` | `((value: T) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Slider` | `orientation` | `Orientation \| undefined` | `'horizontal'` | Caller input | — |
| `forms:Slider` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `forms:Slider` | `render` | `import("react-aria-components").DOMRenderFunction<"div", SliderRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:Slider` | `slot` | `string \| null \| undefined` | Unspecified | Caller input | — |
| `forms:Slider` | `step` | `number \| undefined` | `1` | Caller input | — |
| `forms:Slider` | `style` | `import("react-aria-components").StyleOrFunction<SliderRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:Slider` | `value` | `T \| undefined` | Unspecified | Controlled value | — |
| `forms:Slider` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |
| `forms:SliderTrack` | `children` | `import("react-aria-components").ChildrenOrFunction<SliderTrackRenderProps>` | Unspecified | Caller content | — |
| `forms:SliderTrack` | `className` | `ClassNameOrFunction<SliderTrackRenderProps> \| undefined` | `'react-aria-SliderTrack'` | Caller input | — |
| `forms:SliderTrack` | `onHoverChange` | `((isHovering: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:SliderTrack` | `onHoverEnd` | `((e: import("react-aria-components").HoverEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:SliderTrack` | `onHoverStart` | `((e: import("react-aria-components").HoverEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:SliderTrack` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `forms:SliderTrack` | `render` | `import("react-aria-components").DOMRenderFunction<"div", SliderTrackRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:SliderTrack` | `style` | `import("react-aria-components").StyleOrFunction<SliderTrackRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:SliderTrack` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |
| `forms:SliderThumb` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:SliderThumb` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:SliderThumb` | `aria-errormessage` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:SliderThumb` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:SliderThumb` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:SliderThumb` | `autoFocus` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:SliderThumb` | `children` | `import("react-aria-components").ChildrenOrFunction<SliderThumbRenderProps>` | Unspecified | Caller content | — |
| `forms:SliderThumb` | `className` | `ClassNameOrFunction<SliderThumbRenderProps> \| undefined` | `'react-aria-SliderThumb'` | Caller input | — |
| `forms:SliderThumb` | `form` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:SliderThumb` | `id` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:SliderThumb` | `index` | `number \| undefined` | `0` | Caller input | — |
| `forms:SliderThumb` | `inputRef` | `RefObject<HTMLInputElement \| null> \| undefined` | Unspecified | Caller reference | `HTMLInputElement` |
| `forms:SliderThumb` | `isDisabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:SliderThumb` | `isInvalid` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:SliderThumb` | `isRequired` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:SliderThumb` | `name` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:SliderThumb` | `onBlur` | `((e: React.FocusEvent<Element, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:SliderThumb` | `onFocus` | `((e: React.FocusEvent<Element, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:SliderThumb` | `onFocusChange` | `((isFocused: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:SliderThumb` | `onHoverChange` | `((isHovering: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:SliderThumb` | `onHoverEnd` | `((e: import("react-aria-components").HoverEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:SliderThumb` | `onHoverStart` | `((e: import("react-aria-components").HoverEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:SliderThumb` | `onKeyDown` | `((e: import("react-aria-components").KeyboardEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:SliderThumb` | `onKeyUp` | `((e: import("react-aria-components").KeyboardEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:SliderThumb` | `orientation` | `Orientation \| undefined` | `'horizontal'` | Caller input | — |
| `forms:SliderThumb` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `forms:SliderThumb` | `render` | `import("react-aria-components").DOMRenderFunction<"div", SliderThumbRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:SliderThumb` | `style` | `import("react-aria-components").StyleOrFunction<SliderThumbRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:SliderThumb` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |
| `forms:SliderFill` | `children` | `import("react-aria-components").ChildrenOrFunction<SliderFillRenderProps>` | Unspecified | Caller content | — |
| `forms:SliderFill` | `className` | `ClassNameOrFunction<SliderFillRenderProps> \| undefined` | `'react-aria-SliderFill'` | Caller input | — |
| `forms:SliderFill` | `offset` | `number \| undefined` | `0` | Caller input | — |
| `forms:SliderFill` | `onHoverChange` | `((isHovering: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:SliderFill` | `onHoverEnd` | `((e: import("react-aria-components").HoverEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:SliderFill` | `onHoverStart` | `((e: import("react-aria-components").HoverEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:SliderFill` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `forms:SliderFill` | `render` | `import("react-aria-components").DOMRenderFunction<"div", SliderFillRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:SliderFill` | `style` | `import("react-aria-components").StyleOrFunction<SliderFillRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:SliderFill` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |
| `forms:SliderOutput` | `children` | `import("react-aria-components").ChildrenOrFunction<SliderRenderProps>` | Unspecified | Caller content | — |
| `forms:SliderOutput` | `className` | `ClassNameOrFunction<SliderRenderProps> \| undefined` | `'react-aria-SliderOutput'` | Caller input | — |
| `forms:SliderOutput` | `ref` | `React.Ref<HTMLOutputElement> \| undefined` | Unspecified | Caller reference | `HTMLOutputElement` |
| `forms:SliderOutput` | `render` | `import("react-aria-components").DOMRenderFunction<"output", SliderRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:SliderOutput` | `style` | `import("react-aria-components").StyleOrFunction<SliderRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:SliderOutput` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`forms` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

Slider owns the values. SliderTrack, SliderFill, SliderThumb and SliderOutput represent the range, position, operable input and displayed value.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Surface | Web | Native |
| --- | --- | --- |
| Availability | `Slider`, `SliderTrack`, `SliderThumb`, `SliderFill`, `SliderOutput` | planned. Track a platform contract and simulator fixture in the [family inventory](../component-inventory.md). |

**Tokens.** These mappings apply inside the optional `uld-controls` scope. A headless import does not install the stylesheet.

**Composition.** Place SliderTrack and one SliderThumb for each index inside Slider. Supply unique accessible names for independent thumbs. Use SliderOutput to display formatted values and SliderFill where an explicit filled track is needed. [Catalog composition](../../catalog/EnterpriseNavigation.stories.tsx)

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Keyboard increment | Focus a thumb and press ArrowRight | Underlying slider value advances by one step | Yes | Yes | [Keyboard priority step](../../tests/browser/enterprise-navigation.spec.ts#L18) |
| Upper bound | Increment twice when only one step from max | Slider value is clamped and ArrowLeft moves it back | Yes, toward the range | Focus stays on the thumb | [Keyboard clamping and focus](../../tests/slider/form-spec-states.test.tsx#L9) |
| Disabled | Set isDisabled on Slider | Input is disabled and numeric value is preserved | No | No | [Disabled numeric thumb](../../tests/form-spec-states.test.tsx#L150) |

#### Performance

Named JavaScript exports measured independently from the packed web consumer, gzip level 9, with React and React DOM external: `Slider` 9,619 B, `SliderTrack` 2,862 B, `SliderThumb` 10,942 B, `SliderFill` 3,084 B, `SliderOutput` 1,800 B. These optional imports stay out of the web root. Their sizes overlap when used together. [Measurement method](../../scripts/verify-bundles.mjs) The optional scoped `controls.css` entry measures 1,485 B gzip including its theme tokens. Apply `.uld-controls` to a containing element to opt into its treatments.

#### Tests

- **Keyboard increment.** [Keyboard priority step](../../tests/browser/enterprise-navigation.spec.ts#L18).
- **Upper bound.** [Keyboard clamping and focus](../../tests/slider/form-spec-states.test.tsx#L9).
- **Disabled.** [Disabled numeric thumb](../../tests/form-spec-states.test.tsx#L150).
- Dedicated visual qualification and native simulator coverage remain open.

Touch dragging, two-thumb collision, vertical orientation and RTL keyboard direction beyond the documented LTR case need cross-engine coverage.

#### Changelog and deprecations

The `0.3.0-rc.1` draft records the current public contract. Consult the packed declarations for upstream deprecation notices when upgrading React Aria.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Slider.

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
