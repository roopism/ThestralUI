---
{
  "family": "Disclosure and accordion",
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
      "name": "Disclosure",
      "from": "@ui-lazy-dev/ui-web/navigation"
    },
    {
      "platform": "web",
      "name": "DisclosureGroup",
      "from": "@ui-lazy-dev/ui-web/navigation"
    },
    {
      "platform": "web",
      "name": "DisclosurePanel",
      "from": "@ui-lazy-dev/ui-web/navigation"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/Disclosure",
    "https://mui.com/material-ui/react-accordion/"
  ]
}
---

# Disclosure and accordion

## Part A — Contract

### Purpose and when not to use it

Expand or collapse content next to its heading. Use Tabs when only one view should occupy a shared panel and Dialog for a separate modal task.

### Anatomy

A named trigger expands or collapses its associated panel. A group coordinates related panels.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| trigger | Required | N/A — required | Container gap | Action has its own name | Takes its place when available |
| panel | Required | N/A — required | Container gap | Children retain their semantics | Operable children keep their order |

### Variants

Collapsed hides the panel; expanded reveals it. Group policy can permit more than one expanded item. Disabled triggering is distinct from a collapsed state.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Expanded | Activate the disclosure | See Tokens | The trigger reports expanded and the panel becomes readable | Yes | Trigger | Pending: expanded scenario |

### Keyboard, pointer and touch

Activate the trigger by click, Enter or Space. Keep focus on the heading button after toggling. A disclosure is inline, so Escape does not function as modal dismissal.

### Accessibility

Provide a button with descriptive text. Do not hide an unremovable focus target inside collapsed content.

### State patterns

This family owns no request lifecycle. Its containing surface supplies any loading, empty, error, offline, permission or partial-failure state.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

| Part or state | Token |
| --- | --- |
| Scope foreground | `light.text`, `dark.text` |
| Scoped focus-visible outline | `density.focusWidth`, `light.focus`, `dark.focus` |

### Composition and content guidelines

Place a trigger with the trigger slot inside the heading and the associated panel after it. Do use “Review policy” and provide details in the panel.

## Part B — Bindings

### API

The group can receive `expandedKeys` and an update callback, or initialize from default expanded keys. A standalone disclosure can own its expanded state.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `navigation:Disclosure` | `children` | `import("react-aria-components").ChildrenOrFunction<DisclosureRenderProps>` | Unspecified | Caller content | — |
| `navigation:Disclosure` | `className` | `ClassNameOrFunction<DisclosureRenderProps> \| undefined` | `'react-aria-Disclosure'` | Caller input | — |
| `navigation:Disclosure` | `defaultExpanded` | `boolean \| undefined` | Unspecified | Uncontrolled initial value | — |
| `navigation:Disclosure` | `id` | `Key \| undefined` | Unspecified | Caller input | — |
| `navigation:Disclosure` | `isDisabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `navigation:Disclosure` | `isExpanded` | `boolean \| undefined` | Unspecified | Controlled value | — |
| `navigation:Disclosure` | `onExpandedChange` | `((isExpanded: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Disclosure` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `navigation:Disclosure` | `render` | `import("react-aria-components").DOMRenderFunction<"div", DisclosureRenderProps> \| undefined` | Unspecified | Caller input | — |
| `navigation:Disclosure` | `slot` | `string \| null \| undefined` | Unspecified | Caller input | — |
| `navigation:Disclosure` | `style` | `import("react-aria-components").StyleOrFunction<DisclosureRenderProps> \| undefined` | Unspecified | Caller input | — |
| `navigation:Disclosure` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |
| `navigation:DisclosureGroup` | `allowsMultipleExpanded` | `boolean \| undefined` | Unspecified | Caller input | — |
| `navigation:DisclosureGroup` | `children` | `import("react-aria-components").ChildrenOrFunction<DisclosureGroupRenderProps>` | Unspecified | Caller content | — |
| `navigation:DisclosureGroup` | `className` | `ClassNameOrFunction<DisclosureGroupRenderProps> \| undefined` | `'react-aria-DisclosureGroup'` | Caller input | — |
| `navigation:DisclosureGroup` | `defaultExpandedKeys` | `Iterable<Key> \| undefined` | Unspecified | Uncontrolled initial value | — |
| `navigation:DisclosureGroup` | `expandedKeys` | `Iterable<Key> \| undefined` | Unspecified | Controlled value | — |
| `navigation:DisclosureGroup` | `id` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:DisclosureGroup` | `isDisabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `navigation:DisclosureGroup` | `onExpandedChange` | `((keys: Set<Key>) => any) \| undefined` | Unspecified | Caller callback | — |
| `navigation:DisclosureGroup` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `navigation:DisclosureGroup` | `render` | `import("react-aria-components").DOMRenderFunction<"div", DisclosureGroupRenderProps> \| undefined` | Unspecified | Caller input | — |
| `navigation:DisclosureGroup` | `style` | `import("react-aria-components").StyleOrFunction<DisclosureGroupRenderProps> \| undefined` | Unspecified | Caller input | — |
| `navigation:DisclosureGroup` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |
| `navigation:DisclosurePanel` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:DisclosurePanel` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:DisclosurePanel` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:DisclosurePanel` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:DisclosurePanel` | `children` | `React.ReactNode` | Required | Caller content | — |
| `navigation:DisclosurePanel` | `className` | `ClassNameOrFunction<DisclosurePanelRenderProps> \| undefined` | `'react-aria-DisclosurePanel'` | Caller input | — |
| `navigation:DisclosurePanel` | `id` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:DisclosurePanel` | `label` | `React.ReactNode` | Unspecified | Caller input | — |
| `navigation:DisclosurePanel` | `labelElementType` | `React.ElementType \| undefined` | `'label'` | Caller input | — |
| `navigation:DisclosurePanel` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `navigation:DisclosurePanel` | `render` | `import("react-aria-components").DOMRenderFunction<"div", DisclosurePanelRenderProps> \| undefined` | Unspecified | Caller input | — |
| `navigation:DisclosurePanel` | `role` | `"group" \| "region" \| undefined` | `'group'` | Caller input | — |
| `navigation:DisclosurePanel` | `style` | `import("react-aria-components").StyleOrFunction<DisclosurePanelRenderProps> \| undefined` | Unspecified | Caller input | — |
| `navigation:DisclosurePanel` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`navigation` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

Disclosure connects a trigger slot and DisclosurePanel. DisclosureGroup coordinates expanded keys for an accordion; Heading can contain the trigger.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Contract | Web | Native | Tracking |
| --- | --- | --- | --- |
| Disclosure and accordion | Disclosure, DisclosureGroup, DisclosurePanel | No family binding in the native package | Native implementation and platform-specific verification are open in the [family audit](../component-depth.md). |

**Accessibility.** Provide a button with descriptive text. aria-expanded exposes the state independently of an arrow icon. Do not hide an unremovable focus target inside collapsed content.

**Tokens.** The optional controls stylesheet applies text color inside the controls scope. Interactive descendants can use its keyboard focus treatment. Custom slot paint remains the consumer’s responsibility.

**Composition.** Place a trigger with the trigger slot inside the heading and the associated panel after it. Wrap sibling disclosures in DisclosureGroup when their states interact.

**Content guidelines.** Do use “Review policy” and provide details in the panel. Avoid vague controls such as “More” repeated without context.

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Expanded | Activate Review policy | Trigger exposes aria-expanded true and policy text is visible | Yes | Trigger | [Panel expansion](../../tests/browser/enterprise-navigation.spec.ts) |

#### Performance

`Disclosure` 7,074 B, `DisclosureGroup` 1,722 B, `DisclosurePanel` 4,972 B. Each number is a separate named-import gzip measurement with React and React DOM external. Optional controls CSS is measured separately at 1,457 B gzip. The library root entry does not import this family.

#### Tests

- **Expanded.** [Panel expansion](../../tests/browser/enterprise-navigation.spec.ts).

The linked cases establish the behaviors above. Dedicated per-state visual comparisons and native simulator tests are open. [Catalog example](../../catalog/EnterpriseNavigation.stories.tsx)

#### Changelog and deprecations

The 0.3.0-rc.1 candidate documents the current web bindings. No family-specific deprecation is declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Disclosure and accordion.

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
