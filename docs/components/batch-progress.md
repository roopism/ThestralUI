---
{
  "family": "Batch progress",
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
      "name": "BatchProgress",
      "from": "@ui-lazy-dev/ui-web/workflows"
    }
  ],
  "reference": [
    "https://react-aria.adobe.com/ProgressBar",
    "https://mui.com/material-ui/react-progress/"
  ]
}
---

# Batch progress

## Part A — Contract

### Purpose and when not to use it

Track individually retryable items in a batch. Choose Progress for a single aggregate operation without item outcomes.

### Anatomy

A count summarizes finished operations. Each row exposes a name and outcome.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| summary | Required | N/A — required | Container gap | Provides supporting information | Text adds no stop |
| items | Required | N/A — required | Container gap | Children retain their semantics | Operable children keep their order |
| detail | Optional | collapse | Container gap | Provides supporting information | Text adds no stop |
| retry | Optional | collapse | Container gap | Action has its own name | Takes its place when available |
| retry all failed | Optional | collapse | Container gap | Action has its own caller-supplied name | After the summary, before the rows |

### Variants

Queued, running, complete, failed and denied have distinct labels. A running operation also shows a decorative activity ring next to its label; the label alone carries the meaning. The heading level follows the surrounding outline.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Running | Start an operation | Progress meter and state text | It is excluded from the terminal count | No retry while running | Meter is informational | Pending: running scenario |
| Completed | Complete an operation | Meter increases with terminal count | The readable summary advances | No retry | Meter is informational | Pending: completed scenario |
| Denied | Deny an operation | Permission-denied text | It counts as finished without an offered retry | No retry | Meter is informational | Pending: denied scenario |
| Failed | Fail a retryable operation; with two or more failures, also offer one action for all of them | Failure label in row | Each retry action identifies its item; the bulk action names the failure count | Yes | Retry buttons | Pending: failed scenario |
| Resumed | Restore the batch | Total recomputed | The summary reflects the restored outcomes | Failed actions disappear on recovery | Remaining actions | Pending: resumed scenario |

### Keyboard, pointer and touch

Tab to the optional retry-all action, then to each available row retry, and activate with Enter/Space or tap. Focus order follows reading order. The progress meter and state labels are read-only and require no dedicated keyboard commands.

### Accessibility

A finished count includes failure and denial; label it “finished”, not “succeeded.” The heading names the region, the list and the meter, so all three share one localized name. The meter is not live; the single separate status summarizes progress, and a running row's activity ring is hidden from assistive technology so it adds no announcement. Keep retry labels unique across rows. Updates do not animate layout. System color changes leave textual outcomes available. Use localized counts and preserve reading order in RTL.

### State patterns

Loading or denied access replaces the rows with a status. A failed operation can be retried independently. Terminal counts include failures and denied operations. An empty list has its own message.

### Localization

Default messages are mapped to `batch.queued`, `batch.running`, `batch.complete`, `batch.failed`, `batch.denied`, `batch.empty`, `batch.summary`, `batch.retry`. Preserve caller-supplied translations. [Message inventory](../library-strings.md)

### Tokens

State text and separators inherit surrounding colors; there is no batch-state token contract.

### Composition and content guidelines

Surface retrieval failure via availability separately from a failed job. Use “3 of 8 finished” and “Retry report export”; avoid “3 succeeded” when terminal outcomes include failure.

## Part B — Bindings

### API

The caller owns every job state. The progress value counts complete, failed and denied items; retry requests an ID and does not revise the item itself. No host attributes or root ref are forwarded.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `workflows:BatchProgress` | `availability` | `WorkflowAvailability \| undefined` | Unspecified | Caller input | — |
| `workflows:BatchProgress` | `headingLevel` | `2 \| 3 \| 4 \| undefined` | Unspecified | Caller input | — |
| `workflows:BatchProgress` | `items` | `readonly BatchItem[]` | Required | Caller input | — |
| `workflows:BatchProgress` | `label` | `string` | Required | Caller input | — |
| `workflows:BatchProgress` | `labels` | `{ empty?: string; summary?: (terminal: number, total: number) => string; states?: Partial<Record<BatchState, string>>; retry?: (name: string) => string; } \| undefined` | Unspecified | Caller input | — |
| `workflows:BatchProgress` | `onRetry` | `((id: string) => void) \| undefined` | Unspecified | Caller callback | — |
| `workflows:BatchProgress` | `retryFailed` | `{ label: (count: number) => string; onRetry: (ids: string[]) => void; } \| undefined` | Unspecified | Caller input | — |

### React web

#### Rendering

`workflows` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

A section labelled by its heading (`headingLevel` 2, 3 or 4, default 2) contains a native progress element and a list both labelled by the same heading, a live summary, an optional retry-all Button and rows with label, state, optional detail and failed-item retry. Each row carries `data-state` for styling, and a running row shows a decorative Spinner. `retryFailed` takes `{ label(count), onRetry(ids) }`; the caller owns the localized label, so no new library string is introduced. Availability content or the empty message can replace the batch.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Platform | Public contract |
| --- | --- |
| Web | `BatchProgress` from `@ui-lazy-dev/ui-web/workflows`. |
| Native | Planned. No exported renderer or simulator journey. Track parity in the [family inventory](../component-inventory.md). |

**Variants.** Queued, running, complete, failed and denied have distinct labels. Only failed items with an onRetry handler expose retry. The retry-all action appears only while two or more items have failed and `retryFailed` is supplied, and it passes the failed IDs in display order. Translate both state names and the summary callback.

**Accessibility.** A finished count includes failure and denial; label it “finished”, not “succeeded.” The meter has a name and the separate status summarizes progress. Keep retry labels unique across rows. The browser draws the progressbar, and retry buttons use the workflow minimum height. Updates do not animate layout. System color changes leave textual outcomes available. Use localized counts and preserve reading order in RTL.

**Tokens.** N/A — The meter follows browser progress styling. State text and separators inherit surrounding colors; there is no batch-state token contract.

**Composition.** Store job IDs outside the component and rehydrate the batch after reload. Surface retrieval failure via availability separately from a failed job. [Catalog fixture](../../catalog/EnterpriseWorkspace.stories.tsx).

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Running | Provide a currently running item | Item is excluded from terminal count | No retry while running | Meter is informational | [workflow-status.test.tsx L5](../../tests/batch-progress/workflow-status.test.tsx#L9) |
| Completed | Mark an item complete | Label and localized progress summary expose completion | No retry | Meter is informational | [workflow-status.test.tsx L5](../../tests/batch-progress/workflow-status.test.tsx#L9) |
| Denied | Set item.state to denied | Item counts as terminal without a Retry action | No retry | Meter is informational | [workflow-status.test.tsx L5](../../tests/batch-progress/workflow-status.test.tsx#L9) |
| Failed | Pass a failed item with onRetry | Named retry action | Yes | Retry button | [workflow-status.test.tsx L5](../../tests/batch-progress/workflow-status.test.tsx#L9) |
| Failed | Pass two failed items with retryFailed | One caller-named action retries both IDs and disappears below two failures | Yes | Retry-all button | [Retry every failed operation](../../tests/batch-progress/workflow-status.test.tsx) |
| Running | Render a running item at heading level 3 | Heading, region, list and meter share one name; decorative ring; one status | No retry while running | Meter is informational | [Heading-named batch](../../tests/batch-progress/workflow-status.test.tsx) |
| Resumed | Caller updates job after retry | Progress and status reflect supplied data | Failed actions disappear on recovery | Remaining actions | [enterprise-workspace.spec.ts L80](../../tests/browser/enterprise-workspace.spec.ts#L80) |

#### Performance

The production named-import measurement is 976 B gzip for `BatchProgress` (previously 648 B; the shared Button and Spinner for retry-all and running rows add 328 B). The whole `/workflows` entry measures 40,156 B against its 43,702 B ceiling. The optional `/workflows` entry stays outside the default web entry. Measurements exclude React and React DOM and count JavaScript separately from CSS. [Bundle methodology](../../scripts/verify-bundles.mjs)

#### Tests

- Running. [workflow-status.test.tsx L5](../../tests/batch-progress/workflow-status.test.tsx#L9)
- Completed. [workflow-status.test.tsx L5](../../tests/batch-progress/workflow-status.test.tsx#L9)
- Denied. [workflow-status.test.tsx L5](../../tests/batch-progress/workflow-status.test.tsx#L9)
- Failed. [workflow-status.test.tsx L5](../../tests/batch-progress/workflow-status.test.tsx#L9) and [retry every failed operation](../../tests/batch-progress/workflow-status.test.tsx).
- Naming and outline. [Heading-named batch](../../tests/batch-progress/workflow-status.test.tsx).
- Resumed. [enterprise-workspace.spec.ts L80](../../tests/browser/enterprise-workspace.spec.ts#L80)
- Browser coverage. [enterprise-workspace.spec.ts](../../tests/browser/enterprise-workspace.spec.ts)
- A dedicated visual baseline for this family remains open.
- Simulator coverage awaits a native export.

#### Changelog and deprecations

The `0.3.0-rc.1` draft documents the public contract introduced in `02fe2ba`. No deprecations are declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Batch progress.

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
