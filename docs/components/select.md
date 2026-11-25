---
{
  "family": "Select",
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
      "name": "Select",
      "from": "@ui-lazy-dev/ui-web/forms"
    },
    {
      "platform": "web",
      "name": "SelectValue",
      "from": "@ui-lazy-dev/ui-web/forms"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/Select",
    "https://mui.com/material-ui/react-select/"
  ]
}
---

# Select

## Part A — Contract

### Purpose and when not to use it

Pick a constrained value from a compact trigger. Choose Combobox for editable search among choices.

### Anatomy

A named opener displays the selected value. Opening the list allows the user to choose a new value.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| label | Required | N/A — required | Container gap | Provides the accessible name | Text adds no stop |
| opener | Required | N/A — required | Container gap | Action has its own name | Takes its place when available |
| choices | Required | N/A — required | Container gap | Children retain their semantics | Operable children keep their order |

### Variants

Provide an initial selection or control it from the owner. Placeholder content represents an empty selection.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Open | Open the choices | See Tokens | Options become available | Yes | Through popup options | Pending: open scenario |
| Selected and closed | Choose a value | See Tokens | The opener displays the selection | Yes | Trigger remains available | Pending: selected and closed scenario |
| Disabled and closed | Disable the closed chooser | Disabled foreground | It remains unavailable and collapsed | No | No | Pending: disabled and closed scenario |

### Keyboard, pointer and touch

Open by pressing Enter or Space on the trigger or by tapping it. Accept the active option or dismiss the popup with Escape.

### Accessibility

The visible field label names the trigger. Keep selected option text available after closing the popup. Use the field’s localized labels in RTL layouts. Review touch-target geometry, contrast, forced colors and reduced-motion behavior in the consumer theme before promoting this draft.

### State patterns

The owning form reports validation, busy status and recovery. Preserve the field value while displaying a correctable error.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

| Part or state | Token |
| --- | --- |
| Inherited text / light | `light.text` |
| Inherited text / dark | `dark.text` |

### Composition and content guidelines

The chosen item’s display text belongs in the trigger so the selected value is visible after dismissal. Use “Language”. Avoid “Choose an item please”. Localize the whole label and keep it available when constrained text wraps.

## Part B — Bindings

### API

`value` and `onChange` manage selection according to the declared selection mode. `defaultValue` starts an uncontrolled selection. Popup state can be controlled independently with `isOpen` and `onOpenChange(boolean)`. SelectValue reads the committed selection for the trigger. `isDisabled` on Select disables its trigger.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `forms:Select` | `allowsEmptyCollection` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:Select` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Select` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Select` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Select` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Select` | `autoComplete` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Select` | `autoFocus` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:Select` | `children` | `import("react-aria-components").ChildrenOrFunction<SelectRenderProps>` | Unspecified | Caller content | — |
| `forms:Select` | `className` | `ClassNameOrFunction<SelectRenderProps> \| undefined` | `'react-aria-Select'` | Caller input | — |
| `forms:Select` | `defaultOpen` | `boolean \| undefined` | Unspecified | Uncontrolled initial value | — |
| `forms:Select` | `defaultSelectedKey` | `import("react-aria-components").Key \| null \| undefined` | Unspecified | Uncontrolled initial value | — |
| `forms:Select` | `defaultValue` | `import("react-stately/useSelectState").ValueType<M> \| undefined` | Unspecified | Uncontrolled initial value | — |
| `forms:Select` | `disabledKeys` | `Iterable<import("react-aria-components").Key> \| undefined` | Unspecified | Caller input | — |
| `forms:Select` | `excludeFromTabOrder` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:Select` | `form` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Select` | `id` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Select` | `isDisabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:Select` | `isInvalid` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:Select` | `isOpen` | `boolean \| undefined` | Unspecified | Controlled value | — |
| `forms:Select` | `isRequired` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:Select` | `name` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Select` | `onBlur` | `((e: React.FocusEvent<Element, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Select` | `onChange` | `((value: import("react-stately/useSelectState").ChangeValueType<M>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Select` | `onFocus` | `((e: React.FocusEvent<Element, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Select` | `onFocusChange` | `((isFocused: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Select` | `onKeyDown` | `((e: import("react-aria-components").KeyboardEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Select` | `onKeyUp` | `((e: import("react-aria-components").KeyboardEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Select` | `onOpenChange` | `((isOpen: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Select` | `onSelectionChange` | `((key: import("react-aria-components").Key \| null) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Select` | `placeholder` | `string \| undefined` | `'Select an item' (localized)` | Caller input | — |
| `forms:Select` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `forms:Select` | `render` | `import("react-aria-components").DOMRenderFunction<"div", SelectRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:Select` | `selectedKey` | `import("react-aria-components").Key \| null \| undefined` | Unspecified | Controlled value | — |
| `forms:Select` | `selectionMode` | `M \| undefined` | `'single'` | Caller input | — |
| `forms:Select` | `shouldCloseOnSelect` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:Select` | `slot` | `string \| null \| undefined` | Unspecified | Caller input | — |
| `forms:Select` | `style` | `import("react-aria-components").StyleOrFunction<SelectRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:Select` | `validate` | `((value: M extends "single" ? import("react-aria-components").Key : import("react-aria-components").Key[]) => import("@react-types/shared").ValidationError \| true \| null \| undefined) \| undefined` | Unspecified | Caller input | — |
| `forms:Select` | `validationBehavior` | `"native" \| "aria" \| undefined` | `'native'` | Caller input | — |
| `forms:Select` | `value` | `import("react-stately/useSelectState").ValueType<M> \| undefined` | Unspecified | Controlled value | — |
| `forms:Select` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |
| `forms:SelectValue` | `children` | `import("react-aria-components").ChildrenOrFunction<SelectValueRenderProps<T>>` | Unspecified | Caller content | — |
| `forms:SelectValue` | `className` | `ClassNameOrFunction<SelectValueRenderProps<T>> \| undefined` | `'react-aria-SelectValue'` | Caller input | — |
| `forms:SelectValue` | `ref` | `React.Ref<HTMLSpanElement> \| undefined` | Unspecified | Caller reference | `HTMLSpanElement` |
| `forms:SelectValue` | `render` | `import("react-aria-components").DOMRenderFunction<"span", SelectValueRenderProps<T>> \| undefined` | Unspecified | Caller input | — |
| `forms:SelectValue` | `style` | `import("react-aria-components").StyleOrFunction<SelectValueRenderProps<T>> \| undefined` | Unspecified | Caller input | — |
| `forms:SelectValue` | Host attributes | 276 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`forms` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

Compose Label, a Trigger with SelectValue, Popover and a ListBox of keyed options inside Select.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Surface | Web | Native |
| --- | --- | --- |
| Availability | `Select`, `SelectValue` | planned. Track a platform contract and simulator fixture in the [family inventory](../component-inventory.md). |

**Tokens.** These mappings apply inside the optional `uld-controls` scope. A headless import does not install the stylesheet.

**Composition.** Pair Label with a Trigger containing SelectValue. Put the ListBox in the Popover and use a stable id on each ListBoxItem. The chosen item’s display text belongs in the trigger so the selected value is visible after dismissal. [Catalog composition](../../catalog/EnterpriseNavigation.stories.tsx)

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Open | Click the named language trigger | Options become available to the user | Yes | Through popup options | [Open language options](../../tests/browser/enterprise-navigation.spec.ts#L18) |
| Selected and closed | Choose French from the open list | Trigger now displays French | Yes | Trigger remains available | [Pointer selection](../../tests/browser/enterprise-navigation.spec.ts#L18) |
| Disabled and closed | Set isDisabled before opening | Trigger is disabled with aria-expanded false | No | No | [Disabled select trigger](../../tests/form-spec-states.test.tsx#L109) |

#### Performance

Named JavaScript exports measured independently from the packed web consumer, gzip level 9, with React and React DOM external: `Select` 31,450 B, `SelectValue` 6,873 B. These optional imports stay out of the web root. Their sizes overlap when used together. [Measurement method](../../scripts/verify-bundles.mjs) The optional scoped `controls.css` entry measures 1,485 B gzip including its theme tokens. Apply `.uld-controls` to a containing element to opt into its treatments.

#### Tests

- **Open.** [Open language options](../../tests/browser/enterprise-navigation.spec.ts#L18).
- **Selected and closed.** [Pointer selection](../../tests/browser/enterprise-navigation.spec.ts#L18).
- **Disabled and closed.** [Disabled select trigger](../../tests/form-spec-states.test.tsx#L109).
- Dedicated visual qualification and native simulator coverage remain open.

Keyboard-only opening, Escape dismissal, focus restoration, and multiple selection need dedicated qualification.

#### Changelog and deprecations

The `0.3.0-rc.1` draft records the current public contract. Consult the packed declarations for upstream deprecation notices when upgrading React Aria.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Select.

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
