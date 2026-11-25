---
{
  "family": "Page composition",
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
      "name": "WorkspacePage",
      "from": "@ui-lazy-dev/ui-web/workflows",
      "rendering": "server-safe"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/Group",
    "https://mui.com/material-ui/react-app-bar/"
  ]
}
---

# Page composition

## Part A — Contract

### Purpose and when not to use it

Name and organize a page within the application shell. Choose a panel header for a local subsection header without a new page heading.

### Anatomy

A page heading introduces the main content. Optional description and actions accompany it.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| heading | Required | N/A — required | Container gap | Provides the accessible name | Text adds no stop |
| description | Optional | collapse | Container gap | Provides supporting information | Text adds no stop |
| actions | Optional | collapse | Container gap | Children retain their semantics | Operable children keep their order |
| body | Required | N/A — required | Container gap | Children retain their semantics | Operable children keep their order |

### Variants

With actions the header wraps controls alongside the title when space permits. Omitting them removes the actions container.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Default | Present the page | Inherited shell text | The title names the page and serves as the main heading | Slot controls only | Slot controls only | Pending: default scenario |

### Keyboard, pointer and touch

The page creates no tab stops. Place header actions before body controls in the intended keyboard order. Pointer interaction belongs to the supplied controls.

### Accessibility

The containing section derives its name from that heading. The wrapping header supports long localized labels. Layout changes through normal flow, with no animation. The wrapper sets no target size. Test the supplied actions for contrast, forced colors and focus in the selected theme. Header items wrap when space narrows.

### State patterns

This family owns no request lifecycle. Its containing surface supplies any loading, empty, error, offline, permission or partial-failure state.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

Foreground and background inherit from the containing surface. Pending: map header spacing and line height to semantic tokens.

### Composition and content guidelines

Place related action buttons in actions and the task in children. Separate nested section headings from the page title. Use “Candidate review” with “Export” as an action; avoid repeating “Candidate review” in the description.

## Part B — Bindings

### API

Content and action ownership belong to the caller. The generated heading ID links the section name to the title. There are no wrapper event, ref or arbitrary host-prop slots.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `workflows:WorkspacePage` | `actions` | `ReactNode` | Unspecified | Caller input | — |
| `workflows:WorkspacePage` | `children` | `ReactNode` | Required | Caller content | — |
| `workflows:WorkspacePage` | `description` | `ReactNode` | Unspecified | Caller input | — |
| `workflows:WorkspacePage` | `title` | `string` | Required | Caller input | — |

### React web

#### Rendering

`workflows` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

A section labelled by its h1 contains a header with optional description and action slots; body children follow the header.

#### Headless API

None. This family provides presentation or structure without separate behavior to extract.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Platform | Public contract |
| --- | --- |
| Web | `WorkspacePage` from `@ui-lazy-dev/ui-web/workflows`. |
| Native | Planned. No exported renderer or simulator journey. Track parity in the [family inventory](../component-inventory.md). |

**Accessibility.** Use one short h1 that identifies the page. The containing section derives its name from that heading. The wrapping header supports long localized labels. Text and focus styling of actions depend on the host. Layout changes through normal flow, with no animation. The wrapper sets no target size. Test the supplied actions for contrast, forced colors and focus in the selected theme. Header items wrap when space narrows.

**Tokens.** N/A — The page inherits foreground and background. Header spacing and line height currently come from its workflow stylesheet.

**Composition.** Render as a child of AppShell main. Place related action buttons in actions and the task in children. Separate nested section headings from the page title. [Catalog fixture](../../catalog/EnterpriseWorkspace.stories.tsx).

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Default | Mount a page title and actions | Named section and level-one heading | Slot controls only | Slot controls only | [workflow-shell.test.tsx L63](../../tests/workflow-shell.test.tsx#L9) |

#### Performance

The production named-import measurement is 292 B gzip for `WorkspacePage`. The optional `/workflows` entry stays outside the default web entry. Measurements exclude React and React DOM and count JavaScript separately from CSS. [Bundle methodology](../../scripts/verify-bundles.mjs)

#### Tests

- Default. [workflow-shell.test.tsx L63](../../tests/workflow-shell.test.tsx#L9)
- A dedicated three-engine journey for this family remains open.
- A dedicated visual baseline for this family remains open.
- Simulator coverage awaits a native export.

#### Changelog and deprecations

The `0.3.0-rc.1` draft documents the public contract introduced in `f7eeceb`. No deprecations are declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Page composition.

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
