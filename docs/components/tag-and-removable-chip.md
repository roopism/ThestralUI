---
{
  "family": "Tag and removable chip",
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
      "name": "TagGroup",
      "from": "@ui-lazy-dev/ui-web/forms"
    },
    {
      "platform": "web",
      "name": "Tag",
      "from": "@ui-lazy-dev/ui-web/forms"
    },
    {
      "platform": "web",
      "name": "TagList",
      "from": "@ui-lazy-dev/ui-web/forms"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/TagGroup",
    "https://mui.com/material-ui/react-chip/"
  ]
}
---

# Tag and removable chip

## Part A — Contract

### Purpose and when not to use it

Show a collection of discrete applied values that users can remove. Use Badge for a passive count and a group of checkboxes for independent form choices.

### Anatomy

Each tag identifies a value. An optional removal action names the value it affects.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| tags | Required | N/A — required | Container gap | Children retain their semantics | Operable children keep their order |
| label | Required | N/A — required | Container gap | Provides the accessible name | Text adds no stop |
| remove | Optional | collapse | Container gap | Action has its own name | Takes its place when available |

### Variants

Use read-only tags to summarize values. A removable tag needs a visible removal affordance on touch. Selection behavior depends on the group configuration.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Default | Present a tagged value | See Tokens | The item is named | Row receives focus | Yes | Pending: default scenario |
| Remove requested | Request removal | See Tokens | The owner receives the identity of the value | Yes | Yes | Pending: remove requested scenario |

### Keyboard, pointer and touch

Delete requests removal for the focused row. Arrow keys navigate through enabled tags. Place a labeled remove button in the remove slot for pointer users.

### Accessibility

Name the collection and give each tag readable text. The grid and row semantics expose navigation without relying on the chip shape. Keep the visible label when its remove control receives focus.

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

Use the removal slot to expose the same operation to touch and keyboard users. Do use “Due today” under “Applied filters”. Avoid “Filter 3”.

## Part B — Bindings

### API

The owner receives a set of removed keys in `onRemove` and updates its collection. Supply `textValue` for tags with nontext children. A removal request does not mutate caller data.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `forms:TagGroup` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:TagGroup` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:TagGroup` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:TagGroup` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:TagGroup` | `children` | `React.ReactNode` | Unspecified | Caller content | — |
| `forms:TagGroup` | `className` | `string \| undefined` | `'react-aria-TagGroup'` | Caller input | — |
| `forms:TagGroup` | `defaultSelectedKeys` | `"all" \| Iterable<Key> \| undefined` | Unspecified | Uncontrolled initial value | — |
| `forms:TagGroup` | `disabledKeys` | `Iterable<Key> \| undefined` | Unspecified | Caller input | — |
| `forms:TagGroup` | `disallowEmptySelection` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:TagGroup` | `escapeKeyBehavior` | `"none" \| "clearSelection" \| undefined` | `'clearSelection'` | Caller input | — |
| `forms:TagGroup` | `id` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:TagGroup` | `onAction` | `((key: Key) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:TagGroup` | `onRemove` | `((keys: Set<Key>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:TagGroup` | `onSelectionChange` | `((keys: import("react-aria-components").Selection) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:TagGroup` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `forms:TagGroup` | `render` | `import("react-aria-components").DOMRenderFunction<"div", undefined> \| undefined` | Unspecified | Caller input | — |
| `forms:TagGroup` | `selectedKeys` | `"all" \| Iterable<Key> \| undefined` | Unspecified | Controlled value | — |
| `forms:TagGroup` | `selectionBehavior` | `import("@react-types/shared").SelectionBehavior \| undefined` | `'toggle'` | Caller input | — |
| `forms:TagGroup` | `selectionMode` | `import("react-aria-components").SelectionMode \| undefined` | Unspecified | Caller input | — |
| `forms:TagGroup` | `shouldSelectOnPressUp` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:TagGroup` | `slot` | `string \| null \| undefined` | Unspecified | Caller input | — |
| `forms:TagGroup` | `style` | `React.CSSProperties \| undefined` | Unspecified | Caller input | — |
| `forms:TagGroup` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |
| `forms:Tag` | `children` | `import("react-aria-components").ChildrenOrFunction<TagRenderProps>` | Unspecified | Caller content | — |
| `forms:Tag` | `className` | `ClassNameOrFunction<TagRenderProps> \| undefined` | `'react-aria-Tag'` | Caller input | — |
| `forms:Tag` | `download` | `string \| boolean \| undefined` | Unspecified | Caller input | — |
| `forms:Tag` | `href` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Tag` | `hrefLang` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Tag` | `id` | `Key \| undefined` | Unspecified | Caller input | — |
| `forms:Tag` | `isDisabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:Tag` | `onAction` | `(() => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Tag` | `onBlur` | `((e: React.FocusEvent<Element, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Tag` | `onClick` | `((e: React.MouseEvent<import("react-aria-components").FocusableElement>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Tag` | `onFocus` | `((e: React.FocusEvent<Element, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Tag` | `onFocusChange` | `((isFocused: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Tag` | `onHoverChange` | `((isHovering: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Tag` | `onHoverEnd` | `((e: import("react-aria-components").HoverEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Tag` | `onHoverStart` | `((e: import("react-aria-components").HoverEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Tag` | `onPress` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Tag` | `onPressChange` | `((isPressed: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Tag` | `onPressEnd` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Tag` | `onPressStart` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Tag` | `onPressUp` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Tag` | `ping` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Tag` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `forms:Tag` | `referrerPolicy` | `React.HTMLAttributeReferrerPolicy \| undefined` | Unspecified | Caller input | — |
| `forms:Tag` | `rel` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Tag` | `render` | `import("react-aria-components").DOMRenderFunction<"div", TagRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:Tag` | `routerOptions` | `undefined` | Unspecified | Caller input | — |
| `forms:Tag` | `style` | `import("react-aria-components").StyleOrFunction<TagRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:Tag` | `target` | `React.HTMLAttributeAnchorTarget \| undefined` | Unspecified | Caller input | — |
| `forms:Tag` | `textValue` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Tag` | Host attributes | 70 standard platform attributes, not listed | Unspecified | Caller input | — |
| `forms:TagList` | `children` | `React.ReactNode \| ((item: T) => ReactNode)` | Unspecified | Caller content | — |
| `forms:TagList` | `className` | `ClassNameOrFunction<TagListRenderProps> \| undefined` | `'react-aria-TagList'` | Caller input | — |
| `forms:TagList` | `dependencies` | `readonly any[] \| undefined` | Unspecified | Caller input | — |
| `forms:TagList` | `items` | `Iterable<T> \| undefined` | Unspecified | Caller input | — |
| `forms:TagList` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `forms:TagList` | `render` | `import("react-aria-components").DOMRenderFunction<"div", TagListRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:TagList` | `renderEmptyState` | `((props: TagListRenderProps) => ReactNode) \| undefined` | Unspecified | Caller input | — |
| `forms:TagList` | `style` | `import("react-aria-components").StyleOrFunction<TagListRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:TagList` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`forms` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

TagGroup supplies the collection context and label. TagList arranges the collection. Each Tag has a stable key, visible children and optional removal affordance.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Contract | Web | Native | Tracking |
| --- | --- | --- | --- |
| Tag and removable chip | TagGroup, Tag, TagList | No family binding in the native package | Native implementation and platform-specific verification are open in the [family audit](../component-depth.md). |

**Tokens.** The optional controls stylesheet applies text color inside the controls scope. Interactive descendants can use its keyboard focus treatment. Custom slot paint remains the consumer’s responsibility.

**Composition.** Compose one TagList within a TagGroup. Render a Tag for each stable domain id. Use the removal slot to expose the same operation to touch and keyboard users.

**Content guidelines.** Do use “Due today” under “Applied filters”. Avoid “Filter 3”. Translate display text while keeping the backing id stable.

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Default | Render the Open tag | Named Open row | Row receives focus | Yes | [Named removable row](../../tests/tag-and-removable-chip/authoring.test.tsx) |
| Remove requested | Press Delete on the row | onRemove receives the Open key | Yes | Yes | [Removal reports the key set](../../tests/tag-and-removable-chip/authoring.test.tsx) |

#### Performance

`TagGroup` 32,134 B, `Tag` 25,262 B, `TagList` 9,385 B. Each number is a separate named-import gzip measurement with React and React DOM external. Optional controls CSS is measured separately at 1,457 B gzip. The library root entry does not import this family.

#### Tests

- **Default.** [Named removable row](../../tests/tag-and-removable-chip/authoring.test.tsx).
- **Remove requested.** [Removal reports the key set](../../tests/tag-and-removable-chip/authoring.test.tsx).

The linked cases establish the behaviors above. Dedicated per-state visual comparisons and native simulator tests are open. [Catalog example](../../catalog/Authoring.stories.tsx)

#### Changelog and deprecations

The 0.3.0-rc.1 candidate documents the current web bindings. No family-specific deprecation is declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Tag and removable chip.

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
