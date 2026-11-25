---
{
  "family": "Notice",
  "status": "stable",
  "since": "0.3.0-rc.1",
  "owner": "UI platform",
  "platforms": {
    "web": "supported",
    "native": "planned"
  },
  "exports": [
    {
      "platform": "web",
      "name": "Notice",
      "from": "@ui-lazy-dev/ui-web",
      "rendering": "server-safe"
    }
  ],
  "reference": [
    "https://www.w3.org/WAI/ARIA/apg/"
  ]
}
---
# Notice

## Part A — Contract

### Purpose and when not to use it

Shows a short story. Use a full document for reading materials.

### Anatomy

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| Content | Optional | collapse | Container gap | Retains its name | Supplied order |

### Variants

One presentation.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Visible | Open | Surface | Readable content | No | No | [notice.read](notice.scenarios.yaml) |

### Keyboard, pointer and touch

The reader chooses the next item.

### Accessibility

Content remains in reading order.

### State patterns

The caller supplies an empty message.

### Localization

The caller supplies the localized content.

### Tokens

No independent visual tokens.

### Composition and content guidelines

Keep the notice concise.

## Part B — Bindings

### API

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `.:Notice` | `title` | `string` | Unspecified | Caller input | — |

### React web

#### Rendering

The server returns a paragraph.

#### Headless API

None. Content uses its native reading order.

#### Test helpers

Find the notice by its text.

#### Platform differences

Web renders a paragraph.

#### Performance

No client runtime.

#### Tests

[Unit](../../tests/notice/notice.test.tsx), [browser](../../tests/notice/reading.spec.ts), [visual](../../tests/notice/notice.visual.ts).

#### Changelog and deprecations

Initial release.

### React Native

#### Rendering

N/A — the native binding is planned.

#### Headless API

N/A — the native binding is planned.

#### Test helpers

N/A — the native binding is planned.

#### Platform differences

N/A — the native binding is planned.

#### Performance

N/A — the native binding is planned.

#### Tests

N/A — the native binding is planned.

#### Changelog and deprecations

N/A — the native binding is planned.
