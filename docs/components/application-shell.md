---
{
  "family": "Application shell",
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
      "name": "AppShell",
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

# Application shell

## Part A — Contract

### Purpose and when not to use it

Frame one application workspace: a skip destination, an optional banner, the application's navigation, the single main workspace, an optional complementary region and an optional footer. Use page composition for the heading and actions of one page inside the shell, and a split view for a list beside its detail. Do not use a second shell inside a page or a dialog.

### Anatomy

A skip link precedes the banner, the named navigation and the main workspace. A complementary region and a footer follow the main workspace when supplied.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| skip link | Required | N/A — keyboard users need the bypass | Container gap | Its caller-supplied label | First stop; visible only while focused |
| header | Optional | collapse | Container gap | Banner region; children keep their names | After the skip link |
| navigation | Required | N/A — the shell exists to frame navigation | Container gap | Named navigation region | After the header |
| main | Required | N/A — exactly one main region | Container gap | Main region; children keep their names | After the navigation; focusable as the skip target only |
| aside | Optional | collapse | Container gap | One complementary region; children keep their names | After the main content |
| footer | Optional | collapse | Container gap | Content information region | Last |

### Variants

- **Compact** (container narrower than 48 rem): the navigation sits above the workspace in one column.
- **Wide** (48 rem and wider): the navigation becomes a rail beside the workspace without mounting a second copy.
- **Wide with supporting content** (64 rem and wider, aside supplied): the complementary region forms a third column after the workspace; narrower containers place it below the workspace.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Default | Open the workspace | `light.canvas`, `light.text`, `light.border` | Skip link, then navigation, main and optional regions in reading order | Skip link and slotted controls | Skip link first | Pending: the neutral scenario lands with the native binding |
| Skip focused | Keyboard focus reaches the skip link | System colors | The skip link becomes visible | Yes | Yes | Pending: the neutral vocabulary has no key-press verb yet |
| Skip used | Activate the skip link | `light.canvas` | Focus moves to the main region | Yes | Main region receives focus | Pending: the neutral vocabulary cannot yet observe focus |
| Compact | Narrow the container below 48 rem | `light.border` | Landmark order unchanged | Existing controls | The previously focused control | Pending: the neutral vocabulary cannot yet resize a container |
| Wide | Widen the container to 48 rem or more | `light.border` | Landmark order unchanged | Existing controls | The previously focused control | Pending: the neutral vocabulary cannot yet resize a container |

### Keyboard, pointer and touch

- Tab first reaches the skip link, which appears while focused. Enter moves focus to the main region, so the next Tab continues inside the workspace.
- The shell adds no other keyboard handling: navigation, header and complementary content keep their own controls and order.
- Reflowing between compact and wide layouts keeps focus and scroll position because each slot is mounted once.

### Accessibility

- **Roles.** Banner (header), navigation named by the caller, one main region, one complementary region (aside) and content information (footer). Keep exactly one shell per page so each landmark is unique.
- **Name.** The navigation label is required. The complementary region is unnamed; supply at most one per shell.
- **Announcements.** None. The shell has no live content.
- **Target size.** The skip link uses the shared control padding; slotted controls own their targets.
- **Contrast and forced colors.** The skip link uses system canvas and text colors so it stays legible in forced colors.
- **Reduced motion.** The shell has no animation.
- **Right to left.** Columns, borders and padding use logical directions, so the rail and the complementary region mirror.

### State patterns

The shell owns no request lifecycle. Keep the navigation available while the main workspace shows its own loading, empty, error, offline, permission-denied or partial-failure state. Put a global offline or maintenance notice in the header slot so it precedes the workspace.

### Localization

The skip link and navigation labels are caller-supplied and localized by the caller. The shell has no library-owned strings. Long labels wrap; the rail width adapts to its content up to its maximum. Layout mirrors in right-to-left locales.

### Tokens

| Part or state | Token |
| --- | --- |
| Shell backdrop | `light.canvas`, `dark.canvas` |
| Main text | `light.text`, `dark.text` |
| Header and navigation dividing line | `light.border`, `dark.border` |

### Composition and content guidelines

- Do pass the application's existing navigation markup, and nest a page composition and optionally a split view inside the main workspace.
- Do label the skip link with its destination, such as “Skip to applications”, and name the navigation, such as “Workspace navigation”.
- Do use the complementary region for supporting content that relates to the whole workspace, such as filters or a details panel.
- Avoid nesting a second main region or a second shell, and avoid a generic “Go” skip label or an unnamed route list.

## Part B — Bindings

### API

The host owns routes and content. The shell allocates the main ID and connects the skip link to it. It does not forward root attributes, events or refs.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `workflows:AppShell` | `aside` | `ReactNode` | Unspecified | Caller input | — |
| `workflows:AppShell` | `children` | `ReactNode` | Required | Caller content | — |
| `workflows:AppShell` | `footer` | `ReactNode` | Unspecified | Caller input | — |
| `workflows:AppShell` | `header` | `ReactNode` | Unspecified | Caller input | — |
| `workflows:AppShell` | `navigation` | `ReactNode` | Required | Caller input | — |
| `workflows:AppShell` | `navigationLabel` | `string` | Required | Caller input | — |
| `workflows:AppShell` | `skipLabel` | `string` | Required | Caller input | — |

### React web

#### Rendering

`workflows` is a client entry. `AppShell` itself holds no state or handlers; it allocates the main id with `useId`, so server and client renders produce the same skip target and hydrate without a mismatch.

The skip link is first, then the optional header, named navigation, main content, optional aside and optional footer. Every slot is mounted once and repositioned only by CSS.

#### Headless API

None. This family provides presentation or structure without separate behavior to extract.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Platform | Public contract |
| --- | --- |
| Web | `AppShell` from `@ui-lazy-dev/ui-web/workflows`. |
| Native | Planned. No exported renderer or simulator journey. Track parity in the [family inventory](../component-inventory.md). |

**Variants.** A container query on `.uld-shell` switches the layout at 48 rem (navigation rail) and, when an aside is present, at 64 rem (three columns).

**Keyboard and pointer.** The skip link is an anchor to the `main` element, which has `tabIndex=-1`, so following the fragment moves focus into the workspace.

**Accessibility.** Header, nav, main, aside and footer render as `header`, `nav` (with `aria-label`), `main`, `aside` and `footer`. The skip link becomes visible on focus using system colors.

**Composition.** Pass the existing menu markup to navigation; nest WorkspacePage and optionally SplitView inside main. [Catalog fixture](../../catalog/EnterpriseWorkspace.stories.tsx).

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Default | Render navigation and main | Named nav and main landmark | Slotted actions and skip link | Skip link first | [Landmark order and slot collapse](../../tests/application-shell/workflow-shell.test.tsx) |
| Skip used | Follow the skip link | Main region focusable programmatically only | Yes | Main | [Skip target focus](../../tests/application-shell/workflow-shell.test.tsx) |
| Compact | Resize to a narrow container | Same navigation and main landmarks | Existing controls | Current focus retained in fixture | [enterprise-workspace.spec.ts L5](../../tests/browser/enterprise-workspace.spec.ts#L5) |
| Wide | Restore available container width | Landmark order stays the same | Existing controls | Current focus retained in fixture | [enterprise-workspace.spec.ts L5](../../tests/browser/enterprise-workspace.spec.ts#L5) |

#### Performance

`AppShell` measures 313 B gzip as a separate named import (305 B recorded; 301 B measured before the aside slot), with React and React DOM external. The aside layout adds 26 B to the optional `workflows.css` sheet (1,547 B before, 1,573 B after, against a 1,653 B ceiling). The optional `/workflows` entry stays outside the default web entry. [Bundle methodology](../../scripts/verify-bundles.mjs)

#### Tests

- Landmark order, slot collapse and skip target. [workflow-shell.test.tsx](../../tests/application-shell/workflow-shell.test.tsx)
- Compact and wide reflow with retained focus. [enterprise-workspace.spec.ts L5](../../tests/browser/enterprise-workspace.spec.ts#L5)
- Pending: a dedicated catalog story, browser regression for the three-column layout and the neutral scenario land with the native binding.

#### Changelog and deprecations

Unreleased: optional `aside` slot renders one complementary region after the main workspace and forms a third column in wide containers. Additive; no migration needed.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Application shell.

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
