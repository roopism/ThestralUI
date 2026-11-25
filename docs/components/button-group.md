---
{
  "family": "Button group",
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
      "name": "ButtonGroup",
      "from": "@ui-lazy-dev/ui-web/primitives",
      "rendering": "server-safe"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/Button",
    "https://mui.com/material-ui/react-button-group/"
  ]
}
---

# Button group

## Part A — Contract

### Purpose and when not to use it

Name a group of related independent actions. Use a radio group for mutually exclusive choices and Toolbar when arrow-key navigation is required.

### Anatomy

A label identifies related actions. Each action retains its own name.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| actions | Optional | collapse | Container gap | Children retain their semantics | Operable children keep their order |

### Variants

A spaced, wrapping row is the current treatment. Attached and segmented presentation are open requirements. Individual child buttons own their sizes, tones and disabled states.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Default | Display related actions | Inline gap from theme | The group has a name and each action stays operable | Children only | Children only | Pending: default scenario |

### Keyboard, pointer and touch

Tab and Shift+Tab visit enabled child buttons in reading order. Enter and Space activate the focused button. Pointer and touch targets belong to the children. Arrow keys have no group-specific handling.

### Accessibility

Use a short description that distinguishes sibling action groups. The group's label does not replace individual button names. Text and target contrast come from each button. The group adds no pointer target, animation or color adjustments. Each action owns its reduced-motion and forced-color treatment.

### State patterns

This family owns no request lifecycle. Its containing surface supplies any loading, empty, error, offline, permission or partial-failure state.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

| Part or state | Token |
| --- | --- |
| Space between child actions | `size.gap` |

### Composition and content guidelines

The parent can submit a form or dismiss a dialog. Assign explicit button types where one child submits. Do label the group “Document actions” and its buttons “Download” and “Archive”. Avoid repeating the group name in every button. Translate each complete action label.

## Part B — Bindings

### API

Requires `label` and accepts div props and ref. The wrapper sets its accessible name and group role after forwarding caller props. There is no internal selection, button registration or roving-tabindex state.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `primitives:ButtonGroup` | `children` | `import("react").ReactNode` | Unspecified | Caller content | — |
| `primitives:ButtonGroup` | `className` | `string \| undefined` | Unspecified | Caller input | — |
| `primitives:ButtonGroup` | `label` | `string` | Required | Caller input | — |
| `primitives:ButtonGroup` | `ref` | `import("react").Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `primitives:ButtonGroup` | `style` | `import("react").CSSProperties \| undefined` | Unspecified | Caller input | — |
| `primitives:ButtonGroup` | Host attributes | 276 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`primitives` is published without a client directive. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

A single Inline div carries the group role and name. Each entry in the children slot is an independently focusable action owned by the caller.

#### Headless API

None. This family provides presentation or structure without separate behavior to extract.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Contract | Web | Native | Tracking |
| --- | --- | --- | --- |
| Renderer | Inline layout with a named group role | No native family export | Native parity remains open in the [family audit](../component-depth.md). |

**Accessibility.** Use a short description that distinguishes sibling action groups. The group's label does not replace individual button names. Text and target contrast come from each button. Default wrapping accommodates RTL and longer labels without changing DOM order. The group adds no pointer target, animation or color adjustments. Each action owns its reduced-motion and forced-color treatment.

**Composition.** Use distinct Buttons or IconButtons as children. The parent can submit a form or dismiss a dialog. Assign explicit button types where one child submits.

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Default | Give the group a label and child actions | Named group | Children only | Children only | [Group contains its named content](../../tests/family-contracts.test.tsx) |

#### Performance

`ButtonGroup` 301 B. Measured gzip sizes for separate tree-shaken production web imports, with React and React DOM external. The group uses Inline layout and primitives.css. There is no collection observer, selection model or keyboard manager. The full optional `primitives.css` entry measures 862 B gzip.

#### Tests

- **Default.** [Group contains its named content](../../tests/family-contracts.test.tsx).

Unit and packed-consumer coverage verify group naming and children. Cross-engine keyboard behavior of individual buttons is covered in the [action browser tests](../../tests/browser/button-depth.spec.ts). Dedicated group snapshots and a native binding are open.

#### Changelog and deprecations

The 0.3.0-rc.1 candidate documents the current contract. No family-specific deprecations are declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Button group.

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
