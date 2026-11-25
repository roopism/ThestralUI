---
{
  "family": "Expanding media card",
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
      "name": "ExpandableMediaCard",
      "from": "@ui-lazy-dev/ui-web/motion"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/Disclosure",
    "https://mui.com/material-ui/react-card/"
  ]
}
---

# Expanding media card

## Part A — Contract

### Purpose and when not to use it

Let a reader inspect details attached to an image or video without leaving its place in a collection. Use a link when choosing the item opens another destination.

### Anatomy

Persistent media and a heading identify the item. A toggle reveals its additional detail.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| media | Required | N/A — required | Container gap | Children retain their semantics | Operable children keep their order |
| heading | Required | N/A — required | Container gap | Provides the accessible name | Text adds no stop |
| toggle | Required | N/A — required | Container gap | Action has its own name | Takes its place when available |
| details | Required | N/A — required | Container gap | Children retain their semantics | Operable children keep their order |

### Variants

The collapsed media uses a wide crop and the expanded view gives the media more height. The card can manage its own disclosure, optionally starting open, or follow a state owned by its container, for example to keep only one card in a collection open. The heading level follows the surrounding outline.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Collapsed | Collapse details | Wide media crop | The opener reports collapsed and details are hidden | Disclosure button | Button and other visible controls | Pending: collapsed scenario |
| Expanded | Expand details, start open, or have the owning container open it | Larger media crop | The opener reports expanded and details are readable | Disclosure and detail actions | Button and visible detail controls | Pending: expanded scenario |
| Interrupted | Reverse the transition | Prior transform cancels | The latest choice determines the visible details | Disclosure remains operable | Focused toggle survives reversals | Pending: interrupted scenario |

### Keyboard, pointer and touch

Activate the disclosure button with Enter, Space, a click or tap. Hidden details are outside normal tab order.

### Accessibility

Give meaningful media a text alternative and provide complementary expand and collapse labels. The disclosure reports its expanded state and references the details it controls; when the container owns the state, the reported state always matches what is shown. Reduced motion skips interpolation while retaining content access. The disclosure target grows for coarse pointers. Header actions wrap in source order in RTL. Check button text and outline against the card surface in forced colors and both color schemes.

### State patterns

This family owns no request lifecycle. Its containing surface supplies any loading, empty, error, offline, permission or partial-failure state.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

| Part or state | Token |
| --- | --- |
| Surface | `light.surface`, `dark.surface` |
| Card and media corners | `shape.radiusLg`, `size.radius` |
| Content spacing | `space.spaceMd` |
| Geometry animation | `motion.enterDuration` |

### Composition and content guidelines

Place the card inside a slide or collection item. Supply player controls in the media slot when needed. Do not put unrelated page-level controls in its disclosure content. Use “Read details” and “Hide details” with a distinct publication title. Supply details that add information beyond the title and describe the image only when it conveys content.

## Part B — Bindings

### API

The card owns its boolean expanded state, initially false. Callers provide media, title, detail children and both button labels. animate optionally interpolates the media geometry. No public ref or expansion-change callback is available.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `motion:ExpandableMediaCard` | `animate` | `boolean \| undefined` | Unspecified | Caller input | — |
| `motion:ExpandableMediaCard` | `children` | `ReactNode` | Required | Caller content | — |
| `motion:ExpandableMediaCard` | `collapseLabel` | `string` | Required | Caller input | — |
| `motion:ExpandableMediaCard` | `defaultExpanded` | `boolean \| undefined` | Unspecified | Uncontrolled initial value | — |
| `motion:ExpandableMediaCard` | `expanded` | `boolean \| undefined` | Unspecified | Controlled value | — |
| `motion:ExpandableMediaCard` | `expandLabel` | `string` | Required | Caller input | — |
| `motion:ExpandableMediaCard` | `headingLevel` | `2 \| 3 \| 4 \| undefined` | Unspecified | Caller input | — |
| `motion:ExpandableMediaCard` | `media` | `ReactNode` | Required | Caller input | — |
| `motion:ExpandableMediaCard` | `onExpandedChange` | `((expanded: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `motion:ExpandableMediaCard` | `title` | `string` | Required | Caller input | — |

### React web

#### Rendering

`motion` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

An article contains a persistent media slot, a heading (`headingLevel` 2, 3 or 4, default 2), a disclosure button and a details container whose generated ID is referenced by the button. `defaultExpanded` sets the initial uncontrolled state; `expanded` with `onExpandedChange` makes it controlled, and every activation reports the requested state.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Platform | Public contract |
| --- | --- |
| Web | `ExpandableMediaCard` from `@ui-lazy-dev/ui-web/motion`. |
| Native | Planned. No exported renderer or simulator journey. Track parity in the [family inventory](../component-inventory.md). |

**Variants.** The collapsed media uses a wide crop and the expanded view gives the media more height. Setting animate to true opts into shared-element animation after the layout changes.

**Keyboard and pointer.** Activate the disclosure button with Enter, Space, a click or tap. The button stays mounted across reversals. Hidden details are outside normal tab order.

**Accessibility.** Give meaningful media a text alternative and provide complementary expand and collapse labels. `headingLevel` keeps the title in the composing page's outline. Reduced motion skips interpolation while retaining content access. Focus and text enlargement have browser coverage. The disclosure target grows for coarse pointers. Header actions wrap in source order in RTL. Check button text and outline against the card surface in forced colors and both color schemes.

**Composition.** Place the card inside a slide or collection item. Supply player controls in the media slot when needed. Do not put unrelated page-level controls in its disclosure content. [Catalog fixture](../../catalog/MotionGallery.stories.tsx).

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Collapsed | Render or close | Button has aria-expanded false and details are hidden | Disclosure button | Button and other visible controls | [motion-media.test.tsx L31](../../tests/expanding-media-card/motion-media.test.tsx#L9) |
| Expanded | Open disclosure | Button has aria-expanded true and details become visible | Disclosure and detail actions | Button and visible detail controls | [motion-media.test.tsx L31](../../tests/expanding-media-card/motion-media.test.tsx#L9) |
| Expanded | Control the card or start it open at heading level 3 | Requests are reported; the shown state follows the owner; outline level kept | Disclosure and detail actions | Button and visible detail controls | [Controlled and default-open cards](../../tests/expanding-media-card/motion-media.test.tsx) |
| Interrupted | Toggle again during size transition | Latest expanded state remains authoritative | Disclosure remains operable | Focused toggle survives reversals | [motion.spec.ts L104](../../tests/browser/motion.spec.ts#L79) |

#### Performance

The production named-import measurement is 1,746 B gzip for `ExpandableMediaCard`, including controlled state and heading levels. The optional `/motion` entry stays outside the default web entry. Measurements exclude React and React DOM and count JavaScript separately from CSS. [Bundle methodology](../../scripts/verify-bundles.mjs)

#### Tests

- Collapsed. [motion-media.test.tsx L31](../../tests/expanding-media-card/motion-media.test.tsx#L9)
- Expanded. [motion-media.test.tsx L31](../../tests/expanding-media-card/motion-media.test.tsx#L9) and [controlled and default-open cards](../../tests/expanding-media-card/motion-media.test.tsx).
- Interrupted. [motion.spec.ts L104](../../tests/browser/motion.spec.ts#L79)
- Browser coverage. [quality.spec.ts L227](../../tests/expanding-media-card/quality.spec.ts#L3)
- Visual coverage. [motion.visual.ts](../../tests/browser/motion.visual.ts)
- Simulator coverage awaits a native export.

#### Changelog and deprecations

The `0.3.0-rc.1` draft documents the public contract introduced in `da96ebb`. No deprecations are declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Expanding media card.

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
