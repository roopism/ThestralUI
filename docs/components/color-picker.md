---
{
  "family": "Color picker",
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
      "name": "ColorPicker",
      "from": "@ui-lazy-dev/ui-web/color"
    },
    {
      "platform": "web",
      "name": "ColorArea",
      "from": "@ui-lazy-dev/ui-web/color"
    },
    {
      "platform": "web",
      "name": "ColorThumb",
      "from": "@ui-lazy-dev/ui-web/color"
    },
    {
      "platform": "web",
      "name": "ColorSlider",
      "from": "@ui-lazy-dev/ui-web/color"
    },
    {
      "platform": "web",
      "name": "ColorWheel",
      "from": "@ui-lazy-dev/ui-web/color"
    },
    {
      "platform": "web",
      "name": "ColorWheelTrack",
      "from": "@ui-lazy-dev/ui-web/color"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/ColorPicker",
    "https://mui.com/material-ui/react-slider/"
  ]
}
---

# Color picker

## Part A — Contract

### Purpose and when not to use it

Edit a color through one or more continuous channels. Use color swatch selection for a finite palette or a color text field for exact text entry.

### Anatomy

Coordinated controls represent the same color. A thumb indicates each adjustable position.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| color controls | Required | N/A — required | Container gap | Children retain their semantics | Operable children keep their order |
| track | Optional | collapse | Container gap | Excluded from the name | No stop |
| thumb | Optional | collapse | Container gap | Excluded from the name | No stop |

### Variants

Compose a hue wheel, rectangular two-channel area or linear slider.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Default | Set a channel value | See Tokens | The named slider exposes the current value | Channel accepts edits | Yes | Pending: default scenario |

### Keyboard, pointer and touch

Use pointer or touch to position a thumb; keyboard users edit focused channel inputs. Preserve a numeric/text alternative when a precision pointer is impractical.

### Accessibility

Label each channel, including the color space or unit when ambiguous. Use exposed slider values for nonvisual feedback. The color itself cannot communicate focus or selection in forced colors.

### State patterns

This family owns no request lifecycle. Its containing surface supplies any loading, empty, error, offline, permission or partial-failure state.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

| Part or state | Token |
| --- | --- |
| Scope foreground | `light.text`, `dark.text` |
| Scoped focus-visible outline | `density.focusWidth`, `light.focus`, `dark.focus` |

### Composition and content guidelines

Multiple controls should share one owner for the color. Do use “Hue” and “Saturation”. Avoid “Slider 1”. Localize labels independently of the color value.

## Part B — Bindings

### API

An owner can supply the picker value or use a default color. Child channel controls consume the color context. Configure the channel and when necessary color space on the child, not on a visual thumb.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `color:ColorPicker` | `children` | `ChildrenOrFunction<ColorPickerRenderProps>` | Required | Caller content | — |
| `color:ColorPicker` | `defaultValue` | `string \| Color \| undefined` | Unspecified | Uncontrolled initial value | — |
| `color:ColorPicker` | `onChange` | `((value: Color) => void) \| undefined` | Unspecified | Caller callback | — |
| `color:ColorPicker` | `slot` | `string \| null \| undefined` | Unspecified | Caller input | — |
| `color:ColorPicker` | `value` | `string \| Color \| undefined` | Unspecified | Controlled value | — |
| `color:ColorArea` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `color:ColorArea` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `color:ColorArea` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `color:ColorArea` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `color:ColorArea` | `children` | `import("react-aria-components").ChildrenOrFunction<ColorAreaRenderProps>` | Unspecified | Caller content | — |
| `color:ColorArea` | `className` | `ClassNameOrFunction<ColorAreaRenderProps> \| undefined` | `'react-aria-ColorArea'` | Caller input | — |
| `color:ColorArea` | `colorSpace` | `import("react-aria-components").ColorSpace \| undefined` | Unspecified | Caller input | — |
| `color:ColorArea` | `defaultValue` | `string \| import("react-aria-components").Color \| undefined` | Unspecified | Uncontrolled initial value | — |
| `color:ColorArea` | `form` | `string \| undefined` | Unspecified | Caller input | — |
| `color:ColorArea` | `id` | `string \| undefined` | Unspecified | Caller input | — |
| `color:ColorArea` | `isDisabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `color:ColorArea` | `onChange` | `((value: import("react-aria-components").Color) => void) \| undefined` | Unspecified | Caller callback | — |
| `color:ColorArea` | `onChangeEnd` | `((value: import("react-aria-components").Color) => void) \| undefined` | Unspecified | Caller callback | — |
| `color:ColorArea` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `color:ColorArea` | `render` | `import("react-aria-components").DOMRenderFunction<"div", ColorAreaRenderProps> \| undefined` | Unspecified | Caller input | — |
| `color:ColorArea` | `slot` | `string \| null \| undefined` | Unspecified | Caller input | — |
| `color:ColorArea` | `style` | `import("react-aria-components").StyleOrFunction<ColorAreaRenderProps> \| undefined` | Unspecified | Caller input | — |
| `color:ColorArea` | `value` | `string \| import("react-aria-components").Color \| undefined` | Unspecified | Controlled value | — |
| `color:ColorArea` | `xChannel` | `import("react-aria-components").ColorChannel \| undefined` | Unspecified | Caller input | — |
| `color:ColorArea` | `xName` | `string \| undefined` | Unspecified | Caller input | — |
| `color:ColorArea` | `yChannel` | `import("react-aria-components").ColorChannel \| undefined` | Unspecified | Caller input | — |
| `color:ColorArea` | `yName` | `string \| undefined` | Unspecified | Caller input | — |
| `color:ColorArea` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |
| `color:ColorThumb` | `children` | `import("react-aria-components").ChildrenOrFunction<ColorThumbRenderProps>` | Unspecified | Caller content | — |
| `color:ColorThumb` | `className` | `ClassNameOrFunction<ColorThumbRenderProps> \| undefined` | `'react-aria-ColorThumb'` | Caller input | — |
| `color:ColorThumb` | `onHoverChange` | `((isHovering: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `color:ColorThumb` | `onHoverEnd` | `((e: import("react-aria-components").HoverEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `color:ColorThumb` | `onHoverStart` | `((e: import("react-aria-components").HoverEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `color:ColorThumb` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `color:ColorThumb` | `render` | `import("react-aria-components").DOMRenderFunction<"div", ColorThumbRenderProps> \| undefined` | Unspecified | Caller input | — |
| `color:ColorThumb` | `style` | `import("react-aria-components").StyleOrFunction<ColorThumbRenderProps> \| undefined` | Unspecified | Caller input | — |
| `color:ColorThumb` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |
| `color:ColorSlider` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `color:ColorSlider` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `color:ColorSlider` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `color:ColorSlider` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `color:ColorSlider` | `channel` | `import("react-aria-components").ColorChannel` | Required | Caller input | — |
| `color:ColorSlider` | `children` | `import("react-aria-components").ChildrenOrFunction<ColorSliderRenderProps>` | Unspecified | Caller content | — |
| `color:ColorSlider` | `className` | `ClassNameOrFunction<ColorSliderRenderProps> \| undefined` | `'react-aria-ColorSlider'` | Caller input | — |
| `color:ColorSlider` | `colorSpace` | `import("react-aria-components").ColorSpace \| undefined` | Unspecified | Caller input | — |
| `color:ColorSlider` | `defaultValue` | `string \| import("react-aria-components").Color \| undefined` | Unspecified | Uncontrolled initial value | — |
| `color:ColorSlider` | `form` | `string \| undefined` | Unspecified | Caller input | — |
| `color:ColorSlider` | `id` | `string \| undefined` | Unspecified | Caller input | — |
| `color:ColorSlider` | `isDisabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `color:ColorSlider` | `name` | `string \| undefined` | Unspecified | Caller input | — |
| `color:ColorSlider` | `onChange` | `((value: import("react-aria-components").Color) => void) \| undefined` | Unspecified | Caller callback | — |
| `color:ColorSlider` | `onChangeEnd` | `((value: import("react-aria-components").Color) => void) \| undefined` | Unspecified | Caller callback | — |
| `color:ColorSlider` | `orientation` | `Orientation \| undefined` | `'horizontal'` | Caller input | — |
| `color:ColorSlider` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `color:ColorSlider` | `render` | `import("react-aria-components").DOMRenderFunction<"div", ColorSliderRenderProps> \| undefined` | Unspecified | Caller input | — |
| `color:ColorSlider` | `slot` | `string \| null \| undefined` | Unspecified | Caller input | — |
| `color:ColorSlider` | `style` | `import("react-aria-components").StyleOrFunction<ColorSliderRenderProps> \| undefined` | Unspecified | Caller input | — |
| `color:ColorSlider` | `value` | `string \| import("react-aria-components").Color \| undefined` | Unspecified | Controlled value | — |
| `color:ColorSlider` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |
| `color:ColorWheel` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `color:ColorWheel` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `color:ColorWheel` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `color:ColorWheel` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `color:ColorWheel` | `children` | `import("react-aria-components").ChildrenOrFunction<ColorWheelRenderProps>` | Unspecified | Caller content | — |
| `color:ColorWheel` | `className` | `ClassNameOrFunction<ColorWheelRenderProps> \| undefined` | `'react-aria-ColorWheel'` | Caller input | — |
| `color:ColorWheel` | `defaultValue` | `string \| import("react-aria-components").Color \| undefined` | `'hsl(0, 100%, 50%)'` | Uncontrolled initial value | — |
| `color:ColorWheel` | `form` | `string \| undefined` | Unspecified | Caller input | — |
| `color:ColorWheel` | `id` | `string \| undefined` | Unspecified | Caller input | — |
| `color:ColorWheel` | `innerRadius` | `number` | Required | Caller input | — |
| `color:ColorWheel` | `isDisabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `color:ColorWheel` | `name` | `string \| undefined` | Unspecified | Caller input | — |
| `color:ColorWheel` | `onChange` | `((value: import("react-aria-components").Color) => void) \| undefined` | Unspecified | Caller callback | — |
| `color:ColorWheel` | `onChangeEnd` | `((value: import("react-aria-components").Color) => void) \| undefined` | Unspecified | Caller callback | — |
| `color:ColorWheel` | `outerRadius` | `number` | Required | Caller input | — |
| `color:ColorWheel` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `color:ColorWheel` | `render` | `import("react-aria-components").DOMRenderFunction<"div", ColorWheelRenderProps> \| undefined` | Unspecified | Caller input | — |
| `color:ColorWheel` | `slot` | `string \| null \| undefined` | Unspecified | Caller input | — |
| `color:ColorWheel` | `style` | `import("react-aria-components").StyleOrFunction<ColorWheelRenderProps> \| undefined` | Unspecified | Caller input | — |
| `color:ColorWheel` | `value` | `string \| import("react-aria-components").Color \| undefined` | Unspecified | Controlled value | — |
| `color:ColorWheel` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |
| `color:ColorWheelTrack` | `className` | `ClassNameOrFunction<ColorWheelTrackRenderProps> \| undefined` | `'react-aria-ColorWheelTrack'` | Caller input | — |
| `color:ColorWheelTrack` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `color:ColorWheelTrack` | `render` | `import("react-aria-components").DOMRenderFunction<"div", ColorWheelTrackRenderProps> \| undefined` | Unspecified | Caller input | — |
| `color:ColorWheelTrack` | `style` | `import("react-aria-components").StyleOrFunction<ColorWheelTrackRenderProps> \| undefined` | Unspecified | Caller input | — |
| `color:ColorWheelTrack` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`color` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

ColorPicker coordinates the shared value. ColorArea supplies two axes; ColorSlider edits one channel. ColorWheel owns a hue ring, ColorWheelTrack paints its track and ColorThumb represents a selectable position.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Contract | Web | Native | Tracking |
| --- | --- | --- | --- |
| Color picker | ColorPicker, ColorArea, ColorThumb, ColorSlider, ColorWheel, ColorWheelTrack | No family binding in the native package | Native implementation and platform-specific verification are open in the [family audit](../component-depth.md). |

**Variants.** Compose a hue wheel, rectangular two-channel area or linear slider. The family has no shared size or intent-tone prop.

**Tokens.** The optional controls stylesheet applies text color inside the controls scope. Interactive descendants can use its keyboard focus treatment. Custom slot paint remains the consumer’s responsibility.

**Composition.** Provide ColorThumb inside each interactive control. Use Label for a slider and a ColorField for exact entry. Multiple controls should share one owner for the color.

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Default | Initialize the shared color in HSL | Named Hue slider reads 120 | Channel accepts edits | Yes | [Shared initial hue](../../tests/depth-controls.test.tsx) |

#### Performance

`ColorPicker` 15,779 B, `ColorArea` 27,131 B, `ColorThumb` 5,522 B, `ColorSlider` 27,251 B, `ColorWheel` 23,739 B, `ColorWheelTrack` 1,753 B. Each number is a separate named-import gzip measurement with React and React DOM external. Optional controls CSS is measured separately at 1,457 B gzip. The library root entry does not import this family.

#### Tests

- **Default.** [Shared initial hue](../../tests/depth-controls.test.tsx).

The linked cases establish the behaviors above. Dedicated per-state visual comparisons and native simulator tests are open. A dedicated catalog example remains open.

#### Changelog and deprecations

The 0.3.0-rc.1 candidate documents the current web bindings. No family-specific deprecation is declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Color picker.

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
