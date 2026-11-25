---
{
  "family": "Search",
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
      "name": "SearchField",
      "from": "@ui-lazy-dev/ui-web/forms"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/SearchField",
    "https://mui.com/material-ui/react-text-field/"
  ]
}
---

# Search

## Part A — Contract

### Purpose and when not to use it

Edit a search query. Choose Combobox when the task requires selecting a result from suggestions.

### Anatomy

A named editor holds the current query. An optional clear action resets it.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| label | Required | N/A — required | Container gap | Provides the accessible name | Text adds no stop |
| editor | Required | N/A — required | Container gap | Control has its own name | Participates in its logical position |
| clear | Optional | collapse | Container gap | Action has its own name | Takes its place when available |

### Variants

value makes the query owner-controlled. The application owns results and network requests.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Editable | Enter a query | Input text, surface and border | The search field is named | Yes | Yes | Pending: editable scenario |
| Disabled | Disable search | Disabled foreground | Focus stays on the preceding available control | No | No | Pending: disabled scenario |
| Cleared query | Clear the query | Scoped input text | The field becomes empty | Yes | Yes | Pending: cleared query scenario |

### Keyboard, pointer and touch

Type or paste into the edit control. Enter submits a search when handled. Escape can clear a nonempty query.

### Accessibility

The input has searchbox semantics. Name what it searches. Put result counts in a separate status message. Use the field’s localized labels in RTL layouts. Review touch-target geometry, contrast, forced colors and reduced-motion behavior in the consumer theme before promoting this draft.

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

A clear action inside the field clears the query. Use “Search invoices”. Avoid “Enter keyword here”. Localize the whole label and keep it available when constrained text wraps.

## Part B — Bindings

### API

`value` controls the query and `onChange(text)` reports edits. `defaultValue` starts a self-managed query. `isDisabled` disables the underlying search input. `onSubmit(query)` and `onClear()` describe search actions. Running a request, canceling it or selecting a result belongs to the consumer.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `forms:SearchField` | `aria-activedescendant` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:SearchField` | `aria-autocomplete` | `"none" \| "list" \| "inline" \| "both" \| undefined` | Unspecified | Caller input | — |
| `forms:SearchField` | `aria-controls` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:SearchField` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:SearchField` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:SearchField` | `aria-errormessage` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:SearchField` | `aria-haspopup` | `boolean \| "true" \| "false" \| "dialog" \| "grid" \| "listbox" \| "menu" \| "tree" \| undefined` | Unspecified | Caller input | — |
| `forms:SearchField` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:SearchField` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:SearchField` | `autoComplete` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:SearchField` | `autoCorrect` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:SearchField` | `autoFocus` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:SearchField` | `children` | `import("react-aria-components").ChildrenOrFunction<SearchFieldRenderProps>` | Unspecified | Caller content | — |
| `forms:SearchField` | `className` | `ClassNameOrFunction<SearchFieldRenderProps> \| undefined` | `'react-aria-SearchField'` | Caller input | — |
| `forms:SearchField` | `defaultValue` | `string \| undefined` | Unspecified | Uncontrolled initial value | — |
| `forms:SearchField` | `enterKeyHint` | `"enter" \| "done" \| "go" \| "next" \| "previous" \| "search" \| "send" \| undefined` | Unspecified | Caller input | — |
| `forms:SearchField` | `excludeFromTabOrder` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:SearchField` | `form` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:SearchField` | `id` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:SearchField` | `inputMode` | `"none" \| "search" \| "text" \| "tel" \| "url" \| "email" \| "numeric" \| "decimal" \| undefined` | Unspecified | Caller input | — |
| `forms:SearchField` | `isDisabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:SearchField` | `isInvalid` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:SearchField` | `isReadOnly` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:SearchField` | `isRequired` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:SearchField` | `maxLength` | `number \| undefined` | Unspecified | Caller input | — |
| `forms:SearchField` | `minLength` | `number \| undefined` | Unspecified | Caller input | — |
| `forms:SearchField` | `name` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:SearchField` | `onBeforeInput` | `React.FormEventHandler<HTMLInputElement> \| undefined` | Unspecified | Caller callback | — |
| `forms:SearchField` | `onBlur` | `((e: React.FocusEvent<HTMLInputElement, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:SearchField` | `onChange` | `((value: string) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:SearchField` | `onClear` | `(() => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:SearchField` | `onCompositionEnd` | `React.CompositionEventHandler<HTMLInputElement> \| undefined` | Unspecified | Caller callback | — |
| `forms:SearchField` | `onCompositionStart` | `React.CompositionEventHandler<HTMLInputElement> \| undefined` | Unspecified | Caller callback | — |
| `forms:SearchField` | `onCompositionUpdate` | `React.CompositionEventHandler<HTMLInputElement> \| undefined` | Unspecified | Caller callback | — |
| `forms:SearchField` | `onCopy` | `React.ClipboardEventHandler<HTMLInputElement> \| undefined` | Unspecified | Caller callback | — |
| `forms:SearchField` | `onCut` | `React.ClipboardEventHandler<HTMLInputElement> \| undefined` | Unspecified | Caller callback | — |
| `forms:SearchField` | `onFocus` | `((e: React.FocusEvent<HTMLInputElement, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:SearchField` | `onFocusChange` | `((isFocused: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:SearchField` | `onInput` | `React.FormEventHandler<HTMLInputElement> \| undefined` | Unspecified | Caller callback | — |
| `forms:SearchField` | `onKeyDown` | `((e: import("react-aria-components").KeyboardEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:SearchField` | `onKeyUp` | `((e: import("react-aria-components").KeyboardEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:SearchField` | `onPaste` | `React.ClipboardEventHandler<HTMLInputElement> \| undefined` | Unspecified | Caller callback | — |
| `forms:SearchField` | `onSelect` | `React.ReactEventHandler<HTMLInputElement> \| undefined` | Unspecified | Caller callback | — |
| `forms:SearchField` | `onSubmit` | `((value: string) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:SearchField` | `pattern` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:SearchField` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `forms:SearchField` | `render` | `import("react-aria-components").DOMRenderFunction<"div", SearchFieldRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:SearchField` | `slot` | `string \| null \| undefined` | Unspecified | Caller input | — |
| `forms:SearchField` | `spellCheck` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:SearchField` | `style` | `import("react-aria-components").StyleOrFunction<SearchFieldRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:SearchField` | `type` | `(string & {}) \| "search" \| "text" \| "tel" \| "url" \| "email" \| "password" \| undefined` | `'search'` | Caller input | — |
| `forms:SearchField` | `validate` | `((value: string) => import("@react-types/shared").ValidationError \| true \| null \| undefined) \| undefined` | Unspecified | Caller input | — |
| `forms:SearchField` | `validationBehavior` | `"native" \| "aria" \| undefined` | `'native'` | Caller input | — |
| `forms:SearchField` | `value` | `string \| undefined` | Unspecified | Controlled value | — |
| `forms:SearchField` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`forms` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

SearchField owns the query. Name the Input using Label or aria-label. Place an optional clear button inside the search field.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Surface | Web | Native |
| --- | --- | --- |
| Availability | `SearchField` | planned. Track a platform contract and simulator fixture in the [family inventory](../component-inventory.md). |

**Variants.** value makes the query owner-controlled. defaultValue initializes a self-managed field. The application owns results and network requests.

**Tokens.** These mappings apply inside the optional `uld-controls` scope. A headless import does not install the stylesheet.

**Composition.** Use SearchField with a Label and a single Input. A clear action inside the field clears the query. For collection filtering place SearchField inside Autocomplete and put the ListBox beside the field so option markup stays outside the input. [Catalog composition](../../catalog/Controls.stories.tsx)

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Editable | Render Input with a localized field label | Named searchbox | Yes | Yes | [Localized search name](../../tests/advanced.test.tsx#L9) |
| Disabled | Set isDisabled and attempt to focus Input | Searchbox is disabled and focus stays on the preceding editor | No | No | [Disabled search focus](../../tests/form-spec-states.test.tsx#L13) |
| Cleared query | Owner supplies empty string after an unmatched query | Searchbox value returns to the empty string | Yes | Yes | [Cleared named searchbox](../../tests/autocomplete/form-spec-states.test.tsx#L9) |

#### Performance

Named JavaScript exports measured independently from the packed web consumer, gzip level 9, with React and React DOM external: `SearchField` 12,403 B. These optional imports stay out of the web root. Their sizes overlap when used together. [Measurement method](../../scripts/verify-bundles.mjs) The optional scoped `controls.css` entry measures 1,485 B gzip including its theme tokens. Apply `.uld-controls` to a containing element to opt into its treatments.

#### Tests

- **Editable.** [Localized search name](../../tests/advanced.test.tsx#L9).
- **Disabled.** [Disabled search focus](../../tests/form-spec-states.test.tsx#L13).
- **Cleared query.** [Cleared named searchbox](../../tests/autocomplete/form-spec-states.test.tsx#L9).
- Dedicated browser coverage for the full contract remains open.
- Dedicated visual qualification and native simulator coverage remain open.

Dedicated keyboard tests for activating the clear action, Enter submission and composing characters with an input method editor are open.

#### Changelog and deprecations

The `0.3.0-rc.1` draft records the current public contract. Consult the packed declarations for upstream deprecation notices when upgrading React Aria.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Search.

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
