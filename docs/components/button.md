---
{
  "family": "Button",
  "status": "experimental",
  "since": "0.1.0",
  "owner": "@roopism",
  "platforms": {
    "web": "supported",
    "native": "experimental"
  },
  "exports": [
    {
      "platform": "web",
      "name": "Button",
      "from": "@ui-lazy-dev/ui-web"
    },
    {
      "platform": "web",
      "name": "useButton",
      "from": "@ui-lazy-dev/ui-web"
    },
    {
      "platform": "web",
      "name": "Trigger",
      "from": "@ui-lazy-dev/ui-web/navigation"
    },
    {
      "platform": "native",
      "name": "Button",
      "from": "@ui-lazy-dev/ui-native"
    },
    {
      "platform": "native",
      "name": "useButton",
      "from": "@ui-lazy-dev/ui-native"
    },
    {
      "platform": "native",
      "name": "Button",
      "from": "@ui-lazy-dev/ui-native/button"
    },
    {
      "platform": "native",
      "name": "useButton",
      "from": "@ui-lazy-dev/ui-native/button"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/Button",
    "https://mui.com/material-ui/react-button/"
  ]
}
---

# Button

## Part A — Contract

### Purpose and when not to use it

Trigger an action such as saving, submitting or opening a dialog. Use Link to navigate to another URL and an icon button for a compact action with no visible label.

### Anatomy

A label names the action. Leading and trailing graphics decorate that label. While busy, an indicator covers the label without changing the size of the button. Every part has a stable name that apps can target, also in unstyled mode.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| label | Required | N/A — required | Container gap | Provides the accessible name | Text adds no stop |
| start icon | Optional | collapse | Container gap | Excluded from the name | No stop |
| end icon | Optional | collapse | Container gap | Excluded from the name | No stop |
| busy indicator | Optional | collapse | Container gap | Excluded from the name | No stop |

### Variants

Primary is the default emphasis. Secondary is for a lower-priority alternative. Ghost is a quiet action without a surface, for toolbars and dense rows. Danger is for an action that destroys or removes data. Link looks like inline text but still performs an action; use Link to navigate. `fullWidth` fills the container. `unstyled` keeps the behaviour, accessibility and part names and applies no library styles.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Default | Present an enabled action | Accent background and contrasting label | The action is named | Yes | Yes | [button.save-once](button.scenarios.yaml) |
| Focus-visible | Focus by keyboard | Focus token | The focus indicator is visible | Yes | Yes | [button.save-once](button.scenarios.yaml) |
| Pressed | Press the action | Press scale and duration, or the platform highlight or ripple | The action responds once | Yes | Yes | [button.save-once](button.scenarios.yaml) |
| Pending | Begin an operation | The busy indicator replaces the visible label; the size is unchanged | Busy and unavailable are exposed; the accessible name is unchanged | No | Yes | [button.pending-keeps-name](button.scenarios.yaml) |
| Disabled | Disable the action | Reduced emphasis | Activation is unavailable | No | No keyboard stop | [button.disabled-named](button.scenarios.yaml) |

### Keyboard, pointer and touch

Enter, Space, a pointer click or a tap activates an enabled action once. During pending the button stays in the focus sequence and ignores every activation, including implicit form submission from Enter in a field. An explicitly disabled button leaves the focus sequence and cannot activate.

### Accessibility

Use a visible label. Decorative graphics and the busy indicator stay outside the accessible name. Pending keeps keyboard focus and exposes busy and unavailable states. The action owner announces progress and the outcome through Live status. Every tone meets WCAG 2.2 AA contrast in light and dark. Visible focus survives forced colors, and reduced motion stops both press feedback and the busy animation.

### State patterns

A pending operation suppresses repeat activation. The action owner reports progress, success or failure through Live status and decides when retry is available.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

| Part or state | Token |
| --- | --- |
| Primary fill and label | `light.accent`, `dark.accent`, `light.onAccent`, `dark.onAccent` |
| Secondary surface and label | `light.surface`, `dark.surface`, `light.text`, `dark.text` |
| Danger fill and label | `light.danger`, `dark.danger`, `light.onAccent`, `dark.onAccent` |
| Ghost hover and link label | `light.selected`, `dark.selected`, `light.accent`, `dark.accent` |
| Border, keyboard focus and corners | `light.border`, `dark.border`, `light.focus`, `dark.focus`, `size.radius` |
| Action size | `density.compactTarget`, `size.control`, `density.coarseTarget`, `density.largeTarget` |
| Icon spacing and action padding | `size.gap`, `space.spaceSm`, `space.spaceMd`, `space.spaceLg` |
| Press feedback | `motion.pressScale`, `motion.pressDuration` |
| Busy indicator | `space.spaceMd`, `shape.indicatorStroke`, `shape.radiusLg`, `motion.busyDuration` |

### Composition and content guidelines

Use one submit Button in a form plus explicit secondary actions. Keep interactive controls out of content and decorative slots. In a dialog, give the primary and cancel actions distinct names and let the dialog owner decide when to dismiss. Do write “Save workspace” or “Archive invoice”. Avoid “Click here”. Preserve the verb and object in translation and allow adequate line length for the locale.

## Part B — Bindings

### API

The root web Button forwards HTML button props, events and a button ref. It defaults to `type="button"`; explicitly set submit for form submission. `useButton` returns the same behaviour as `buttonProps` for a plain button, with no styling. `startIcon` and `endIcon` accept elements. On native the required onPress receives the Pressable event and `label` supplies both visible text and the accessible name. The native ref points to the underlying Pressable view. Native Button and useButton are available from the root and the dedicated `@ui-lazy-dev/ui-native/button` entry. `navigation:Trigger` uses the separate React Aria press-event and render-prop contract.

The native component accepts a resolved `theme` for its scope. When omitted, its colors follow the device color scheme.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `.:Button` | `busy` | `boolean \| undefined` | Unspecified | Caller input | — |
| `.:Button` | `children` | `import("react").ReactNode` | Unspecified | Caller content | — |
| `.:Button` | `className` | `string \| undefined` | Unspecified | Caller input | — |
| `.:Button` | `endIcon` | `ReactElement<unknown, string \| import("react").JSXElementConstructor<any>> \| undefined` | Unspecified | Caller input | — |
| `.:Button` | `fullWidth` | `boolean \| undefined` | Unspecified | Caller input | — |
| `.:Button` | `motion` | `"press" \| "none" \| undefined` | Unspecified | Caller input | — |
| `.:Button` | `ref` | `Ref<HTMLButtonElement> \| undefined` | Unspecified | Caller reference | `HTMLButtonElement` |
| `.:Button` | `size` | `"sm" \| "md" \| "lg" \| undefined` | Unspecified | Caller input | — |
| `.:Button` | `startIcon` | `ReactElement<unknown, string \| import("react").JSXElementConstructor<any>> \| undefined` | Unspecified | Caller input | — |
| `.:Button` | `style` | `import("react").CSSProperties \| undefined` | Unspecified | Caller input | — |
| `.:Button` | `tone` | `"primary" \| "secondary" \| "ghost" \| "danger" \| "link" \| undefined` | Unspecified | Caller input | — |
| `.:Button` | `unstyled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `.:Button` | Host attributes | 285 standard platform attributes, not listed | Unspecified | Caller input | — |
| `.:useButton` | `__0` | `UseButtonOptions` | Required | Caller input | — |
| `navigation:Trigger` | `aria-controls` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Trigger` | `aria-current` | `boolean \| "true" \| "false" \| "page" \| "step" \| "location" \| "date" \| "time" \| undefined` | Unspecified | Caller input | — |
| `navigation:Trigger` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Trigger` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Trigger` | `aria-disabled` | `boolean \| "true" \| "false" \| undefined` | Unspecified | Caller input | — |
| `navigation:Trigger` | `aria-expanded` | `boolean \| "true" \| "false" \| undefined` | Unspecified | Caller input | — |
| `navigation:Trigger` | `aria-haspopup` | `boolean \| "true" \| "false" \| "dialog" \| "grid" \| "listbox" \| "menu" \| "tree" \| undefined` | Unspecified | Caller input | — |
| `navigation:Trigger` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Trigger` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Trigger` | `aria-pressed` | `boolean \| "true" \| "false" \| "mixed" \| undefined` | Unspecified | Caller input | — |
| `navigation:Trigger` | `autoFocus` | `boolean \| undefined` | Unspecified | Caller input | — |
| `navigation:Trigger` | `children` | `import("react-aria-components").ChildrenOrFunction<ButtonRenderProps>` | Unspecified | Caller content | — |
| `navigation:Trigger` | `className` | `ClassNameOrFunction<ButtonRenderProps> \| undefined` | `'react-aria-Button'` | Caller input | — |
| `navigation:Trigger` | `excludeFromTabOrder` | `boolean \| undefined` | Unspecified | Caller input | — |
| `navigation:Trigger` | `form` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Trigger` | `formAction` | `string \| ((formData: FormData) => void \| Promise<void>) \| undefined` | Unspecified | Caller input | — |
| `navigation:Trigger` | `formEncType` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Trigger` | `formMethod` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Trigger` | `formNoValidate` | `boolean \| undefined` | Unspecified | Caller input | — |
| `navigation:Trigger` | `formTarget` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Trigger` | `id` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Trigger` | `isDisabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `navigation:Trigger` | `isPending` | `boolean \| undefined` | Unspecified | Caller input | — |
| `navigation:Trigger` | `name` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Trigger` | `onBlur` | `((e: React.FocusEvent<Element, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Trigger` | `onClick` | `((e: React.MouseEvent<import("react-aria-components").FocusableElement>) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Trigger` | `onFocus` | `((e: React.FocusEvent<Element, Element>) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Trigger` | `onFocusChange` | `((isFocused: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Trigger` | `onHoverChange` | `((isHovering: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Trigger` | `onHoverEnd` | `((e: import("react-aria-components").HoverEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Trigger` | `onHoverStart` | `((e: import("react-aria-components").HoverEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Trigger` | `onKeyDown` | `((e: import("react-aria-components").KeyboardEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Trigger` | `onKeyUp` | `((e: import("react-aria-components").KeyboardEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Trigger` | `onPress` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Trigger` | `onPressChange` | `((isPressed: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Trigger` | `onPressEnd` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Trigger` | `onPressStart` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Trigger` | `onPressUp` | `((e: import("react-aria-components").PressEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Trigger` | `preventFocusOnPress` | `boolean \| undefined` | Unspecified | Caller input | — |
| `navigation:Trigger` | `ref` | `React.Ref<HTMLButtonElement> \| undefined` | Unspecified | Caller reference | `HTMLButtonElement` |
| `navigation:Trigger` | `render` | `import("react-aria-components").DOMRenderFunction<"button", ButtonRenderProps> \| undefined` | Unspecified | Caller input | — |
| `navigation:Trigger` | `slot` | `string \| null \| undefined` | Unspecified | Caller input | — |
| `navigation:Trigger` | `style` | `import("react-aria-components").StyleOrFunction<ButtonRenderProps> \| undefined` | Unspecified | Caller input | — |
| `navigation:Trigger` | `type` | `"submit" \| "reset" \| "button" \| undefined` | `'button'` | Caller input | — |
| `navigation:Trigger` | `value` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:Trigger` | Host attributes | 70 standard platform attributes, not listed | Unspecified | Caller input | — |
| `native:Button` | `accessibilityHint` | `string \| undefined` | Unspecified | Caller input | — |
| `native:Button` | `busy` | `boolean \| undefined` | Unspecified | Caller input | — |
| `native:Button` | `disabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `native:Button` | `endIcon` | `ReactElement<unknown, string \| import("react").JSXElementConstructor<any>> \| undefined` | Unspecified | Caller input | — |
| `native:Button` | `fullWidth` | `boolean \| undefined` | Unspecified | Caller input | — |
| `native:Button` | `icon` | `ReactElement<unknown, string \| import("react").JSXElementConstructor<any>> \| undefined` | Unspecified | Caller input | — |
| `native:Button` | `label` | `string` | Required | Caller input | — |
| `native:Button` | `labelStyle` | `StyleProp<TextStyle> \| undefined` | Unspecified | Caller input | — |
| `native:Button` | `motion` | `"press" \| "none" \| undefined` | Unspecified | Caller input | — |
| `native:Button` | `onPress` | `(event: import("react-native").GestureResponderEvent) => unknown` | Required | Caller callback | — |
| `native:Button` | `pressableStyle` | `StyleProp<ViewStyle> \| undefined` | Unspecified | Caller input | — |
| `native:Button` | `ref` | `Ref<import("react-native/types_generated/src/private/webapis/dom/nodes/ReactNativeElement.js").default> \| undefined` | Unspecified | Caller reference | `import("react-native/types_generated/src/private/webapis/dom/nodes/ReactNativeElement.js").default` |
| `native:Button` | `size` | `"sm" \| "md" \| "lg" \| undefined` | Unspecified | Caller input | — |
| `native:Button` | `startIcon` | `ReactElement<unknown, string \| import("react").JSXElementConstructor<any>> \| undefined` | Unspecified | Caller input | — |
| `native:Button` | `style` | `StyleProp<ViewStyle> \| undefined` | Unspecified | Caller input | — |
| `native:Button` | `testID` | `string \| undefined` | Unspecified | Caller input | — |
| `native:Button` | `theme` | `ResolvedTokens \| undefined` | Unspecified | Caller input | — |
| `native:Button` | `tone` | `"primary" \| "secondary" \| "ghost" \| "danger" \| "link" \| undefined` | Unspecified | Caller input | — |
| `native:Button` | `unstyled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `native:useButton` | `__0` | `UseButtonOptions` | Required | Caller input | — |
| `native/button:Button` | `accessibilityHint` | `string \| undefined` | Unspecified | Caller input | — |
| `native/button:Button` | `busy` | `boolean \| undefined` | Unspecified | Caller input | — |
| `native/button:Button` | `disabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `native/button:Button` | `endIcon` | `ReactElement<unknown, string \| import("react").JSXElementConstructor<any>> \| undefined` | Unspecified | Caller input | — |
| `native/button:Button` | `fullWidth` | `boolean \| undefined` | Unspecified | Caller input | — |
| `native/button:Button` | `icon` | `ReactElement<unknown, string \| import("react").JSXElementConstructor<any>> \| undefined` | Unspecified | Caller input | — |
| `native/button:Button` | `label` | `string` | Required | Caller input | — |
| `native/button:Button` | `labelStyle` | `StyleProp<TextStyle> \| undefined` | Unspecified | Caller input | — |
| `native/button:Button` | `motion` | `"press" \| "none" \| undefined` | Unspecified | Caller input | — |
| `native/button:Button` | `onPress` | `(event: import("react-native").GestureResponderEvent) => unknown` | Required | Caller callback | — |
| `native/button:Button` | `pressableStyle` | `StyleProp<ViewStyle> \| undefined` | Unspecified | Caller input | — |
| `native/button:Button` | `ref` | `Ref<import("react-native/types_generated/src/private/webapis/dom/nodes/ReactNativeElement.js").default> \| undefined` | Unspecified | Caller reference | `import("react-native/types_generated/src/private/webapis/dom/nodes/ReactNativeElement.js").default` |
| `native/button:Button` | `size` | `"sm" \| "md" \| "lg" \| undefined` | Unspecified | Caller input | — |
| `native/button:Button` | `startIcon` | `ReactElement<unknown, string \| import("react").JSXElementConstructor<any>> \| undefined` | Unspecified | Caller input | — |
| `native/button:Button` | `style` | `StyleProp<ViewStyle> \| undefined` | Unspecified | Caller input | — |
| `native/button:Button` | `testID` | `string \| undefined` | Unspecified | Caller input | — |
| `native/button:Button` | `theme` | `ResolvedTokens \| undefined` | Unspecified | Caller input | — |
| `native/button:Button` | `tone` | `"primary" \| "secondary" \| "ghost" \| "danger" \| "link" \| undefined` | Unspecified | Caller input | — |
| `native/button:Button` | `unstyled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `native/button:useButton` | `__0` | `UseButtonOptions` | Required | Caller input | — |

### React web

#### Rendering

A Button without an event handler or a busy state renders as a server component. The packed server-only fixture renders “Print chapter” without client JavaScript. A busy Button uses a client handler to suppress activation. `navigation` is a client entry. The packed consumer hydrates the Review button, opens a dialog and receives focus again after dismissal. [Consumer probe](../../tests/packaging/fixture/probe.mjs) · [Hydration checks](../../scripts/verify-hydration.mjs)

The web root is a native button. Its children render inside the label part, with optional decorative start and end graphics and, while busy, a busy indicator. Each part has the class `uld-button-<part>` and `data-part="<part>"` (`root`, `label`, `start-icon`, `end-icon`, `busy-indicator`); the root also has `uld-button-root`. The styling class `uld-button` is left out in unstyled mode. The optional navigation `Trigger` binding delegates to React Aria.

#### Headless API

`useButton({ busy, disabled, type, onClick })` returns `buttonProps` for a plain `<button>`: the type, the native `disabled` attribute, `aria-busy` and `aria-disabled` while pending, and a click handler that blocks activation and form submission while pending. Button is built on it. [Hook test](../../tests/button/controls.test.tsx)

#### Test helpers

None. Button is a single native button; consumers query it by role and accessible name, which is the pattern the library's own tests use.

#### Platform differences

| Contract | Web | Native | Tracking |
| --- | --- | --- | --- |
| Content | Visible children in the label part and optional decorative graphics | Required label and optional decorative graphics | Both support leading and trailing elements. |
| Focus and pending | Busy keeps the native button focusable with `aria-busy` and `aria-disabled`, and blocks activation | Busy keeps the press target focusable with busy and disabled accessibility state, and ignores presses | Same contract on both platforms. |
| Ref and activation | HTML button ref and DOM events | Pressable view ref and native onPress event | Use the platform ref for imperative access and the part ids for automation. |

**Variants.** Five tones: primary, secondary, ghost, danger and link. Web minimum sizes are 32, 44 and 56 CSS pixels; on a touch screen small and medium rise to 48 in every density, matching native. `fullWidth` fills the container and `unstyled` removes the library styles while keeping the part class names.

**Keyboard and pointer.** Enabled HTML buttons activate with Enter, Space, click or tap. DOM placement determines tab order and the type controls form behavior. While busy, the click handler cancels the event, which also cancels form submission, including implicit submission from Enter in a field. The navigation Trigger has an independent isPending API.

**Accessibility.** Web action text names the control; start and end graphics and the busy indicator are hidden and inert. While busy the label is transparent but still names the button. RTL places logical graphics on the appropriate side. Web honors prefers-reduced-motion for press feedback and the busy animation, and forced colors keep a visible focus outline.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Default | Mount the button | Named HTML button | Yes | Yes | [Ordinary action type](../../tests/button/controls.test.tsx) |
| Focus-visible | Reach an enabled action by keyboard | Focus token outline | Yes | Yes | [Keyboard activation and focus return](../../tests/browser/catalog.spec.ts) |
| Pressed | Opt into press feedback and press | Press scale unless reduced motion | Yes | Yes | [Press and reduced motion](../../tests/browser/adaptive.spec.ts) |
| Pending | Set busy | `aria-busy` and `aria-disabled`; activation and submission blocked; size unchanged | No | Keeps focus | [Busy submit in three browsers](../../tests/browser/button-states.spec.ts) |
| Disabled | Set disabled | Native disabled attribute | No | No web tab stop | [Disabled leaves the focus order](../../tests/button/controls.test.tsx) |

#### Performance

`Button` 572 B, `useButton` 205 B, `Trigger` 13070 B. Measured gzip sizes for separate tree-shaken production web imports, with React and React DOM external. Button is inside the 2.5 KB band for simple components. The root entry keeps React Aria and native code outside its web bundle. The optional Trigger loads through navigation. Import root styles separately; `styles.css` measures 1,558 B gzip.

#### Tests

- **Default.** [Ordinary action type](../../tests/button/controls.test.tsx).
- **Focus-visible.** [Keyboard activation and focus return](../../tests/browser/catalog.spec.ts).
- **Pressed.** [Press and reduced motion](../../tests/browser/adaptive.spec.ts).
- **Pending.** [Busy submit keeps focus and width in three browsers](../../tests/browser/button-states.spec.ts).
- **Disabled.** [Disabled leaves the focus order](../../tests/button/controls.test.tsx).
- [Every tone and state passes axe in light, dark and high contrast, in both brands](../../tests/browser/button-states.spec.ts).
- [A 48 pixel target on touch screens in every density](../../tests/browser/button-states.spec.ts).
- [Light and dark screenshots at phone and desktop size](../../tests/browser/button.visual.ts).
- [Responsive sizes, decorative slots, RTL and keyboard focus](../../tests/browser/button-depth.spec.ts).
- [Native reduced motion, icon slots and hit targets](../../tests/button/native.test.cjs).
- [iPhone workspace editing and save](../../tests/simulator/workspace.yaml).

Scenario fixture: [button.save-once](button.scenarios.yaml).

#### Changelog and deprecations

The web action appeared in 0.1.0. Candidate 0.3.0-rc.1 adds token sizes and decorative icon slots on web and native, then ghost, danger and link tones, `fullWidth`, `unstyled`, part names and `useButton`. A busy web button now stays focusable and uses `aria-disabled` instead of the native `disabled` attribute; code that read `disabled` to detect busy should read `aria-busy`, and no automatic migration is needed because the props are unchanged. No prop is deprecated.

### React Native

#### Rendering

The press target requires a label and exposes busy and disabled state. The ref resolves to the press target in the application's native view hierarchy. Use `style` for its outer layout, `pressableStyle` for the target and `labelStyle` for the text. Consumer styles override the defaults. Tones, `fullWidth` and `unstyled` match web. While busy, an ActivityIndicator covers the label and icons, which keep their space, so the button keeps its size. With a `testID`, each part gets `<testID>.label`, `.start-icon`, `.end-icon`, `.icon` and `.busy-indicator`. In unstyled mode the busy part remains available to target, the label stays visible, and the library draws no indicator.

#### Headless API

Import `useButton` from `@ui-lazy-dev/ui-native` and spread its `buttonProps` on a `Pressable`. The hook supplies its accessible role, name, hint, focusability and press guard. The styled Button uses the same hook. The caller owns all visuals when rendering a custom press target.

#### Test helpers

None. Button is a single press target; renderer tests and apps query it by role and accessible name.

#### Platform differences

| State | iOS | Android |
| --- | --- | --- |
| Default | Named button | Named button |
| Focus-visible | Accessibility focus belongs to the press target | Accessibility focus belongs to the press target |
| Pressed | Highlights to `motion.pressOpacity`, plus press scale when `motion="press"` | Bounded theme ripple, plus press scale when `motion="press"` |
| Pending | Busy and disabled accessibility state; stays focusable; presses ignored | Same |
| Disabled | Disabled accessibility state; leaves accessibility focus order | Same |

Busy, disabled and unstyled controls draw no press feedback. Reduced motion stops the press scale and shows a stationary indicator while busy on both platforms.

#### Performance

Measured by the packed native consumer check with React, React Native and the token package supplied by the app. The default native entry stays inside the 60 KB default install.

#### Tests

Native support is experimental pending physical-device and assistive-technology qualification. [Renderer tests for tones, busy, parts, full width, unstyled and the iOS highlight](../../tests/button/native.test.cjs). [Neutral scenarios on the native renderer](../../tests/native/scenarios.test.cjs), the iPhone Simulator and both Android emulator profiles.

#### Changelog and deprecations

0.3.0-rc.1 adds ghost, danger and link tones, `fullWidth`, `unstyled`, part ids, a size-preserving busy indicator and the iOS press highlight. The public `useButton` hook exposes the same accessibility and activation behaviour to custom press targets. Busy no longer dims the button. No prop is deprecated.
