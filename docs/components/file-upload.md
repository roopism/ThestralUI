---
{
  "family": "File upload",
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
      "name": "FileUpload",
      "from": "@ui-lazy-dev/ui-web/entry-fields",
      "rendering": "server-safe"
    },
    {
      "platform": "web",
      "name": "DropZone",
      "from": "@ui-lazy-dev/ui-web/forms"
    },
    {
      "platform": "web",
      "name": "FileTrigger",
      "from": "@ui-lazy-dev/ui-web/forms"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/FileTrigger",
    "https://mui.com/material-ui/react-button/"
  ]
}
---

# File upload

## Part A — Contract

### Purpose and when not to use it

Let users choose files from their device. Offer a drop area for direct manipulation and keep a named file chooser available for keyboard and touch.

### Anatomy

A named chooser accepts files from the device. An optional drop target offers another input method.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| label | Required | N/A — required | Container gap | Provides the accessible name | Text adds no stop |
| chooser | Required | N/A — required | Container gap | Control has its own name | Participates in its logical position |
| drop area | Optional | collapse | Container gap | Control has its own name | Participates in its logical position |
| hint | Optional | collapse | Container gap | Provides supporting information | Text adds no stop |
| error | Optional | collapse | Container gap | Provides supporting information | Text adds no stop |

### Variants

Offer single or multiple file selection and restrict accepted types when the task requires it. The chooser can use a custom trigger. A drop area supports additional pointer workflows.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Default | Open the chooser | See Tokens | The label and hint identify the control | Yes | Yes | Pending: default scenario |
| Changed | Choose a file | See Tokens | The owner receives the selected file once | Yes | Yes | Pending: changed scenario |
| Disabled | Disable file selection | See Tokens | The chooser cannot activate | No | No | Pending: disabled scenario |

### Keyboard, pointer and touch

Activating the file input or trigger opens the system chooser. Use the same picker path for keyboard and touch. Disabled file input does not accept choices.

### Accessibility

Give the control a visible label and identify allowed file types in its description. Expose progress and failure outside the input with localized status text. OS picker appearance follows the platform.

### State patterns

The owning form reports validation, busy status and recovery. Preserve the field value while displaying a correctable error.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

| Part or state | Token |
| --- | --- |
| Scope foreground | `light.text`, `dark.text` |
| Scoped focus-visible outline | `density.focusWidth`, `light.focus`, `dark.focus` |

### Composition and content guidelines

Do use “Attach résumé” and “PDF required”. Avoid “Upload stuff”. Keep file names intact for the reader.

## Part B — Bindings

### API

Read the selected FileList from the file input change event or from FileTrigger's selection callback. The browser owns the file selection. FileUpload omits value/defaultValue. Upload transport, retry and progress belong to the consumer.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `entry-fields:FileUpload` | `className` | `string \| undefined` | Unspecified | Caller input | — |
| `entry-fields:FileUpload` | `error` | `string \| undefined` | Unspecified | Caller input | — |
| `entry-fields:FileUpload` | `hint` | `string \| undefined` | Unspecified | Caller input | — |
| `entry-fields:FileUpload` | `label` | `string` | Required | Caller input | — |
| `entry-fields:FileUpload` | `ref` | `import("react").Ref<HTMLInputElement> \| undefined` | Unspecified | Caller reference | `HTMLInputElement` |
| `entry-fields:FileUpload` | `style` | `import("react").CSSProperties \| undefined` | Unspecified | Caller input | — |
| `entry-fields:FileUpload` | Host attributes | 303 standard platform attributes, not listed | Unspecified | Caller input | — |
| `forms:DropZone` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:DropZone` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:DropZone` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:DropZone` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:DropZone` | `children` | `import("react-aria-components").ChildrenOrFunction<DropZoneRenderProps>` | Unspecified | Caller content | — |
| `forms:DropZone` | `className` | `ClassNameOrFunction<DropZoneRenderProps> \| undefined` | `'react-aria-DropZone'` | Caller input | — |
| `forms:DropZone` | `getDropOperation` | `((types: import("react-aria-components").DragTypes, allowedOperations: import("react-aria-components").DropOperation[]) => import("react-aria-components").DropOperation) \| undefined` | Unspecified | Caller input | — |
| `forms:DropZone` | `isDisabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:DropZone` | `onDrop` | `((e: import("@react-types/shared").DropEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:DropZone` | `onDropActivate` | `((e: import("@react-types/shared").DropActivateEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:DropZone` | `onDropEnter` | `((e: import("@react-types/shared").DropEnterEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:DropZone` | `onDropExit` | `((e: import("@react-types/shared").DropExitEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:DropZone` | `onDropMove` | `((e: import("@react-types/shared").DropMoveEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:DropZone` | `onHoverChange` | `((isHovering: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:DropZone` | `onHoverEnd` | `((e: import("react-aria-components").HoverEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:DropZone` | `onHoverStart` | `((e: import("react-aria-components").HoverEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:DropZone` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `forms:DropZone` | `render` | `import("react-aria-components").DOMRenderFunction<"div", DropZoneRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:DropZone` | `slot` | `string \| null \| undefined` | Unspecified | Caller input | — |
| `forms:DropZone` | `style` | `import("react-aria-components").StyleOrFunction<DropZoneRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:DropZone` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |
| `forms:FileTrigger` | `acceptDirectory` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:FileTrigger` | `acceptedFileTypes` | `readonly string[] \| undefined` | Unspecified | Caller input | — |
| `forms:FileTrigger` | `allowsMultiple` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:FileTrigger` | `children` | `React.ReactNode` | Unspecified | Caller content | — |
| `forms:FileTrigger` | `defaultCamera` | `"user" \| "environment" \| undefined` | Unspecified | Uncontrolled initial value | — |
| `forms:FileTrigger` | `onSelect` | `((files: FileList \| null) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:FileTrigger` | `ref` | `React.Ref<HTMLInputElement> \| undefined` | Unspecified | Caller reference | `HTMLInputElement` |
| `forms:FileTrigger` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`entry-fields` is a client entry. `forms` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

FileUpload renders a FormField and a browser file input. FileTrigger connects a pressable child to the file chooser. DropZone supplies optional drop and paste input.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Contract | Web | Native | Tracking |
| --- | --- | --- | --- |
| File upload | FileUpload, DropZone, FileTrigger | No family binding in the native package | Native implementation and platform-specific verification are open in the [family audit](../component-depth.md). |

**Variants.** FileUpload forwards single/multiple selection and accepted type filters. FileTrigger offers a custom press target; DropZone accepts user-provided drop handlers.

**Tokens.** The optional controls stylesheet applies text color inside the controls scope. Interactive descendants can use its keyboard focus treatment. Custom slot paint remains the consumer’s responsibility.

**Composition.** Place FileUpload in a form and process its FileList. A DropZone can surround explanatory content, with a separately labeled file trigger as an alternate path.

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Default | Render with accept and hint | Named file input references the hint | Yes | Yes | [Browser files and descriptions](../../tests/file-upload/entry-fields.test.tsx) |
| Changed | Choose work.txt | Owner receives one change and the File object | Yes | Yes | [File selection](../../tests/file-upload/entry-fields.test.tsx) |
| Disabled | Set disabled on FileUpload | Input has the disabled property | No | No | [Disabled browser input](../../tests/file-upload/entry-fields.test.tsx) |

#### Performance

`FileUpload` 424 B, `DropZone` 35,147 B, `FileTrigger` 6,506 B. Each number is a separate named-import gzip measurement with React and React DOM external. Optional controls CSS is measured separately at 1,457 B gzip. The library root entry does not import this family.

#### Tests

- **Default.** [Browser files and descriptions](../../tests/file-upload/entry-fields.test.tsx).
- **Changed.** [File selection](../../tests/file-upload/entry-fields.test.tsx).
- **Disabled.** [Disabled browser input](../../tests/file-upload/entry-fields.test.tsx).

The linked cases establish the behaviors above. Dedicated per-state visual comparisons and native simulator tests are open. [Catalog example](../../catalog/EntryFields.stories.tsx)

#### Changelog and deprecations

The 0.3.0-rc.1 candidate documents the current web bindings. No family-specific deprecation is declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of File upload.

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
