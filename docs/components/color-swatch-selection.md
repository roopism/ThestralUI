---
{
  "family": "Color swatch selection",
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
      "name": "ColorSwatchPicker",
      "from": "@ui-lazy-dev/ui-web/color"
    },
    {
      "platform": "web",
      "name": "ColorSwatchPickerItem",
      "from": "@ui-lazy-dev/ui-web/color"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/ColorSwatchPicker",
    "https://mui.com/material-ui/react-radio-button/"
  ]
}
---

# Color swatch selection

## Part A — Contract

### Purpose and when not to use it

Choose exactly one supplied color. Use the color picker to permit colors beyond the offered list.

### Anatomy

A named set contains color choices. Each swatch identifies its color independently of sight.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| choices | Required | N/A — required | Container gap | Children retain their semantics | Operable children keep their order |
| swatch | Required | N/A — required | Container gap | Use the image description | No independent action |

### Variants

A palette can be read-only, disabled or editable when configured on the controls. Selected styling needs a mark or outline that survives color loss.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Selected | Choose a color | See Tokens | The named option is selected | Yes | Yes | Pending: selected scenario |
| Changed | Choose another color | See Tokens | Selection moves to the second option | Yes | Yes | Pending: changed scenario |

### Keyboard, pointer and touch

Pointer or touch selects a swatch; keyboard navigation follows listbox behavior. Keep options large enough for touch and preserve a visible focus cue.

### Accessibility

Name the listbox and provide human-readable color names. A checkmark or outline distinguishes the chosen swatch without relying on hue.

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

Do use “Midnight blue” and “Forest green”. Avoid duplicate names or hex values as the only user-facing names.

## Part B — Bindings

### API

Use `defaultValue` for initial selection or supply `value` and update it on `onChange`. Items receive color values; the callback reports the selected Color object.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `color:ColorSwatchPicker` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `color:ColorSwatchPicker` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `color:ColorSwatchPicker` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `color:ColorSwatchPicker` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `color:ColorSwatchPicker` | `children` | `React.ReactNode` | Unspecified | Caller content | — |
| `color:ColorSwatchPicker` | `className` | `ClassNameOrFunction<ColorSwatchPickerRenderProps> \| undefined` | `'react-aria-ColorSwatchPicker'` | Caller input | — |
| `color:ColorSwatchPicker` | `defaultValue` | `string \| Color \| undefined` | Unspecified | Uncontrolled initial value | — |
| `color:ColorSwatchPicker` | `layout` | `"grid" \| "stack" \| undefined` | `'grid'` | Caller input | — |
| `color:ColorSwatchPicker` | `onChange` | `((value: Color) => void) \| undefined` | Unspecified | Caller callback | — |
| `color:ColorSwatchPicker` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `color:ColorSwatchPicker` | `render` | `import("react-aria-components").DOMRenderFunction<"div", ColorSwatchPickerRenderProps> \| undefined` | Unspecified | Caller input | — |
| `color:ColorSwatchPicker` | `style` | `import("react-aria-components").StyleOrFunction<ColorSwatchPickerRenderProps> \| undefined` | Unspecified | Caller input | — |
| `color:ColorSwatchPicker` | `value` | `string \| Color \| undefined` | Unspecified | Controlled value | — |
| `color:ColorSwatchPicker` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |
| `color:ColorSwatchPickerItem` | `children` | `import("react-aria-components").ChildrenOrFunction<ColorSwatchPickerItemRenderProps>` | Unspecified | Caller content | — |
| `color:ColorSwatchPickerItem` | `className` | `ClassNameOrFunction<ColorSwatchPickerItemRenderProps> \| undefined` | `'react-aria-ColorSwatchPickerItem'` | Caller input | — |
| `color:ColorSwatchPickerItem` | `color` | `string \| Color` | Required | Caller input | — |
| `color:ColorSwatchPickerItem` | `isDisabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `color:ColorSwatchPickerItem` | `onClick` | `((e: React.MouseEvent<import("react-aria-components").FocusableElement>) => void) \| undefined` | Unspecified | Caller callback | — |
| `color:ColorSwatchPickerItem` | `onHoverChange` | `((isHovering: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `color:ColorSwatchPickerItem` | `onHoverEnd` | `((e: import("react-aria-components").HoverEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `color:ColorSwatchPickerItem` | `onHoverStart` | `((e: import("react-aria-components").HoverEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `color:ColorSwatchPickerItem` | `onPress` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `color:ColorSwatchPickerItem` | `onPressChange` | `((isPressed: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `color:ColorSwatchPickerItem` | `onPressEnd` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `color:ColorSwatchPickerItem` | `onPressStart` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `color:ColorSwatchPickerItem` | `onPressUp` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `color:ColorSwatchPickerItem` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `color:ColorSwatchPickerItem` | `render` | `import("react-aria-components").DOMRenderFunction<"div", ColorSwatchPickerItemRenderProps> \| undefined` | Unspecified | Caller input | — |
| `color:ColorSwatchPickerItem` | `style` | `import("react-aria-components").StyleOrFunction<ColorSwatchPickerItemRenderProps> \| undefined` | Unspecified | Caller input | — |
| `color:ColorSwatchPickerItem` | Host attributes | 70 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`color` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

ColorSwatchPicker is the listbox. ColorSwatchPickerItem binds a concrete color to an option, with ColorSwatch as its visual and named child.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Contract | Web | Native | Tracking |
| --- | --- | --- | --- |
| Color swatch selection | ColorSwatchPicker, ColorSwatchPickerItem | No family binding in the native package | Native implementation and platform-specific verification are open in the [family audit](../component-depth.md). |

**Accessibility.** Name the listbox and provide human-readable color names. Check `aria-selected` on options. A checkmark or outline distinguishes the chosen swatch without relying on hue.

**Tokens.** The optional controls stylesheet applies text color inside the controls scope. Interactive descendants can use its keyboard focus treatment. Custom slot paint remains the consumer’s responsibility.

**Composition.** Keep ColorSwatchPickerItem children inside their picker. A ColorSwatch with `colorName` supplies readable names such as “Blue”. Share value with a separate ColorField if exact input is allowed.

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Selected | Initialize the first option | First option exposes aria-selected | Yes | Yes | [Initial selected swatch](../../tests/depth-controls.test.tsx) |
| Changed | Activate the second color | Selection moves to second option and onChange reports its color | Yes | Yes | [Named selection callback](../../tests/depth-controls.test.tsx) |

#### Performance

`ColorSwatchPicker` 46,465 B, `ColorSwatchPickerItem` 32,129 B. Each number is a separate named-import gzip measurement with React and React DOM external. Optional controls CSS is measured separately at 1,457 B gzip. The library root entry does not import this family.

#### Tests

- **Selected.** [Initial selected swatch](../../tests/depth-controls.test.tsx).
- **Changed.** [Named selection callback](../../tests/depth-controls.test.tsx).

The linked cases establish the behaviors above. Dedicated per-state visual comparisons and native simulator tests are open. A dedicated catalog example remains open.

#### Changelog and deprecations

The 0.3.0-rc.1 candidate documents the current web bindings. No family-specific deprecation is declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Color swatch selection.

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
