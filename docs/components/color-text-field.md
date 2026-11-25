---
{
  "family": "Color text field",
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
      "name": "ColorField",
      "from": "@ui-lazy-dev/ui-web/color"
    },
    {
      "platform": "web",
      "name": "ColorSwatch",
      "from": "@ui-lazy-dev/ui-web/color"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/ColorField",
    "https://mui.com/material-ui/react-text-field/"
  ]
}
---

# Color text field

## Part A — Contract

### Purpose and when not to use it

Accept an editable color value and show its current swatch. Use color swatch selection to restrict choices to a palette.

### Anatomy

A labeled editor accepts a color and a swatch can show the current value.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| label | Required | N/A — required | Container gap | Provides the accessible name | Text adds no stop |
| editor | Required | N/A — required | Container gap | Control has its own name | Participates in its logical position |
| swatch | Optional | collapse | Container gap | Use the image description | No independent action |

### Variants

Use a field for a whole color or configure a channel.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Default | Open the color editor | See Tokens | The label names the editable field | Text editing | Yes | Pending: default scenario |
| Committed | Confirm a valid color | See Tokens | The owner receives the committed color | Yes | Yes | Pending: committed scenario |

### Keyboard, pointer and touch

Click or Tab into the input. Edit as ordinary text, then leave the field to commit. Display the new swatch without adding a focus stop for color alone.

### Accessibility

Provide a localized Label. Pair the swatch with text or a color name for people who cannot distinguish the preview. Preserve the text editor in forced colors.

### State patterns

The owning form reports validation, busy status and recovery. Preserve the field value while displaying a correctable error.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

| Part or state | Token |
| --- | --- |
| Scope foreground | `light.text`, `dark.text` |
| Scoped focus-visible outline | `density.focusWidth`, `light.focus`, `dark.focus` |

### Composition and content guidelines

Do use “Accent color” and show a value such as “Deep blue”. Avoid a field labeled only with a colored square.

## Part B — Bindings

### API

Use `value` with `onChange` or initialize with `defaultValue`. ColorField emits a parsed Color on successful commit. Use the Color object's serialization method to persist the chosen format.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `color:ColorField` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `color:ColorField` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `color:ColorField` | `aria-errormessage` | `string \| undefined` | Unspecified | Caller input | — |
| `color:ColorField` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `color:ColorField` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `color:ColorField` | `autoFocus` | `boolean \| undefined` | Unspecified | Caller input | — |
| `color:ColorField` | `channel` | `ColorChannel \| undefined` | Unspecified | Caller input | — |
| `color:ColorField` | `children` | `import("react-aria-components").ChildrenOrFunction<ColorFieldRenderProps>` | Unspecified | Caller content | — |
| `color:ColorField` | `className` | `ClassNameOrFunction<ColorFieldRenderProps> \| undefined` | `'react-aria-ColorField'` | Caller input | — |
| `color:ColorField` | `colorSpace` | `ColorSpace \| undefined` | Unspecified | Caller input | — |
| `color:ColorField` | `defaultValue` | `string \| import("react-aria-components").Color \| null \| undefined` | Unspecified | Uncontrolled initial value | — |
| `color:ColorField` | `excludeFromTabOrder` | `boolean \| undefined` | Unspecified | Caller input | — |
| `color:ColorField` | `form` | `string \| undefined` | Unspecified | Caller input | — |
| `color:ColorField` | `id` | `string \| undefined` | Unspecified | Caller input | — |
| `color:ColorField` | `isDisabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `color:ColorField` | `isInvalid` | `boolean \| undefined` | Unspecified | Caller input | — |
| `color:ColorField` | `isReadOnly` | `boolean \| undefined` | Unspecified | Caller input | — |
| `color:ColorField` | `isRequired` | `boolean \| undefined` | Unspecified | Caller input | — |
| `color:ColorField` | `isWheelDisabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `color:ColorField` | `name` | `string \| undefined` | Unspecified | Caller input | — |
| `color:ColorField` | `onBeforeInput` | `React.FormEventHandler<HTMLInputElement> \| undefined` | Unspecified | Caller callback | — |
| `color:ColorField` | `onBlur` | `((e: React.FocusEvent<Element, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `color:ColorField` | `onChange` | `((color: import("react-aria-components").Color \| null) => void) \| undefined` | Unspecified | Caller callback | — |
| `color:ColorField` | `onCompositionEnd` | `React.CompositionEventHandler<HTMLInputElement> \| undefined` | Unspecified | Caller callback | — |
| `color:ColorField` | `onCompositionStart` | `React.CompositionEventHandler<HTMLInputElement> \| undefined` | Unspecified | Caller callback | — |
| `color:ColorField` | `onCompositionUpdate` | `React.CompositionEventHandler<HTMLInputElement> \| undefined` | Unspecified | Caller callback | — |
| `color:ColorField` | `onCopy` | `React.ClipboardEventHandler<HTMLInputElement> \| undefined` | Unspecified | Caller callback | — |
| `color:ColorField` | `onCut` | `React.ClipboardEventHandler<HTMLInputElement> \| undefined` | Unspecified | Caller callback | — |
| `color:ColorField` | `onFocus` | `((e: React.FocusEvent<Element, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `color:ColorField` | `onFocusChange` | `((isFocused: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `color:ColorField` | `onInput` | `React.FormEventHandler<HTMLInputElement> \| undefined` | Unspecified | Caller callback | — |
| `color:ColorField` | `onKeyDown` | `((e: import("react-aria-components").KeyboardEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `color:ColorField` | `onKeyUp` | `((e: import("react-aria-components").KeyboardEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `color:ColorField` | `onPaste` | `React.ClipboardEventHandler<HTMLInputElement> \| undefined` | Unspecified | Caller callback | — |
| `color:ColorField` | `onSelect` | `React.ReactEventHandler<HTMLInputElement> \| undefined` | Unspecified | Caller callback | — |
| `color:ColorField` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `color:ColorField` | `render` | `import("react-aria-components").DOMRenderFunction<"div", ColorFieldRenderProps> \| undefined` | Unspecified | Caller input | — |
| `color:ColorField` | `slot` | `string \| null \| undefined` | Unspecified | Caller input | — |
| `color:ColorField` | `style` | `import("react-aria-components").StyleOrFunction<ColorFieldRenderProps> \| undefined` | Unspecified | Caller input | — |
| `color:ColorField` | `validate` | `((value: import("react-aria-components").Color \| null) => import("@react-types/shared").ValidationError \| true \| null \| undefined) \| undefined` | Unspecified | Caller input | — |
| `color:ColorField` | `validationBehavior` | `"native" \| "aria" \| undefined` | `'native'` | Caller input | — |
| `color:ColorField` | `value` | `string \| import("react-aria-components").Color \| null \| undefined` | Unspecified | Controlled value | — |
| `color:ColorField` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |
| `color:ColorSwatch` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `color:ColorSwatch` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `color:ColorSwatch` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `color:ColorSwatch` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `color:ColorSwatch` | `className` | `ClassNameOrFunction<ColorSwatchRenderProps> \| undefined` | `'react-aria-ColorSwatch'` | Caller input | — |
| `color:ColorSwatch` | `color` | `string \| Color \| undefined` | Unspecified | Caller input | — |
| `color:ColorSwatch` | `colorName` | `string \| undefined` | Unspecified | Caller input | — |
| `color:ColorSwatch` | `id` | `string \| undefined` | Unspecified | Caller input | — |
| `color:ColorSwatch` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `color:ColorSwatch` | `render` | `import("react-aria-components").DOMRenderFunction<"div", ColorSwatchRenderProps> \| undefined` | Unspecified | Caller input | — |
| `color:ColorSwatch` | `slot` | `string \| null \| undefined` | Unspecified | Caller input | — |
| `color:ColorSwatch` | `style` | `import("react-aria-components").StyleOrFunction<ColorSwatchRenderProps> \| undefined` | Unspecified | Caller input | — |
| `color:ColorSwatch` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`color` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

ColorField supplies edit state. A Label and Input expose the text entry. ColorSwatch displays the chosen color and can supply its human-readable name.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Contract | Web | Native | Tracking |
| --- | --- | --- | --- |
| Color text field | ColorField, ColorSwatch | No family binding in the native package | Native implementation and platform-specific verification are open in the [family audit](../component-depth.md). |

**Variants.** Use a field for a whole color or configure a channel. ColorSwatch is a preview and has no editing affordance.

**Tokens.** The optional controls stylesheet applies text color inside the controls scope. Interactive descendants can use its keyboard focus treatment. Custom slot paint remains the consumer’s responsibility.

**Composition.** Place Label and Input inside ColorField. Render ColorSwatch alongside it and pass the last committed value when the preview is outside the field context.

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Default | Render a named color field | Textbox named Accent | Text editing | Yes | [Localized Accent label](../../tests/color-text-field/authoring.test.tsx) |
| Committed | Type a color and blur the field | Owner receives normalized hex serialization | Yes | Yes | [Committed color callback](../../tests/color-text-field/authoring.test.tsx) |

#### Performance

`ColorField` 34,445 B, `ColorSwatch` 19,441 B. Each number is a separate named-import gzip measurement with React and React DOM external. Optional controls CSS is measured separately at 1,457 B gzip. The library root entry does not import this family.

#### Tests

- **Default.** [Localized Accent label](../../tests/color-text-field/authoring.test.tsx).
- **Committed.** [Committed color callback](../../tests/color-text-field/authoring.test.tsx).

The linked cases establish the behaviors above. Dedicated per-state visual comparisons and native simulator tests are open. [Catalog example](../../catalog/Authoring.stories.tsx)

#### Changelog and deprecations

The 0.3.0-rc.1 candidate documents the current web bindings. No family-specific deprecation is declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Color text field.

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
