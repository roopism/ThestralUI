---
{
  "family": "Modal dialog",
  "status": "experimental",
  "since": "0.1.0",
  "owner": "@thetechgeeek",
  "platforms": {
    "web": "supported",
    "native": "experimental"
  },
  "exports": [
    {
      "platform": "web",
      "name": "Dialog",
      "from": "@ui-lazy-dev/ui-web/dialog",
      "rendering": "client-only"
    },
    {
      "platform": "web",
      "name": "DialogTrigger",
      "from": "@ui-lazy-dev/ui-web/navigation",
      "rendering": "client-only"
    },
    {
      "platform": "web",
      "name": "Modal",
      "from": "@ui-lazy-dev/ui-web/navigation",
      "rendering": "client-only"
    },
    {
      "platform": "web",
      "name": "ModalOverlay",
      "from": "@ui-lazy-dev/ui-web/navigation",
      "rendering": "client-only"
    },
    {
      "platform": "web",
      "name": "OverlayDialog",
      "from": "@ui-lazy-dev/ui-web/navigation",
      "rendering": "client-only"
    },
    {
      "platform": "native",
      "name": "Dialog",
      "from": "@ui-lazy-dev/ui-native"
    },
    {
      "platform": "web",
      "name": "Dialog",
      "from": "@ui-lazy-dev/ui-web/modal-dialog",
      "rendering": "client-only"
    },
    {
      "platform": "web",
      "name": "useDialog",
      "from": "@ui-lazy-dev/ui-web/modal-dialog",
      "rendering": "client-only"
    },
    {
      "platform": "web",
      "name": "DialogHeading",
      "from": "@ui-lazy-dev/ui-web/modal-dialog",
      "rendering": "server-safe"
    },
    {
      "platform": "web",
      "name": "DialogBody",
      "from": "@ui-lazy-dev/ui-web/modal-dialog",
      "rendering": "server-safe"
    },
    {
      "platform": "web",
      "name": "DialogActions",
      "from": "@ui-lazy-dev/ui-web/modal-dialog",
      "rendering": "server-safe"
    },
    {
      "platform": "native",
      "name": "useDialog",
      "from": "@ui-lazy-dev/ui-native"
    },
    {
      "platform": "native",
      "name": "Dialog",
      "from": "@ui-lazy-dev/ui-native/modal-dialog"
    },
    {
      "platform": "native",
      "name": "useDialog",
      "from": "@ui-lazy-dev/ui-native/modal-dialog"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/Dialog",
    "https://mui.com/material-ui/react-dialog/"
  ]
}
---

# Modal dialog

## Part A — Contract

### Purpose and when not to use it

Contain a focused task while the surrounding workspace is unavailable. Use Popover for nonmodal contextual content and Status for a result that needs no reply.

### Anatomy

A heading names the modal surface. Only the current task is reachable while the dialog is open. A nested task closes independently and leaves the parent’s draft intact.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| heading | Required | N/A — required | Container gap | Provides the accessible name | Text adds no stop |
| body | Required | N/A — required | Container gap | Children retain their semantics | Operable children keep their order |
| actions | Optional | collapse | Container gap | Children retain their semantics | Operable children keep their order |

### Variants

Use an ordinary dialog for a focused task. Consequential decisions can select the alert dialog role on web. Choose a small panel for a short question, medium for a review, and large for a longer form. The owner decides whether an outside press requests dismissal.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Open | Open the modal | Surface, text, border and radius | A named dialog contains the task | Child actions only | Focus enters its contents | [modal-dialog.open-and-close](modal-dialog.scenarios.yaml) |
| Dismissed | Dismiss the modal | Owner removes the surface | Focus returns to the opener | Launcher may activate again | The opener when it is still available | [modal-dialog.open-and-close](modal-dialog.scenarios.yaml) |
| System dismissal | Request dismissal using the platform back action | See Tokens | The dialog owner receives the dismissal request | Child controls own actions | Modal holds interaction | [modal-dialog.nested-return](modal-dialog.scenarios.yaml) |
| Nested | Open a second task from an existing dialog | Only the foreground surface accepts interaction | Its title and actions are exposed | Foreground controls | Closing the child returns to its invoking control on web | [modal-dialog.nested-return](modal-dialog.scenarios.yaml) |

### Keyboard, pointer and touch

While the modal is open Tab stays within the dialog. Updating its content preserves focus on the active control. The web Dialog captures its return target when it opens.

### Accessibility

Keep the least destructive action easy to reach. Preserve reading order for RTL titles and actions. Child buttons supply the activation targets.

### State patterns

This family owns no request lifecycle. Its containing surface supplies any loading, empty, error, offline, permission or partial-failure state.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

| Part or state | Token |
| --- | --- |
| Modal panel | `light.surface`, `dark.surface`, `light.text`, `dark.text` |
| Border and corners | `light.border`, `dark.border`, `size.radius` |
| Control focus indication | `light.focus`, `dark.focus` |
| Child spacing | `size.gap` |

### Composition and content guidelines

Pass separate Button controls for confirm and cancel. Each instance needs its own title and focus return target. Do ask “Discard changes?” and label actions “Keep editing” and “Discard”. Avoid a title like “Attention!” with two ambiguous Yes/No choices. Allow localized labels and long explanations to grow.

## Part B — Bindings

### API

Mount Dialog to open it, or keep it mounted and control its `open` prop. The owner decides what happens after `onDismiss`. The web binding takes a title ID (`labelledBy`) and an optional description ID (`describedBy`). Native takes a localized `title`. Both platforms accept an optional `returnFocusRef` for the opener. Web forwards its ref to the HTML dialog and native forwards it to the panel. The navigation trigger also supports uncontrolled open state.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `dialog:Dialog` | `children` | `ReactNode` | Required | Caller content | — |
| `dialog:Dialog` | `className` | `string \| undefined` | Unspecified | Caller input | — |
| `dialog:Dialog` | `describedBy` | `string \| undefined` | Unspecified | Caller input | — |
| `dialog:Dialog` | `dismissOnBackdrop` | `boolean \| undefined` | Unspecified | Caller input | — |
| `dialog:Dialog` | `labelledBy` | `string` | Required | Caller input | — |
| `dialog:Dialog` | `onDismiss` | `() => void` | Required | Caller callback | — |
| `dialog:Dialog` | `open` | `boolean \| undefined` | Unspecified | Caller input | — |
| `dialog:Dialog` | `ref` | `Ref<HTMLDialogElement> \| undefined` | Unspecified | Caller reference | `HTMLDialogElement` |
| `dialog:Dialog` | `returnFocusRef` | `RefObject<HTMLElement \| null> \| undefined` | Unspecified | Caller reference | `HTMLElement` |
| `dialog:Dialog` | `role` | `"alertdialog" \| "dialog" \| undefined` | Unspecified | Caller input | — |
| `dialog:Dialog` | `size` | `"sm" \| "md" \| "lg" \| undefined` | Unspecified | Caller input | — |
| `dialog:Dialog` | `style` | `import("react").CSSProperties \| undefined` | Unspecified | Caller input | — |
| `dialog:Dialog` | `unstyled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `dialog:Dialog` | Host attributes | 275 standard platform attributes, not listed | Unspecified | Caller input | — |
| `navigation:DialogTrigger` | `children` | `React.ReactNode` | Required | Caller content | — |
| `navigation:DialogTrigger` | `defaultOpen` | `boolean \| undefined` | Unspecified | Uncontrolled initial value | — |
| `navigation:DialogTrigger` | `isOpen` | `boolean \| undefined` | Unspecified | Controlled value | — |
| `navigation:DialogTrigger` | `onOpenChange` | `((isOpen: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Modal` | `children` | `import("react-aria-components").ChildrenOrFunction<ModalRenderProps>` | Unspecified | Caller content | — |
| `navigation:Modal` | `className` | `ClassNameOrFunction<ModalRenderProps> \| undefined` | `'react-aria-ModalOverlay'` | Caller input | — |
| `navigation:Modal` | `defaultOpen` | `boolean \| undefined` | Unspecified | Uncontrolled initial value | — |
| `navigation:Modal` | `isDismissable` | `boolean \| undefined` | `false` | Caller input | — |
| `navigation:Modal` | `isEntering` | `boolean \| undefined` | Unspecified | Caller input | — |
| `navigation:Modal` | `isExiting` | `boolean \| undefined` | Unspecified | Caller input | — |
| `navigation:Modal` | `isKeyboardDismissDisabled` | `boolean \| undefined` | `false` | Caller input | — |
| `navigation:Modal` | `isOpen` | `boolean \| undefined` | Unspecified | Controlled value | — |
| `navigation:Modal` | `onEnter` | `((element: HTMLElement) => void \| Promise<void>) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Modal` | `onExit` | `((element: HTMLElement) => void \| Promise<void>) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Modal` | `onOpenChange` | `((isOpen: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:Modal` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `navigation:Modal` | `render` | `import("react-aria-components").DOMRenderFunction<"div", ModalRenderProps> \| undefined` | Unspecified | Caller input | — |
| `navigation:Modal` | `shouldCloseOnInteractOutside` | `((element: Element) => boolean) \| undefined` | Unspecified | Caller input | — |
| `navigation:Modal` | `slot` | `string \| null \| undefined` | Unspecified | Caller input | — |
| `navigation:Modal` | `style` | `import("react-aria-components").StyleOrFunction<ModalRenderProps> \| undefined` | Unspecified | Caller input | — |
| `navigation:Modal` | `UNSTABLE_deferUntilEntered` | `boolean \| undefined` | Unspecified | Caller input | — |
| `navigation:Modal` | `UNSTABLE_overrideFocus` | `boolean \| undefined` | Unspecified | Caller input | — |
| `navigation:Modal` | `UNSTABLE_portalContainer` | `Element \| undefined` | `document.body` | Caller input | — |
| `navigation:Modal` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |
| `navigation:ModalOverlay` | `children` | `import("react-aria-components").ChildrenOrFunction<ModalRenderProps>` | Unspecified | Caller content | — |
| `navigation:ModalOverlay` | `className` | `ClassNameOrFunction<ModalRenderProps> \| undefined` | `'react-aria-ModalOverlay'` | Caller input | — |
| `navigation:ModalOverlay` | `defaultOpen` | `boolean \| undefined` | Unspecified | Uncontrolled initial value | — |
| `navigation:ModalOverlay` | `isDismissable` | `boolean \| undefined` | `false` | Caller input | — |
| `navigation:ModalOverlay` | `isEntering` | `boolean \| undefined` | Unspecified | Caller input | — |
| `navigation:ModalOverlay` | `isExiting` | `boolean \| undefined` | Unspecified | Caller input | — |
| `navigation:ModalOverlay` | `isKeyboardDismissDisabled` | `boolean \| undefined` | `false` | Caller input | — |
| `navigation:ModalOverlay` | `isOpen` | `boolean \| undefined` | Unspecified | Controlled value | — |
| `navigation:ModalOverlay` | `onEnter` | `((element: HTMLElement) => void \| Promise<void>) \| undefined` | Unspecified | Caller callback | — |
| `navigation:ModalOverlay` | `onExit` | `((element: HTMLElement) => void \| Promise<void>) \| undefined` | Unspecified | Caller callback | — |
| `navigation:ModalOverlay` | `onOpenChange` | `((isOpen: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `navigation:ModalOverlay` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `navigation:ModalOverlay` | `render` | `import("react-aria-components").DOMRenderFunction<"div", ModalRenderProps> \| undefined` | Unspecified | Caller input | — |
| `navigation:ModalOverlay` | `shouldCloseOnInteractOutside` | `((element: Element) => boolean) \| undefined` | Unspecified | Caller input | — |
| `navigation:ModalOverlay` | `slot` | `string \| null \| undefined` | Unspecified | Caller input | — |
| `navigation:ModalOverlay` | `style` | `import("react-aria-components").StyleOrFunction<ModalRenderProps> \| undefined` | Unspecified | Caller input | — |
| `navigation:ModalOverlay` | `UNSTABLE_deferUntilEntered` | `boolean \| undefined` | Unspecified | Caller input | — |
| `navigation:ModalOverlay` | `UNSTABLE_overrideFocus` | `boolean \| undefined` | Unspecified | Caller input | — |
| `navigation:ModalOverlay` | `UNSTABLE_portalContainer` | `Element \| undefined` | `document.body` | Caller input | — |
| `navigation:ModalOverlay` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |
| `navigation:OverlayDialog` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:OverlayDialog` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:OverlayDialog` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:OverlayDialog` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:OverlayDialog` | `children` | `import("react").ReactNode \| ((opts: import("react-aria-components").DialogRenderProps) => import("react").ReactNode)` | Unspecified | Caller content | — |
| `navigation:OverlayDialog` | `className` | `string \| undefined` | `'react-aria-Dialog'` | Caller input | — |
| `navigation:OverlayDialog` | `id` | `string \| undefined` | Unspecified | Caller input | — |
| `navigation:OverlayDialog` | `isEntering` | `boolean \| undefined` | Unspecified | Caller input | — |
| `navigation:OverlayDialog` | `ref` | `import("react").Ref<HTMLElement> \| undefined` | Unspecified | Caller reference | `HTMLElement` |
| `navigation:OverlayDialog` | `render` | `import("react-aria-components").DOMRenderFunction<"section", undefined> \| undefined` | Unspecified | Caller input | — |
| `navigation:OverlayDialog` | `role` | `"alertdialog" \| "dialog" \| undefined` | `'dialog'` | Caller input | — |
| `navigation:OverlayDialog` | `slot` | `string \| null \| undefined` | Unspecified | Caller input | — |
| `navigation:OverlayDialog` | `style` | `import("react").CSSProperties \| undefined` | Unspecified | Caller input | — |
| `navigation:OverlayDialog` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |
| `modal-dialog:Dialog` | `children` | `ReactNode` | Required | Caller content | — |
| `modal-dialog:Dialog` | `className` | `string \| undefined` | Unspecified | Caller input | — |
| `modal-dialog:Dialog` | `describedBy` | `string \| undefined` | Unspecified | Caller input | — |
| `modal-dialog:Dialog` | `dismissOnBackdrop` | `boolean \| undefined` | Unspecified | Caller input | — |
| `modal-dialog:Dialog` | `labelledBy` | `string` | Required | Caller input | — |
| `modal-dialog:Dialog` | `onDismiss` | `() => void` | Required | Caller callback | — |
| `modal-dialog:Dialog` | `open` | `boolean \| undefined` | Unspecified | Caller input | — |
| `modal-dialog:Dialog` | `ref` | `Ref<HTMLDialogElement> \| undefined` | Unspecified | Caller reference | `HTMLDialogElement` |
| `modal-dialog:Dialog` | `returnFocusRef` | `RefObject<HTMLElement \| null> \| undefined` | Unspecified | Caller reference | `HTMLElement` |
| `modal-dialog:Dialog` | `role` | `"alertdialog" \| "dialog" \| undefined` | Unspecified | Caller input | — |
| `modal-dialog:Dialog` | `size` | `"sm" \| "md" \| "lg" \| undefined` | Unspecified | Caller input | — |
| `modal-dialog:Dialog` | `style` | `import("react").CSSProperties \| undefined` | Unspecified | Caller input | — |
| `modal-dialog:Dialog` | `unstyled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `modal-dialog:Dialog` | Host attributes | 275 standard platform attributes, not listed | Unspecified | Caller input | — |
| `modal-dialog:useDialog` | `__0` | `UseDialogOptions` | Required | Caller input | — |
| `modal-dialog:DialogHeading` | `children` | `import("react").ReactNode` | Unspecified | Caller content | — |
| `modal-dialog:DialogHeading` | `className` | `string \| undefined` | Unspecified | Caller input | — |
| `modal-dialog:DialogHeading` | `ref` | `import("react").Ref<HTMLHeadingElement> \| undefined` | Unspecified | Caller reference | `HTMLHeadingElement` |
| `modal-dialog:DialogHeading` | `style` | `import("react").CSSProperties \| undefined` | Unspecified | Caller input | — |
| `modal-dialog:DialogHeading` | Host attributes | 276 standard platform attributes, not listed | Unspecified | Caller input | — |
| `modal-dialog:DialogBody` | `children` | `import("react").ReactNode` | Unspecified | Caller content | — |
| `modal-dialog:DialogBody` | `className` | `string \| undefined` | Unspecified | Caller input | — |
| `modal-dialog:DialogBody` | `ref` | `import("react").Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `modal-dialog:DialogBody` | `style` | `import("react").CSSProperties \| undefined` | Unspecified | Caller input | — |
| `modal-dialog:DialogBody` | Host attributes | 276 standard platform attributes, not listed | Unspecified | Caller input | — |
| `modal-dialog:DialogActions` | `children` | `import("react").ReactNode` | Unspecified | Caller content | — |
| `modal-dialog:DialogActions` | `className` | `string \| undefined` | Unspecified | Caller input | — |
| `modal-dialog:DialogActions` | `ref` | `import("react").Ref<HTMLElement> \| undefined` | Unspecified | Caller reference | `HTMLElement` |
| `modal-dialog:DialogActions` | `style` | `import("react").CSSProperties \| undefined` | Unspecified | Caller input | — |
| `modal-dialog:DialogActions` | Host attributes | 276 standard platform attributes, not listed | Unspecified | Caller input | — |
| `native:Dialog` | `actions` | `ReactNode` | Unspecified | Caller input | — |
| `native:Dialog` | `actionsStyle` | `StyleProp<ViewStyle> \| undefined` | Unspecified | Caller input | — |
| `native:Dialog` | `backdropStyle` | `StyleProp<ViewStyle> \| undefined` | Unspecified | Caller input | — |
| `native:Dialog` | `bodyStyle` | `StyleProp<ViewStyle> \| undefined` | Unspecified | Caller input | — |
| `native:Dialog` | `children` | `ReactNode` | Required | Caller content | — |
| `native:Dialog` | `dismissOnBackdrop` | `boolean \| undefined` | Unspecified | Caller input | — |
| `native:Dialog` | `headingStyle` | `StyleProp<TextStyle> \| undefined` | Unspecified | Caller input | — |
| `native:Dialog` | `onDismiss` | `() => void` | Required | Caller callback | — |
| `native:Dialog` | `open` | `boolean \| undefined` | Unspecified | Caller input | — |
| `native:Dialog` | `ref` | `Ref<import("react-native/types_generated/src/private/webapis/dom/nodes/ReactNativeElement.js").default> \| undefined` | Unspecified | Caller reference | `import("react-native/types_generated/src/private/webapis/dom/nodes/ReactNativeElement.js").default` |
| `native:Dialog` | `returnFocusRef` | `RefObject<import("react-native/types_generated/src/private/webapis/dom/nodes/ReactNativeElement.js").default \| null> \| undefined` | Unspecified | Caller reference | `import("react-native/types_generated/src/private/webapis/dom/nodes/ReactNativeElement.js").default` |
| `native:Dialog` | `size` | `"sm" \| "md" \| "lg" \| undefined` | Unspecified | Caller input | — |
| `native:Dialog` | `style` | `StyleProp<ViewStyle> \| undefined` | Unspecified | Caller input | — |
| `native:Dialog` | `testID` | `string \| undefined` | Unspecified | Caller input | — |
| `native:Dialog` | `theme` | `ResolvedTokens \| undefined` | Unspecified | Caller input | — |
| `native:Dialog` | `title` | `string` | Required | Caller input | — |
| `native:Dialog` | `unstyled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `native:useDialog` | `__0` | `UseDialogOptions` | Required | Caller input | — |
| `native/modal-dialog:Dialog` | `actions` | `ReactNode` | Unspecified | Caller input | — |
| `native/modal-dialog:Dialog` | `actionsStyle` | `StyleProp<ViewStyle> \| undefined` | Unspecified | Caller input | — |
| `native/modal-dialog:Dialog` | `backdropStyle` | `StyleProp<ViewStyle> \| undefined` | Unspecified | Caller input | — |
| `native/modal-dialog:Dialog` | `bodyStyle` | `StyleProp<ViewStyle> \| undefined` | Unspecified | Caller input | — |
| `native/modal-dialog:Dialog` | `children` | `ReactNode` | Required | Caller content | — |
| `native/modal-dialog:Dialog` | `dismissOnBackdrop` | `boolean \| undefined` | Unspecified | Caller input | — |
| `native/modal-dialog:Dialog` | `headingStyle` | `StyleProp<TextStyle> \| undefined` | Unspecified | Caller input | — |
| `native/modal-dialog:Dialog` | `onDismiss` | `() => void` | Required | Caller callback | — |
| `native/modal-dialog:Dialog` | `open` | `boolean \| undefined` | Unspecified | Caller input | — |
| `native/modal-dialog:Dialog` | `ref` | `Ref<import("react-native/types_generated/src/private/webapis/dom/nodes/ReactNativeElement.js").default> \| undefined` | Unspecified | Caller reference | `import("react-native/types_generated/src/private/webapis/dom/nodes/ReactNativeElement.js").default` |
| `native/modal-dialog:Dialog` | `returnFocusRef` | `RefObject<import("react-native/types_generated/src/private/webapis/dom/nodes/ReactNativeElement.js").default \| null> \| undefined` | Unspecified | Caller reference | `import("react-native/types_generated/src/private/webapis/dom/nodes/ReactNativeElement.js").default` |
| `native/modal-dialog:Dialog` | `size` | `"sm" \| "md" \| "lg" \| undefined` | Unspecified | Caller input | — |
| `native/modal-dialog:Dialog` | `style` | `StyleProp<ViewStyle> \| undefined` | Unspecified | Caller input | — |
| `native/modal-dialog:Dialog` | `testID` | `string \| undefined` | Unspecified | Caller input | — |
| `native/modal-dialog:Dialog` | `theme` | `ResolvedTokens \| undefined` | Unspecified | Caller input | — |
| `native/modal-dialog:Dialog` | `title` | `string` | Required | Caller input | — |
| `native/modal-dialog:Dialog` | `unstyled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `native/modal-dialog:useDialog` | `__0` | `UseDialogOptions` | Required | Caller input | — |

### React web

#### Rendering

The heading, body and actions can render directly in a React Server Component. The packed foundation page renders all three. The interactive Dialog and its hook run in a client component. Server rendering preserves the labeled `<dialog>`, heading, body and actions in the initial HTML. The surface stays closed until hydration calls `showModal()`. Use a real named button for the launcher. The packed application opens Dialog after hydration and checks dismissal and focus return. [Server-rendered markup test](../../tests/modal-dialog/modal-dialog.test.tsx) · [Packed consumer](../../tests/packaging/fixture/probe.mjs)

Use the lightweight `@ui-lazy-dev/ui-web/dialog` import for Dialog alone. The family subpath `@ui-lazy-dev/ui-web/modal-dialog` also exports `DialogHeading`, `DialogBody`, `DialogActions` and `useDialog`. Supply a heading ID to the dialog. Empty actions omit their wrapper. For React Aria trigger composition, import `DialogTrigger`, `ModalOverlay`, `Modal` and `OverlayDialog` from the navigation subpath.

#### Headless API

Spread `useDialog({ labelledBy, open, onDismiss, returnFocusRef })` on a `<dialog>`. The hook opens the native modal, handles dismissal requests and restores focus. It adds no classes or styles. The styled Dialog calls the same hook. Pass `unstyled` to keep its root part and behavior while providing your own presentation.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Contract | Web | Native | Tracking |
| --- | --- | --- | --- |
| Title | Provide title element and its ID | Supply title text directly | Platform contracts differ by design. |
| Dismissal | Escape, owner actions and optional backdrop | System Back, accessibility escape and owner actions | Browser and native renderer tests check focus return to the supplied opener. |
| Ref | HTML dialog | Native panel view | Use the platform ref type for the corresponding control. |

**Variants.** Root web Dialog supports a dialog or alertdialog role and optional backdrop dismissal, which defaults off. The navigation overlay has its own trigger and dismissability props. Native presents a transparent modal without a transition and uses platform Back/escape delegation.

**Keyboard and pointer.** Web Escape requests dismissal. While the modal is open Tab stays within the dialog. Browser initial focus follows HTML dialog behavior and caller autofocus, and an explicit returnFocusRef handles pointer launchers. Native onShow sends accessibility focus to the heading and delegates Back or the accessibility escape gesture to its owner.

**Accessibility.** Give the title a meaningful name and use labelledBy on web. Keep brief context in describedBy only where appropriate. Keep the least destructive action easy to reach. Long content scrolls in the native modal and keyboard avoidance accommodates editing. Native requests accessibility focus on the supplied opener after dismissal. Physical-device VoiceOver and TalkBack walkthroughs remain separate from automated qualification. Web text and surface colors follow the theme and accept forced-color adjustment. Preserve reading order for RTL titles and actions. The HTML dialog and native renderer add no motion. Child buttons supply the activation targets.

**Composition.** Mount Dialog within the owning workflow. Pass separate Button controls for confirm and cancel. Use DialogTrigger plus Modal and OverlayDialog when building a React Aria trigger composition. Each instance needs its own title and focus return target.

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Open | Mount the web Dialog or open its trigger | Named modal dialog | Child actions only | Focus enters its contents | [Opening focuses the safe action](../../tests/browser/catalog.spec.ts) |
| Dismissed | Press Escape or invoke onDismiss and close | Prior launcher regains focus in the catalog | Launcher may activate again | Launcher on web and the explicitly supplied native opener | [Escape closes overlay and restores focus](../../tests/browser/enterprise-navigation.spec.ts) |
| Native request to close | Invoke the system Back action | No matching web Back event | Child controls own actions | Modal holds interaction | [Native delegates dismissal](../../tests/modal-dialog/native.test.cjs) |

#### Performance

The canonical `@ui-lazy-dev/ui-web/modal-dialog` entry measures 1,193 B gzip for all JavaScript exports and 396 B for its scoped styles, or 1,589 B together against the 7 KB overlay goal. Individual imports measure 1,018 B for `Dialog`, 903 B for `useDialog`, 201 B for `DialogHeading`, 199 B for `DialogBody` and 264 B for `DialogActions`. The existing `/dialog` entry measures 991 B in full and 990 B for its named Dialog. The complete shared `styles.css` entry measures 1,735 B gzip, up from 1,581 B in the previous enterprise build. Measurements use tree-shaken production bundles with React and React DOM external.

The independently published React Aria navigation exports retain their previous cost. `DialogTrigger` measures 6,234 B, `Modal` 19,199 B, `ModalOverlay` 16,262 B and `OverlayDialog` 5,516 B. Importing all four together costs 23,055 B after shared code is deduplicated. Bringing the two larger legacy exports within the overlay budget remains open for 1.0. The canonical family has no dependency on these exports.

#### Tests

- **Open.** [Opening focuses the safe action](../../tests/browser/catalog.spec.ts).
- **Dismissed.** Escape restores the opener. When a supplied return target is missing, an embedded Dialog preserves the focus destination the application chooses while closing. [Navigation dismissal](../../tests/browser/enterprise-navigation.spec.ts) · [Embedded draft actions](../../tests/browser/catalog.spec.ts)
- **Native request to close.** [Native delegates dismissal](../../tests/modal-dialog/native.test.cjs).
- [Native editing, cancel and confirm journey](../../tests/simulator/workspace.yaml).
- [Large text, system appearance and long modal copy](../../tests/simulator/appearance.yaml).

Browser cases cover both the standalone HTML dialog and the navigation trigger composition. Native renderer and simulator cases cover the native prompt. The browser family suite covers phone and desktop, light and dark. Physical assistive-technology walkthroughs remain outside the simulator evidence.

#### Changelog and deprecations

The root HTML dialog was available in 0.1.0. The current candidate also includes React Aria overlay companions and the experimental native renderer. No export is marked deprecated.

### React Native

#### Rendering

The system modal presents a heading, scrollable body and optional actions. On iOS the container avoids the keyboard. On Android a nested window waits for its parent to show. Back closes an open keyboard first. A later Back asks the foreground dialog’s owner to dismiss. The optional backdrop requests dismissal when `dismissOnBackdrop` is enabled.

#### Headless API

`useDialog({ open, onDismiss, returnFocusRef })` returns `modalProps`, `panelProps`, `headingProps` and `content(children)`. Apply these to a native `Modal`, panel and heading, then put nested content inside `content` so child windows follow their parent. The styled Dialog calls this hook. `unstyled` keeps accessibility and dismissal behavior, and the panel, backdrop, heading, body and actions accept caller styles.

#### Test helpers

None. Renderer fixtures query the accessible control directly.

#### Platform differences

On both platforms, showing the window moves accessibility focus to its heading. Closing can restore the supplied opener. Native Android Back handles the keyboard before the modal, and accessibility escape requests dismissal on iOS. The native renderer tests cover stale and reopened focus targets.

| State | Native binding behavior |
| --- | --- |
| Open | Modal accessibility view and heading |
| Dismissed | Native delegates Back and accessibility escape |
| Native request to close | Native Modal invokes owner's callback |

#### Performance

The packed native family subpath measures 1,416 B gzip for all exports, 1,407 B for Dialog alone and 706 B for useDialog alone. These separate tree-shaken measurements treat React, React Native and the shared tokens as dependencies supplied by the consumer. The family uses the system modal and adds no native binary module.

A 120-row scrolling Dialog ran on the low-end Android emulator against the previous enterprise build. One of the first three candidate trials presented 425 of 460 scroll frames late. Android reported buffer stuffing for all 425. The other two candidate trials and all three baseline trials had zero late frames. In four additional trials, each on a fresh boot from the same snapshot, the same packages presented all 899 baseline and 897 candidate scroll frames on time. The cause of the original outlier remains open.

#### Tests

The [native renderer suite](../../tests/modal-dialog/native.test.cjs) covers system dismissal, opener return, nested presentation, caller styles and accessible part roles. [Both shared journeys](modal-dialog.scenarios.yaml) run through the gallery in the iPhone simulator and both Android emulator profiles. Physical assistive-technology qualification remains outstanding.

#### Changelog and deprecations

The current candidate includes this native export. See the family changelog above for changes to shared behavior.
