---
{
  "family": "Listbox",
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
      "name": "ListBox",
      "from": "@ui-lazy-dev/ui-web/forms"
    },
    {
      "platform": "web",
      "name": "ListBoxItem",
      "from": "@ui-lazy-dev/ui-web/forms"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/ListBox",
    "https://mui.com/material-ui/react-select/"
  ]
}
---

# Listbox

## Part A — Contract

### Purpose and when not to use it

Select from a visible collection. Choose Menu for commands or Select for choices that begin collapsed.

### Anatomy

Named choices form a collection with a selection owner. Each option retains a stable identity.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| options | Required | N/A — required | Container gap | Children retain their semantics | Operable children keep their order |

### Variants

Choose single or multiple selection according to the task; describe the selection policy when it is not evident.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Available | Open the collection | See Tokens | Named options are reachable within the list | Yes in selection mode | Through list focus | Pending: available scenario |
| Disabled option | Disable an option | Disabled foreground | It cannot become selected | No | Depends on whether the collection allows inspection of disabled choices | Pending: disabled option scenario |
| Empty results | Filter out all options | Caller-supplied empty content | An empty message describes the result | No option to select | Search input remains available | Pending: empty results scenario |

### Keyboard, pointer and touch

Arrows navigate, Home and End jump, and typeahead locates an option. The entire option is the pointer target.

### Accessibility

Give the listbox a name. Use the field’s localized labels in RTL layouts. Review touch-target geometry, contrast, forced colors and reduced-motion behavior in the consumer theme before promoting this draft.

### State patterns

An empty collection can expose an explanatory message in place of the options.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

| Part or state | Token |
| --- | --- |
| Inherited text / light | `light.text` |
| Inherited text / dark | `dark.text` |

### Composition and content guidelines

Use “Language options”. Avoid “List”. Localize the whole label and keep it available when constrained text wraps.

## Part B — Bindings

### API

A list’s `selectionMode` determines whether selection is available. `selectedKeys` controls selection and `defaultSelectedKeys` initializes local selection. Use stable item keys. With `disabledKeys`, an unavailable item is exposed to accessibility and suppressed by the selection handler. A child action can have different semantics from selection.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `forms:ListBox` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:ListBox` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:ListBox` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:ListBox` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:ListBox` | `autoFocus` | `boolean \| import("@react-types/shared").FocusStrategy \| undefined` | Unspecified | Caller input | — |
| `forms:ListBox` | `children` | `React.ReactNode \| ((item: T) => ReactNode)` | Unspecified | Caller content | — |
| `forms:ListBox` | `className` | `ClassNameOrFunction<ListBoxRenderProps> \| undefined` | `'react-aria-ListBox'` | Caller input | — |
| `forms:ListBox` | `defaultSelectedKeys` | `"all" \| Iterable<Key> \| undefined` | Unspecified | Uncontrolled initial value | — |
| `forms:ListBox` | `dependencies` | `readonly any[] \| undefined` | Unspecified | Caller input | — |
| `forms:ListBox` | `disabledKeys` | `Iterable<Key> \| undefined` | Unspecified | Caller input | — |
| `forms:ListBox` | `disallowEmptySelection` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:ListBox` | `dragAndDropHooks` | `DragAndDropHooks<NoInfer<T>> \| undefined` | Unspecified | Caller input | — |
| `forms:ListBox` | `escapeKeyBehavior` | `"none" \| "clearSelection" \| undefined` | `'clearSelection'` | Caller input | — |
| `forms:ListBox` | `id` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:ListBox` | `items` | `Iterable<T> \| undefined` | Unspecified | Caller input | — |
| `forms:ListBox` | `layout` | `"grid" \| "stack" \| undefined` | `'stack'` | Caller input | — |
| `forms:ListBox` | `onAction` | `((key: Key) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ListBox` | `onBlur` | `((e: React.FocusEvent<Element, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ListBox` | `onFocus` | `((e: React.FocusEvent<Element, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ListBox` | `onFocusChange` | `((isFocused: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ListBox` | `onSelectionChange` | `((keys: import("react-aria-components").Selection) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ListBox` | `orientation` | `Orientation \| undefined` | `'vertical'` | Caller input | — |
| `forms:ListBox` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `forms:ListBox` | `render` | `import("react-aria-components").DOMRenderFunction<"div", ListBoxRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:ListBox` | `renderEmptyState` | `((props: ListBoxRenderProps) => ReactNode) \| undefined` | Unspecified | Caller input | — |
| `forms:ListBox` | `selectedKeys` | `"all" \| Iterable<Key> \| undefined` | Unspecified | Controlled value | — |
| `forms:ListBox` | `selectionBehavior` | `SelectionBehavior \| undefined` | `'toggle'` | Caller input | — |
| `forms:ListBox` | `selectionMode` | `import("react-aria-components").SelectionMode \| undefined` | Unspecified | Caller input | — |
| `forms:ListBox` | `shouldFocusOnHover` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:ListBox` | `shouldFocusWrap` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:ListBox` | `shouldSelectOnPressUp` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:ListBox` | `slot` | `string \| null \| undefined` | Unspecified | Caller input | — |
| `forms:ListBox` | `style` | `import("react-aria-components").StyleOrFunction<ListBoxRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:ListBox` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |
| `forms:ListBoxItem` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:ListBoxItem` | `children` | `import("react-aria-components").ChildrenOrFunction<ListBoxItemRenderProps>` | Unspecified | Caller content | — |
| `forms:ListBoxItem` | `className` | `ClassNameOrFunction<ListBoxItemRenderProps> \| undefined` | `'react-aria-ListBoxItem'` | Caller input | — |
| `forms:ListBoxItem` | `download` | `string \| boolean \| undefined` | Unspecified | Caller input | — |
| `forms:ListBoxItem` | `href` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:ListBoxItem` | `hrefLang` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:ListBoxItem` | `id` | `Key \| undefined` | Unspecified | Caller input | — |
| `forms:ListBoxItem` | `isDisabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:ListBoxItem` | `onAction` | `(() => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ListBoxItem` | `onBlur` | `((e: React.FocusEvent<HTMLDivElement, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ListBoxItem` | `onClick` | `((e: React.MouseEvent<import("react-aria-components").FocusableElement>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ListBoxItem` | `onFocus` | `((e: React.FocusEvent<HTMLDivElement, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ListBoxItem` | `onFocusChange` | `((isFocused: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ListBoxItem` | `onHoverChange` | `((isHovering: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ListBoxItem` | `onHoverEnd` | `((e: import("react-aria-components").HoverEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ListBoxItem` | `onHoverStart` | `((e: import("react-aria-components").HoverEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ListBoxItem` | `onKeyDown` | `((e: import("react-aria-components").KeyboardEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ListBoxItem` | `onKeyUp` | `((e: import("react-aria-components").KeyboardEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ListBoxItem` | `onPress` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ListBoxItem` | `onPressChange` | `((isPressed: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ListBoxItem` | `onPressEnd` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ListBoxItem` | `onPressStart` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ListBoxItem` | `onPressUp` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ListBoxItem` | `ping` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:ListBoxItem` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `forms:ListBoxItem` | `referrerPolicy` | `React.HTMLAttributeReferrerPolicy \| undefined` | Unspecified | Caller input | — |
| `forms:ListBoxItem` | `rel` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:ListBoxItem` | `render` | `((props: React.DetailedHTMLProps<Required<Pick<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">> & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">, HTMLAnchorElement> \| React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, renderProps: ListBoxItemRenderProps) => React.ReactElement) \| undefined` | Unspecified | Caller input | — |
| `forms:ListBoxItem` | `routerOptions` | `undefined` | Unspecified | Caller input | — |
| `forms:ListBoxItem` | `style` | `import("react-aria-components").StyleOrFunction<ListBoxItemRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:ListBoxItem` | `target` | `React.HTMLAttributeAnchorTarget \| undefined` | Unspecified | Caller input | — |
| `forms:ListBoxItem` | `textValue` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:ListBoxItem` | `value` | `T \| undefined` | Unspecified | Caller input | — |
| `forms:ListBoxItem` | Host attributes | 70 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`forms` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

ListBox owns the collection. Each ListBoxItem needs a stable key and textValue when the label is rich. Compose selection separately from actions.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Surface | Web | Native |
| --- | --- | --- |
| Availability | `ListBox`, `ListBoxItem` | planned. Track a platform contract and simulator fixture in the [family inventory](../component-inventory.md). |

**Accessibility.** Give the listbox a name. Use selected state on options and preserve their readable labels even with a custom render function. Use the field’s localized labels in RTL layouts. Review touch-target geometry, contrast, forced colors and reduced-motion behavior in the consumer theme before promoting this draft.

**Tokens.** These mappings apply inside the optional `uld-controls` scope. A headless import does not install the stylesheet.

**Composition.** Render a ListBoxItem per choice. Supply an id for each option and `textValue` when the visible children contain complex content. Compose under Select or ComboBox to inherit that field’s active collection. Let renderEmptyState supply a meaningful empty-result message. [Catalog composition](../../catalog/EnterpriseNavigation.stories.tsx)

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Available | Render keyed options with no filter | Named listbox contains options | Yes in selection mode | Through list focus | [Available query results](../../tests/depth-controls.test.tsx#L37) |
| Disabled option | Include its key in disabledKeys and click it | Option exposes aria-disabled and selection callback is silent | No | Depends on disabledBehavior | [Disabled collection key](../../tests/form-spec-states.test.tsx#L109) |
| Empty results | Filter all keyed items from the collection | Empty message replaces matching options | No option to select | Search input remains available | [No matching option](../../tests/autocomplete/form-spec-states.test.tsx#L9) |

#### Performance

Named JavaScript exports measured independently from the packed web consumer, gzip level 9, with React and React DOM external: `ListBox` 29,386 B, `ListBoxItem` 17,155 B. These optional imports stay out of the web root. Their sizes overlap when used together. [Measurement method](../../scripts/verify-bundles.mjs) The optional scoped `controls.css` entry measures 1,485 B gzip including its theme tokens. Apply `.uld-controls` to a containing element to opt into its treatments.

#### Tests

- **Available.** [Available query results](../../tests/depth-controls.test.tsx#L37).
- **Disabled option.** [Disabled collection key](../../tests/form-spec-states.test.tsx#L109).
- **Empty results.** [No matching option](../../tests/autocomplete/form-spec-states.test.tsx#L9).
- Dedicated visual qualification and native simulator coverage remain open.

Direct keyboard typeahead, multi-selection range extension and disabledBehavior variants need dedicated browser coverage.

#### Changelog and deprecations

The `0.3.0-rc.1` draft records the current public contract. Consult the packed declarations for upstream deprecation notices when upgrading React Aria.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Listbox.

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
