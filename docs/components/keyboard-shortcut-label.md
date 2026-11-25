---
{
  "family": "Keyboard shortcut label",
  "status": "experimental",
  "since": "0.3.0-rc.1",
  "owner": "@roopism",
  "platforms": {
    "web": "supported",
    "native": "excluded"
  },
  "exports": [
    {
      "platform": "web",
      "name": "Keyboard",
      "from": "@ui-lazy-dev/ui-web/navigation",
      "rendering": "client-only"
    },
    {
      "platform": "web",
      "name": "Keyboard",
      "from": "@ui-lazy-dev/ui-web/document",
      "rendering": "server-safe"
    },
    {
      "platform": "web",
      "name": "KeyboardShortcutLabel",
      "from": "@ui-lazy-dev/ui-web/keyboard-shortcut-label",
      "rendering": "server-safe"
    },
    {
      "platform": "web",
      "name": "useKeyboardShortcutLabel",
      "from": "@ui-lazy-dev/ui-web/keyboard-shortcut-label",
      "rendering": "server-safe"
    },
    {
      "platform": "web",
      "name": "getKeyboardShortcutLabelProps",
      "from": "@ui-lazy-dev/ui-web/keyboard-shortcut-label",
      "rendering": "server-safe"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/Menu",
    "https://mui.com/material-ui/react-typography/"
  ]
}
---

# Keyboard shortcut label

## Part A — Contract

### Purpose and when not to use it

Show literal keyboard input or a shortcut. Use Button, a menu item or application keyboard handling to perform the action.

### Anatomy

The key names describe the shortcut available on the associated command.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| keys | Required | N/A — required | Container gap | Supplies readable content | Text adds no stop |

### Variants

No built-in size, selection or pressed state. Shortcut representation can use words or platform-specific key glyphs.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Shortcut | Display a single key or chord | Inherited text or optional style | The caller supplies the notation and its spoken expansion | No | No | [keyboard-shortcut-label.read-chord](keyboard-shortcut-label.scenarios.yaml) |
| Inline help | Place a shortcut among instructions | The surrounding line owns spacing | Localized prose keeps its reading order and the chord keeps its key order | No | No | [keyboard-shortcut-label.read-inline-help](keyboard-shortcut-label.scenarios.yaml) |
| Menu command | Open a menu containing a keyboard hint | The containing menu owns selection and focus | The command keeps its name and describes its shortcut | The command accepts activation | Focus stays on the menu item | [keyboard-shortcut-label.run-menu-command](keyboard-shortcut-label.scenarios.yaml) |

### Keyboard, pointer and touch

Displaying a key combination does not intercept keys. Let the surrounding command handle input and expose a pointer or touch alternative.

### Accessibility

An abbreviated or symbolic chord needs a localized reading equivalent. Supply the spoken expansion when a glyph would otherwise be unclear, and keep the expanded words in their natural reading order. Focus belongs to the control that actually performs the command.

### State patterns

This family owns no request lifecycle. Its containing surface supplies any loading, empty, error, offline, permission or partial-failure state.

### Localization

The caller chooses notation for the actual platform keyboard, supplies translated modifier names, and chooses the separator between keys. Isolate the chord direction from the surrounding prose so right-to-left help keeps its intended word order.

### Tokens

| Part or state | Token |
| --- | --- |
| Scope foreground | `light.text`, `dark.text` |

### Composition and content guidelines

Keep the notation consistent with the actual keyboard handler and OS convention. Do use “Ctrl+S” with readable equivalent text. Avoid documenting a shortcut that is unavailable on the user's platform.

## Part B — Bindings

### API

The standalone `/keyboard-shortcut-label` entry exports KeyboardShortcutLabel, useKeyboardShortcutLabel and getKeyboardShortcutLabelProps. Supply a string or an ordered array through `keys` and an optional localized `spokenLabel`. The `/document` alias continues to render the caller’s keyboard content on the server. Use the `/navigation` Keyboard for an existing React Aria menu slot.

The Keyboard ref points at the rendered host. Default direction is LTR to preserve key order inside RTL content; host props can override it.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `navigation:Keyboard` | `children` | `React.ReactNode` | Unspecified | Caller content | — |
| `navigation:Keyboard` | `className` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Keyboard` | `ref` | `React.Ref<HTMLElement> \| undefined` | Unspecified | Caller reference | `HTMLElement` |
| `navigation:Keyboard` | `render` | `import("react-aria-components").DOMRenderFunction<"kbd", undefined> \| undefined` | Unspecified | Caller input | — |
| `navigation:Keyboard` | `style` | `React.CSSProperties \| undefined` | Unspecified | Caller input | — |
| `navigation:Keyboard` | Host attributes | 276 standard platform attributes, not listed | Unspecified | Caller input | — |
| `document:Keyboard` | `children` | `import("react").ReactNode` | Unspecified | Caller content | — |
| `document:Keyboard` | `className` | `string \| undefined` | Unspecified | Caller input | — |
| `document:Keyboard` | `ref` | `import("react").Ref<HTMLElement> \| undefined` | Unspecified | Caller reference | `HTMLElement` |
| `document:Keyboard` | `style` | `import("react").CSSProperties \| undefined` | Unspecified | Caller input | — |
| `document:Keyboard` | Host attributes | 276 standard platform attributes, not listed | Unspecified | Caller input | — |
| `keyboard-shortcut-label:KeyboardShortcutLabel` | `className` | `string \| undefined` | Unspecified | Caller input | — |
| `keyboard-shortcut-label:KeyboardShortcutLabel` | `dir` | `"auto" \| "ltr" \| "rtl" \| undefined` | Unspecified | Caller input | — |
| `keyboard-shortcut-label:KeyboardShortcutLabel` | `keys` | `string \| readonly string[]` | Required | Caller input | — |
| `keyboard-shortcut-label:KeyboardShortcutLabel` | `ref` | `import("react").Ref<HTMLElement> \| undefined` | Unspecified | Caller reference | `HTMLElement` |
| `keyboard-shortcut-label:KeyboardShortcutLabel` | `separator` | `string \| undefined` | Unspecified | Caller input | — |
| `keyboard-shortcut-label:KeyboardShortcutLabel` | `spokenLabel` | `string \| undefined` | Unspecified | Caller input | — |
| `keyboard-shortcut-label:KeyboardShortcutLabel` | `style` | `CSSProperties \| undefined` | Unspecified | Caller input | — |
| `keyboard-shortcut-label:KeyboardShortcutLabel` | `unstyled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `keyboard-shortcut-label:KeyboardShortcutLabel` | Host attributes | 275 standard platform attributes, not listed | Unspecified | Caller input | — |
| `keyboard-shortcut-label:useKeyboardShortcutLabel` | `__0` | `KeyboardShortcutLabelOptions` | Required | Caller input | — |
| `keyboard-shortcut-label:getKeyboardShortcutLabelProps` | `__0` | `KeyboardShortcutLabelOptions` | Required | Caller input | — |

### React web

#### Rendering

The canonical component and both helpers render on the server. The document Keyboard also renders on the server. The navigation Keyboard consumes the React Aria menu context in a client component.

A kbd element wraps the caller's shortcut content. A menu can supply slot context. The label does not register a global shortcut.

#### Headless API

Use `useKeyboardShortcutLabel` or `getKeyboardShortcutLabelProps` with the same options as the component. They return the visible keys, the separator, and the props for the root, visible content and spoken expansion. A string supplies one key. An array supplies an ordered chord. Empty key names are discarded.

#### Test helpers

Read the line containing the shortcut to verify a single localized expansion. For a menu, inspect the accessible description of its command. Activate that command to verify its outcome.

#### Platform differences

| Contract | Web | Native | Tracking |
| --- | --- | --- | --- |
| Keyboard shortcut label | Keyboard | No family binding in the native package | The [library goal](../ui-lazy-dev-goal.md) scopes keyboard shortcut labels to web. |

**Tokens.** Import `@ui-lazy-dev/ui-web/keyboard-shortcut-label.css` for the key border, corner, spacing, surface and text colors. The caller can use `unstyled` to supply its own appearance. The localized spoken expansion remains available with or without that stylesheet.

**Composition.** Place beside a MenuItem label or inline in instructions. Keep the notation consistent with the actual keyboard handler and OS convention.

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Default | Render shortcut text under an RTL toolbar | KBD host uses LTR and stays outside tab order | No | No | [RTL shortcut notation](../../tests/navigation-labels.test.tsx) |
| Inline help | Render Tab inside instructions | Visible kbd shows Tab | No | No | [Inline keyboard label](../../tests/browser/enterprise-navigation.spec.ts) |

#### Performance

The canonical namespace measures 560 B gzip, and the optional family stylesheet measures 759 B. The named component measures 543 B, the hook 349 B and the static helper 350 B. The existing document and navigation Keyboard imports measure 126 B and 1,503 B respectively. Imports are bundled independently with React and React DOM external. The library root adds zero bytes for this family.

#### Tests

- **Default.** [RTL shortcut notation](../../tests/navigation-labels.test.tsx).
- **Inline help.** [Inline keyboard label](../../tests/browser/enterprise-navigation.spec.ts).

The browser cases exercise a chord, an Arabic help line, a React Aria menu command, Japanese text at double zoom and forced-color borders. [Browser tests](../../tests/keyboard-shortcut-label/shortcut-label.spec.ts) · [Catalog examples](../../catalog/keyboard-shortcut-label.stories.tsx)

#### Changelog and deprecations

The 0.3.0-rc.1 candidate documents the current web bindings. No family-specific deprecation is declared.

### React Native

#### Rendering

The library goal defines Keyboard shortcut label as web-only. Native applications own the presentation of hardware keyboard hints. [Platform scope](../ui-lazy-dev-goal.md)

#### Headless API

This family exposes its two headless helpers in the web package.

#### Test helpers

The registered web scenarios exercise the visible chord, inline reading order and menu command.

#### Platform differences

Shortcut glyphs and spoken expansions depend on the user’s keyboard layout, language and desktop platform. The web binding consumes the caller’s chosen notation.

#### Performance

The family adds no native package entry.

#### Tests

The family-specific browser and installed-consumer checks cover the platform in scope.

#### Changelog and deprecations

The 1.0 delivery goal assigns this family to web.
