---
{
  "family": "CodeField",
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
      "name": "CodeField",
      "from": "@ui-lazy-dev/ui-web/entry-fields",
      "rendering": "server-safe"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/TextField",
    "https://mui.com/material-ui/react-text-field/"
  ]
}
---

# CodeField

## Part A — Contract

### Purpose and when not to use it

Enter a fixed-length numeric verification code as one editable value. Use a password field for a reusable secret and a number field for a quantity.

### Anatomy

One labeled editor accepts a fixed number of digits. A hint or error may explain entry requirements.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| label | Required | N/A — required | Container gap | Provides the accessible name | Text adds no stop |
| editor | Required | N/A — required | Container gap | Control has its own name | Participates in its logical position |
| hint | Optional | collapse | Container gap | Provides supporting information | Text adds no stop |
| error | Optional | collapse | Container gap | Provides supporting information | Text adds no stop |

### Variants

The field accepts normal, required, invalid and disabled input states. It has one focus stop regardless of length. A pattern mismatch marks form validity without silently changing input.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Default | Open the code field | See Tokens | One editor accepts the full code | Editable | Yes | Pending: default scenario |
| Valid | Enter the required digits | See Tokens | The complete code remains available with leading zeros | Yes | Yes | Pending: valid scenario |
| Invalid | Enter a value outside the allowed format | See Tokens | The code is invalid | Yes | Yes | Pending: invalid scenario |

### Keyboard, pointer and touch

Tap or focus the field to type or paste. Submission-time validation belongs to the form.

### Accessibility

Provide the expected length in localized instructions.

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

Do use “Enter the six-digit code”. Avoid converting it to a number or announcing the user's code.

## Part B — Bindings

### API

A positive integer `digits` is required. Input mode is numeric, autocomplete defaults to one-time-code, and value/defaultValue follow ordinary text input behavior. Leading zeros are significant.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `entry-fields:CodeField` | `className` | `string \| undefined` | Unspecified | Caller input | — |
| `entry-fields:CodeField` | `digits` | `number` | Required | Caller input | — |
| `entry-fields:CodeField` | `error` | `string \| undefined` | Unspecified | Caller input | — |
| `entry-fields:CodeField` | `hint` | `string \| undefined` | Unspecified | Caller input | — |
| `entry-fields:CodeField` | `label` | `string` | Required | Caller input | — |
| `entry-fields:CodeField` | `ref` | `import("react").Ref<HTMLInputElement> \| undefined` | Unspecified | Caller reference | `HTMLInputElement` |
| `entry-fields:CodeField` | `style` | `import("react").CSSProperties \| undefined` | Unspecified | Caller input | — |
| `entry-fields:CodeField` | Host attributes | 302 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`entry-fields` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

FormField associates the label and error with one text input. `digits` defines maximum length and the ASCII-digit validity pattern.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Contract | Web | Native | Tracking |
| --- | --- | --- | --- |
| CodeField | CodeField | No family binding in the native package | Native implementation and platform-specific verification are open in the [family audit](../component-depth.md). |

**Keyboard and pointer.** Tap or focus the field to type or paste. Browser selection, deletion and IME stay within one input. Submission-time validation belongs to the form.

**Accessibility.** Provide the expected length in localized instructions. Browser validity and explicit application error are distinct. Use the error prop to associate visible feedback with the input.

**Tokens.** The optional controls stylesheet applies text color inside the controls scope. Interactive descendants can use its keyboard focus treatment. Custom slot paint remains the consumer’s responsibility.

**Composition.** Set an id and name in a form. Link ValidationSummary to that id so the user can correct a failed recovery code.

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Default | Render digits=4 | One textbox with one-time-code and maxLength four | Editable | Yes | [Autofill and length](../../tests/codefield/entry-fields.test.tsx) |
| Valid | Enter 0017 | FormData retains the string and validity passes | Yes | Yes | [Leading zeros](../../tests/codefield/entry-fields.test.tsx) |
| Invalid | Enter 00x7 | Input exposes patternMismatch | Yes | Yes | [Non-digit validation](../../tests/codefield/entry-fields.test.tsx) |

#### Performance

`CodeField` 560 B. Each number is a separate named-import gzip measurement with React and React DOM external. Optional controls CSS is measured separately at 1,457 B gzip. The library root entry does not import this family.

#### Tests

- **Default.** [Autofill and length](../../tests/codefield/entry-fields.test.tsx).
- **Valid.** [Leading zeros](../../tests/codefield/entry-fields.test.tsx).
- **Invalid.** [Non-digit validation](../../tests/codefield/entry-fields.test.tsx).

The linked cases establish the behaviors above. Dedicated per-state visual comparisons and native simulator tests are open. [Catalog example](../../catalog/EntryFields.stories.tsx)

#### Changelog and deprecations

The 0.3.0-rc.1 candidate documents the current web bindings. No family-specific deprecation is declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of CodeField.

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
