---
{
  "family": "Menu and submenu",
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
      "name": "Menu",
      "from": "@ui-lazy-dev/ui-web/navigation"
    },
    {
      "platform": "web",
      "name": "MenuItem",
      "from": "@ui-lazy-dev/ui-web/navigation"
    },
    {
      "platform": "web",
      "name": "MenuTrigger",
      "from": "@ui-lazy-dev/ui-web/navigation"
    },
    {
      "platform": "web",
      "name": "SubmenuTrigger",
      "from": "@ui-lazy-dev/ui-web/navigation"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/Menu",
    "https://mui.com/material-ui/react-menu/"
  ]
}
---

# Menu and submenu

## Part A — Contract

### Purpose and when not to use it

Offer contextual commands, grouped when necessary. Use Select for a persistent field value or Link for a straightforward destination.

### Anatomy

An opener reveals a collection of commands. A nested opener provides access to a submenu.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| opener | Required | N/A — required | Container gap | Action has its own name | Takes its place when available |
| items | Required | N/A — required | Container gap | Children retain their semantics | Operable children keep their order |
| submenu | Optional | collapse | Container gap | Children retain their semantics | Operable children keep their order |

### Variants

Flat commands and nested menus share the same key model. Disabled commands remain unavailable. A destructive label and treatment must describe the consequence.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Open | Open the commands | See Tokens | The named menu is exposed | Yes | Menu items | Pending: open scenario |
| Submenu | Open a child menu | See Tokens | Nested commands become reachable | Yes | Menu items | Pending: submenu scenario |
| Closed | Choose a command | See Tokens | The menu closes and focus returns to the opener | Yes on trigger | Yes on trigger | Pending: closed scenario |

### Keyboard, pointer and touch

Enter opens the trigger; arrows navigate commands. End moves to the last enabled item. Escape backs out of the active level.

### Accessibility

Use a name for each command surface. Menuitems expose actions and focus. Allow touch activation to open nested commands without requiring hover.

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

A single selection should dispatch one command. Do use “Export” then “Plain text”. Avoid several nested levels or commands labeled “Go”.

## Part B — Bindings

### API

An item's id reaches the owner's action handler. Use selection props for selected commands; use trigger open props when another component owns visibility. Preserve a stable item id when translating text.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `navigation:Menu` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Menu` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Menu` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Menu` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Menu` | `autoFocus` | `boolean \| import("@react-types/shared").FocusStrategy \| undefined` | Unspecified | Caller input | — |
| `navigation:Menu` | `children` | `React.ReactNode \| ((item: T) => ReactNode)` | Unspecified | Caller content | — |
| `navigation:Menu` | `className` | `ClassNameOrFunction<MenuRenderProps> \| undefined` | `'react-aria-Menu'` | Caller input | — |
| `navigation:Menu` | `defaultSelectedKeys` | `"all" \| Iterable<Key> \| undefined` | Unspecified | Uncontrolled initial value | — |
| `navigation:Menu` | `dependencies` | `readonly any[] \| undefined` | Unspecified | Caller input | — |
| `navigation:Menu` | `disabledKeys` | `Iterable<Key> \| undefined` | Unspecified | Caller input | — |
| `navigation:Menu` | `disallowEmptySelection` | `boolean \| undefined` | Unspecified | Caller input | — |
| `navigation:Menu` | `escapeKeyBehavior` | `"none" \| "clearSelection" \| undefined` | `'clearSelection'` | Caller input | — |
| `navigation:Menu` | `id` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Menu` | `items` | `Iterable<T> \| undefined` | Unspecified | Caller input | — |
| `navigation:Menu` | `onAction` | `((key: Key, value: T) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Menu` | `onClose` | `(() => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Menu` | `onSelectionChange` | `((keys: import("react-aria-components").Selection) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Menu` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `navigation:Menu` | `render` | `import("react-aria-components").DOMRenderFunction<"div", MenuRenderProps> \| undefined` | Unspecified | Caller input | — |
| `navigation:Menu` | `renderEmptyState` | `(() => ReactNode) \| undefined` | Unspecified | Caller input | — |
| `navigation:Menu` | `selectedKeys` | `"all" \| Iterable<Key> \| undefined` | Unspecified | Controlled value | — |
| `navigation:Menu` | `selectionMode` | `import("react-aria-components").SelectionMode \| undefined` | Unspecified | Caller input | — |
| `navigation:Menu` | `shouldCloseOnSelect` | `boolean \| undefined` | Unspecified | Caller input | — |
| `navigation:Menu` | `shouldFocusWrap` | `boolean \| undefined` | Unspecified | Caller input | — |
| `navigation:Menu` | `slot` | `string \| null \| undefined` | Unspecified | Caller input | — |
| `navigation:Menu` | `style` | `import("react-aria-components").StyleOrFunction<MenuRenderProps> \| undefined` | Unspecified | Caller input | — |
| `navigation:Menu` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |
| `navigation:MenuItem` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:MenuItem` | `children` | `import("react-aria-components").ChildrenOrFunction<MenuItemRenderProps>` | Unspecified | Caller content | — |
| `navigation:MenuItem` | `className` | `ClassNameOrFunction<MenuItemRenderProps> \| undefined` | `'react-aria-MenuItem'` | Caller input | — |
| `navigation:MenuItem` | `download` | `string \| boolean \| undefined` | Unspecified | Caller input | — |
| `navigation:MenuItem` | `href` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:MenuItem` | `hrefLang` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:MenuItem` | `id` | `Key \| undefined` | Unspecified | Caller input | — |
| `navigation:MenuItem` | `isDisabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `navigation:MenuItem` | `onAction` | `(() => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:MenuItem` | `onBlur` | `((e: React.FocusEvent<Element, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:MenuItem` | `onClick` | `((e: React.MouseEvent<import("react-aria-components").FocusableElement>) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:MenuItem` | `onFocus` | `((e: React.FocusEvent<Element, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:MenuItem` | `onFocusChange` | `((isFocused: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:MenuItem` | `onHoverChange` | `((isHovering: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:MenuItem` | `onHoverEnd` | `((e: import("react-aria-components").HoverEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:MenuItem` | `onHoverStart` | `((e: import("react-aria-components").HoverEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:MenuItem` | `onPress` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:MenuItem` | `onPressChange` | `((isPressed: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:MenuItem` | `onPressEnd` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:MenuItem` | `onPressStart` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:MenuItem` | `onPressUp` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:MenuItem` | `ping` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:MenuItem` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `navigation:MenuItem` | `referrerPolicy` | `React.HTMLAttributeReferrerPolicy \| undefined` | Unspecified | Caller input | — |
| `navigation:MenuItem` | `rel` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:MenuItem` | `render` | `((props: React.DetailedHTMLProps<Required<Pick<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">> & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">, HTMLAnchorElement> \| React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, renderProps: MenuItemRenderProps) => ReactElement) \| undefined` | Unspecified | Caller input | — |
| `navigation:MenuItem` | `routerOptions` | `undefined` | Unspecified | Caller input | — |
| `navigation:MenuItem` | `shouldCloseOnSelect` | `boolean \| undefined` | Unspecified | Caller input | — |
| `navigation:MenuItem` | `style` | `import("react-aria-components").StyleOrFunction<MenuItemRenderProps> \| undefined` | Unspecified | Caller input | — |
| `navigation:MenuItem` | `target` | `React.HTMLAttributeAnchorTarget \| undefined` | Unspecified | Caller input | — |
| `navigation:MenuItem` | `textValue` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:MenuItem` | `value` | `T \| undefined` | Unspecified | Caller input | — |
| `navigation:MenuItem` | Host attributes | 70 standard platform attributes, not listed | Unspecified | Caller input | — |
| `navigation:MenuTrigger` | `children` | `React.ReactNode` | Required | Caller content | — |
| `navigation:MenuTrigger` | `defaultOpen` | `boolean \| undefined` | Unspecified | Uncontrolled initial value | — |
| `navigation:MenuTrigger` | `isOpen` | `boolean \| undefined` | Unspecified | Controlled value | — |
| `navigation:MenuTrigger` | `onOpenChange` | `((isOpen: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:MenuTrigger` | `trigger` | `import("react-stately/useMenuTriggerState").MenuTriggerType \| undefined` | `'press'` | Caller input | — |
| `navigation:SubmenuTrigger` | `children` | `React.ReactElement<unknown, string \| React.JSXElementConstructor<any>>[]` | Required | Caller content | — |
| `navigation:SubmenuTrigger` | `delay` | `number \| undefined` | `200` | Caller input | — |
| `navigation:SubmenuTrigger` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `navigation:SubmenuTrigger` | Host attributes | 1 standard platform attribute, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`navigation` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

MenuTrigger connects a button to a popover. Menu contains MenuItem rows. SubmenuTrigger pairs a parent item with a nested popover and Menu.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Contract | Web | Native | Tracking |
| --- | --- | --- | --- |
| Menu and submenu | Menu, MenuItem, MenuTrigger, SubmenuTrigger | No family binding in the native package | Native implementation and platform-specific verification are open in the [family audit](../component-depth.md). |

**Keyboard and pointer.** Enter opens the trigger; arrows navigate commands. End moves to the last enabled item. The submenu direction follows layout; in the LTR fixture Right opens the child. Escape backs out of the active level.

**Tokens.** The optional controls stylesheet applies text color inside the controls scope. Interactive descendants can use its keyboard focus treatment. Custom slot paint remains the consumer’s responsibility.

**Composition.** Put Menu inside Popover under MenuTrigger. Place SubmenuTrigger around a parent MenuItem and its child popover. A single selection should dispatch one command.

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Open | Press Enter on Actions | Named menu is exposed | Yes | Menu items | [Keyboard opens Actions](../../tests/browser/enterprise-navigation.spec.ts) |
| Submenu | Press End and ArrowRight | Plain text child menuitem appears | Yes | Menu items | [Nested command](../../tests/browser/enterprise-navigation.spec.ts) |
| Closed | Choose Plain text | Action result updates and the trigger regains focus | Yes on trigger | Yes on trigger | [Action and return](../../tests/browser/enterprise-navigation.spec.ts) |

#### Performance

`Menu` 27,212 B, `MenuItem` 18,651 B, `MenuTrigger` 17,389 B, `SubmenuTrigger` 11,055 B. Each number is a separate named-import gzip measurement with React and React DOM external. Optional controls CSS is measured separately at 1,457 B gzip. The library root entry does not import this family.

#### Tests

- **Open.** [Keyboard opens Actions](../../tests/browser/enterprise-navigation.spec.ts).
- **Submenu.** [Nested command](../../tests/browser/enterprise-navigation.spec.ts).
- **Closed.** [Action and return](../../tests/browser/enterprise-navigation.spec.ts).

The linked cases establish the behaviors above. Dedicated per-state visual comparisons and native simulator tests are open. [Catalog example](../../catalog/EnterpriseNavigation.stories.tsx)

#### Changelog and deprecations

The 0.3.0-rc.1 candidate documents the current web bindings. No family-specific deprecation is declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Menu and submenu.

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
