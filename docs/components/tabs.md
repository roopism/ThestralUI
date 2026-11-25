---
{
  "family": "Tabs",
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
      "name": "Tabs",
      "from": "@ui-lazy-dev/ui-web/navigation"
    },
    {
      "platform": "web",
      "name": "Tab",
      "from": "@ui-lazy-dev/ui-web/navigation"
    },
    {
      "platform": "web",
      "name": "TabList",
      "from": "@ui-lazy-dev/ui-web/navigation"
    },
    {
      "platform": "web",
      "name": "TabPanel",
      "from": "@ui-lazy-dev/ui-web/navigation"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/Tabs",
    "https://mui.com/material-ui/react-tabs/"
  ]
}
---

# Tabs

## Part A — Contract

### Purpose and when not to use it

Switch between related, peer views of one subject in place, keeping a single view visible at a time. Use links (navigation bar, breadcrumb) for independently addressable pages, a disclosure or accordion when several sections should stay visible together, and a segmented control when the choice filters one view instead of replacing it.

### Anatomy

A tab set contains one labelled tab list and one panel per tab. The selected tab determines the single visible panel, and each panel is named by its tab.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| tab list | Required | N/A — the set needs one labelled list | Container gap | Named by the caller; announced as a tab group | One stop: the selected tab |
| tab | Required | N/A — each panel needs a tab | Container gap | Its visible label | Reached with the arrow keys inside the list |
| panel | Required | N/A — each tab controls one panel | Container gap | Named by its tab | Follows the list; the panel itself is a stop only when it has no focusable content |

### Variants

- **Orientation.** Horizontal (default) places tabs in one row that scrolls inside itself when it overflows. Vertical stacks tabs in a column beside the panel for long or numerous labels.
- **Activation.** Automatic (default) shows a panel as soon as its tab receives keyboard focus. Manual moves focus only, and Enter or Space shows the panel; use it when showing a panel is slow or costly.
- **Unavailable tabs.** Individual tabs, or the whole set, can be unavailable. Unavailable tabs stay visible, keep their position and are skipped by the arrow keys.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Selected | Initial key or the owner's key | `light.selected`, `light.accent`, `type.strongWeight` | Tab is selected and controls the visible panel | Yes | Yes, the single list stop | Pending: the neutral owner-selection scenario lands with the native binding |
| Changed | Activate another tab or the owner changes the key | `light.selected`, `light.accent` | The new tab is selected; its panel replaces the previous one | Yes | Yes | Pending: the neutral owner-selection scenario lands with the native binding |
| Focus-visible | Keyboard focus on a tab | `light.focus`, `density.focusWidth` | Focus outline on the tab | Yes | Yes | Pending: the neutral vocabulary has no key-press verb yet |
| Hover | Pointer over a tab | `light.text` | No change | Yes | Yes | Pending: the neutral vocabulary has no hover verb yet |
| Unavailable | Unavailable key or unavailable set | `light.disabled` | Tab is unavailable | No | No, skipped by the arrow keys | Pending: the neutral vocabulary cannot yet observe an unavailable tab |

### Keyboard, pointer and touch

- Tab moves focus to the selected tab, then into the selected panel; Shift+Tab returns. Only one tab is a tab stop.
- Left and Right arrows move between tabs in the reading direction and wrap at either end; in right-to-left content Left moves forward. Vertical sets also accept Up and Down. Home and End move to the first and last available tab.
- Automatic activation shows the focused tab's panel at once; manual activation waits for Enter or Space.
- Pointer and touch select a tab on release. Unavailable tabs ignore activation. A long horizontal list scrolls with touch or a trackpad, and keyboard focus scrolls the focused tab into view.

### Accessibility

- **Roles.** The list is a tab group with its orientation, each tab is a tab with selected and unavailable states, and each panel is a tab panel named by its tab and controlled by it.
- **Name.** The caller names the tab list. Tab names come from their visible labels; do not repeat the page heading in each tab.
- **Announcements.** Assistive technology announces the selected state and position in the set. Changing the selection needs no live announcement.
- **Target size.** Tabs keep the `control` target height, which meets the 24 by 24 minimum and the coarse-pointer target.
- **Contrast and forced colors.** The selected tab is marked by colour, an outline and a stronger weight, so it remains distinguishable in forced colours and without colour.
- **Reduced motion.** Selection changes are immediate and use no animation.
- **Right to left.** Tabs start at the inline start edge and the horizontal arrow keys follow the reading direction.

### State patterns

The family owns no request lifecycle. Put loading, empty, error, offline, permission-denied and partial-failure states inside the affected panel so the tab list stays usable. Keep a tab whose content is unavailable visible and selectable when the panel can explain why; make it unavailable only when the destination does not apply.

### Localization

The family has no library-owned strings. The caller supplies localized tab labels and panel content, and keeps selection keys stable across locales. Long translations scroll inside the horizontal list instead of wrapping into a second row. Arrow-key direction and tab order mirror in right-to-left locales.

### Tokens

| Part or state | Token |
| --- | --- |
| Scope foreground | `light.text`, `dark.text` |
| Tab list divider | `light.border`, `dark.border` |
| Tab target height | `size.control` |
| Selected tab foreground, background and outline | `light.accent`, `dark.accent`, `light.selected`, `dark.selected`, `type.strongWeight` |
| Unavailable tab foreground | `light.disabled`, `dark.disabled` |
| Focus-visible outline | `density.focusWidth`, `light.focus`, `dark.focus` |
| Gap between tabs, list and panel | `space.spaceMd` |

### Composition and content guidelines

- Do keep each tab set to related views of one subject, with short, distinct, sentence-case labels such as “Profile” and “Billing”.
- Do keep the selection key stable when labels are translated or reordered.
- Do put the most frequently used view first and keep the order stable.
- Avoid nesting tab sets, using tabs as a step-by-step wizard, or labels such as “Section 1”.
- Avoid hiding errors in an unselected panel; surface a summary above the tab set instead.

## Part B — Bindings

### API

Use `selectedKey`/`onSelectionChange` for controlled selection or `defaultSelectedKey` for initial state. A controlled tab displays its owner-supplied key on each render.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `navigation:Tabs` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Tabs` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Tabs` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Tabs` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Tabs` | `children` | `import("react-aria-components").ChildrenOrFunction<TabsRenderProps>` | Unspecified | Caller content | — |
| `navigation:Tabs` | `className` | `ClassNameOrFunction<TabsRenderProps> \| undefined` | `'react-aria-Tabs'` | Caller input | — |
| `navigation:Tabs` | `defaultSelectedKey` | `Key \| undefined` | Unspecified | Uncontrolled initial value | — |
| `navigation:Tabs` | `disabledKeys` | `Iterable<Key> \| undefined` | Unspecified | Caller input | — |
| `navigation:Tabs` | `id` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Tabs` | `isDisabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `navigation:Tabs` | `keyboardActivation` | `"manual" \| "automatic" \| undefined` | `'automatic'` | Caller input | — |
| `navigation:Tabs` | `onSelectionChange` | `((key: Key) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Tabs` | `orientation` | `Orientation \| undefined` | `'horizontal'` | Caller input | — |
| `navigation:Tabs` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `navigation:Tabs` | `render` | `import("react-aria-components").DOMRenderFunction<"div", TabsRenderProps> \| undefined` | Unspecified | Caller input | — |
| `navigation:Tabs` | `selectedKey` | `Key \| undefined` | Unspecified | Controlled value | — |
| `navigation:Tabs` | `slot` | `string \| null \| undefined` | Unspecified | Caller input | — |
| `navigation:Tabs` | `style` | `import("react-aria-components").StyleOrFunction<TabsRenderProps> \| undefined` | Unspecified | Caller input | — |
| `navigation:Tabs` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |
| `navigation:Tab` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Tab` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Tab` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Tab` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Tab` | `children` | `import("react-aria-components").ChildrenOrFunction<TabRenderProps>` | Unspecified | Caller content | — |
| `navigation:Tab` | `className` | `ClassNameOrFunction<TabRenderProps> \| undefined` | `'react-aria-Tab'` | Caller input | — |
| `navigation:Tab` | `download` | `string \| boolean \| undefined` | Unspecified | Caller input | — |
| `navigation:Tab` | `href` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Tab` | `hrefLang` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Tab` | `id` | `Key \| undefined` | Unspecified | Caller input | — |
| `navigation:Tab` | `isDisabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `navigation:Tab` | `onBlur` | `((e: React.FocusEvent<Element, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Tab` | `onClick` | `((e: React.MouseEvent<import("react-aria-components").FocusableElement>) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Tab` | `onFocus` | `((e: React.FocusEvent<Element, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Tab` | `onFocusChange` | `((isFocused: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Tab` | `onHoverChange` | `((isHovering: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Tab` | `onHoverEnd` | `((e: import("react-aria-components").HoverEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Tab` | `onHoverStart` | `((e: import("react-aria-components").HoverEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Tab` | `onPress` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Tab` | `onPressChange` | `((isPressed: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Tab` | `onPressEnd` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Tab` | `onPressStart` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Tab` | `onPressUp` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Tab` | `ping` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Tab` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `navigation:Tab` | `referrerPolicy` | `React.HTMLAttributeReferrerPolicy \| undefined` | Unspecified | Caller input | — |
| `navigation:Tab` | `rel` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Tab` | `render` | `((props: React.DetailedHTMLProps<Required<Pick<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">> & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">, HTMLAnchorElement> \| React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, renderProps: TabRenderProps) => React.ReactElement) \| undefined` | Unspecified | Caller input | — |
| `navigation:Tab` | `routerOptions` | `undefined` | Unspecified | Caller input | — |
| `navigation:Tab` | `style` | `import("react-aria-components").StyleOrFunction<TabRenderProps> \| undefined` | Unspecified | Caller input | — |
| `navigation:Tab` | `target` | `React.HTMLAttributeAnchorTarget \| undefined` | Unspecified | Caller input | — |
| `navigation:Tab` | Host attributes | 70 standard platform attributes, not listed | Unspecified | Caller input | — |
| `navigation:TabList` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:TabList` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:TabList` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:TabList` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:TabList` | `children` | `React.ReactNode \| ((item: T) => React.ReactNode)` | Unspecified | Caller content | — |
| `navigation:TabList` | `className` | `ClassNameOrFunction<TabListRenderProps> \| undefined` | `'react-aria-TabList'` | Caller input | — |
| `navigation:TabList` | `dependencies` | `readonly any[] \| undefined` | Unspecified | Caller input | — |
| `navigation:TabList` | `items` | `Iterable<T> \| undefined` | Unspecified | Caller input | — |
| `navigation:TabList` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `navigation:TabList` | `render` | `import("react-aria-components").DOMRenderFunction<"div", TabListRenderProps> \| undefined` | Unspecified | Caller input | — |
| `navigation:TabList` | `style` | `import("react-aria-components").StyleOrFunction<TabListRenderProps> \| undefined` | Unspecified | Caller input | — |
| `navigation:TabList` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |
| `navigation:TabPanel` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:TabPanel` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:TabPanel` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:TabPanel` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:TabPanel` | `children` | `import("react-aria-components").ChildrenOrFunction<TabPanelRenderProps>` | Unspecified | Caller content | — |
| `navigation:TabPanel` | `className` | `ClassNameOrFunction<TabPanelRenderProps> \| undefined` | `'react-aria-TabPanel'` | Caller input | — |
| `navigation:TabPanel` | `id` | `Key \| undefined` | Unspecified | Caller input | — |
| `navigation:TabPanel` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `navigation:TabPanel` | `render` | `import("react-aria-components").DOMRenderFunction<"div", TabPanelRenderProps> \| undefined` | Unspecified | Caller input | — |
| `navigation:TabPanel` | `shouldForceMount` | `boolean \| undefined` | `false` | Caller input | — |
| `navigation:TabPanel` | `style` | `import("react-aria-components").StyleOrFunction<TabPanelRenderProps> \| undefined` | Unspecified | Caller input | — |
| `navigation:TabPanel` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`navigation` is a client entry: the tab set holds selection state and keyboard handlers, so it renders on the server with its initial selection and becomes interactive after hydration. The server renders only the selected panel; keep unselected content out of the critical path.

Tabs coordinates a TabList of Tab slots and matching TabPanel slots. Each TabPanel uses the same id as its Tab, and the Tabs root owns the selection model, built on React Aria `Tabs`.

#### Headless API

React Aria's `useTabList`, `useTab` and `useTabPanel` hooks supply the behaviour. The library does not re-export them; use React Aria directly when a fully custom rendering is needed.

#### Test helpers

None. Query the tab group, tab and tab panel roles by name, as the contract describes.

#### Platform differences

| Contract | Web | Native | Tracking |
| --- | --- | --- | --- |
| Tabs | Tabs, Tab, TabList, TabPanel | No family binding in the native package | Native implementation is open in the [family audit](../component-depth.md). |

**Accessibility.** The list has `role="tablist"` with `aria-orientation`; tabs expose `aria-selected`, `aria-disabled` and `aria-controls`; the panel is `aria-labelledby` its tab. A panel without focusable content gets `tabIndex=0`. Safari reaches buttons inside a panel with Option+Tab unless the user enables full keyboard access.

**Tokens.** The optional `controls.css` sheet styles the set inside a `uld-controls` scope: a horizontal list scrolls with `overflow-x: auto` instead of wrapping, vertical sets lay out the list beside the panel, and the shared scope supplies the unavailable colour and the focus-visible outline.

**Composition.** Give each TabPanel the same id as its Tab. Keep siblings inside the same Tabs root. Use `selectedKey` with `onSelectionChange` for controlled selection or `defaultSelectedKey` for an initial key.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Selected | Render `selectedKey="profile"` | Profile panel is visible | Yes | Active tab | [Controlled initial selection](../../tests/tabs/advanced.test.tsx) |
| Changed | Owner selects another key or a tab is activated | The new tab is `aria-selected` and its panel is visible | Yes | Active tab | [Owner selection](../../tests/tabs/advanced.test.tsx) |
| Keyboard | Arrow, Home and End keys | Selection follows the reading direction and wraps | Yes | Active tab | [Keyboard traversal](../../tests/tabs/advanced.test.tsx) |
| Unavailable | `disabledKeys` or `isDisabled` | Tab is `aria-disabled` and skipped | No | Skipped | [Unavailable tabs](../../tests/tabs/advanced.test.tsx) |

#### Performance

`Tabs` 14,086 B gzip as a separate named import with React and React DOM external (14,091 B recorded). This family adds no JavaScript. Its `controls.css` rules add 57 B gzip to the shared optional sheet (measured 1,505 B before and 1,562 B after, against a 1,603 B ceiling). The library root entry does not import this family.

#### Tests

- **Selection, activation, keyboard traversal, right to left, vertical orientation and unavailable tabs.** [Unit regressions](../../tests/tabs/advanced.test.tsx).
- **Keyboard selection and reflow at 320 CSS pixels in four locales.** [Preferences journey](../../tests/browser/preferences.spec.ts) in Chromium, Firefox and WebKit.
- **Catalog.** [Preferences example](../../catalog/Controls.stories.tsx).

Pending: browser regressions for focus order, overflow scrolling and vertical layout, and the neutral scenario, land with the native binding.

#### Changelog and deprecations

Unreleased: a horizontal tab list scrolls in one row instead of wrapping, and vertical sets place the list beside the panel. No API change and no automatic migration is needed.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Tabs.

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
