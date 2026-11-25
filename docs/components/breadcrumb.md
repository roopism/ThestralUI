---
{
  "family": "Breadcrumb",
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
      "name": "Breadcrumbs",
      "from": "@ui-lazy-dev/ui-web/navigation"
    },
    {
      "platform": "web",
      "name": "Breadcrumb",
      "from": "@ui-lazy-dev/ui-web/navigation"
    },
    {
      "platform": "web",
      "name": "Link",
      "from": "@ui-lazy-dev/ui-web/navigation"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/Breadcrumbs",
    "https://mui.com/material-ui/react-breadcrumbs/"
  ]
}
---

# Breadcrumb

## Part A — Contract

### Purpose and when not to use it

Show where the current page sits in a navigable hierarchy. Use Tabs to switch panels at the same level.

### Anatomy

An ordered trail leads through ancestors to the current destination.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| items | Required | N/A — required | Container gap | Children retain their semantics | Operable children keep their order |

### Variants

Ancestor links are destinations; the current item describes the page.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Default | Display the trail | See Tokens | Ancestor links identify navigable destinations | Yes on ancestor links | Yes on links | Pending: default scenario |

### Keyboard, pointer and touch

Tab reaches available links in source order. Do not add a tab stop to decorative separators.

### Accessibility

The trail is a named list within navigation. Use readable link text and expose the current destination distinctly. A visible separator must not introduce a redundant focus stop.

### State patterns

This family owns no request lifecycle. Its containing surface supplies any loading, empty, error, offline, permission or partial-failure state.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

| Part or state | Token |
| --- | --- |
| Scope foreground | `light.text`, `dark.text` |

### Composition and content guidelines

Place near the main heading. Put a Link inside each Breadcrumb and use the caller's routing integration for navigation. Do use “Workspace / Review”.

## Part B — Bindings

### API

Use an ordered collection or explicit Breadcrumb children with meaningful keys. A Link receives its href and text from the owner. Provide the collection's accessible label.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `navigation:Breadcrumbs` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Breadcrumbs` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Breadcrumbs` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Breadcrumbs` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Breadcrumbs` | `children` | `React.ReactNode \| ((item: T) => React.ReactNode)` | Unspecified | Caller content | — |
| `navigation:Breadcrumbs` | `className` | `string \| undefined` | `'react-aria-Breadcrumbs'` | Caller input | — |
| `navigation:Breadcrumbs` | `dependencies` | `readonly any[] \| undefined` | Unspecified | Caller input | — |
| `navigation:Breadcrumbs` | `id` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Breadcrumbs` | `isDisabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `navigation:Breadcrumbs` | `items` | `Iterable<T> \| undefined` | Unspecified | Caller input | — |
| `navigation:Breadcrumbs` | `onAction` | `((key: Key) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Breadcrumbs` | `ref` | `React.Ref<HTMLOListElement> \| undefined` | Unspecified | Caller reference | `HTMLOListElement` |
| `navigation:Breadcrumbs` | `render` | `import("react-aria-components").DOMRenderFunction<"ol", undefined> \| undefined` | Unspecified | Caller input | — |
| `navigation:Breadcrumbs` | `slot` | `string \| null \| undefined` | Unspecified | Caller input | — |
| `navigation:Breadcrumbs` | `style` | `React.CSSProperties \| undefined` | Unspecified | Caller input | — |
| `navigation:Breadcrumbs` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |
| `navigation:Breadcrumb` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Breadcrumb` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Breadcrumb` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Breadcrumb` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Breadcrumb` | `children` | `import("react-aria-components").ChildrenOrFunction<BreadcrumbRenderProps>` | Unspecified | Caller content | — |
| `navigation:Breadcrumb` | `className` | `ClassNameOrFunction<BreadcrumbRenderProps> \| undefined` | `'react-aria-Breadcrumb'` | Caller input | — |
| `navigation:Breadcrumb` | `id` | `Key \| undefined` | Unspecified | Caller input | — |
| `navigation:Breadcrumb` | `ref` | `React.Ref<HTMLLIElement> \| undefined` | Unspecified | Caller reference | `HTMLLIElement` |
| `navigation:Breadcrumb` | `render` | `import("react-aria-components").DOMRenderFunction<"li", BreadcrumbRenderProps> \| undefined` | Unspecified | Caller input | — |
| `navigation:Breadcrumb` | `style` | `import("react-aria-components").StyleOrFunction<BreadcrumbRenderProps> \| undefined` | Unspecified | Caller input | — |
| `navigation:Breadcrumb` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |
| `navigation:Link` | `aria-current` | `boolean \| "true" \| "false" \| "page" \| "step" \| "location" \| "date" \| "time" \| undefined` | Unspecified | Caller input | — |
| `navigation:Link` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Link` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Link` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Link` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Link` | `autoFocus` | `boolean \| undefined` | Unspecified | Caller input | — |
| `navigation:Link` | `children` | `import("react-aria-components").ChildrenOrFunction<LinkRenderProps>` | Unspecified | Caller content | — |
| `navigation:Link` | `className` | `ClassNameOrFunction<LinkRenderProps> \| undefined` | `'react-aria-Link'` | Caller input | — |
| `navigation:Link` | `download` | `string \| boolean \| undefined` | Unspecified | Caller input | — |
| `navigation:Link` | `href` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Link` | `hrefLang` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Link` | `id` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Link` | `isDisabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `navigation:Link` | `onBlur` | `((e: React.FocusEvent<Element, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Link` | `onClick` | `((e: React.MouseEvent<import("react-aria-components").FocusableElement>) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Link` | `onFocus` | `((e: React.FocusEvent<Element, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Link` | `onFocusChange` | `((isFocused: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Link` | `onHoverChange` | `((isHovering: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Link` | `onHoverEnd` | `((e: import("react-aria-components").HoverEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Link` | `onHoverStart` | `((e: import("react-aria-components").HoverEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Link` | `onKeyDown` | `((e: import("react-aria-components").KeyboardEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Link` | `onKeyUp` | `((e: import("react-aria-components").KeyboardEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Link` | `onPress` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Link` | `onPressChange` | `((isPressed: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Link` | `onPressEnd` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Link` | `onPressStart` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Link` | `onPressUp` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Link` | `ping` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Link` | `ref` | `React.Ref<HTMLAnchorElement> \| undefined` | Unspecified | Caller reference | `HTMLAnchorElement` |
| `navigation:Link` | `referrerPolicy` | `React.HTMLAttributeReferrerPolicy \| undefined` | Unspecified | Caller input | — |
| `navigation:Link` | `rel` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Link` | `render` | `((props: React.DetailedHTMLProps<Required<Pick<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">> & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">, HTMLAnchorElement> \| React.DetailedHTMLProps<React.HTMLAttributes<HTMLSpanElement>, HTMLSpanElement>, renderProps: LinkRenderProps) => React.ReactElement) \| undefined` | Unspecified | Caller input | — |
| `navigation:Link` | `routerOptions` | `undefined` | Unspecified | Caller input | — |
| `navigation:Link` | `slot` | `string \| null \| undefined` | Unspecified | Caller input | — |
| `navigation:Link` | `style` | `import("react-aria-components").StyleOrFunction<LinkRenderProps> \| undefined` | Unspecified | Caller input | — |
| `navigation:Link` | `target` | `React.HTMLAttributeAnchorTarget \| undefined` | Unspecified | Caller input | — |
| `navigation:Link` | Host attributes | 70 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`navigation` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

Breadcrumbs owns the ordered trail. Each Breadcrumb supplies a list item and Link supplies the navigable or current destination.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Contract | Web | Native | Tracking |
| --- | --- | --- | --- |
| Breadcrumb | Breadcrumbs, Breadcrumb, Link | No family binding in the native package | Native implementation and platform-specific verification are open in the [family audit](../component-depth.md). |

**Variants.** Ancestor links are destinations; the current item describes the page. The component has no semantic tone or density prop.

**Keyboard and pointer.** Tab reaches available links in source order. Pointer or Enter follows the destination through the browser or router. Do not add a tab stop to decorative separators.

**Tokens.** The optional controls stylesheet applies text color inside the controls scope. Interactive descendants can use its keyboard focus treatment. Custom slot paint remains the consumer’s responsibility.

**Content guidelines.** Do use “Workspace / Review”. Avoid exposing route ids or truncating the only distinguishable part of adjacent names.

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Default | Render the Location trail | Named list and Workspace link expose #home | Yes on ancestor links | Yes on links | [Named destinations](../../tests/browser/enterprise-navigation.spec.ts) |

#### Performance

`Breadcrumbs` 9,758 B, `Breadcrumb` 3,922 B, `Link` 11,700 B. Each number is a separate named-import gzip measurement with React and React DOM external. Optional controls CSS is measured separately at 1,457 B gzip. The library root entry does not import this family.

#### Tests

- **Default.** [Named destinations](../../tests/browser/enterprise-navigation.spec.ts).

The linked cases establish the behaviors above. Dedicated per-state visual comparisons and native simulator tests are open. [Catalog example](../../catalog/EnterpriseNavigation.stories.tsx)

#### Changelog and deprecations

The 0.3.0-rc.1 candidate documents the current web bindings. No family-specific deprecation is declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Breadcrumb.

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
