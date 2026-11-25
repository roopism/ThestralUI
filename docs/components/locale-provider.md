---
{
  "family": "Locale provider",
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
      "name": "I18nProvider",
      "from": "@ui-lazy-dev/ui-web/navigation"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/I18nProvider",
    "https://mui.com/material-ui/react-typography/"
  ]
}
---

# Locale provider

## Part A — Contract

### Purpose and when not to use it

Supply locale to descendants with locale-sensitive behavior or messages. Use a text translation service for application copy; this provider does not translate labels you supply.

### Anatomy

Descendants inherit the active locale. The provider adds no separate visible control.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| content | Required | N/A — required | Container gap | Children retain their semantics | Operable children keep their order |

### Variants

A Japanese or Arabic label is still application content. A provider does not manufacture translated strings for arbitrary children.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Localized | Set the locale | No visual surface | Caller-supplied translated labels are preserved | Descendants | Descendants | Pending: localized scenario |
| RTL navigation | Set a right-to-left locale | No visual surface | Reading and navigation follow the active direction | Descendants | Descendants | Pending: rtl navigation scenario |

### Keyboard, pointer and touch

There is no provider focus target. Direction-sensitive controls, such as horizontal tabs, interpret logical arrows according to their current locale.

### Accessibility

Set language and direction on the surrounding page region for assistive technology. Exercise labels and long text under RTL, localized formatting and narrow widths.

### State patterns

This family owns no request lifecycle. Its containing surface supplies any loading, empty, error, offline, permission or partial-failure state.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

N/A — language and direction are configuration. The provider paints no surface.

### Composition and content guidelines

Do use locale tags and translated labels such as “通知”.

## Part B — Bindings

### API

The `locale` input is a locale identifier. Children consume React Aria locale data. Set the host's language and direction consistently with the context.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `navigation:I18nProvider` | `children` | `ReactNode` | Required | Caller content | — |
| `navigation:I18nProvider` | `locale` | `string \| undefined` | Unspecified | Caller input | — |

### React web

#### Rendering

`navigation` is a client entry. Concurrent streams retain different locales and reading directions through hydration. Pending: verify the server-component import boundary. [Streaming hydration](../../tests/runtime-streams.test.tsx) · [Request isolation](../../tests/runtime-isolation.test.tsx)

I18nProvider wraps descendants in shared locale context. It supplies no visible root or action slot.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Contract | Web | Native | Tracking |
| --- | --- | --- | --- |
| Locale provider | I18nProvider | No family binding in the native package | Native implementation and platform-specific verification are open in the [family audit](../component-depth.md). |

**Variants.** Switching locale updates context. A Japanese or Arabic label is still application content. A provider does not manufacture translated strings for arbitrary children.

**Tokens.** N/A — localization context emits no visual element or styling.

**Composition.** Wrap controls in a provider for the chosen locale and set dir/lang on the host region. Nested contexts can scope a distinct locale when justified.

**Content guidelines.** Do use locale tags and translated labels such as “通知”. Avoid passing display country names as locale ids.

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Localized | Wrap a checkbox in a Japanese locale | Checkbox retains its supplied localized accessible name | Descendants | Descendants | [Localized controlled checkbox](../../tests/family-contracts.test.tsx) |
| RTL navigation | Visit Arabic preferences and move to next tab | RTL container and logical tab navigation agree | Descendants | Descendants | [Arabic compact preferences](../../tests/browser/preferences.spec.ts) |

#### Performance

`I18nProvider` 1,190 B. Each number is a separate named-import gzip measurement with React and React DOM external. The provider requires no stylesheet. The library root entry does not import this family.

#### Tests

- **Localized.** [Localized controlled checkbox](../../tests/family-contracts.test.tsx).
- **RTL navigation.** [Arabic compact preferences](../../tests/browser/preferences.spec.ts).

The linked cases establish the behaviors above. Dedicated per-state visual comparisons and native simulator tests are open. [Catalog example](../../catalog/Controls.stories.tsx)

#### Changelog and deprecations

The 0.3.0-rc.1 candidate documents the current web bindings. No family-specific deprecation is declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Locale provider.

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
