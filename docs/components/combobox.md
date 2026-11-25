---
{
  "family": "Combobox",
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
      "name": "ComboBox",
      "from": "@ui-lazy-dev/ui-web/forms"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/ComboBox",
    "https://mui.com/material-ui/react-autocomplete/"
  ]
}
---

# Combobox

## Part A — Contract

### Purpose and when not to use it

Type to find or select a suggestion. Choose Select for a short list requiring no typing.

### Anatomy

The editable field controls its associated suggestions. An optional opener exposes the list.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| label | Required | N/A — required | Container gap | Provides the accessible name | Text adds no stop |
| editor | Required | N/A — required | Container gap | Control has its own name | Participates in its logical position |
| opener | Optional | collapse | Container gap | Action has its own name | Takes its place when available |
| suggestions | Required | N/A — required | Container gap | Children retain their semantics | Operable children keep their order |

### Variants

Input text and selection have separate state. Decide whether the task accepts a custom value or only a listed key.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Committed choice | Choose a suggestion | Input surface and text | The field displays the selected value | Yes | Yes | Pending: committed choice scenario |
| Read-only query | Attempt to edit a read-only field | Input remains visible | The displayed selection remains unchanged | No text edits | Yes | Pending: read-only query scenario |

### Keyboard, pointer and touch

Type to filter, use arrows to inspect options, Enter to choose and Escape to dismiss. Preserve text editing and IME composition.

### Accessibility

Name the input. Expose the active option and popup expansion without taking text editing focus from the user. Use the field’s localized labels in RTL layouts. Review touch-target geometry, contrast, forced colors and reduced-motion behavior in the consumer theme before promoting this draft.

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

When accepting server results, preserve the label for the committed choice independently of the currently visible results. Use “Audience”. Avoid “Choose or type something”. Localize the whole label and keep it available when constrained text wraps.

## Part B — Bindings

### API

Text, selection and popup state are separate. Use `inputValue` and `onInputChange(text)` to control the editable query. Use `value`/`onChange` for the selected choice or `defaultValue` for its initial value. `isReadOnly` reaches the input and preserves its current text.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `forms:ComboBox` | `allowsCustomValue` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:ComboBox` | `allowsEmptyCollection` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:ComboBox` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:ComboBox` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:ComboBox` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:ComboBox` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:ComboBox` | `autoFocus` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:ComboBox` | `children` | `import("react-aria-components").ChildrenOrFunction<ComboBoxRenderProps>` | Unspecified | Caller content | — |
| `forms:ComboBox` | `className` | `ClassNameOrFunction<ComboBoxRenderProps> \| undefined` | `'react-aria-ComboBox'` | Caller input | — |
| `forms:ComboBox` | `defaultFilter` | `((textValue: string, inputValue: string) => boolean) \| undefined` | Unspecified | Uncontrolled initial value | — |
| `forms:ComboBox` | `defaultInputValue` | `string \| undefined` | Unspecified | Uncontrolled initial value | — |
| `forms:ComboBox` | `defaultItems` | `Iterable<T> \| undefined` | Unspecified | Uncontrolled initial value | — |
| `forms:ComboBox` | `defaultSelectedKey` | `import("react-aria-components").Key \| null \| undefined` | Unspecified | Uncontrolled initial value | — |
| `forms:ComboBox` | `defaultValue` | `import("react-stately/dist/types/src/combobox/useComboBoxState.js").ValueType<M> \| undefined` | Unspecified | Uncontrolled initial value | — |
| `forms:ComboBox` | `disabledKeys` | `Iterable<import("react-aria-components").Key> \| undefined` | Unspecified | Caller input | — |
| `forms:ComboBox` | `form` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:ComboBox` | `formValue` | `"text" \| "key" \| undefined` | `'key'` | Caller input | — |
| `forms:ComboBox` | `id` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:ComboBox` | `inputValue` | `string \| undefined` | Unspecified | Controlled value | — |
| `forms:ComboBox` | `isDisabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:ComboBox` | `isInvalid` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:ComboBox` | `isReadOnly` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:ComboBox` | `isRequired` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:ComboBox` | `items` | `Iterable<T> \| undefined` | Unspecified | Controlled value | — |
| `forms:ComboBox` | `menuTrigger` | `import("react-stately/useComboBoxState").MenuTriggerAction \| undefined` | `'input'` | Caller input | — |
| `forms:ComboBox` | `name` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:ComboBox` | `onBlur` | `((e: React.FocusEvent<HTMLInputElement, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ComboBox` | `onChange` | `((value: import("react-stately/dist/types/src/combobox/useComboBoxState.js").ChangeValueType<M>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ComboBox` | `onFocus` | `((e: React.FocusEvent<HTMLInputElement, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ComboBox` | `onFocusChange` | `((isFocused: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ComboBox` | `onInputChange` | `((value: string) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ComboBox` | `onKeyDown` | `((e: import("react-aria-components").KeyboardEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ComboBox` | `onKeyUp` | `((e: import("react-aria-components").KeyboardEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ComboBox` | `onOpenChange` | `((isOpen: boolean, menuTrigger?: import("react-stately/useComboBoxState").MenuTriggerAction) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ComboBox` | `onSelectionChange` | `((key: import("react-aria-components").Key \| null) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ComboBox` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `forms:ComboBox` | `render` | `import("react-aria-components").DOMRenderFunction<"div", ComboBoxRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:ComboBox` | `selectedKey` | `import("react-aria-components").Key \| null \| undefined` | Unspecified | Controlled value | — |
| `forms:ComboBox` | `selectionMode` | `M \| undefined` | `'single'` | Caller input | — |
| `forms:ComboBox` | `shouldFocusWrap` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:ComboBox` | `slot` | `string \| null \| undefined` | Unspecified | Caller input | — |
| `forms:ComboBox` | `style` | `import("react-aria-components").StyleOrFunction<ComboBoxRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:ComboBox` | `validate` | `((value: import("react-stately/useComboBoxState").ComboBoxValidationValue<M>) => import("@react-types/shared").ValidationError \| true \| null \| undefined) \| undefined` | Unspecified | Caller input | — |
| `forms:ComboBox` | `validationBehavior` | `"native" \| "aria" \| undefined` | `'native'` | Caller input | — |
| `forms:ComboBox` | `value` | `import("react-stately/dist/types/src/combobox/useComboBoxState.js").ValueType<M> \| undefined` | Unspecified | Controlled value | — |
| `forms:ComboBox` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`forms` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

ComboBox connects the field label, editable Input, optional Trigger and keyed ListBox. The application supplies items.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Surface | Web | Native |
| --- | --- | --- |
| Availability | `ComboBox` | planned. Track a platform contract and simulator fixture in the [family inventory](../component-inventory.md). |

**Tokens.** These mappings apply inside the optional `uld-controls` scope. A headless import does not install the stylesheet.

**Composition.** Compose Label, Input, optional Trigger, Popover and ListBox inside ComboBox. Give each ListBoxItem a stable id and a typeahead-friendly textValue. When accepting server results, preserve the label for the committed choice independently of the currently visible results. [Catalog composition](../../catalog/Authoring.stories.tsx)

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Committed choice | Initialize selected key to east | Named combobox displays East | Yes | Yes | [Committed choice label](../../tests/depth-controls.test.tsx#L37) |
| Read-only query | Set isReadOnly with defaultInputValue | Combobox input is read-only and preserves Paris | No text edits | Yes | [Read-only combobox input](../../tests/form-spec-states.test.tsx#L109) |

#### Performance

Named JavaScript exports measured independently from the packed web consumer, gzip level 9, with React and React DOM external: `ComboBox` 44,778 B. These optional imports stay out of the web root. Their sizes overlap when used together. [Measurement method](../../scripts/verify-bundles.mjs) The optional scoped `controls.css` entry measures 1,485 B gzip including its theme tokens. Apply `.uld-controls` to a containing element to opt into its treatments.

#### Tests

- **Committed choice.** [Committed choice label](../../tests/depth-controls.test.tsx#L37).
- **Read-only query.** [Read-only combobox input](../../tests/form-spec-states.test.tsx#L109).
- Dedicated browser coverage for the full contract remains open.
- Dedicated visual qualification and native simulator coverage remain open.

Keyboard acceptance, Escape restoration after free typing, stale remote responses and input-method composition need dedicated coverage.

#### Changelog and deprecations

The `0.3.0-rc.1` draft records the current public contract. Consult the packed declarations for upstream deprecation notices when upgrading React Aria.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Combobox.

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
