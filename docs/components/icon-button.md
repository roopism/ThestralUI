---
{
  "family": "Icon button",
  "status": "draft",
  "since": "0.3.0-rc.1",
  "owner": "@thetechgeeek",
  "platforms": {
    "web": "supported",
    "native": "experimental"
  },
  "exports": [
    {
      "platform": "web",
      "name": "IconButton",
      "from": "@ui-lazy-dev/ui-web/primitives"
    },
    {
      "platform": "native",
      "name": "IconButton",
      "from": "@ui-lazy-dev/ui-native"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/Button",
    "https://mui.com/material-ui/react-button/"
  ]
}
---

# Icon button

## Part A — Contract

### Purpose and when not to use it

Use one recognizable graphic for a frequently used action in a constrained space. Use Button with visible text when the command is unfamiliar or ambiguous. Use Link for navigation.

### Anatomy

One meaningful action has a localized name and a decorative graphic.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| label | Required | N/A — required | Container gap | Provides the accessible name | Text adds no stop |
| graphic | Required | N/A — required | Container gap | Excluded from the name | No stop |

### Variants

Shares Button's primary and secondary tones.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Default | Present the action | Control size and tone tokens | The graphic decorates a named button | Yes | Yes | Pending: default scenario |
| Compact touch | Use compact sizing on touch | Coarse target floor | The target remains square and named | Yes | Yes | Pending: compact touch scenario |
| Pending | Begin the operation | Shared inactive treatment | The named button reports busy and blocks repeat activation | No | Yes during pending (binding gap below) | Pending: pending scenario |
| Icon only | Present an icon without visible text | See Tokens | The localized name still identifies the action | Yes when enabled | Screen-reader focus targets the button | Pending: icon only scenario |

### Keyboard, pointer and touch

Child SVGs and graphics must not introduce focusable or interactive descendants. Tab moves past the control as a single stop.

### Accessibility

The caller's label names the whole action. Decorative content is hidden or inert. Choose a localized intent rather than a shape or a color. Coarse targets protect touch users. Use directionally appropriate glyphs in RTL. Reduced motion and forced-color behavior follow Button.

### State patterns

This family owns no request lifecycle. Its containing surface supplies any loading, empty, error, offline, permission or partial-failure state.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions. Mirror directional graphics when their meaning follows the reading direction.

### Tokens

| Part or state | Token |
| --- | --- |
| Default and touch target sides | `size.control`, `density.compactTarget`, `density.coarseTarget`, `density.largeTarget` |
| Fill, border and contrast | `light.accent`, `dark.accent`, `light.onAccent`, `dark.onAccent`, `light.surface`, `dark.surface`, `light.border`, `dark.border`, `light.text`, `dark.text` |
| Focus and press treatment | `light.focus`, `dark.focus`, `size.radius`, `motion.pressDuration`, `motion.pressScale` |

### Composition and content guidelines

Use among named toolbar actions or beside a text field. The button alone owns activation. A tooltip can clarify the command but must not be the only source of its accessible name. Do label a magnifying-glass action “Search documents”. Avoid “Magnifying glass” or untranslated strings in compact toolbars. Shorten the graphic treatment rather than truncating its accessible name.

## Part B — Bindings

### API

Both bindings require a localized `label`. Web uses `children` for the graphic and forwards Button props and its button ref. Native requires `icon` and `onPress` and inherits the native text-button size, tone, busy and disabled props. Native's dedicated icon-only binding omits startIcon/endIcon.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `primitives:IconButton` | `busy` | `boolean \| undefined` | Unspecified | Caller input | — |
| `primitives:IconButton` | `children` | `import("react").ReactNode` | Unspecified | Caller content | — |
| `primitives:IconButton` | `className` | `string \| undefined` | Unspecified | Caller input | — |
| `primitives:IconButton` | `endIcon` | `import("react").ReactElement<unknown, string \| import("react").JSXElementConstructor<any>> \| undefined` | Unspecified | Caller input | — |
| `primitives:IconButton` | `fullWidth` | `boolean \| undefined` | Unspecified | Caller input | — |
| `primitives:IconButton` | `label` | `string` | Required | Caller input | — |
| `primitives:IconButton` | `motion` | `"press" \| "none" \| undefined` | Unspecified | Caller input | — |
| `primitives:IconButton` | `ref` | `import("react").Ref<HTMLButtonElement> \| undefined` | Unspecified | Caller reference | `HTMLButtonElement` |
| `primitives:IconButton` | `size` | `"sm" \| "md" \| "lg" \| undefined` | Unspecified | Caller input | — |
| `primitives:IconButton` | `startIcon` | `import("react").ReactElement<unknown, string \| import("react").JSXElementConstructor<any>> \| undefined` | Unspecified | Caller input | — |
| `primitives:IconButton` | `style` | `import("react").CSSProperties \| undefined` | Unspecified | Caller input | — |
| `primitives:IconButton` | `tone` | `"primary" \| "secondary" \| undefined` | Unspecified | Caller input | — |
| `primitives:IconButton` | `unstyled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `primitives:IconButton` | Host attributes | 285 standard platform attributes, not listed | Unspecified | Caller input | — |
| `native:IconButton` | `accessibilityHint` | `string \| undefined` | Unspecified | Caller input | — |
| `native:IconButton` | `busy` | `boolean \| undefined` | Unspecified | Caller input | — |
| `native:IconButton` | `disabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `native:IconButton` | `fullWidth` | `boolean \| undefined` | Unspecified | Caller input | — |
| `native:IconButton` | `icon` | `ReactElement<unknown, string \| import("react").JSXElementConstructor<any>>` | Required | Caller input | — |
| `native:IconButton` | `label` | `string` | Required | Caller input | — |
| `native:IconButton` | `labelStyle` | `import("react-native").StyleProp<import("react-native").TextStyle> \| undefined` | Unspecified | Caller input | — |
| `native:IconButton` | `motion` | `"press" \| "none" \| undefined` | Unspecified | Caller input | — |
| `native:IconButton` | `onPress` | `(event: import("react-native").GestureResponderEvent) => unknown` | Required | Caller callback | — |
| `native:IconButton` | `pressableStyle` | `import("react-native").StyleProp<import("react-native").ViewStyle> \| undefined` | Unspecified | Caller input | — |
| `native:IconButton` | `ref` | `import("react").Ref<import("react-native/types_generated/src/private/webapis/dom/nodes/ReactNativeElement.js").default> \| undefined` | Unspecified | Caller reference | `import("react-native/types_generated/src/private/webapis/dom/nodes/ReactNativeElement.js").default` |
| `native:IconButton` | `size` | `"sm" \| "md" \| "lg" \| undefined` | Unspecified | Caller input | — |
| `native:IconButton` | `style` | `import("react-native").StyleProp<import("react-native").ViewStyle> \| undefined` | Unspecified | Caller input | — |
| `native:IconButton` | `testID` | `string \| undefined` | Unspecified | Caller input | — |
| `native:IconButton` | `tone` | `"primary" \| "secondary" \| "ghost" \| "danger" \| "link" \| undefined` | Unspecified | Caller input | — |
| `native:IconButton` | `unstyled` | `boolean \| undefined` | Unspecified | Caller input | — |

### React web

#### Rendering

`primitives` is published without a client directive. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

On web, IconButton renders Button with a square styling attribute and a decorative inert span wrapping the children. Native passes an icon to Button, which renders the graphic in a hidden accessibility subtree while retaining an accessible label.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Contract | Web | Native | Tracking |
| --- | --- | --- | --- |
| Graphic | Provide the icon in children | Supply a single icon element | Both separate the graphic from the accessibility name. |
| Sizing | Small uses the pointer capability | Small and medium use the same square target | Status is experimental on native. |

**Variants.** Shares Button's primary and secondary tones. With default tokens, web square sides are 32, 44 and 56 CSS pixels, with the small touch target at least 48. Native small and medium both occupy 48 points; large occupies 56.

**Keyboard and pointer.** Enabled actions activate by Enter, Space, click or tap on web and onPress on native. Child SVGs and graphics must not introduce focusable or interactive descendants. Tab moves past the control as a single stop.

**Accessibility.** The caller's label names the whole action. Decorative content is hidden or inert. Choose a localized intent rather than a shape or a color. Coarse targets protect touch users. Use directionally appropriate glyphs in RTL. Reduced motion and forced-color behavior follow Button. The focus and announcement gap in the root pending state also affects IconButton.

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Default | Mount a labeled graphic action | Named button; graphic hidden | Yes | Yes | [Square targets across sizes](../../tests/browser/button-depth.spec.ts) |
| Compact touch | Select small on a device with a coarse pointer | Named square button | Yes | Yes | [Coarse-pointer target](../../tests/browser/button-depth.spec.ts) |
| Pending | Set busy | aria-busy and disabled button | No | Web removes the tab stop | [Named busy icon ignores click](../../tests/primitives.test.tsx) |
| Native icon only | Supply a native graphic and localized label | Web uses a children slot | Yes when enabled | Screen-reader focus targets the button | [Native square and accessible label](../../tests/icon-button/native.test.cjs) |

#### Performance

`IconButton` 382 B. Measured gzip sizes for separate tree-shaken production web imports, with React and React DOM external. Square sizing and host treatment use primitives.css and the root stylesheet. The graphic is supplied separately by the caller. The independently compressed CSS entries measure 862 B for primitives.css and 1,224 B for styles.css including theme tokens.

#### Tests

- **Default.** [Square targets across sizes](../../tests/browser/button-depth.spec.ts).
- **Compact touch.** [Coarse-pointer target](../../tests/browser/button-depth.spec.ts).
- **Pending.** [Named busy icon ignores click](../../tests/primitives.test.tsx).
- **Native icon only.** [Native square and accessible label](../../tests/icon-button/native.test.cjs).
- [Native gallery help action](../../tests/simulator/appearance.yaml).
- [Square action sizes and compact touch targets](../../tests/browser/button-depth.spec.ts).

Native renderer tests verify square bounds and hidden icon descendants. Appearance and enlarged-text simulator journeys activate the help button. Dedicated visual comparisons and focus-preserving pending tests are open.

#### Changelog and deprecations

The 0.3.0-rc.1 candidate adds tokenized sizing for web and a named icon-only binding for native. No prop is deprecated.

### React Native

#### Rendering

The press target carries the name while the decorative icon subtree is hidden. The binding renders in the application’s native view hierarchy.

#### Headless API

None. The native public entry currently exposes the styled component.

#### Test helpers

None. Renderer fixtures query the accessible control directly.

#### Platform differences

The cross-platform differences table above captures the current binding. Pending: verify iOS and Android conventions for Icon button separately.

| State | Native binding behavior |
| --- | --- |
| Default | Named button; graphic inaccessible |
| Compact touch | Native target floor also applies |
| Pending | busy and disabled state |
| Native icon only | Accessible name is independent of symbol text |

Enabled Android controls draw the platform theme’s bounded foreground ripple over their surface. Busy and disabled controls suppress press feedback.

#### Performance

The named IconButton import measures 1,088 B gzip, up from 1,077 B, with React, React Native and the token package supplied by the app. It uses Button’s bounded Android ripple and reduced-motion handling. [Native Button measurements](button.md#react-native) · [IconButton tests](../../tests/icon-button/native.test.cjs)

#### Tests

[Renderer tests](../../tests/icon-button/native.test.cjs). Pending: verify every neutral scenario in the iPhone Simulator. Android device evidence is pending.

#### Changelog and deprecations

The current candidate includes this native export. See the family changelog above for changes to shared behavior.
