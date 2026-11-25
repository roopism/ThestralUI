---
{
  "family": "DocumentPreview",
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
      "name": "DocumentPreview",
      "from": "@ui-lazy-dev/ui-web/patterns",
      "rendering": "server-safe"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/Group",
    "https://mui.com/material-ui/react-card/"
  ]
}
---

# DocumentPreview

## Part A — Contract

### Purpose and when not to use it

Give a caller-supplied document viewer a named region that preserves its contents while loading. Use a format-specific viewer for pagination, zoom, printing and exporting.

### Anatomy

The named viewing area holds the document presentation, controls and any status supplied by the caller.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| content | Optional | collapse | Container gap | Children retain their semantics | Operable children keep their order |

### Variants

A preview may hold a rich document viewer, plain accessible content or recovery controls. Busy status can change without replacing the document.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Busy | Begin loading | See Tokens | The named viewing area retains its contents | Through the supplied controls | Controls supplied inside the viewing area | Pending: busy scenario |
| Ready | Finish loading | See Tokens | Busy clears and the user’s input survives | Through the supplied controls | Controls supplied inside the viewing area | Pending: ready scenario |
| Removed | Remove the viewer | Region removed | The viewer leaves the reading order | No | No | Pending: removal scenario |

### Keyboard, pointer and touch

The wrapper assigns no keyboard shortcuts.

### Accessibility

The wrapper does not create a live region. The section introduces no focus target, color treatment or motion of its own. A document viewer and its toolbar needs its own high-contrast, zoom, reduced-motion, RTL and keyboard checks.

### State patterns

Keep the viewing area and its content in place while loading. The document owner supplies error, unavailable and retry content.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

N/A — the document presentation chooses its own surface and text tokens.

### Composition and content guidelines

“Q4 invoice preview” distinguishes this region from adjacent previews. Use actionable recovery copy such as “Preview unavailable. Download the PDF.” when appropriate.

## Part B — Bindings

### API

Supply label for the section name. HTML section props, children and a ref pass through. The caller owns viewer lifetime, content safety, busy state and all commands. label determines the aria-label emitted by the wrapper.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `patterns:DocumentPreview` | `children` | `import("react").ReactNode` | Unspecified | Caller content | — |
| `patterns:DocumentPreview` | `className` | `string \| undefined` | Unspecified | Caller input | — |
| `patterns:DocumentPreview` | `label` | `string` | Required | Caller input | — |
| `patterns:DocumentPreview` | `ref` | `import("react").Ref<HTMLElement> \| undefined` | Unspecified | Caller reference | `HTMLElement` |
| `patterns:DocumentPreview` | `style` | `import("react").CSSProperties \| undefined` | Unspecified | Caller input | — |
| `patterns:DocumentPreview` | Host attributes | 276 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`patterns` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

A labeled section receives the host’s header, renderer and any status or fallback controls as children. No nested document, toolbar or footer is created by default.

#### Headless API

None. This family provides presentation or structure without separate behavior to extract.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Platform | Public contract |
| --- | --- |
| Web | `DocumentPreview` from `@ui-lazy-dev/ui-web/patterns`. |
| Native | Planned. No exported renderer or simulator journey. Track parity in the [family inventory](../component-inventory.md). |

**Variants.** A preview can contain a rich viewer, plain accessible content or host error recovery. aria-busy is an inherited section attribute. It does not initiate work or replace the child renderer.

**Keyboard and pointer.** The wrapper assigns no keyboard shortcuts. The host viewer supplies focus management for pages, zoom and actions and should let Tab leave the viewer.

**Accessibility.** Use a specific localized region label, provide accessible text or a download alternative for inaccessible document formats, and announce failures or progress through a host status component where needed. The wrapper does not create a live region. The section introduces no focus target, color treatment or motion of its own. A PDF canvas, embedded document or toolbar needs its own high-contrast, zoom, reduced-motion, RTL and keyboard checks.

**Tokens.** N/A — DocumentPreview provides a semantic section and a class hook. The host renderer selects its surface, typography and content-specific tokens.

**Composition.** Place a PanelHeader with an appropriate heading and a single renderer inside the region. Keep the renderer keyed by document identity when continuity across busy state changes matters. [Catalog fixture](../../catalog/DocumentReview.stories.tsx).

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Busy | Host marks aria-busy while loading | Named region contains the same mounted children | Host controls only | Host controls only | [patterns.test.tsx L33](../../tests/documentpreview/patterns.test.tsx#L9) |
| Ready | Host clears aria-busy | Region reports aria-busy false and input state survives | Host controls only | Host controls only | [patterns.test.tsx L33](../../tests/documentpreview/patterns.test.tsx#L9) |
| Ready | Host mounts its own viewer | One named region forwards its ref, class, ID and language and directly contains the viewer | Host controls only | Host controls only | [Named region and forwarding](../../tests/documentpreview/runtime-cleanup.test.tsx) |
| Detached | Parent unmounts | Section ref clears | No | No | [family-contracts.test.tsx L18](../../tests/family-contracts.test.tsx#L15) |

#### Performance

The production named-import measurement is 194 B gzip for `DocumentPreview`. The optional `/patterns` entry stays outside the default web entry. Measurements exclude React and React DOM and count JavaScript separately from CSS. [Bundle methodology](../../scripts/verify-bundles.mjs)

#### Tests

- Busy. [patterns.test.tsx L33](../../tests/documentpreview/patterns.test.tsx#L9)
- Ready. [patterns.test.tsx L33](../../tests/documentpreview/patterns.test.tsx#L9) and [named region and forwarding](../../tests/documentpreview/runtime-cleanup.test.tsx).
- Detached. [family-contracts.test.tsx L18](../../tests/family-contracts.test.tsx#L15)
- A dedicated three-engine journey for this family remains open.
- A dedicated visual baseline for this family remains open.
- Simulator coverage awaits a native export.

Open: `/patterns` ships no stylesheet, so the viewer frame and busy treatment wait for a per-family sheet.

#### Changelog and deprecations

The `0.3.0-rc.1` draft documents the public contract introduced in `f58a492`. No deprecations are declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of DocumentPreview.

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
