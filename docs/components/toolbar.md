---
{
  "family": "Toolbar",
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
      "name": "Toolbar",
      "from": "@ui-lazy-dev/ui-web/navigation"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/Toolbar",
    "https://mui.com/material-ui/react-app-bar/"
  ]
}
---

# Toolbar

## Part A — Contract

### Purpose and when not to use it

Group related actions into a keyboard-navigable control strip. Use a Menu for a collapsed command list or a plain Stack for unrelated controls.

### Anatomy

The named strip groups actions and defines their keyboard navigation direction.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| actions | Required | N/A — required | Container gap | Children retain their semantics | Operable children keep their order |

### Variants

The orientation defaults to horizontal. A vertical toolbar sets vertical semantics for assistive technology.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Vertical | Arrange actions vertically | See Tokens | The named group exposes its orientation and actions | Children only | Child commands | Pending: vertical scenario |
| Focus restored | Return to an invoking action | See Tokens | The prior control regains focus | Yes | Yes | Pending: focus restored scenario |

### Keyboard, pointer and touch

Enter the group with Tab and use directional navigation among eligible children. Escape from an overlay opened by a child returns focus to its own trigger.

### Accessibility

Use a concise name such as “Editing tools”. Keep child commands reachable with pointer and keyboard. A toolbar label does not replace action labels.

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

Contain adjacent commands or menu triggers. Keep long-form inputs and unrelated page navigation outside this command group. Do label a group “Review tools”. Avoid calling every toolbar “Actions” when several are present.

## Part B — Bindings

### API

Set `orientation` for the axis. Caller provides the related pressables, their events and state. Localize the group's label.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `navigation:Toolbar` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Toolbar` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Toolbar` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Toolbar` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Toolbar` | `children` | `import("react-aria-components").ChildrenOrFunction<ToolbarRenderProps>` | Unspecified | Caller content | — |
| `navigation:Toolbar` | `className` | `ClassNameOrFunction<ToolbarRenderProps> \| undefined` | `'react-aria-Toolbar'` | Caller input | — |
| `navigation:Toolbar` | `orientation` | `Orientation \| undefined` | `'horizontal'` | Caller input | — |
| `navigation:Toolbar` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `navigation:Toolbar` | `render` | `import("react-aria-components").DOMRenderFunction<"div", ToolbarRenderProps> \| undefined` | Unspecified | Caller input | — |
| `navigation:Toolbar` | `slot` | `string \| null \| undefined` | Unspecified | Caller input | — |
| `navigation:Toolbar` | `style` | `import("react-aria-components").StyleOrFunction<ToolbarRenderProps> \| undefined` | Unspecified | Caller input | — |
| `navigation:Toolbar` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`navigation` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

A toolbar root supplies role, orientation and grouped children. The children are the actual action slots and own their individual names.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Contract | Web | Native | Tracking |
| --- | --- | --- | --- |
| Toolbar | Toolbar | No family binding in the native package | Native implementation and platform-specific verification are open in the [family audit](../component-depth.md). |

**Tokens.** The optional controls stylesheet applies text color inside the controls scope. Interactive descendants can use its keyboard focus treatment. Custom slot paint remains the consumer’s responsibility.

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Vertical | Render a vertical tools group | Named toolbar with aria-orientation vertical and a Save button | Children only | Child commands | [RTL toolbar naming](../../tests/navigation-labels.test.tsx) |
| Focus restored | Choose a nested command | Invoker in toolbar regains focus | Yes | Yes | [Menu keyboard and focus return](../../tests/browser/enterprise-navigation.spec.ts) |

#### Performance

`Toolbar` 7,902 B. Each number is a separate named-import gzip measurement with React and React DOM external. Optional controls CSS is measured separately at 1,457 B gzip. The library root entry does not import this family.

#### Tests

- **Vertical.** [RTL toolbar naming](../../tests/navigation-labels.test.tsx).
- **Focus restored.** [Menu keyboard and focus return](../../tests/browser/enterprise-navigation.spec.ts).

The linked cases establish the behaviors above. Dedicated per-state visual comparisons and native simulator tests are open. [Catalog example](../../catalog/EnterpriseNavigation.stories.tsx)

#### Changelog and deprecations

The 0.3.0-rc.1 candidate documents the current web bindings. No family-specific deprecation is declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Toolbar.

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
