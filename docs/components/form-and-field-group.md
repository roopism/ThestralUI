---
{
  "family": "Form and field group",
  "status": "draft",
  "since": "0.3.0-rc.1",
  "owner": "@thetechgeeek",
  "platforms": {
    "web": "exported",
    "native": "planned"
  },
  "exports": [
    {
      "platform": "web",
      "name": "Form",
      "from": "@ui-lazy-dev/ui-web/forms"
    },
    {
      "platform": "web",
      "name": "Group",
      "from": "@ui-lazy-dev/ui-web/forms"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/Form",
    "https://mui.com/material-ui/react-text-field/"
  ]
}
---

# Form and field group

## Part A — Contract

### Purpose and when not to use it

Collect named fields for submission or label related editors. Choose Labeled field for one editor and its feedback.

### Anatomy

Named fields share submission and validation. Groups associate related controls with a shared meaning.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| fields | Required | N/A — required | Container gap | Children retain their semantics | Operable children keep their order |
| actions | Optional | collapse | Container gap | Children retain their semantics | Operable children keep their order |

### Variants

Supply server validation errors or rely on the form's validation behavior. Group alone performs no submission.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Ready to submit | Open a group of fields | Scoped text and form spacing | The group is named within the form | Through submit button | Through child controls | Pending: ready to submit scenario |
| Submitted | Submit the form | No submit animation supplied | Only eligible field values are included | Yes, via button | Child action | Pending: submitted scenario |
| Child validation error | Return a field error | Visible error text | The affected field identifies the problem | Through children | Through children | Pending: child validation error scenario |

### Keyboard, pointer and touch

Tab follows child order. Enter in a single-line input uses the form's normal submission behavior. A Group adds no shortcut or focus trap.

### Accessibility

Give each field a name. Name a group when its shared meaning needs explanation. Errors belong to the affected field. Use the field’s localized labels in RTL layouts. Review touch-target geometry, contrast, forced colors and reduced-motion behavior in the consumer theme before promoting this draft.

### State patterns

The owning form reports validation, busy status and recovery. Preserve the field value while displaying a correctable error.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

| Part or state | Token |
| --- | --- |
| Input foreground / light | `light.text` |
| Input surface / light | `light.surface` |
| Input surface / dark | `dark.surface` |
| Field border / light | `light.muted` |
| Field border / dark | `dark.muted` |
| Keyboard outline | `density.focusWidth` |

### Composition and content guidelines

Give each participating editor its own form name, use Group around related controls, and label a meaningful group. Use “Delivery address”. Avoid “More fields”. Localize the whole label and keep it available when constrained text wraps.

## Part B — Bindings

### API

`Form.onSubmit(event)` receives the submit event for the HTML form. Its `currentTarget` can be passed to FormData. The caller chooses whether to call preventDefault and perform a mutation. `validationErrors` maps form field names to messages. Group provides the grouped container and its DOM ref. It does not provide an additional submit model.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `forms:Form` | `action` | `string \| ((formData: FormData) => void \| Promise<void>) \| undefined` | Unspecified | Caller input | — |
| `forms:Form` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Form` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Form` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Form` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Form` | `autoCapitalize` | `"none" \| "off" \| "on" \| "sentences" \| "words" \| "characters" \| undefined` | Unspecified | Caller input | — |
| `forms:Form` | `autoComplete` | `"off" \| "on" \| undefined` | Unspecified | Caller input | — |
| `forms:Form` | `children` | `React.ReactNode` | Unspecified | Caller content | — |
| `forms:Form` | `className` | `string \| undefined` | `'react-aria-Form'` | Caller input | — |
| `forms:Form` | `encType` | `"application/x-www-form-urlencoded" \| "multipart/form-data" \| "text/plain" \| undefined` | Unspecified | Caller input | — |
| `forms:Form` | `id` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Form` | `method` | `"dialog" \| "get" \| "post" \| undefined` | Unspecified | Caller input | — |
| `forms:Form` | `onInvalid` | `((event: React.FormEvent<HTMLFormElement>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Form` | `onReset` | `((event: React.FormEvent<HTMLFormElement>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Form` | `onSubmit` | `((event: React.FormEvent<HTMLFormElement>) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Form` | `ref` | `React.Ref<HTMLFormElement> \| undefined` | Unspecified | Caller reference | `HTMLFormElement` |
| `forms:Form` | `render` | `import("react-aria-components").DOMRenderFunction<"form", undefined> \| undefined` | Unspecified | Caller input | — |
| `forms:Form` | `role` | `"search" \| "presentation" \| undefined` | Unspecified | Caller input | — |
| `forms:Form` | `style` | `React.CSSProperties \| undefined` | Unspecified | Caller input | — |
| `forms:Form` | `target` | `"_blank" \| "_self" \| "_parent" \| "_top" \| undefined` | Unspecified | Caller input | — |
| `forms:Form` | `validationBehavior` | `"native" \| "aria" \| undefined` | `'native'` | Caller input | — |
| `forms:Form` | `validationErrors` | `import("@react-types/shared").ValidationErrors \| undefined` | Unspecified | Caller input | — |
| `forms:Form` | Host attributes | 71 standard platform attributes, not listed | Unspecified | Caller input | — |
| `forms:Group` | `aria-describedby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Group` | `aria-details` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Group` | `aria-label` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Group` | `aria-labelledby` | `string \| undefined` | Unspecified | Caller input | — |
| `forms:Group` | `children` | `import("react-aria-components").ChildrenOrFunction<GroupRenderProps>` | Unspecified | Caller content | — |
| `forms:Group` | `className` | `ClassNameOrFunction<GroupRenderProps> \| undefined` | `'react-aria-Group'` | Caller input | — |
| `forms:Group` | `isDisabled` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:Group` | `isInvalid` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:Group` | `isReadOnly` | `boolean \| undefined` | Unspecified | Caller input | — |
| `forms:Group` | `onHoverChange` | `((isHovering: boolean) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Group` | `onHoverEnd` | `((e: import("react-aria-components").HoverEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Group` | `onHoverStart` | `((e: import("react-aria-components").HoverEvent) => void) \| undefined` | Unspecified | Caller callback | — |
| `forms:Group` | `ref` | `React.Ref<HTMLDivElement> \| undefined` | Unspecified | Caller reference | `HTMLDivElement` |
| `forms:Group` | `render` | `import("react-aria-components").DOMRenderFunction<"div", GroupRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:Group` | `role` | `"group" \| "presentation" \| "region" \| undefined` | `'group'` | Caller input | — |
| `forms:Group` | `slot` | `string \| null \| undefined` | Unspecified | Caller input | — |
| `forms:Group` | `style` | `import("react-aria-components").StyleOrFunction<GroupRenderProps> \| undefined` | Unspecified | Caller input | — |
| `forms:Group` | Host attributes | 270 standard platform attributes, not listed | Unspecified | Caller input | — |

### React web

#### Rendering

`forms` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

Form owns submission and validation. Group contains related controls. Give errors the same names that the nested input fields use.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Surface | Web | Native |
| --- | --- | --- |
| Availability | `Form`, `Group` | planned. Track a platform contract and simulator fixture in the [family inventory](../component-inventory.md). |

**Tokens.** These mappings apply inside the optional `uld-controls` scope. A headless import does not install the stylesheet.

**Composition.** Give each participating editor its own form name, use Group around related controls, and label a meaningful group. Place `Button type="submit"` inside the form. A disabled editor is omitted from FormData even when the owner supplied it an initial value.

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Ready to submit | Render a named Form and Group containing a submit action | Named form contains a named group | Through submit button | Through child controls | [Form and group ownership](../../tests/form-spec-states.test.tsx#L223) |
| Submitted | Activate the submit button with enabled and disabled named fields | FormData contains the enabled editor only | Yes, via button | Child action | [Submitted form contents](../../tests/form-spec-states.test.tsx#L223) |
| Child validation error | Supply a validationErrors entry for a nested named field | Input exposes aria-invalid and its error description | Through children | Through children | [Server validation association](../../tests/depth-controls.test.tsx#L15) |

#### Performance

Named JavaScript exports measured independently from the packed web consumer, gzip level 9, with React and React DOM external: `Form` 1,717 B, `Group` 5,470 B. These optional imports stay out of the web root. Their sizes overlap when used together. [Measurement method](../../scripts/verify-bundles.mjs) The optional scoped `controls.css` entry measures 1,485 B gzip including its theme tokens. Apply `.uld-controls` to a containing element to opt into its treatments.

#### Tests

- **Ready to submit.** [Form and group ownership](../../tests/form-spec-states.test.tsx#L223).
- **Submitted.** [Submitted form contents](../../tests/form-spec-states.test.tsx#L223).
- **Child validation error.** [Server validation association](../../tests/depth-controls.test.tsx#L15).
- Dedicated browser coverage for the full contract remains open.
- Dedicated visual qualification and native simulator coverage remain open.

Reset handling, submission after server errors and focus recovery when an asynchronous submit fails need a browser journey.

#### Changelog and deprecations

The `0.3.0-rc.1` draft records the current public contract. Consult the packed declarations for upstream deprecation notices when upgrading React Aria.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Form and field group.

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
