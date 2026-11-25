---
{
  "family": "Text field",
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
      "name": "TextField",
      "from": "@ui-lazy-dev/ui-web/forms"
    },
    {
      "platform": "web",
      "name": "Input",
      "from": "@ui-lazy-dev/ui-web/forms"
    },
    {
      "platform": "web",
      "name": "TextArea",
      "from": "@ui-lazy-dev/ui-web/forms"
    },
    {
      "platform": "web",
      "name": "Label",
      "from": "@ui-lazy-dev/ui-web/forms"
    },
    {
      "platform": "web",
      "name": "FieldError",
      "from": "@ui-lazy-dev/ui-web/forms"
    },
    {
      "platform": "web",
      "name": "Text",
      "from": "@ui-lazy-dev/ui-web/forms"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/TextField",
    "https://mui.com/material-ui/react-text-field/"
  ]
}
---

# Text field

## Part A — Contract

### Purpose and when not to use it

Collect free text with field-level validation. Choose Search to edit a query or Number field for a measured quantity.

### Anatomy

The field joins a visible label, an editor, and optional description and validation error.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| label | Required | N/A — required | Container gap | Provides the accessible name | Text adds no stop |
| editor | Required | N/A — required | Container gap | Control has its own name | Participates in its logical position |
| description | Optional | collapse | Container gap | Provides supporting information | Text adds no stop |
| error | Optional | collapse | Container gap | Provides supporting information | Text adds no stop |

### Variants

Use a single line for names and a multiline editor for paragraphs. The owner of a controlled field decides which edits to accept.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Editable | Focus the editor | Scoped input surface and text | The named editor accepts input | Yes | Yes | Pending: editable scenario |
| Read-only | Set the editor read-only | No dedicated read-only treatment | The current value remains inspectable | No edits | Yes | Pending: read-only scenario |
| Required and invalid | Leave a required field invalid | See Tokens | The requirement and error are exposed | Yes | Yes | Pending: required and invalid scenario |
| Server error | Return a validation error | See Tokens | The editor describes the error | Yes | Yes | Pending: server error scenario |

### Keyboard, pointer and touch

Tab enters the editor. Selection, paste and IME composition use normal text editing. Enter inserts a newline inside a multiline editor.

### Accessibility

The visible label names the textbox. Invalid input references its description or error. Explain how to fix the value in text. Use the field’s localized labels in RTL layouts. Review touch-target geometry, contrast, forced colors and reduced-motion behavior in the consumer theme before promoting this draft.

### State patterns

The owning form reports validation, busy status and recovery. Preserve the field value while displaying a correctable error.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

| Part or state | Token |
| --- | --- |
| Input foreground / light | `light.text` |
| Input surface / light | `light.surface` |
| Input surface / dark | `dark.surface` |
| Field border / light | `light.muted` |
| Field border / dark | `dark.muted` |
| Keyboard outline | `density.focusWidth` |

### Composition and content guidelines

Use “Project name”. Avoid “Enter all appropriate information”. Localize the whole label and keep it available when constrained text wraps.

## Part B — Bindings

### API

`value` and `onChange(text)` make TextField controlled. `defaultValue` initializes a field that manages its own text. `isReadOnly` leaves the named editor focusable, while `isDisabled` disables editing and focus. Required and invalid flags propagate to the active Input or TextArea. Input and TextArea refs resolve to the DOM editors, so callers can focus the actual field after validation.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `forms:TextField` | `aria-activedescendant` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:TextField` | `aria-autocomplete` | `"none" \| "list" \| "inline" \| "both" \| undefined` | Unspecified | Caller input | — |
| `forms:TextField` | `aria-controls` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:TextField` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:TextField` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:TextField` | `aria-errormessage` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:TextField` | `aria-haspopup` | `boolean \| "true" \| "false" \| "dialog" \| "grid" \| "listbox" \| "menu" \| "tree" \| undefined` | Unspecified | Caller input | — |
| `forms:TextField` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:TextField` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:TextField` | `autoComplete` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:TextField` | `autoCorrect` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:TextField` | `autoFocus` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:TextField` | `children` | `import("react-aria-components").ChildrenOrFunction<TextFieldRenderProps>` | Unspecified | Caller content | — |
| `forms:TextField` | `className` | `ClassNameOrFunction<TextFieldRenderProps> \| undefined` | `'react-aria-TextField'` | Caller input | — |
| `forms:TextField` | `defaultValue` | `string \| undefined` | Unspecified | Uncontrolled initial value | — |
| `forms:TextField` | `enterKeyHint` | `"enter" \| "done" \| "go" \| "next" \| "previous" \| "search" \| "send" \| undefined` | Unspecified | Caller input | — |
| `forms:TextField` | `excludeFromTabOrder` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:TextField` | `form` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:TextField` | `id` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:TextField` | `inputMode` | `"none" \| "search" \| "text" \| "tel" \| "url" \| "email" \| "numeric" \| "decimal" \| undefined` | Unspecified | Caller input | — |
| `forms:TextField` | `isDisabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:TextField` | `isInvalid` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:TextField` | `isReadOnly` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:TextField` | `isRequired` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:TextField` | `maxLength` | `number \| undefined` | Unspecified | Caller input | — |
| `forms:TextField` | `minLength` | `number \| undefined` | Unspecified | Caller input | — |
| `forms:TextField` | `name` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:TextField` | `onBeforeInput` | `React.FormEventHandler<HTMLInputElement> \| undefined` | Unspecified | Caller callback | — |
| `forms:TextField` | `onBlur` | `((e: React.FocusEvent<HTMLInputElement, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:TextField` | `onChange` | `((value: string) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:TextField` | `onCompositionEnd` | `React.CompositionEventHandler<HTMLInputElement> \| undefined` | Unspecified | Caller callback | — |
| `forms:TextField` | `onCompositionStart` | `React.CompositionEventHandler<HTMLInputElement> \| undefined` | Unspecified | Caller callback | — |
| `forms:TextField` | `onCompositionUpdate` | `React.CompositionEventHandler<HTMLInputElement> \| undefined` | Unspecified | Caller callback | — |
| `forms:TextField` | `onCopy` | `React.ClipboardEventHandler<HTMLInputElement> \| undefined` | Unspecified | Caller callback | — |
| `forms:TextField` | `onCut` | `React.ClipboardEventHandler<HTMLInputElement> \| undefined` | Unspecified | Caller callback | — |
| `forms:TextField` | `onFocus` | `((e: React.FocusEvent<HTMLInputElement, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:TextField` | `onFocusChange` | `((isFocused: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:TextField` | `onInput` | `React.FormEventHandler<HTMLInputElement> \| undefined` | Unspecified | Caller callback | — |
| `forms:TextField` | `onKeyDown` | `((e: import("react-aria-components").KeyboardEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:TextField` | `onKeyUp` | `((e: import("react-aria-components").KeyboardEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:TextField` | `onPaste` | `React.ClipboardEventHandler<HTMLInputElement> \| undefined` | Unspecified | Caller callback | — |
| `forms:TextField` | `onSelect` | `React.ReactEventHandler<HTMLInputElement> \| undefined` | Unspecified | Caller callback | — |
| `forms:TextField` | `pattern` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:TextField` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `forms:TextField` | `render` | `import("react-aria-components").DOMRenderFunction<"div", TextFieldRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:TextField` | `slot` | `string \| null \| undefined` | Unspecified | Caller input | — |
| `forms:TextField` | `spellCheck` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:TextField` | `style` | `import("react-aria-components").StyleOrFunction<TextFieldRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:TextField` | `type` | `(string & {}) \| "search" \| "text" \| "tel" \| "url" \| "email" \| "password" \| undefined` | `'text'` | Caller input | — |
| `forms:TextField` | `validate` | `((value: string) => import("@react-types/shared").ValidationError \| true \| null \| undefined) \| undefined` | Unspecified | Caller input | — |
| `forms:TextField` | `validationBehavior` | `"native" \| "aria" \| undefined` | `'native'` | Caller input | — |
| `forms:TextField` | `value` | `string \| undefined` | Unspecified | Controlled value | — |
| `forms:TextField` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |
| `forms:Input` | `children` | `React.ReactNode` | Unspecified | Caller content | — |
| `forms:Input` | `className` | `ClassNameOrFunction<InputRenderProps> \| undefined` | `'react-aria-Input'` | Caller input | — |
| `forms:Input` | `onHoverChange` | `((isHovering: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Input` | `onHoverEnd` | `((e: import("react-aria-components").HoverEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Input` | `onHoverStart` | `((e: import("react-aria-components").HoverEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Input` | `placeholder` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Input` | `ref` | `React.Ref<HTMLInputElement> \| undefined` | Unspecified | Caller reference | `HTMLInputElement` |
| `forms:Input` | `render` | `import("react-aria-components").DOMRenderFunction<"input", InputRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:Input` | `style` | `import("react-aria-components").StyleOrFunction<InputRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:Input` | Host attributes | 305 standard platform attributes, not listed | Unspecified | Caller input | — |
| `forms:TextArea` | `children` | `React.ReactNode` | Unspecified | Caller content | — |
| `forms:TextArea` | `className` | `ClassNameOrFunction<InputRenderProps> \| undefined` | `'react-aria-TextArea'` | Caller input | — |
| `forms:TextArea` | `onHoverChange` | `((isHovering: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:TextArea` | `onHoverEnd` | `((e: import("react-aria-components").HoverEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:TextArea` | `onHoverStart` | `((e: import("react-aria-components").HoverEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:TextArea` | `ref` | `React.Ref<HTMLTextAreaElement> \| undefined` | Unspecified | Caller reference | `HTMLTextAreaElement` |
| `forms:TextArea` | `render` | `import("react-aria-components").DOMRenderFunction<"textarea", InputRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:TextArea` | `style` | `import("react-aria-components").StyleOrFunction<InputRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:TextArea` | Host attributes | 290 standard platform attributes, not listed | Unspecified | Caller input | — |
| `forms:Label` | `children` | `React.ReactNode` | Unspecified | Caller content | — |
| `forms:Label` | `className` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Label` | `elementType` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Label` | `ref` | `React.Ref<HTMLLabelElement> \| undefined` | Unspecified | Caller reference | `HTMLLabelElement` |
| `forms:Label` | `render` | `import("react-aria-components").DOMRenderFunction<"label", undefined> \| undefined` | Unspecified | Caller input | — |
| `forms:Label` | `style` | `React.CSSProperties \| undefined` | Unspecified | Caller input | — |
| `forms:Label` | Host attributes | 278 standard platform attributes, not listed | Unspecified | Caller input | — |
| `forms:FieldError` | `children` | `import("react-aria-components").ChildrenOrFunction<FieldErrorRenderProps>` | Unspecified | Caller content | — |
| `forms:FieldError` | `className` | `ClassNameOrFunction<FieldErrorRenderProps> \| undefined` | `'react-aria-FieldError'` | Caller input | — |
| `forms:FieldError` | `elementType` | `string \| undefined` | `'span'` | Caller input | — |
| `forms:FieldError` | `id` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:FieldError` | `ref` | `React.Ref<HTMLElement> \| undefined` | Unspecified | Caller reference | `HTMLElement` |
| `forms:FieldError` | `render` | `import("react-aria-components").DOMRenderFunction<"div", FieldErrorRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:FieldError` | `style` | `import("react-aria-components").StyleOrFunction<FieldErrorRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:FieldError` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |
| `forms:Text` | `children` | `React.ReactNode` | Unspecified | Caller content | — |
| `forms:Text` | `className` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Text` | `elementType` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Text` | `ref` | `React.Ref<HTMLElement> \| undefined` | Unspecified | Caller reference | `HTMLElement` |
| `forms:Text` | `render` | `import("react-aria-components").DOMRenderFunction<any, any> \| undefined` | Unspecified | Caller input | — |
| `forms:Text` | `style` | `React.CSSProperties \| undefined` | Unspecified | Caller input | — |
| `forms:Text` | Host attributes | 276 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`forms` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

TextField connects Label, Input or TextArea, description Text and FieldError. Compose the editor and label inside the same field.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Surface | Web | Native |
| --- | --- | --- |
| Availability | `TextField`, `Input`, `TextArea`, `Label`, `FieldError`, `Text` | planned. Track a platform contract and simulator fixture in the [family inventory](../component-inventory.md). |

**Variants.** Use a single line for names and TextArea for paragraphs. With a controlled value the owner must accept each edit through onChange.

**Tokens.** These mappings apply inside the optional `uld-controls` scope. A headless import does not install the stylesheet.

**Composition.** Use one Label and one Input or TextArea per TextField. A `Text` child in the `description` slot supplies persistent guidance, while FieldError supplies the validation message. Use the field’s `name` as the key for a parent Form’s server errors.

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Editable | Mount Input inside a named TextField | Textbox resolves its input ref | Yes | Yes | [Interactive input ref](../../tests/family-contracts.test.tsx#L18) |
| Read-only | Set isReadOnly and focus the textbox | Input remains focusable and exposes readonly | No edits | Yes | [Read-only versus disabled focus](../../tests/form-spec-states.test.tsx#L13) |
| Required and invalid | Set both flags with ARIA validation | TextArea exposes aria-required and aria-invalid | Yes | Yes | [Required invalid multiline field](../../tests/form-spec-states.test.tsx#L13) |
| Server error | Provide a validationErrors entry matching name | aria-describedby includes the server error | Yes | Yes | [Associated server error](../../tests/depth-controls.test.tsx#L15) |

#### Performance

Named JavaScript exports measured independently from the packed web consumer, gzip level 9, with React and React DOM external: `TextField` 9,719 B, `Input` 5,600 B, `TextArea` 5,416 B, `Label` 1,736 B, `FieldError` 2,544 B, `Text` 1,738 B. These optional imports stay out of the web root. Their sizes overlap when used together. [Measurement method](../../scripts/verify-bundles.mjs) The optional scoped `controls.css` entry measures 1,485 B gzip including its theme tokens. Apply `.uld-controls` to a containing element to opt into its treatments.

#### Tests

- **Editable.** [Interactive input ref](../../tests/family-contracts.test.tsx#L18).
- **Read-only.** [Read-only versus disabled focus](../../tests/form-spec-states.test.tsx#L13).
- **Required and invalid.** [Required invalid multiline field](../../tests/form-spec-states.test.tsx#L13).
- **Server error.** [Associated server error](../../tests/depth-controls.test.tsx#L15).
- Dedicated browser coverage for the full contract remains open.
- Dedicated visual qualification and native simulator coverage remain open.

Multiline editing with an input method editor and screen-reader narration of newly inserted errors need browser and assistive-technology qualification.

#### Changelog and deprecations

The `0.3.0-rc.1` draft records the current public contract. Consult the packed declarations for upstream deprecation notices when upgrading React Aria.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Text field.

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
