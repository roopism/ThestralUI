---
{
  "family": "ResourceCard",
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
      "name": "ResourceCard",
      "from": "@ui-lazy-dev/ui-web/patterns"
    }
  ],
  "reference": [
    "https://mui.com/material-ui/react-card/",
    "https://react-aria.adobe.com/Button"
  ]
}
---

# ResourceCard

## Part A — Contract

### Purpose and when not to use it

Represent a named resource with a controlled binary action such as saving an item. Use a simple navigation link when the resource solely opens a destination.

### Anatomy

A heading identifies the resource. Its action retains an accessible name as selection changes.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| heading | Required | N/A — required | Container gap | Provides the accessible name | Text adds no stop |
| artwork | Optional | collapse | Container gap | Children retain their semantics | Operable children keep their order |
| metadata | Optional | collapse | Container gap | Provides supporting information | Text adds no stop |
| action | Required | N/A — required | Container gap | Action has its own name | Takes its place when available |

### Variants

Heading levels 2, 3 and 4 preserve the document hierarchy. Optional metadata and artwork decorate the resource. The action uses the shared press motion treatment.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Unselected | Present an unselected item | Shared button surface | The toggle reports off | Yes, requests true | Action button | Pending: unselected scenario |
| Selection requested | Request selection | Caller-supplied action text remains until update | The owner receives the requested value | Yes | Action button | Pending: selection requested scenario |
| Selected | Confirm selection | Caller may change visible action text | The toggle keeps its name and reports on | Yes, requests false | Action button | Pending: selected scenario |
| Pressed | Press the action | Optional press transform or reduced-motion styling | The action retains its name | Yes | Action button | Pending: pressed scenario |
| Touch activated | Activate by touch | Selected button text and pressed state follow owner | The item’s selection is exposed | Yes | Action button for AT | Pending: touch activated scenario |

### Keyboard, pointer and touch

The contained button activates with Enter, Space, click or tap. The outer article is not an activation target. Keep any artwork links independent of the toggle.

### Accessibility

Include distinctive wording from the visible action in its accessible name. Provide appropriate artwork alternatives and choose the heading level explicitly when nesting cards. The shared button provides its minimum target, focus outline and reduced-motion path. The document language controls reading order.

### State patterns

This family owns no request lifecycle. Its containing surface supplies any loading, empty, error, offline, permission or partial-failure state.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

| Part or state | Token |
| --- | --- |
| Action background | `light.accent`, `dark.accent` |
| Action foreground | `light.onAccent`, `dark.onAccent` |
| Press feedback | `motion.pressDuration`, `motion.pressScale` |

### Composition and content guidelines

Use a collection of articles with a shared selection owner if saving updates other surfaces. “Save proposal” can remain the accessible name while the visual label changes from “Save” to “Saved”. Metadata such as “PDF · 4 pages” helps identify the resource.

## Part B — Bindings

### API

The caller owns selected and must update it in response to onSelectedChange. actionLabel names the button while actionText is its visible content. headingLevel defaults to 2. The article accepts a class, ref and host attributes.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `patterns:ResourceCard` | `actionLabel` | `string` | Required | Caller input | — |
| `patterns:ResourceCard` | `actionText` | `string` | Required | Caller input | — |
| `patterns:ResourceCard` | `artwork` | `ReactNode` | Unspecified | Caller input | — |
| `patterns:ResourceCard` | `bodyClassName` | `string \| undefined` | Unspecified | Caller input | — |
| `patterns:ResourceCard` | `className` | `string \| undefined` | Unspecified | Caller input | — |
| `patterns:ResourceCard` | `headingLevel` | `2 \| 3 \| 4 \| undefined` | Unspecified | Caller input | — |
| `patterns:ResourceCard` | `metadata` | `ReactNode` | Unspecified | Caller input | — |
| `patterns:ResourceCard` | `onSelectedChange` | `(selected: boolean) => void` | Required | Caller callback | — |
| `patterns:ResourceCard` | `ref` | `import("react").Ref<HTMLElement> \| undefined` | Unspecified | Caller reference | `HTMLElement` |
| `patterns:ResourceCard` | `selected` | `boolean` | Required | Caller input | — |
| `patterns:ResourceCard` | `style` | `import("react").CSSProperties \| undefined` | Unspecified | Caller input | — |
| `patterns:ResourceCard` | `title` | `string` | Required | Caller input | — |
| `patterns:ResourceCard` | Host attributes | 275 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`patterns` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

The article is named by its generated heading ID. Optional artwork precedes the body, which contains optional metadata, the heading and a shared Button with a stable accessible name.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Platform | Public contract |
| --- | --- |
| Web | `ResourceCard` from `@ui-lazy-dev/ui-web/patterns`. |
| Native | Planned. No exported renderer or simulator journey. Track parity in the [family inventory](../component-inventory.md). |

**Accessibility.** Keep actionLabel stable across both states. Include distinctive wording from the visible action in its accessible name. Provide appropriate artwork alternatives and choose the heading level explicitly when nesting cards. The shared button provides its minimum target, focus outline and reduced-motion path. The document language controls reading order. Check the host artwork and surface together with the button in forced colors.

**Composition.** Use a collection of articles with a shared selection owner if saving updates other surfaces. Render definitive selection from the owner after handling the request. [Catalog fixture](../../catalog/DocumentReview.stories.tsx).

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Unselected | Render selected false | Button exposes aria-pressed false | Yes, requests true | Action button | [patterns.test.tsx L11](../../tests/resourcecard/patterns.test.tsx#L9) |
| Unselected | Omit metadata and artwork at heading level 3 | Optional slots collapse; the title names the article at the requested level | Yes, requests true | Action button | [Slot collapse and outline](../../tests/resourcecard/patterns.test.tsx) |
| Selection requested | Activate the action | Callback receives the requested next boolean | Yes | Action button | [patterns.test.tsx L11](../../tests/resourcecard/patterns.test.tsx#L9) |
| Selected | Caller rerenders with selected true | Button exposes pressed state and keeps its name | Yes, requests false | Action button | [patterns.test.tsx L11](../../tests/resourcecard/patterns.test.tsx#L9) |
| Selected | Activate a selected card with forwarded attributes | Requests false through the same action; article and body classes and ID kept | Yes, requests false | Action button | [Deselect and forwarding](../../tests/resourcecard/patterns.test.tsx) |
| Pressed | Press the toggle by pointer or keyboard | Button retains a stable accessible name | Yes | Action button | [adaptive.spec.ts L3](../../tests/browser/adaptive.spec.ts#L3) |
| Touch activated | Tap the toggle on a narrow screen | Button exposes aria-pressed true | Yes | Action button for AT | [adaptive.spec.ts L44](../../tests/browser/adaptive.spec.ts#L44) |

#### Performance

The production named-import measurement is 574 B gzip for `ResourceCard`. The optional `/patterns` entry stays outside the default web entry. Measurements exclude React and React DOM and count JavaScript separately from CSS. [Bundle methodology](../../scripts/verify-bundles.mjs)

#### Tests

- Unselected. [patterns.test.tsx L11](../../tests/resourcecard/patterns.test.tsx#L9)
- Selection requested. [patterns.test.tsx L11](../../tests/resourcecard/patterns.test.tsx#L9)
- Selected. [patterns.test.tsx L11](../../tests/resourcecard/patterns.test.tsx#L9) and [deselect and forwarding](../../tests/resourcecard/patterns.test.tsx).
- Slots and outline. [Slot collapse and heading level](../../tests/resourcecard/patterns.test.tsx).
- Pressed. [adaptive.spec.ts L3](../../tests/browser/adaptive.spec.ts#L3)
- Touch activated. [adaptive.spec.ts L44](../../tests/browser/adaptive.spec.ts#L44)
- Browser coverage. [adaptive.spec.ts L3](../../tests/browser/adaptive.spec.ts#L3)
- A dedicated visual baseline for this family remains open.
- Simulator coverage awaits a native export.

Open: `/patterns` ships no stylesheet, so the card surface, spacing and selected treatment wait for a per-family sheet; the entry has 32 B of script headroom.

#### Changelog and deprecations

The `0.3.0-rc.1` draft documents the public contract introduced in `f58a492`. No deprecations are declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of ResourceCard.

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
