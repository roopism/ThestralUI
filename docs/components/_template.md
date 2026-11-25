---
{
  "family": "Button",
  "status": "draft",
  "since": "0.3.0-rc.1",
  "owner": "@thetechgeeek",
  "platforms": { "web": "supported", "native": "experimental" },
  "exports": [
    { "platform": "web", "name": "Button", "from": "@ui-lazy-dev/ui-web", "rendering": "client-only" },
    { "platform": "web", "name": "Trigger", "from": "@ui-lazy-dev/ui-web/navigation", "rendering": "client-only" },
    { "platform": "native", "name": "Button", "from": "@ui-lazy-dev/ui-native" }
  ],
  "reference": ["https://react-aria.adobe.com/Button", "https://mui.com/material-ui/react-button/"]
}
---

# Family specification template

Copy the frontmatter and headings into one document per family. Set the inventory name, owner, release, platform statuses, exact packed exports and primary references. A draft can carry a specific `Pending: reason`. Keep the dependency or missing observation explicit. Promotion requires all open items to be resolved and the [behavior scenarios](../scenarios.md) to run on each claimed platform.

## Part A — Contract

### Purpose and when not to use it

Describe the user’s task and name the alternative family for a different task.

### Anatomy

Identify the parts and the owner of each content slot. List all optional slots individually. For absence use collapse, fallback with the replacement, or placeholder with a reason for reserving space. Mark a slot required when the interaction depends on it, even when a binding accepts a missing value. An empty layout remains valid when its items slot is optional. Document how omission changes the accessible name and focus order.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| label | Required | N/A — the action requires a name | Container gap | Names the action | Text adds no stop |
| start icon | Optional | collapse | Container gap | Decorative | No stop |

### Variants

Explain when to use each size, tone and mode. Distinguish changes in presentation from changes in behavior.

### States matrix

Describe default and each applicable hover, focus-visible, pressed, pending, disabled, invalid, selected or open state. Include combinations that change activation or focus. Link each row to its covering scenario ID. Use generic role and state names. [Role mapping](../role-mapping.md)

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Default | Present an enabled action | `light.accent`, `light.onAccent` | Named button | Yes | Yes | [button.save-once](button.scenarios.yaml) |

### Keyboard, pointer and touch

List the relevant keys, touch gestures and pointer behavior, including cancellation, repeat activation, initial focus and focus return where applicable.

### Accessibility

Identify roles, name computation, announcements, target size, contrast and focus indication. Describe forced colors, reading direction and reduced motion. Place platform-specific details in the binding sections.

### State patterns

Explain how loading, empty, error, offline, permission-denied and partial failure affect this family. Identify the state owner and any recovery action. Give a reason for inapplicable states.

### Localization

List library-owned message keys and caller-owned text. Define which values need locale-aware formatting, what changes in a right-to-left locale and how long labels wrap.

### Tokens

Map each styled part and state to semantic token paths. Put an optional resolved default in square brackets.

| Part or state | Token |
| --- | --- |
| Minimum coarse target | `density.coarseTarget` [48px] |

### Composition and content guidelines

Show how the family composes with its neighbors and who owns state. Give a concrete example of effective content and an example to avoid.

## Part B — Bindings

### API

Generate this combined table from the packed TypeScript declarations. Each export identifies its binding. Regenerate after changing a public signature.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |

### React web

#### Rendering

Record each web export’s `rendering` as `server-safe` or `client-only` in the frontmatter. Explain its boundary and hydration behavior here. Exercise every server-safe export by name on the packed foundation route.

#### Headless API

Name the public hooks or give the reason the family needs none. Interactive bindings describe how their styled control consumes the same hook.

#### Test helpers

Link the consumer query and interaction helpers, or explain why the family needs none.

#### Platform differences

Identify the concrete accessibility roles, events, focus behavior and any exceptions to the neutral contract.

#### Performance

Record compressed import cost, entry point, measurement conditions and optional CSS cost.

#### Tests

For each scenario, link to the runner and the relevant unit, browser, accessibility and visual tests. Record which gaps remain in drafts.

#### Changelog and deprecations

Describe release changes, replacements, the migration path and any applicable codemod.

### React Native

#### Rendering

Identify the native entry, rendered control and state ownership. For an absent binding document its status and exclusion reason where applicable.

#### Headless API

Identify public native behavior hooks and their control binding, or provide the reason none is needed.

#### Test helpers

Name the native testing helper and its public contract, or give a reason for none.

#### Platform differences

Give iOS and Android equivalents for actions, focus, screen-reader state, Back or dismissal, safe areas and input conventions where relevant.

#### Performance

Record the measured native import cost with its measurement conditions.

#### Tests

Connect each scenario to the native renderer and simulator journeys. Identify available operating-system evidence, physical-device gaps and pending assistive-technology observations.

#### Changelog and deprecations

Describe platform-specific release changes and migration support.
