---
{
  "family": "Toggle and segmented control",
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
      "name": "ToggleButton",
      "from": "@ui-lazy-dev/ui-web/forms"
    },
    {
      "platform": "web",
      "name": "ToggleButtonGroup",
      "from": "@ui-lazy-dev/ui-web/forms"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/ToggleButtonGroup",
    "https://mui.com/material-ui/react-toggle-button/"
  ]
}
---

# Toggle and segmented control

## Part A — Contract

### Purpose and when not to use it

Choose a persistent mode or toggle formatting. Choose Button for a one-time command.

### Anatomy

A named toggle exposes its persistent selection. A group coordinates choices when only one mode may be active.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| label | Required | N/A — required | Container gap | Provides the accessible name | Text adds no stop |
| segments | Optional | collapse | Container gap | Children retain their semantics | Operable children keep their order |

### Variants

Use independent toggles for unrelated flags or mutually exclusive segments for a single mode.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Exclusive selection | Select an exclusive segment | See Tokens | The chosen item exposes selection | Yes | Selected segment | Pending: exclusive selection scenario |
| Disabled segment | Disable a segment | Disabled foreground | It cannot replace the current selection | No | No | Pending: disabled segment scenario |

### Keyboard, pointer and touch

Enter or Space activates the focused item. A group coordinates focus and arrow-key navigation. Touch activation works on the whole segment.

### Accessibility

Name the group. A standalone toggle announces pressed state. Use the field’s localized labels in RTL layouts. Review touch-target geometry, contrast, forced colors and reduced-motion behavior in the consumer theme before promoting this draft.

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

Use “Compact view”. Avoid “Switch this”. Localize the whole label and keep it available when constrained text wraps.

## Part B — Bindings

### API

An individual ToggleButton accepts `isSelected`, `defaultSelected` and `onChange(boolean)`. A group instead accepts `selectedKeys`, `defaultSelectedKeys` and `onSelectionChange(keys)`. Its default `selectionMode` is single. In this mode the group uses radiogroup/radio semantics, including aria-checked on each segment.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `forms:ToggleButton` | `aria-controls` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:ToggleButton` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:ToggleButton` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:ToggleButton` | `aria-disabled` | `boolean \| "true" \| "false" \| undefined` | Unspecified | Caller input | — |
| `forms:ToggleButton` | `aria-expanded` | `boolean \| "true" \| "false" \| undefined` | Unspecified | Caller input | — |
| `forms:ToggleButton` | `aria-haspopup` | `boolean \| "true" \| "false" \| "dialog" \| "grid" \| "listbox" \| "menu" \| "tree" \| undefined` | Unspecified | Caller input | — |
| `forms:ToggleButton` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:ToggleButton` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:ToggleButton` | `aria-pressed` | `boolean \| "true" \| "false" \| "mixed" \| undefined` | Unspecified | Caller input | — |
| `forms:ToggleButton` | `autoFocus` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:ToggleButton` | `children` | `import("react-aria-components").ChildrenOrFunction<ToggleButtonRenderProps>` | Unspecified | Caller content | — |
| `forms:ToggleButton` | `className` | `ClassNameOrFunction<ToggleButtonRenderProps> \| undefined` | `'react-aria-ToggleButton'` | Caller input | — |
| `forms:ToggleButton` | `defaultSelected` | `boolean \| undefined` | Unspecified | Uncontrolled initial value | — |
| `forms:ToggleButton` | `excludeFromTabOrder` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:ToggleButton` | `id` | `Key \| undefined` | Unspecified | Caller input | — |
| `forms:ToggleButton` | `isDisabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:ToggleButton` | `isSelected` | `boolean \| undefined` | Unspecified | Controlled value | — |
| `forms:ToggleButton` | `onBlur` | `((e: React.FocusEvent<Element, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ToggleButton` | `onChange` | `((isSelected: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ToggleButton` | `onClick` | `((e: React.MouseEvent<import("react-aria-components").FocusableElement>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ToggleButton` | `onFocus` | `((e: React.FocusEvent<Element, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ToggleButton` | `onFocusChange` | `((isFocused: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ToggleButton` | `onHoverChange` | `((isHovering: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ToggleButton` | `onHoverEnd` | `((e: import("react-aria-components").HoverEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ToggleButton` | `onHoverStart` | `((e: import("react-aria-components").HoverEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ToggleButton` | `onKeyDown` | `((e: import("react-aria-components").KeyboardEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ToggleButton` | `onKeyUp` | `((e: import("react-aria-components").KeyboardEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ToggleButton` | `onPress` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ToggleButton` | `onPressChange` | `((isPressed: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ToggleButton` | `onPressEnd` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ToggleButton` | `onPressStart` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ToggleButton` | `onPressUp` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ToggleButton` | `preventFocusOnPress` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:ToggleButton` | `ref` | `React.Ref<HTMLButtonElement> \| undefined` | Unspecified | Caller reference | `HTMLButtonElement` |
| `forms:ToggleButton` | `render` | `import("react-aria-components").DOMRenderFunction<"button", ToggleButtonRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:ToggleButton` | `slot` | `string \| null \| undefined` | Unspecified | Caller input | — |
| `forms:ToggleButton` | `style` | `import("react-aria-components").StyleOrFunction<ToggleButtonRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:ToggleButton` | Host attributes | 70 standard platform attributes, not listed | Unspecified | Caller input | — |
| `forms:ToggleButtonGroup` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:ToggleButtonGroup` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:ToggleButtonGroup` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:ToggleButtonGroup` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:ToggleButtonGroup` | `children` | `import("react-aria-components").ChildrenOrFunction<ToggleButtonGroupRenderProps>` | Unspecified | Caller content | — |
| `forms:ToggleButtonGroup` | `className` | `ClassNameOrFunction<ToggleButtonGroupRenderProps> \| undefined` | `'react-aria-ToggleButtonGroup'` | Caller input | — |
| `forms:ToggleButtonGroup` | `defaultSelectedKeys` | `Iterable<import("react-aria-components").Key> \| undefined` | Unspecified | Uncontrolled initial value | — |
| `forms:ToggleButtonGroup` | `disallowEmptySelection` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:ToggleButtonGroup` | `isDisabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:ToggleButtonGroup` | `onSelectionChange` | `((keys: Set<import("react-aria-components").Key>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:ToggleButtonGroup` | `orientation` | `Orientation \| undefined` | `'horizontal'` | Caller input | — |
| `forms:ToggleButtonGroup` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `forms:ToggleButtonGroup` | `render` | `import("react-aria-components").DOMRenderFunction<"div", ToggleButtonGroupRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:ToggleButtonGroup` | `selectedKeys` | `Iterable<import("react-aria-components").Key> \| undefined` | Unspecified | Controlled value | — |
| `forms:ToggleButtonGroup` | `selectionMode` | `"single" \| "multiple" \| undefined` | `'single'` | Caller input | — |
| `forms:ToggleButtonGroup` | `slot` | `string \| null \| undefined` | Unspecified | Caller input | — |
| `forms:ToggleButtonGroup` | `style` | `import("react-aria-components").StyleOrFunction<ToggleButtonGroupRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:ToggleButtonGroup` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`forms` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

ToggleButton handles the press and selection. ToggleButtonGroup coordinates the selected item keys. Supply text or a localized name on every segment.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Surface | Web | Native |
| --- | --- | --- |
| Availability | `ToggleButton`, `ToggleButtonGroup` | planned. Track a platform contract and simulator fixture in the [family inventory](../component-inventory.md). |

**Accessibility.** Name the group. The single-selection catalog example exposes radio semantics. A standalone toggle announces pressed state. Use the field’s localized labels in RTL layouts. Review touch-target geometry, contrast, forced colors and reduced-motion behavior in the consumer theme before promoting this draft.

**Tokens.** These mappings apply inside the optional `uld-controls` scope. A headless import does not install the stylesheet.

**Composition.** Give the ToggleButtonGroup an accessible collection name. Give each ToggleButton a stable id and a concise label such as “Rows” or “Tiles”. Set a single unavailable segment’s `isDisabled` on that child. [Catalog composition](../../catalog/EnterpriseNavigation.stories.tsx)

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Exclusive selection | Activate a segment | The selected exclusive segment reports checked | Yes | Selected segment | [Exclusive density choice](../../tests/browser/enterprise-navigation.spec.ts#L56) |
| Disabled segment | Disable an unselected child and attempt activation | Disabled radio button stays unchecked and the other radio stays checked | No | No | [Disabled exclusive choice](../../tests/form-spec-states.test.tsx#L80) |

#### Performance

Named JavaScript exports measured independently from the packed web consumer, gzip level 9, with React and React DOM external: `ToggleButton` 12,119 B, `ToggleButtonGroup` 8,516 B. These optional imports stay out of the web root. Their sizes overlap when used together. [Measurement method](../../scripts/verify-bundles.mjs) The optional scoped `controls.css` entry measures 1,485 B gzip including its theme tokens. Apply `.uld-controls` to a containing element to opt into its treatments.

#### Tests

- **Exclusive selection.** [Exclusive density choice](../../tests/browser/enterprise-navigation.spec.ts#L56).
- **Disabled segment.** [Disabled exclusive choice](../../tests/form-spec-states.test.tsx#L80).
- Dedicated visual qualification and native simulator coverage remain open.

Multiple-selection toggle semantics, empty selection and roving focus across disabled segments need dedicated browser coverage.

#### Changelog and deprecations

The `0.3.0-rc.1` draft records the current public contract. Consult the packed declarations for upstream deprecation notices when upgrading React Aria.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Toggle and segmented control.

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
