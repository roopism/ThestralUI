# Web interaction, motion and runtime evidence

The publication library runs the same save, preview, remove and recovery flow in two design directions. The editorial variant animates the same mounted media across sizes. A separate proof-review example moves a visual between parents, reverses a running sequence and cancels it. The host owns draft submission, cancellation and stale-result handling in the quality fixture.

| Check | Coverage |
| --- | --- |
| Input and focus | Keyboard, pointer, existing touchscreen controls, manual alternatives to sheet dragging, duplicate activation, native form reset, retained failed submissions, cancelled and out-of-order results, unmount during a pending request, nested Escape and focus restoration |
| Accessibility | Axe WCAG A/AA rules for disabled, pending, invalid, resolved and open-dialog states. Named focus targets and error association. Forced-colors and doubled text. |
| Layout | 320 CSS-pixel reflow, landscape phone, tablet, desktop, narrow parent within a desktop, viewport-height reduction, draft and focus across resize. The shorter viewport models keyboard occlusion. |
| Language and content | Nested light/dark providers, Arabic and Japanese, mixed-direction filename isolation, localized dates/numbers/plurals, failed avatar load, empty and 5,000-row collections |
| Motion | Reduced motion at start and during a sequence, interrupted and reversed timelines, navigation during a transition, repeated disclosure, swipe cancellation, normal content scrolling |
| Visual | 24 OS- and browser-specific comparisons of two design directions × two widths × two color schemes × Chromium, Firefox and WebKit. Keyboard focus and expanded content are visible in every baseline. |

```sh
npm run build
npx playwright test tests/browser/quality.spec.ts tests/browser/motion.spec.ts
npx playwright test -c tests/browser/motion.visual.config.ts
node --test tests/browser/quality-perf-check.mjs
node tests/browser/quality-perf.mjs
```

Run pixel comparisons on macOS 26 ARM64 with the lockfile browsers. The workflow compares against committed images and retains expected/actual/difference artifacts on failure. To propose a visual change, inspect each affected image on the matching host and run the comparison again without snapshot updates. Each screenshot allows a maximum differing-pixel ratio of 0.001.

The runtime gate opens and unmounts 24 command dialogs, enters a search against a 48-record workspace, scrolls a fixed 5,000-row grid in 40 steps and rapidly toggles an editorial disclosure. Chromium runs at 4× CPU throttling. The benchmark records the processor, OS, architecture, browser version and number of samples. The build directory can be passed as the first argument. The CLI writes the JSON summary, browser timeline and editorial recording to `test-results/ui-runtime/`. The macOS job retains them for seven days.

| Metric | Measurement |
| --- | --- |
| Dialog open | p95 time from activation to next animation frame with a mounted, named combobox |
| Search entry | p95 time from the input event to the next animation frame. The React hook counts commits per input. |
| Virtual grid | p95 duration of two animation frames after changing scroll position, peak number of mounted rows and visibility of the last record |
| Retained memory | Change in garbage-collected Chromium JS heap across the warmed dialog mount/unmount loop |
| Editorial disclosure | p95 frame interval across 100 frames and ten interruptions. The final disclosure and dismissed sheet state are asserted. |

The versioned baseline lists each measured value and its allowed absolute increase. The gate fails for absent, non-finite or over-budget metrics. Run this benchmark separately from other load generators before comparing results. The local timing measurements characterize this synthetic journey. Production Core Web Vitals, real input latency distributions and mobile device frame pacing require separate evidence. The iPhone keyboard, safe-area behavior on hardware, assistive-technology walkthroughs, lower-end Android, design sign-off and an independent engineer's adoption review remain open.
