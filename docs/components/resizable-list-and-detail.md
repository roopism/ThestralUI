---
{
  "family": "Resizable list and detail",
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
      "name": "SplitView",
      "from": "@ui-lazy-dev/ui-web/workflows"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/Group",
    "https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/"
  ]
}
---

# Resizable list and detail

## Part A — Contract

### Purpose and when not to use it

Keep a collection and its selected record side by side, and let the reader resize the two panes. Use a stack for unrelated sections, tabs when only one view is needed at a time, and a drawer for detail that should cover the list temporarily.

### Anatomy

Two named panes flank a movable divider that reports the list's share of the width.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| list | Required | N/A — the view pairs a list with its detail | Container gap | Named region; children keep their names | First pane; focusable as a target of pane switching |
| divider | Required | N/A — present whenever both panes sit side by side | Container gap | Named separator with its current value | One stop between the panes |
| detail | Required | N/A — the view pairs a list with its detail | Container gap | Named region; children keep their names | After the divider |

### Variants

- **Compact** (narrow container): panes stack and the divider is hidden; both panes stay mounted.
- **Wide**: panes sit side by side with a divider for keyboard or pointer resizing; coarse pointers get a wider grab area.
- **Bounds**: the list's share is limited to a minimum and maximum (20 % and 80 % by default).
- **Controlled or uncontrolled**: the owner can supply the size, or let the view keep it from an initial size.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Default | Show both panes | `light.text` | The divider reports the list's current share | Divider | Divider | Pending: the neutral separator role lands with the native binding |
| Resized | Arrow keys, Home, End or drag | `light.text` | The reported value changes within its bounds | Divider | Divider | Pending: the neutral vocabulary has no key-press or drag verb yet |
| Collapsed | Enter on the divider | `light.text` | The list is at its minimum; Enter restores the previous size | Divider | Divider | Pending: the neutral vocabulary has no key-press verb yet |
| Focus restored | Switch panes with F6 | `light.focus` | Focus returns to the pane or its last focused control | Pane content | Previously focused control | Pending: the neutral vocabulary cannot yet observe focus |
| Compact | Narrow the container | `light.text` | Both named panes remain; the divider is hidden | Pane content | Preserves the focused control | Pending: the neutral vocabulary cannot yet resize a container |

### Keyboard, pointer and touch

- Left and Right change the list's share by one point, or ten with Shift; in right-to-left content the directions reverse. Home and End jump to the minimum and maximum.
- Enter collapses the list to its minimum and a second Enter restores the previous size.
- F6 switches between the panes and restores the control that last had focus in the target pane; modified F6 is ignored.
- Dragging the divider with a primary pointer resizes continuously; the panes keep scrolling independently.

### Accessibility

- **Roles.** Two named regions and a focusable vertical separator that controls the list region.
- **Name and value.** The caller names both panes and the divider. The divider reports its minimum, maximum and current share as a percentage.
- **Announcements.** Value changes are announced through the separator value; no live region is needed.
- **Target size.** The divider keeps a coarse target width and full pane height.
- **Contrast and forced colors.** The divider uses inherited foreground and system highlight focus.
- **Reduced motion.** Resizing updates the layout without animation.
- **Right to left.** The list is the logical start pane and arrow directions follow the reading direction.

### State patterns

This family owns no request lifecycle. Its containing surface supplies any loading, empty, error, offline, permission or partial-failure state.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

| Part or state | Token |
| --- | --- |
| Divider line and pane text | `light.text`, `dark.text` |
| Focus-visible outline | `light.focus`, `dark.focus` |
| Divider target | `density.coarseTarget` |

### Composition and content guidelines

- Do supply the collection and the selected record as separate slots, and keep their keys stable so drafts survive resizing.
- Do name the panes after their content, such as “Results” and “Selected invoice”, and the divider after its action, such as “Resize results”.
- Avoid naming both panes “Panel”, and avoid nesting split views.

## Part B — Bindings

### API

An initial defaultSize seeds internal size (40 percent by default). onSizeChange receives a clamped whole percentage. The host owns selected records and child inputs; there is no controlled size prop or forwarded ref.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `workflows:SplitView` | `defaultSize` | `number \| undefined` | Unspecified | Uncontrolled initial value | — |
| `workflows:SplitView` | `detail` | `ReactNode` | Required | Caller input | — |
| `workflows:SplitView` | `detailLabel` | `string` | Required | Caller input | — |
| `workflows:SplitView` | `list` | `ReactNode` | Required | Caller input | — |
| `workflows:SplitView` | `listLabel` | `string` | Required | Caller input | — |
| `workflows:SplitView` | `maxSize` | `number \| undefined` | Unspecified | Caller input | — |
| `workflows:SplitView` | `minSize` | `number \| undefined` | Unspecified | Caller input | — |
| `workflows:SplitView` | `onSizeChange` | `((percentage: number) => void) \| undefined` | Unspecified | Caller callback | — |
| `workflows:SplitView` | `resizeLabel` | `string` | Required | Caller input | — |
| `workflows:SplitView` | `size` | `number \| undefined` | Unspecified | Controlled value | — |

### React web

#### Rendering

`workflows` is a client entry: the divider holds its size and keyboard and pointer handlers. The initial size renders on the server as a CSS custom property, so the first paint already has the final split.

Two labeled pane sections surround a vertical separator. The list and detail slots keep their identities. The handle reports the share allocated to the logical start pane.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Platform | Public contract |
| --- | --- |
| Web | `SplitView` from `@ui-lazy-dev/ui-web/workflows`. |
| Native | Planned. No exported renderer or simulator journey. Track parity in the [family inventory](../component-inventory.md). |

**Accessibility.** The divider is a `role="separator"` element with `tabIndex=0`, `aria-orientation="vertical"`, `aria-controls` naming the list section and `aria-valuemin`, `aria-valuemax`, `aria-valuenow` and `aria-valuetext`. Panes are `section` elements with `aria-label` and `aria-keyshortcuts="F6"`.

**Tokens.** The separator uses inherited foreground and system focus colors; the share is the `--uld-list-size` custom property.

**Composition.** Supply RecordList and the selected record page as separate slots. Use `size` with `onSizeChange` for a controlled split or `defaultSize` for an initial one; `minSize` and `maxSize` set the bounds. [Catalog fixture](../../catalog/EnterpriseWorkspace.stories.tsx).

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Default | Render with bounds | Named separator with range and value | Resize handle | Separator | [Separator semantics](../../tests/resizable-list-and-detail/workflow-shell.test.tsx) |
| Resized | Arrow keys, Home, End, drag | `aria-valuenow` updates within bounds | Resize handle | Separator | [Keyboard resize](../../tests/resizable-list-and-detail/workflow-shell.test.tsx) and [enterprise-workspace.spec.ts L5](../../tests/browser/enterprise-workspace.spec.ts#L5) |
| Collapsed | Enter, then Enter | Minimum, then the previous size | Resize handle | Separator | [Collapse and restore](../../tests/resizable-list-and-detail/workflow-shell.test.tsx) |
| Controlled | `size` with `onSizeChange` | Shows the owner value and reports requests | Resize handle | Separator | [Controlled size](../../tests/resizable-list-and-detail/workflow-shell.test.tsx) |
| Focus restored | F6 to switch panes and return | Named region or last focused child | Child-specific | Previously focused control | [Pane switching](../../tests/resizable-list-and-detail/workflow-shell.test.tsx) |
| Compact | Narrow the parent during a review | Both pane regions retained | Existing content | Preserves draft focus | [enterprise-workspace.spec.ts L5](../../tests/browser/enterprise-workspace.spec.ts#L5) |

#### Performance

`SplitView` measures 1,052 B gzip as a separate named import (978 B before controlled size, bounds and collapse), with React and React DOM external. No CSS change. The optional `/workflows` entry stays outside the default web entry. [Bundle methodology](../../scripts/verify-bundles.mjs)

#### Tests

- Separator semantics, bounds, keyboard resize, collapse and restore, controlled size, right to left and pane switching. [workflow-shell.test.tsx](../../tests/resizable-list-and-detail/workflow-shell.test.tsx)
- Drag, compact reflow and retained drafts in three engines. [enterprise-workspace.spec.ts](../../tests/browser/enterprise-workspace.spec.ts)
- Pending: a dedicated catalog story and the neutral scenario land with the native binding.

#### Changelog and deprecations

Unreleased: controlled `size`, `minSize` and `maxSize`, and Enter to collapse and restore the list. Additive; the default bounds stay 20 % and 80 %.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Resizable list and detail.

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
