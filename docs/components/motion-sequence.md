---
{
  "family": "Motion sequence",
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
      "name": "playMotionSequence",
      "from": "@ui-lazy-dev/ui-web/motion"
    }
  ],
  "reference": [
    "https://mui.com/material-ui/transitions/",
    "https://react-aria.adobe.com/Disclosure"
  ]
}
---

# Motion sequence

## Part A — Contract

### Purpose and when not to use it

Coordinate visual feedback across related targets after a change. Use a single state transition for an isolated hover or focus indicator.

### Anatomy

A sequence animates one or more visual targets. The calling surface retains meaning and focus.

| Slot | Requirement | Omission | Spacing owner | Accessible name | Focus order |
| --- | --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | No content slot | No slot focus stop |

### Variants

- **Entrances.** `enter` rises into place while fading in; `fade-in` changes opacity only and suits content that must not move; `slide-in` arrives from the inline start and mirrors in right-to-left reading; `pop` grows from slightly smaller with a small overshoot, for newly added items and confirmations; `spring` settles with a damped overshoot.
- **Exits.** `exit` sinks slightly while fading out, `fade-out` changes opacity only and `slide-out` leaves towards the inline end. Exits use the shorter exit duration.
- **Feedback.** `emphasis` pulses once to draw attention to a changed value; `shake` moves sideways around its resting position to signal a rejected action and always ends where it started.
- **Stagger and order.** `stagger` offsets successive starts and defaults to zero. Order `forward` starts with the first step, `reverse` with the last (natural for exits) and `center` ripples outward from the middle. A per-step delay adds to the stagger position.

### States matrix

| State | Trigger | Visual tokens | Semantics | Activatable | Focusable | Scenario |
| --- | --- | --- | --- | --- | --- | --- |
| Running | Start a sequence | Preset transforms or animates opacity | Meaning and focus stay with the targets | Through eligible controls | The owning surface retains focus | Pending: running scenario |
| Reversed | Reverse a running sequence | Animation reverses in place; a reversal that reaches the start reports reversed | Meaning and focus stay with the targets | Through eligible controls | The owning surface retains focus | Pending: reversed scenario |
| Superseded | Replace a sequence | Prior animation cancels | The previous sequence is cancelled | Through eligible controls | The owning surface retains focus | Pending: superseded scenario |
| Finished | Allow the sequence to finish | Final semantic layout remains | The final visual state is reached | Through eligible controls | The owning surface retains focus | Pending: finished scenario |
| Reduced motion | Enable reduced motion | Active animations cancel and new runs skip | Content state is available without interpolation | Through eligible controls | Existing focus unchanged | Pending: reduced motion scenario |
| Disposed | Dispose of the sequence | See Tokens | The owning content remains accessible | Through eligible controls | Existing focus unchanged | Pending: disposed scenario |

### Keyboard, pointer and touch

The function binds no keyboard or pointer listeners. Start it in the action that already owns activation. Expose meaningful operation controls even when the sequence skips. Interruption is always safe: starting a new sequence on an element supersedes its running motion from the current position, and reverse can be called at any point to return towards the start.

### Accessibility

Apply semantic content and focus independently of completion. Every preset animates only opacity and transform, so layout, reading order and hit targets never move. `fade-in` and `fade-out` contain no movement and are the preferred choice near text people are reading. Shake and emphasis repeat for at most twice the entrance duration and never loop. Reduced-motion changes cancel live runs. A skipped animation must expose the same final state to assistive technology. Announcements, colors, RTL layout and focus rings belong to the target components. There is no standalone hit target, foreground or background. In forced colors, keep the end state intelligible without animated opacity or scaling.

### State patterns

This family owns no request lifecycle. Its containing surface supplies any loading, empty, error, offline, permission or partial-failure state.

### Localization

The caller supplies localized names and content. Keep reading order logical in both directions.

### Tokens

| Part or state | Token |
| --- | --- |
| Enter, emphasis and spring timing | `motion.enterDuration` |
| Exit timing | `motion.exitDuration` |
| Shake and spring timing (twice the entrance) | `motion.enterDuration` |
| Emphasis, pop and spring overshoot | `motion.pressScale` |
| Rise distance | `space.spaceSm` |
| Exit and shake distance | `space.spaceXs` |
| Slide distance | `space.spaceLg` |
| Reduced-motion durations | `motion.enterDuration` [0ms in the reduced mode] |

### Composition and content guidelines

Do stagger the cards of a newly loaded result set with `enter` and a short stagger, `pop` a newly added item into a list, `shake` a field group whose submission was rejected while the error text explains why, and `slide-out` with order `reverse` when dismissing a stack. Avoid sequencing more than about a dozen targets, chaining a sequence on every scroll event, or waiting for a sequence before updating text, focus or announcements.

## Part B — Bindings

### API

Pass the ordered steps, each with an element, a preset and an optional delay, and optionally an AbortSignal, a stagger in milliseconds and an order (`forward`, `reverse` or `center`). The caller owns the semantic end state and the lifetime of target elements. The handle resolves exactly once with finished, reversed, cancelled or skipped; reverse toggles the playing direction and cancel stops every step.

| Export | Prop | Type | Default | Ownership | Ref target |
| --- | --- | --- | --- | --- | --- |
| `motion:playMotionSequence` | `options` | `(MotionOptions & { order?: "forward" \| "reverse" \| "center"; }) \| undefined` | Unspecified | Caller input | — |
| `motion:playMotionSequence` | `steps` | `readonly MotionStep[]` | Required | Caller input | — |

### React web

#### Rendering

`motion` is a client entry. Pending: verify this binding’s server-component boundary and hydration behavior in a consuming application.

Each track contains an element and a preset. A sequence returns a handle with reverse, cancel and a completion promise. Browser animations and preference listeners belong to that handle.

#### Headless API

None. The current public exports do not include a separate behavior hook.

#### Test helpers

None. Consumers currently query the accessible roles and names described in the contract.

#### Platform differences

| Platform | Public contract |
| --- | --- |
| Web | `playMotionSequence` from `@ui-lazy-dev/ui-web/motion`. |
| Native | Planned. No exported renderer or simulator journey. Track parity in the [family inventory](../component-inventory.md). |

**Composition.** Pass target elements from refs after mounting. Use the handle or an explicit AbortSignal on teardown. Keep the number of tracks small because each step creates a Web Animation. [Catalog fixture](../../catalog/MotionSequences.stories.tsx).

**Content guidelines.** This utility renders no copy. If an action moves a task to “Completed”, announce the new task status through the host even when the animation is skipped.

The existing regressions exercise the following bindings. The linked test identifies the exercised platform for each case.

| State | Observed trigger | Current binding behavior | Activation | Focus | Existing regression |
| --- | --- | --- | --- | --- | --- |
| Running | Start a sequence | Host roles and state stay in place | Host inputs | Host focus | [motion-choreography.test.tsx L23](../../tests/motion-sequence/motion-choreography.test.tsx#L23) |
| Reversed | Call reverse on an unsettled handle | Host roles and state stay in place | Host inputs | Host focus | [motion-choreography.test.tsx L23](../../tests/motion-sequence/motion-choreography.test.tsx#L23) |
| Superseded | Start a new run on the same element | Previous handle resolves cancelled | Host inputs | Host focus | [motion-choreography.test.tsx L48](../../tests/motion-sequence/motion-choreography.test.tsx#L48) |
| Finished | Allow all tracks to finish | Handle resolves finished | Host inputs | Host focus | [motion-choreography.test.tsx L48](../../tests/motion-sequence/motion-choreography.test.tsx#L48) |
| Reduced motion | Enable the preference during a run or start with it enabled | Semantic state belongs to the caller | Host controls only | Existing focus unchanged | [motion-choreography.test.tsx L23](../../tests/motion-sequence/motion-choreography.test.tsx#L23) |
| Disposed | Cancel or finish | No DOM mutation required | Host controls only | Existing focus unchanged | [motion-choreography.test.tsx L58](../../tests/motion-sequence/motion-choreography.test.tsx#L58) |

#### Performance

The production named-import measurement is 1,701 B gzip for `playMotionSequence`. The optional `/motion` entry stays outside the default web entry. Measurements exclude React and React DOM and count JavaScript separately from CSS. [Bundle methodology](../../scripts/verify-bundles.mjs)

#### Tests

- Running. [motion-choreography.test.tsx L23](../../tests/motion-sequence/motion-choreography.test.tsx#L23)
- Reversed. [motion-choreography.test.tsx L23](../../tests/motion-sequence/motion-choreography.test.tsx#L23)
- Superseded. [motion-choreography.test.tsx L48](../../tests/motion-sequence/motion-choreography.test.tsx#L48)
- Finished. [motion-choreography.test.tsx L48](../../tests/motion-sequence/motion-choreography.test.tsx#L48)
- Reduced motion. [motion-choreography.test.tsx L23](../../tests/motion-sequence/motion-choreography.test.tsx#L23)
- Disposed. [motion-choreography.test.tsx L58](../../tests/motion-sequence/motion-choreography.test.tsx#L58)
- Reversed to the start. [motion-choreography.test.tsx L81](../../tests/motion-sequence/motion-choreography.test.tsx#L81)
- Center order and right-to-left slides. [motion-choreography.test.tsx L99](../../tests/motion-sequence/motion-choreography.test.tsx#L99)
- Reverse order, per-step delay and shake rest position. [motion-choreography.test.tsx L117](../../tests/motion-sequence/motion-choreography.test.tsx#L117)
- Browser coverage. [motion.spec.ts L152](../../tests/browser/motion.spec.ts#L127)
- A dedicated visual baseline for this family remains open.
- Simulator coverage awaits a native export.

#### Changelog and deprecations

The `0.3.0-rc.1` draft documents the public contract introduced in `c1626ab`. No deprecations are declared.

### React Native

#### Rendering

Native status is `planned`. This release exposes no native implementation of Motion sequence.

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
