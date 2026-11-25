---
{
  "family": "PasswordField",
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
      "name": "PasswordField",
      "from": "@ui-lazy-dev/ui-web/entry-fields"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/TextField",
    "https://mui.com/material-ui/react-text-field/"
  ]
}
---

# PasswordField

## Part A — Contract

### Purpose and when not to use it

Enter or edit a password with a local visibility toggle. Use a code field for a one-time numeric code.

### Anatomy

The editor and visibility toggle share one field label. The toggle’s name describes its next action.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| label | Required | N/A — required | Container gap | Provides the accessible name | Text adds no stop |
| editor | Required | N/A — required | Container gap | Control has its own name | Participates in its logical position |
| toggle | Required | N/A — required | Container gap | Action has its own name | Takes its place when available |
| hint | Optional | collapse | Container gap | Provides supporting information | Text adds no stop |
| error | Optional | collapse | Container gap | Provides supporting information | Text adds no stop |

### Variants

Masked text is the initial treatment. Revealed text uses the same input and value. Disabled applies to both the input and its reveal button.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Masked | Enter a secret | See Tokens | The value is masked | Text editing | Yes | Pending: masked scenario |
| Revealed | Reveal the value | See Tokens | The value remains and the toggle offers to hide it | Yes | Yes | Pending: revealed scenario |
| Masked again | Conceal the value | See Tokens | Masking returns without submitting the field | Yes | Yes | Pending: masked again scenario |

### Keyboard, pointer and touch

Tab visits input then toggle. Activate the toggle with pointer, Enter or Space. Continue editing the same value after hiding the password.

### Accessibility

Localize reveal and conceal labels as commands. Do not log or announce the actual password in status text.

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

Place the field inside a form and provide an appropriate autocomplete token. Do use “Show password” and “Hide password”. Avoid a static “Eye” label. Never use the password itself as helper text.

## Part B — Bindings

### API

Host input props flow to the input. The control owns visibility; the form owner owns the password when using `value`. Toggle state is independent of the password value. Buttons do not submit the form when clicked.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `entry-fields:PasswordField` | `className` | `string \| undefined` | Unspecified | Caller input | — |
| `entry-fields:PasswordField` | `concealLabel` | `string` | Required | Caller input | — |
| `entry-fields:PasswordField` | `error` | `string \| undefined` | Unspecified | Caller input | — |
| `entry-fields:PasswordField` | `hint` | `string \| undefined` | Unspecified | Caller input | — |
| `entry-fields:PasswordField` | `label` | `string` | Required | Caller input | — |
| `entry-fields:PasswordField` | `ref` | `import("react").Ref<HTMLInputElement> \| undefined` | Unspecified | Caller reference | `HTMLInputElement` |
| `entry-fields:PasswordField` | `revealLabel` | `string` | Required | Caller input | — |
| `entry-fields:PasswordField` | `style` | `import("react").CSSProperties \| undefined` | Unspecified | Caller input | — |
| `entry-fields:PasswordField` | Host attributes | 305 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`entry-fields` is a client entry. The streaming test hydrates two independently rendered forms in reverse order. It verifies field identifiers, descriptions and the local reveal action. Pending: verify the server-component import boundary. [Streaming hydration](../../tests/runtime-streams.test.tsx)

FormField owns label, hint, error and input association. The password input and secondary Button share an id through aria-controls. The caller provides both toggle labels.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Contract | Web | Native | Tracking |
| --- | --- | --- | --- |
| PasswordField | PasswordField | No family binding in the native package | Native implementation and platform-specific verification are open in the [family audit](../component-depth.md). |

**Accessibility.** Localize reveal and conceal labels as commands. The input retains its visible label while its HTML type changes. Do not log or announce the actual password in status text.

**Tokens.** The optional controls stylesheet applies text color inside the controls scope. Interactive descendants can use its keyboard focus treatment. Custom slot paint remains the consumer’s responsibility.

**Composition.** Place the field inside a form and provide an appropriate autocomplete token. ValidationSummary may link to the forwarded input id.

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Masked | Render with defaultValue | Labeled input has password type | Text editing | Yes | [Initial masked input](../../tests/passwordfield/entry-fields.test.tsx) |
| Revealed | Activate Show password | Same value, text type, Hide password action | Yes | Yes | [Reveal keeps value](../../tests/passwordfield/entry-fields.test.tsx) |
| Masked again | Activate Hide password | Password type restored without submitting | Yes | Yes | [Toggle avoids submission](../../tests/passwordfield/entry-fields.test.tsx) |

#### Performance

`PasswordField` 696 B. Each number is a separate named-import gzip measurement with React and React DOM external. Optional controls CSS is measured separately at 1,457 B gzip. The library root entry does not import this family.

#### Tests

- **Masked.** [Initial masked input](../../tests/passwordfield/entry-fields.test.tsx).
- **Revealed.** [Reveal keeps value](../../tests/passwordfield/entry-fields.test.tsx).
- **Masked again.** [Toggle avoids submission](../../tests/passwordfield/entry-fields.test.tsx).

The linked cases establish the behaviors above. Dedicated per-state visual comparisons and native simulator tests are open. [Catalog example](../../catalog/EntryFields.stories.tsx)

#### Changelog and deprecations

The 0.3.0-rc.1 candidate documents the current web bindings. No family-specific deprecation is declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of PasswordField.

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
