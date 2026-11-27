---
{
  "family": "Snap carousel",
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
      "name": "Carousel",
      "from": "@ui-lazy-dev/ui-web/motion"
    }
  ],
  "reference": [
    "https://www.w3.org/WAI/ARIA/apg/patterns/carousel/",
    "https://react-aria.adobe.com/Button"
  ]
}
---

# Snap carousel

## Part A — Contract

### Purpose and when not to use it

Let readers browse a short sequence one slide at a time, by swiping or with explicit previous and next actions, with the position always announced. Use a list or grid to compare many items at once, tabs for named peer views, and avoid carousels for content every reader must see.

### Anatomy

A named viewport contains the slides. Navigation actions flank the position announcement.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| slides | Required | N/A — required | Container gap | Children retain their semantics | Operable children keep their order |
| previous | Required | N/A — required | Container gap | Action has its own name | Takes its place when available |
| next | Required | N/A — required | Container gap | Action has its own name | Takes its place when available |
| position | Required | N/A — required | Container gap | Provides supporting information | Text adds no stop |

### Variants

- **Uncontrolled**: starts at the first slide, or at a chosen initial slide, and keeps its own position.
- **Controlled**: the owner supplies the current slide and receives every requested change, so the position can be shared with a URL or other views.
- The scroll track follows the layout direction. A zero-length collection omits the carousel entirely. There is no autoplay.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Current | Select a slide | See Tokens | The current slide’s controls are reachable | Current controls only | The viewing area and current controls | Pending: current scenario |
| Offscreen | Move a slide offscreen | See Tokens | Its controls leave the reading order | No | No | Pending: offscreen scenario |
| Boundary | Reach an endpoint | Disabled text color | The position updates and unavailable navigation is identified | Available direction only | Both boundary buttons stay in tab order | Pending: boundary scenario |
| Reordered | Reorder slides | See Tokens | The position follows the new order | Current controls | Current controls | Pending: reordered scenario |
| Empty | Remove all slides | See Tokens | The region and controls disappear | No | No | Pending: empty scenario |

### Keyboard, pointer and touch

- With focus on the viewing area, Left and Right move one slide in the reading direction (reversed in right-to-left content), and Home and End move to the first and last slide. Modified keys are ignored.
- Keys pressed on a control inside a slide keep that control's own behaviour.
- Previous and Next accept keyboard or pointer activation and stay in the tab order at the ends, where the unavailable direction is identified.
- Horizontal swiping snaps to a slide and updates the position.

### Accessibility

- **Roles.** A named region described as a carousel contains a focusable, named group for the viewing area and one group per slide described as a slide and named by its title. Offscreen slides are hidden from assistive technology and cannot receive focus.
- **Announcements.** An atomic status announces the position, such as “2 of 5”, after every change.
- **Target size.** Previous and Next keep the coarse target size; swiping supplements but never replaces them.
- **Contrast and forced colors.** Focus outlines and the unavailable text colour must stay visible in the active theme.
- **Reduced motion.** Moving between slides scrolls without animation when reduced motion is requested.
- **Right to left.** Slide order, swiping and arrow keys mirror.

### State patterns

An empty sequence removes the region and its navigation actions.

### Localization

The caller supplies every string: the region name, the carousel and slide role descriptions, the previous and next labels, each slide title and the position formatter, which should use the locale's numbers. The family has no library-owned defaults.

### Tokens

| Part or state | Token |
| --- | --- |
| Navigation target | `size.control`, `density.coarseTarget` |
| Keyboard outline | `light.focus`, `dark.focus`, `density.focusWidth` |
| Boundary text | `light.disabled`, `dark.disabled` |
| Control separation | `space.spaceSm`, `space.spaceMd` |

### Composition and content guidelines

Supply an expandable card inside a slide when its details belong to that item. Use “Next publication” and “2 of 5” in the current locale. A slide title such as “After Hours” helps readers distinguish cards more reliably than “Item”.

## Part B — Bindings

### API

Supply stable item IDs, localized labels, and the position formatter. Selection lives inside Carousel and survives reordering by ID. Each item owns its content. The wrapper has no public DOM ref.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `motion:Carousel` | `defaultSelectedId` | `string \| undefined` | Unspecified | Uncontrolled initial value | — |
| `motion:Carousel` | `items` | `readonly CarouselItem[]` | Required | Caller input | — |
| `motion:Carousel` | `label` | `string` | Required | Caller input | — |
| `motion:Carousel` | `labels` | `CarouselLabels` | Required | Caller input | — |
| `motion:Carousel` | `onSelectionChange` | `((id: string) => void) \| undefined` | Unspecified | Caller callback | — |
| `motion:Carousel` | `selectedId` | `string \| undefined` | Unspecified | Controlled value | — |

### React web

#### Rendering

`motion` is a client entry: the carousel tracks its position, scroll and keyboard handlers. The server renders the initial slide as current and the others as inert, so hydration keeps the same reading order.

A named section encloses the scroll-snap viewport and one group per slide. Previous and next buttons flank the localized position status.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Query the region, the viewing group, the current slide group and the position status by role and name.

#### Platform differences

| Platform | Public contract |
| --- | --- |
| Web | `Carousel` from `@ui-lazy-dev/ui-web/motion`. |
| Native | Planned. No exported renderer or simulator journey. Track parity in the [family inventory](../component-inventory.md). |

**Variants.** The scroll track inherits layout direction. There is one slide per viewport with explicit navigation and manual touch scrolling. A zero-length collection omits the carousel.

**Keyboard and pointer.** Focus the viewport for Left, Right, Home and End. Arrow direction follows RTL. Keys on a slide child retain their own behavior. Previous and Next accept keyboard or pointer activation. Horizontal touch scrolling updates the position.

**Accessibility.** Localize the region, slide descriptions, item names, and position text. The atomic status describes the selected position. Each offscreen slide is inert. Buttons and viewport use focus-visible outlines. No autoplay timer is installed. Touch scroll is supplemented by independent navigation buttons with a coarse-pointer size. RTL reverses horizontal key navigation. In high contrast, verify both focus outlines and disabled text in the active theme.

**Composition.** Give every slide a stable ID as the collection changes. Keep the collection short because all slide contents stay mounted. Supply an expandable card inside a slide when its details belong to that item. [Catalog fixture](../../catalog/MotionGallery.stories.tsx).

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Current | Move to a visible item | Current group exposes its interactive descendants | Current controls only | Viewport and current controls | [motion-media.test.tsx L19](../../tests/snap-carousel/motion-media.test.tsx#L23) |
| Offscreen | Select a different slide | Inactive group has inert and aria-hidden | No | No | [motion-media.test.tsx L19](../../tests/snap-carousel/motion-media.test.tsx#L23) |
| Boundary | Reach the first or last slide | Position status updates and the unavailable direction has aria-disabled | Available direction only | Both boundary buttons stay in tab order | [motion.spec.ts L57](../../tests/browser/motion.spec.ts#L57) |
| Reordered | Change item order while preserving its ID | Position updates relative to new order | Current controls | Current controls | [motion-media.test.tsx L19](../../tests/snap-carousel/motion-media.test.tsx#L23) |
| Empty | Remove all items | No region or controls remain | No | No | [motion-media.test.tsx L19](../../tests/snap-carousel/motion-media.test.tsx#L23) |
| Keyboard | Arrow keys, Home and End on the viewport | Position follows the reading direction; ends set `aria-disabled` | Yes | Viewport | [Keyboard and boundaries](../../tests/snap-carousel/motion-media.test.tsx) |
| Controlled | `selectedId` with `onSelectionChange` | Shows the owner slide and reports requests | Yes | Viewport and current controls | [Controlled selection](../../tests/snap-carousel/motion-media.test.tsx) |

#### Performance

`Carousel` measures 954 B gzip as a separate named import (895 B before controlled selection), with React and React DOM external. No CSS change; the visual baselines are unchanged. The optional `/motion` entry stays outside the default web entry. [Bundle methodology](../../scripts/verify-bundles.mjs)

#### Tests

- Current. [motion-media.test.tsx L19](../../tests/snap-carousel/motion-media.test.tsx#L23)
- Offscreen. [motion-media.test.tsx L19](../../tests/snap-carousel/motion-media.test.tsx#L23)
- Boundary. [motion.spec.ts L57](../../tests/browser/motion.spec.ts#L57)
- Reordered. [motion-media.test.tsx L19](../../tests/snap-carousel/motion-media.test.tsx#L23)
- Empty. [motion-media.test.tsx L19](../../tests/snap-carousel/motion-media.test.tsx#L23)
- Browser coverage. [motion.spec.ts](../../tests/browser/motion.spec.ts)
- Visual coverage. [motion.visual.ts](../../tests/browser/motion.visual.ts)
- Simulator coverage awaits a native export.
- Keyboard traversal, boundary semantics, role descriptions and controlled selection. [motion-media.test.tsx](../../tests/snap-carousel/motion-media.test.tsx)

#### Changelog and deprecations

Unreleased: `selectedId`, `defaultSelectedId` and `onSelectionChange` add controlled and initial selection. Additive; uncontrolled behaviour is unchanged.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Snap carousel.

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
