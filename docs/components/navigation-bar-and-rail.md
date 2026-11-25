---
{
  "family": "Navigation bar and rail",
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
      "name": "AppNavigation",
      "from": "@ui-lazy-dev/ui-web/workflows",
      "rendering": "server-safe"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/Link",
    "https://mui.com/material-ui/react-app-bar/"
  ]
}
---

# Navigation bar and rail

## Part A — Contract

### Purpose and when not to use it

Move between the application's top-level destinations and show which one is current. It is a list of links inside the shell's navigation region: a wrapping bar in compact containers and a vertical rail in wide ones. Use tabs to switch panels within one page, a breadcrumb to show the path to the current page, and a menu for actions.

### Anatomy

A list of destinations, each a link with an optional decorative icon and a text label. The current destination is marked as the current page.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| destinations | Required | N/A — the list needs at least one destination | Container gap | One list; each link is named by its label | One stop per available destination, in list order |
| icon | Optional | collapse | Container gap | Excluded from the name | No stop |

### Variants

- **Bar** (compact container): destinations run in the inline direction and wrap to new rows instead of truncating.
- **Rail** (wide container inside the application shell): destinations stack vertically beside the workspace.
- **Unavailable destination**: shown as plain text in its position, without a link, when the host marks it unavailable or its location is unsafe.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Default | Display destinations | `light.text` | Each link identifies its destination | Yes | Links in list order | Pending: the neutral link role lands with the native binding |
| Current | The host names the current destination | `light.accent`, `type.strongWeight` | That link is the current page; no other link is | Yes | Yes | Pending: the neutral vocabulary cannot yet observe the current marker |
| Hover | Pointer over a link | `light.surface` | No change | Yes | Yes | Pending: the neutral vocabulary has no hover verb yet |
| Unavailable | The host marks a destination unavailable or supplies an unsafe location | `light.text` | Plain text; not a link | No | No | Pending: the neutral vocabulary cannot yet observe an absent link |

### Keyboard, pointer and touch

- Tab and Shift+Tab move through the available destinations in list order; unavailable destinations are skipped.
- Enter follows a link. Platform link behaviours (opening in a new window, copying the location, history) are preserved because each destination is an ordinary link.
- Pointer and touch follow a link on activation. Each link keeps at least the coarse target height.

### Accessibility

- **Roles.** A list of links inside a named navigation region supplied by the shell. The current destination carries the current-page state.
- **Name.** Each link is named by its text label; decorative icons are hidden from assistive technology.
- **Announcements.** None; the current-page state is announced with the link.
- **Target size.** Links keep the coarse target height in both bar and rail.
- **Contrast and forced colors.** The current destination uses a stronger weight as well as the accent marker, so it stays distinguishable when forced colors remove the marker.
- **Reduced motion.** Switching between bar and rail is a layout change without animation.
- **Right to left.** Alignment and the rail border use logical directions and mirror.

### State patterns

The family owns no request lifecycle. Keep the list usable while a destination's page loads. When a destination is not permitted, mark it unavailable or omit it; prefer omission when the person can never gain access. Offline and error states belong to the destination page.

### Localization

The caller supplies localized labels; the family has no library-owned strings. Long translations wrap instead of truncating. Order and alignment mirror in right-to-left locales.

### Tokens

| Part or state | Token |
| --- | --- |
| Current destination marker | `light.accent`, `dark.accent` |
| Current destination weight | `type.strongWeight` |
| Hover surface | `light.surface`, `dark.surface` |
| Link radius | `size.radius` |

### Composition and content guidelines

- Do use short nouns that name the destination, such as “Invoices”, not “Click here”.
- Do keep the order stable and limit the list to top-level destinations; put secondary destinations on the destination page.
- Do mark exactly one destination current, matching the page the person is on.
- Avoid icons without labels and avoid truncating translated labels.

## Part B — Bindings

### API

The router controls `currentId`. Each renderLink call receives the entry and normalized href, children and current-page attribute. Unsupported URLs render plain text. No wrapper ref or passthrough DOM props.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `workflows:AppNavigation` | `currentId` | `string \| undefined` | Unspecified | Caller input | — |
| `workflows:AppNavigation` | `items` | `readonly NavigationEntry[]` | Required | Caller input | — |
| `workflows:AppNavigation` | `renderLink` | `((item: NavigationEntry, props: { "aria-current"?: "page"; children: ReactNode; href: string; }) => ReactNode) \| undefined` | Unspecified | Caller input | — |

### React web

#### Rendering

`workflows` is a client entry, but `AppNavigation` holds no state or handlers and renders the same markup on the server and client. Unsafe locations are rejected during rendering, so they never reach the markup or a custom router. [Navigation rendering](../../tests/navigation-bar-and-rail/runtime-isolation.test.tsx)

An unordered list contains a list item for each destination. Each safe link contains an optional decorative icon and a text label. The `renderLink` slot adapts a link to the router.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Platform | Public contract |
| --- | --- |
| Web | `AppNavigation` from `@ui-lazy-dev/ui-web/workflows`. |
| Native | Planned. No exported renderer or simulator journey. Track parity in the [family inventory](../component-inventory.md). |

**Variants.** The bar and rail layouts follow the application shell's container query; `disabled` renders a destination as a text span without `href`.

**Keyboard and pointer.** Use ordinary anchors in custom renderers to preserve browser history, context menus and modified-click behavior.

**Accessibility.** Wrap the list in a named `nav` landmark (AppShell supplies it). The current link has `aria-current="page"`; icons sit in an `aria-hidden` span. Only `http`, `https`, `mailto` and `tel` locations without credentials become links.

**Composition.** Supply AppNavigation as the navigation slot of AppShell. A router adapter must spread the supplied props and children onto its actual link. [Catalog fixture](../../catalog/EnterpriseWorkspace.stories.tsx).

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Default | Render route items | Ordered list items with anchors | Yes for a safe location | Links in source order | [Order and current marker](../../tests/navigation-bar-and-rail/runtime-isolation.test.tsx) |
| Current | Set `currentId` | `aria-current="page"` on that link only | Yes | Yes | [Order and current marker](../../tests/navigation-bar-and-rail/runtime-isolation.test.tsx) |
| Unavailable | `disabled` or an unsafe `href` | Text span; router not called | No | No | [Inert destinations](../../tests/navigation-bar-and-rail/runtime-isolation.test.tsx) |
| Router | `renderLink` supplied | Receives the safe `href`, current marker and children | Yes | Yes | [Custom router](../../tests/navigation-bar-and-rail/runtime-isolation.test.tsx) |

#### Performance

`AppNavigation` measures 486 B gzip as a separate named import with React and React DOM external. The optional `/workflows` entry stays outside the default web entry. The `disabled` option adds no CSS. [Bundle methodology](../../scripts/verify-bundles.mjs)

#### Tests

- Order, current marker, icons, unavailable destinations, unsafe locations and router adaptation. [runtime-isolation.test.tsx](../../tests/navigation-bar-and-rail/runtime-isolation.test.tsx)
- Shell composition. [workflow-shell.test.tsx](../../tests/workflow-shell.test.tsx)
- Pending: a dedicated three-engine journey, catalog story and the neutral scenario land with the native binding.

#### Changelog and deprecations

Unreleased: `NavigationEntry.disabled` renders a destination as unavailable text. Additive; no migration needed.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Navigation bar and rail.

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
