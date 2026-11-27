---
{
  "family": "Labeled field",
  "status": "draft",
  "since": "0.1.0",
  "owner": "@roopism",
  "platforms": {
    "web": "supported",
    "native": "experimental"
  },
  "exports": [
    {
      "platform": "web",
      "name": "FormField",
      "from": "@ui-lazy-dev/ui-web",
      "rendering": "server-safe"
    },
    {
      "platform": "native",
      "name": "FormField",
      "from": "@ui-lazy-dev/ui-native"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/TextField",
    "https://mui.com/material-ui/react-text-field/"
  ]
}
---

# Labeled field

## Part A — Contract

### Purpose and when not to use it

Connect a visible label, hint and validation error to one form control. Choose Text field for an editor with its own validation behavior.

### Anatomy

A visible label names one editor. Optional hint and error text describe it.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| label | Required | N/A — required | Container gap | Provides the accessible name | Text adds no stop |
| editor | Required | N/A — required | Container gap | Control has its own name | Participates in its logical position |
| hint | Optional | collapse | Container gap | Provides supporting information | Text adds no stop |
| error | Optional | collapse | Container gap | Provides supporting information | Text adds no stop |

### Variants

A labeled control can have a hint, an error or both.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Default | Present the field | Surface, text and border | The visible label names the editor | Control-specific | Yes when enabled | Pending: default scenario |
| Invalid | Provide a validation error | Danger border and message | The editor exposes the error | Input still editable when enabled | Yes when enabled | Pending: invalid scenario |
| Corrected | Correct the field | Normal field border | The error is removed | Control-specific | Yes when enabled | Pending: corrected scenario |

### Keyboard, pointer and touch

Keyboard and touch input belong to the editor. Its label identifies the same control in each input mode. The surrounding form owns submission.

### Accessibility

Use a visible localized label. Error text should identify the problem without depending on border color. Label and control inherit reading direction, and the field introduces no transition.

### State patterns

The owning form supplies errors and can clear them after correction. Field hints stay conceptually separate from validation.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

| Part or state | Token |
| --- | --- |
| Label and input text | `light.text`, `dark.text` |
| Control surface and border | `light.surface`, `dark.surface`, `light.border`, `dark.border` |
| Error and hint | `light.danger`, `dark.danger`, `light.muted`, `dark.muted` |
| Control geometry | `size.control`, `size.gap`, `size.radius` |
| Keyboard focus | `light.focus`, `dark.focus` |

### Composition and content guidelines

In a dialog, keep the visible label near the input and leave the error available for correction. Do use “Workspace name” and “Enter at least three characters”. Avoid “Invalid value” without a remedy. Preserve translation and text scaling for every hint and error.

## Part B — Bindings

### API

On web the child owns value, event handlers, form attributes and ref; FormField supplies or reuses its ID and composes description IDs. The wrapper accepts className but exposes no ref. On native, TextInput receives forwarded host props and the ref; `onChangeText` delivers the new string, and `value` or `defaultValue` determines ownership. A caller hint is combined with field hint and error.

The native component accepts a resolved `theme` for its scope. When omitted, its colors follow the device color scheme.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `.:FormField` | `children` | `ReactElement<HTMLAttributes<HTMLInputElement \| HTMLTextAreaElement \| HTMLSelectElement>, "input" \| "textarea" \| "select">` | Required | Caller content | — |
| `.:FormField` | `className` | `string \| undefined` | Unspecified | Caller input | — |
| `.:FormField` | `error` | `string \| undefined` | Unspecified | Caller input | — |
| `.:FormField` | `hint` | `string \| undefined` | Unspecified | Caller input | — |
| `.:FormField` | `label` | `string` | Required | Caller input | — |
| `native:FormField` | `children` | `import("react").ReactNode` | Unspecified | Caller content | — |
| `native:FormField` | `error` | `string \| undefined` | Unspecified | Caller input | — |
| `native:FormField` | `hint` | `string \| undefined` | Unspecified | Caller input | — |
| `native:FormField` | `label` | `string` | Required | Caller input | — |
| `native:FormField` | `ref` | `Ref<import("react-native/types_generated/Libraries/Components/TextInput/TextInput.flow.js")._TextInputInstance> \| undefined` | Unspecified | Caller reference | `import("react-native/types_generated/Libraries/Components/TextInput/TextInput.flow.js")._TextInputInstance` |
| `native:FormField` | `style` | `import("react-native/types_generated/Libraries/StyleSheet/StyleSheetTypes.js").____TextStyleProp_Internal \| undefined` | Unspecified | Caller input | — |
| `native:FormField` | `theme` | `ResolvedTokens \| undefined` | Unspecified | Caller input | — |
| `native:FormField` | Host attributes | 180 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`index` is published without a client directive. The packed consumer verifies the field text in the initial HTML, its description after hydration and the edited value after dialog dismissal. A separate test isolates identifiers across concurrent server renders. Pending: verify the server-component import boundary. [Hydration checks](../../scripts/verify-hydration.mjs) · [Request isolation](../../tests/runtime-isolation.test.tsx)

Web has a root div, label wrapping one caller-supplied input, select or textarea, an optional hint, and an optional alert. Native renders the label, TextInput, hint and error in a View. The title and assistant text belong to the field.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Contract | Web | Native | Tracking |
| --- | --- | --- | --- |
| Control | Caller-provided input, textarea or select | Built-in TextInput | [Family audit](../component-depth.md) tracks behavior across input modes. |
| Ref and state | Child owns the DOM ref and control value | Component forwards the native TextInput ref and both state modes | Native renderer remains experimental. |

**Variants.** A labeled control can have a hint, an error or both. Web can wrap three host control kinds. Native supplies its own text input, including supported host text-input modes.

**Keyboard and pointer.** Tab reaches the web child, and entering text follows its native editing protocol. The caller owns submission. On iOS and Android TextInput handles IME focus and return events; use its declared host props for the desired return action.

**Accessibility.** Use a visible localized label. Web preserves an existing described-by list and appends hint and error nodes. The native error is marked as an alert with a polite live region. Browser focus indicators and native text scaling support editing. Error text should identify the problem without depending on border color. The web control uses the control-height token. Forced colors use the browser’s adjustment of borders and focus outlines. Label and control inherit reading direction, and the field introduces no transition.

**Composition.** Put one real host control inside the web wrapper, and pass native input props directly on RN. In a dialog, keep the visible label near the input and leave the error available for correction.

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Default | Mount with a visible label | Input named by its label | Control-specific | Yes when enabled | [Independent field names](../../tests/labeled-field/controls.test.tsx) |
| Invalid | Supply error text | aria-invalid and alert linked in description | Input still editable when enabled | Yes when enabled | [Native validation and input](../../tests/labeled-field/native.test.cjs) |
| Corrected | Clear the validation error after editing | Error alert disappears | Control-specific | Yes when enabled | [Validation recovers after typing](../../tests/browser/catalog.spec.ts) |

#### Performance

`FormField` 360 B. Measured gzip sizes for separate tree-shaken production web imports, with React and React DOM external. Web FormField is available from the root entry. It uses a generated ID and clones a single child. Native uses TextInput and the theme tokens; the web import does not include the native renderer. The full web `styles.css` entry, including theme tokens, measures 1,224 B gzip.

#### Tests

- **Default.** [Independent field names](../../tests/labeled-field/controls.test.tsx).
- **Invalid.** [Native validation and input](../../tests/labeled-field/native.test.cjs).
- **Corrected.** [Validation recovers after typing](../../tests/browser/catalog.spec.ts).
- [Web error, hint and existing description composition](../../tests/labeled-field/controls.test.tsx).
- [Simulator editing, validation and retry](../../tests/simulator/workspace.yaml).

The [catalog browser case](../../tests/browser/catalog.spec.ts) runs light and dark accessibility checks. The [appearance simulator journey](../../tests/simulator/appearance.yaml) covers larger native text. Dedicated family visual baselines and physical device speech checks remain open.

#### Changelog and deprecations

Web FormField was present in the 0.1.0 library. The 0.3.0-rc.1 candidate also exposes the experimental native field. No prop deprecation is declared.

### React Native

#### Rendering

A named text editor exposes an optional hint and validation error. Input properties and its ref are forwarded. The binding renders in the application’s native view hierarchy.

#### Headless API

None. The native public entry currently exposes the styled component.

#### Test helpers

None. Renderer fixtures query the accessible control directly.

#### Platform differences

The cross-platform differences table above captures the current binding. Pending: verify iOS and Android conventions for Labeled field separately.

| State | Native binding behavior |
| --- | --- |
| Default | TextInput has a label and label association |
| Invalid | Alert text also contributes to accessibilityHint |
| Corrected | Owner clears the error prop |

#### Performance

Pending: measure the isolated native import cost.

#### Tests

[Renderer tests](../../tests/labeled-field/native.test.cjs). Pending: verify every neutral scenario in the iPhone Simulator. Android device evidence is pending.

#### Changelog and deprecations

The current candidate includes this native export. See the family changelog above for changes to shared behavior.
